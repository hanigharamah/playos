import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format } from "date-fns";
import { MessageCircle } from "lucide-react-native";
import { useGetMyBookings, useGameRoster, useReconfirmBooking, useGetOrCreateGameChat, type MyBooking } from "@/lib/api";
import { serverNow, syncServerTime } from "@/lib/serverTime";

/**
 * Match-day mini-bar (Figma 834:136 / 211 / 248 / 285, placement 834:470).
 *
 * Sits at the TOP of tab screens, not above the tab bar, so it never collides
 * with the floating nav or a pinned CTA — which is why no screen needs extra
 * bottom reserve. Tab screens add BAR_INSET to their top padding when it shows.
 *
 * Four live states. State 2 (834:174) is deliberately not built: it showed a
 * countdown across the eleven dead hours between T-12h and T-20m. The four
 * parked sub states (834:322 / 359 / 396 / 433) are v2.
 *
 * Every time here comes from the server clock. The bar is the surface that
 * tells someone they are about to lose their fee, so a wrong phone clock must
 * not be able to move it.
 */

/** Bar height plus the gap beneath it — what a screen adds to its top padding. */
export const BAR_INSET = 86;

const T12H_MS = 12 * 60 * 60_000;
const T20M_MS = 20 * 60_000;
const T10M_MS = 10 * 60_000;

type BarState = "reconfirm" | "checkin" | "atRisk" | "checkedIn";

const TONE: Record<BarState, { fill: string; accent: string; well: string }> = {
  // Tints and accents are verbatim from the four frames.
  reconfirm: { fill: "rgba(255,244,230,0.70)", accent: "#C96A00", well: "rgba(201,106,0,0.15)" },
  checkin:   { fill: "rgba(255,238,221,0.76)", accent: "#D4550A", well: "rgba(212,85,10,0.15)" },
  atRisk:    { fill: "rgba(255,233,233,0.78)", accent: "#BF2626", well: "rgba(191,38,38,0.15)" },
  checkedIn: { fill: "rgba(234,246,234,0.72)", accent: "#1F7A2C", well: "rgba(31,122,44,0.15)" },
};

