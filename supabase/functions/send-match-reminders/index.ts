// PlayOS — send-match-reminders
//
// Invoked on a schedule (pg_cron, every 2-3 min). Finds games kicking off in
// ~18-22 minutes that haven't been notified yet, pushes each booked player a
// "match starting soon" notification deep-linking to /game/:id?matchday=1,
// and stamps games.reminder_sent_at so the ±2min window can't double-send.
//
// Deploy: supabase functions deploy send-match-reminders
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@domain
// Schedule: pg_cron -> select cron.schedule('match-reminders', '*/2 * * * *',
//   $$ select net.http_post(url:='https://<ref>.functions.supabase.co/send-match-reminders',
//        headers:='{"Authorization": "Bearer <service-role-or-anon-key>"}'::jsonb) $$);

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://playos.sa";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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

  let totalSent = 0;

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
      .select("id, endpoint, p256dh, auth")
      .in("user_id", userIds);

    const payload = JSON.stringify({
      title: game.title,
      body: "Starts in 20 min — tap to pick your team",
      url: `${SITE_URL}/game/${game.id}?matchday=1`,
      tag: `matchday-${game.id}`,
    });

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        totalSent++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }

    await supabase.from("games").update({ reminder_sent_at: new Date().toISOString() }).eq("id", game.id);
  }

  return new Response(JSON.stringify({ sent: totalSent, games: games.length }), { status: 200 });
});
