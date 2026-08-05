// PlayOS — send-match-reminders
//
// Invoked on a schedule (pg_cron, every 2-3 min). Finds games kicking off in
// ~18-22 minutes that haven't been notified yet, pushes each booked player a
// "match starting soon" notification deep-linking to the match, and stamps
// games.reminder_sent_at so the ±2min window can't double-send.
//
// TWO TRANSPORTS, one per row shape. push_subscriptions holds both:
//
//   endpoint + p256dh + auth  -> a browser, delivered by VAPID web-push
//   expo_push_token           -> a phone, delivered by Expo's push service
//
// This function used to select only the web columns and send only via VAPID.
// Once 2026-08-expo-push-tokens.sql let phones register at all, that became
// the next silent failure in the chain: a device would register successfully
// and still receive nothing, because its row has a null endpoint and web-push
// would be handed undefined. One player may have both a laptop and a phone,
// and should be reached on both.
//
// Deploy: supabase functions deploy send-match-reminders
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@domain
// Schedule: already live as the 'match-reminders' pg_cron job.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");
const SITE_URL = Deno.env.get("SITE_URL") || "https://playos.sa";

/** The app's URL scheme, from app.json. Native deep links are not http. */
const APP_SCHEME = "playos";

/**
 * VAPID keys are optional now.
 *
 * They were read with `!` and used at module scope, so a project with phones
 * registered but no web push configured would throw on cold start and take
 * the native reminders down with it. Web sending is skipped instead, and the
 * response says so.
 */
const webPushReady = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
if (webPushReady) {
  webpush.setVapidDetails(VAPID_SUBJECT!, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** Expo's documented cap per request. */
const EXPO_BATCH = 100;

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

/**
 * Send one batch to Expo and return the tokens Expo reports as dead.
 *
 * `DeviceNotRegistered` is the native equivalent of web-push's 404/410: the
 * app was uninstalled, or the token rotated. Pruning matters — a token that
 * can never deliver otherwise sits there forever, making the subscriber count
 * look healthier than it is.
 */
async function sendExpoBatch(
  messages: { to: string; title: string; body: string; data: unknown; channelId: string; sound: string }[],
): Promise<{ sent: number; dead: string[] }> {
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    // A transport failure is NOT a dead token. Returning no dead tokens means
    // the rows survive and the next run retries, which is right: this fires
    // every two minutes, so a reminder is only lost if every attempt in the
    // window fails.
    console.error("expo push HTTP", res.status, await res.text());
    return { sent: 0, dead: [] };
  }

  const body = (await res.json()) as { data?: ExpoTicket[] };
  const tickets = body.data ?? [];
  const dead: string[] = [];
  let sent = 0;

  tickets.forEach((t, i) => {
    if (t.status === "ok") {
      sent++;
      return;
    }
    if (t.details?.error === "DeviceNotRegistered") dead.push(messages[i].to);
    else console.error("expo push ticket error", t.details?.error, t.message);
  });

  return { sent, dead };
}

Deno.serve(async (_req) => {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 18 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 22 * 60 * 1000).toISOString();

  const { data: games, error: gamesErr } = await supabase
    .from("games")
    .select("id, title")
    .neq("status", "cancelled")
    .is("reminder_sent_at", null)
    .gte("kickoff_time", windowStart)
    .lte("kickoff_time", windowEnd);

  if (gamesErr) {
    return new Response(JSON.stringify({ error: gamesErr.message }), { status: 500 });
  }
  if (!games?.length) {
    return new Response(JSON.stringify({ sent: 0, games: 0 }), { status: 200 });
  }

  let sentWeb = 0;
  let sentNative = 0;

  for (const game of games) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("user_id")
      .eq("game_id", game.id)
      .in("payment_status", ["paid", "pending"])
      .not("user_id", "is", null);

    const userIds = [...new Set((bookings ?? []).map((b) => b.user_id as string))];
    if (userIds.length === 0) {
      await supabase.from("games").update({ reminder_sent_at: new Date().toISOString() }).eq("id", game.id);
      continue;
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, expo_push_token")
      .in("user_id", userIds);

    const title = game.title;
    const body = "Starts in 20 min — tap to pick your team";

    // ── Web: VAPID ──────────────────────────────────────────────────────────
    const webSubs = (subs ?? []).filter((s) => s.endpoint && s.p256dh && s.auth);
    if (webSubs.length > 0 && webPushReady) {
      const payload = JSON.stringify({
        title,
        body,
        url: `${SITE_URL}/game/${game.id}?matchday=1`,
        tag: `matchday-${game.id}`,
      });
      for (const sub of webSubs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint!, keys: { p256dh: sub.p256dh!, auth: sub.auth! } },
            payload,
          );
          sentWeb++;
        } catch (err) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      }
    }

    // ── Native: Expo ────────────────────────────────────────────────────────
    const tokens = [...new Set((subs ?? []).map((s) => s.expo_push_token).filter(Boolean) as string[])];
    for (let i = 0; i < tokens.length; i += EXPO_BATCH) {
      const messages = tokens.slice(i, i + EXPO_BATCH).map((to) => ({
        to,
        title,
        body,
        // A native deep link uses the app's scheme, not an https URL — https
        // would open the browser, which is not where the match room is.
        data: { url: `${APP_SCHEME}://game/${game.id}?matchday=1`, gameId: game.id },
        // Matches the defaultChannel declared in app.json. Android drops
        // notifications addressed to a channel that does not exist.
        channelId: "match-reminders",
        sound: "default",
      }));

      const { sent, dead } = await sendExpoBatch(messages);
      sentNative += sent;
      if (dead.length > 0) {
        await supabase.from("push_subscriptions").delete().in("expo_push_token", dead);
      }
    }

    await supabase.from("games").update({ reminder_sent_at: new Date().toISOString() }).eq("id", game.id);
  }

  return new Response(
    JSON.stringify({
      sent: sentWeb + sentNative,
      web: sentWeb,
      native: sentNative,
      games: games.length,
      // Surfaced rather than silent: phones registered with no VAPID keys is a
      // normal state now, and "web: 0" should not read as a failure.
      webPushConfigured: webPushReady,
      // NOT filtered by notification_preferences. That table does not exist --
      // 2026-07-notification-preferences.sql has never been applied -- so
      // there is nothing to consult, and every booked player gets the T-20
      // reminder. Apply that migration before adding per-message opt-outs.
      respectsPreferences: false,
    }),
    { status: 200 },
  );
});