/** "18:45" — minutes and seconds, which is what states 3 and 4 show. */
function mmss(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Time to the nearest future kickoff, or null if nothing is booked. Used only
 * to decide when to wake up next — `upcoming` is sorted by kickoff ascending,
 * so the first one still ahead of the clock is the soonest.
 */
function soonestKickoffMs(upcoming: MyBooking[] | undefined): number | null {
  for (const b of upcoming ?? []) {
    const ms = new Date(b.game.kickoffTime).getTime() - serverNow();
    if (ms > 0) return ms;
  }
  return null;
}

/**
 * Which booking, if any, the bar is for, and which state it is in. Returns
 * null when there is nothing to show — which is almost always.
 */
export function useMatchDayBar(): { booking: MyBooking; state: BarState } | null {
  const { data } = useGetMyBookings();
  const [tick, setTick] = useState(0);

  useEffect(() => { void syncServerTime(); }, []);

  // Both lists, not just `upcoming`: api.ts moves a booking to `past` the
  // instant the clock passes kickoff, so reading `upcoming` alone switched the
  // bar off at T+0 — taking the red "not checked in" state away from the one
  // player it exists for, at the exact minute their fee goes. The window runs
  // to T+20m, which is as long as the operator is still working the phone.
  const booking = [...(data?.upcoming ?? []), ...(data?.past ?? [])].find((b) => {
    const ms = new Date(b.game.kickoffTime).getTime() - serverNow();
    return ms <= T12H_MS && ms > -T20M_MS;
  });

  // Only tick when a tick can change something. This hook runs in all five tab
  // screens plus the bar, so an unconditional 1s interval re-rendered every tab
  // tree once a second for the whole session — on a week with nothing booked.
  // Outside T-12h we sleep until the window opens (capped so a resync still
  // lands); inside it, 30s until the last 20 minutes, then 1s.
  const nextMs = booking
    ? new Date(booking.game.kickoffTime).getTime() - serverNow()
    : soonestKickoffMs(data?.upcoming);
  const period =
    nextMs === null ? null
    : nextMs > T12H_MS ? Math.min(nextMs - T12H_MS, 30 * 60_000)
    : nextMs > T20M_MS ? 30_000
    : 1000;

  // setTimeout keyed on `tick`, not setInterval: every fire re-runs this effect,
  // so the delay is recomputed as the states approach instead of being frozen
  // at whatever it was when the interval was armed.
  useEffect(() => {
    if (period === null) return;
    const id = setTimeout(() => setTick((n) => n + 1), period);
    return () => clearTimeout(id);
  }, [period, tick]);

  if (!booking) return null;

  const msToKickoff = new Date(booking.game.kickoffTime).getTime() - serverNow();

  if (booking.checkedIn) return { booking, state: "checkedIn" };
  if (msToKickoff <= T10M_MS) return { booking, state: "atRisk" };
  if (msToKickoff <= T20M_MS) return { booking, state: "checkin" };
  // Answering makes the ask disappear. Taking the bar away IS the confirmation
  // — there is deliberately no success state.
  if (!booking.reconfirmedAt) return { booking, state: "reconfirm" };
  return null;
}

export function MatchDayBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const active = useMatchDayBar();
  const reconfirm = useReconfirmBooking();
  const gameChat = useGetOrCreateGameChat();
  const roster = useGameRoster(active?.state === "checkedIn" ? active.booking.gameId : null);

  if (!active) return null;

  const { booking, state } = active;
  const tone = TONE[state];
  const kickoff = new Date(booking.game.kickoffTime);
  const msToKickoff = kickoff.getTime() - serverNow();
  const open = () => router.push(`/match/${booking.gameId}`);

  // If the chat can't be opened — no booking, or the RPC not applied yet — fall
  // back to the match room rather than stranding the tap.
  const openChat = () =>
    gameChat.mutate(
      { gameId: booking.gameId },
      {
        onSuccess: (conversationId) => router.push(`/chat/${conversationId}`),
        onError: open,
      },
    );

  const copy = {
    reconfirm: {
      glyph: "?",
      title: "still coming tonight?",
      sub: `${booking.game.pitchName}  ·  ${format(kickoff, "h:mm aaa")}`,
    },
    checkin: {
      glyph: "→",
      title: "check in now",
      sub: `kickoff at ${format(kickoff, "h:mm aaa")}`,
    },
    atRisk: {
      glyph: "!",
      title: "not checked in",
      sub: "we are calling you now",
    },
    checkedIn: {
      glyph: "✓",
      title: "you are in",
      // Squad size is parametric — read capacity, never assume 12.
      sub: roster.data
        ? `${roster.data.checkedInCount} of ${roster.data.capacity} checked in  ·  teams forming`
        : "teams forming",
    },
  }[state];

  return (
    <View style={[styles.wrap, { top: insets.top + 5 }]} pointerEvents="box-none">
      <Pressable onPress={state === "reconfirm" ? undefined : open} style={styles.shadow}>
        <View style={styles.clip}>
          <BlurView intensity={Platform.OS === "ios" ? 12 : 0} tint="light" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tone.fill }]} />

          <View style={[styles.well, { backgroundColor: tone.well }]}>
            <Text style={[styles.glyph, { color: tone.accent }]}>{copy.glyph}</Text>
          </View>

          <View style={styles.text}>
            <Text style={[styles.title, { color: tone.accent }]} numberOfLines={1}>{copy.title}</Text>
            <Text style={styles.sub} numberOfLines={1}>{copy.sub}</Text>
          </View>

          {state === "reconfirm" ? (
            <Pressable
              onPress={() => reconfirm.mutate({ bookingId: booking.id })}
              disabled={reconfirm.isPending}
              style={styles.chipWrap}
            >
              <LinearGradient
                colors={["#FFDEA0", "#FEC15F", "#FDAA5F", "#EB6923"]}
                locations={[0, 0.35, 0.65, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.chip}
              >
                <Text style={styles.chipText}>yes, i am</Text>
              </LinearGradient>
            </Pressable>
          ) : state === "checkedIn" ? (
            // Once you are in, the countdown has done its job and the squad
            // chat is the live thing — so the bar's right-hand affordance
            // becomes chat, one tap from any screen. Fetched on tap only: this
            // component renders on every tab, and a standing query here is what
            // the timer fix just removed.
            <Pressable
              onPress={openChat}
              disabled={gameChat.isPending}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
              style={styles.chatBtn}
              accessibilityRole="button"
              accessibilityLabel="Open squad chat"
            >
              <MessageCircle size={17} color={tone.accent} strokeWidth={2.2} />
            </Pressable>
          ) : (
            <Text style={[styles.value, { color: tone.accent }]} numberOfLines={1}>
              {mmss(msToKickoff)}
            </Text>
          )}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Positioned from the safe-area inset, not the mock's literal y=52: that
  // number is smaller than the Dynamic Island's inset and would put the one
  // component a player cannot afford to miss underneath it.
  wrap: { position: "absolute", left: 16, right: 16, zIndex: 50 },
  shadow: {
    borderRadius: 28,
    shadowColor: "#8A6A4A", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  clip: {
    height: 64, borderRadius: 28, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.92)",
    flexDirection: "row", alignItems: "center", paddingHorizontal: 13,
  },

  well: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  glyph: { fontSize: 15, fontWeight: "700" },

  text: { flex: 1, marginLeft: 10 },
  title: { fontSize: 14, fontWeight: "600" },
  sub: { fontSize: 11.5, color: "#5F5F64", marginTop: 3 },

  value: { fontSize: 15, fontWeight: "700", textAlign: "right", minWidth: 56, fontVariant: ["tabular-nums"] },

  chipWrap: {
    shadowColor: "#EB6923", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 6,
  },
  chatBtn: { width: 40, height: 40, alignItems: "flex-end", justifyContent: "center" },
  chip: { width: 90, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
});
