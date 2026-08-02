import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { format, isSameDay } from "date-fns";
import * as Notifications from "expo-notifications";
import { useGetGame, useGetMyBookings } from "@/lib/api";
import { DotWaveBackground } from "@/components/DotWaveBackground";
import { WarmCanvas } from "@/components/WarmCanvas";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { Btn3D } from "@/components/Btn3D";
import { BtnOutline } from "@/components/BtnOutline";
import { Callout } from "@/components/Callout";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import { useServerCountdown, formatCountdown, serverNow } from "@/lib/serverTime";
import { colors } from "@/lib/theme";
import { shouldPromptForNotifications } from "@/app/permission/notifications";
import { screen } from "@/lib/analytics";

const INK = "#1C1C1E";
const MUTED = "#6C6C70";
const GREEN = "#268033";

const GLOWS = [
  { cx: 0.8, cy: 0.15, r: 0.9, color: "rgba(255,225,204,0.35)" },
  { cx: 0.65, cy: 0.3, r: 0.6, color: "rgba(255,217,228,0.2)" },
];

/** The window opens 20 minutes before kickoff. */
const CHECK_IN_OPENS_MINUTES_BEFORE = 20;

/**
 * Check-in isn't open yet (Figma 684:542).
 *
 * A waiting state, not an error — no red, no retry button, per the
 * annotation. Three rules from the same note are load-bearing:
 *
 *  - the countdown runs on the SERVER clock, never the device clock, so a
 *    wrong phone clock can't open the window early (see lib/serverTime.ts)
 *  - the screen swaps itself to the live check-in the moment the window
 *    opens; the player never has to refresh
 *  - show the exact time the button goes live, not a relative countdown
 *    alone — the mock's sub-label is extended with the wall-clock time
 *
 * The Live Activity is the primary check-in surface; this is the fallback
 * for players who open the app early.
 */
export default function CheckInNotOpen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data: game, isLoading } = useGetGame(gameId!);
  const { data: bookings } = useGetMyBookings();
  const [reminderSet, setReminderSet] = useState(false);

  useEffect(() => { screen("CheckInNotOpen", { gameId }); }, [gameId]);

  const kickoff = game ? new Date(game.kickoffTime).getTime() : null;
  const opensAt = kickoff === null ? null : kickoff - CHECK_IN_OPENS_MINUTES_BEFORE * 60_000;
  const { remainingMs, synced } = useServerCountdown(opensAt);

  // Swap to the live check-in the instant the window opens — no refresh.
  useEffect(() => {
    if (opensAt === null) return;
    // Wait for the server clock before opening the window. Without this the
    // first render used raw device time, so a phone set an hour fast walked
    // straight into check-in — the one thing this screen exists to prevent.
    if (!synced) return;
    if (remainingMs <= 0 && serverNow() >= opensAt) router.replace(`/match/${gameId}`);
  }, [synced, remainingMs, opensAt, gameId, router]);

  const booking = bookings?.upcoming?.find((b) => b.gameId === gameId);

  const scheduleReminder = async () => {
    if (opensAt === null) return;
    const { status: existing } = await Notifications.getPermissionsAsync();
    const status = existing === "granted" ? existing : (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") {
      // Respect the "must not reappear more than twice" rule instead of
      // pushing the primer every time the button is tapped.
      if (await shouldPromptForNotifications()) router.push("/permission/notifications");
      return;
    }
    // A local notification, so it fires whether or not the backend is up.
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "check-in is open",
        body: game ? `${game.title} — tap to check in` : "tap to check in",
        data: { url: `/match/${gameId}` },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(opensAt) },
    });
    setReminderSet(true);
  };

  if (isLoading || !game) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.orange} />
      </View>
    );
  }

  const kickoffDate = new Date(game.kickoffTime);
  const teamSize = game.capacity / 2;

  return (
    <View style={styles.wrap}>
      <WarmCanvas base="#FFF8F0" glows={GLOWS} />
      <DotWaveBackground width={width} height={600} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <HandwrittenHeader style={styles.title}>check-in isn't open yet</HandwrittenHeader>
      </View>

      {/* Match card */}
      <View style={styles.matchCard}>
        <Image source={{ uri: getVenuePhoto(game.pitchName, game.pitchPhotoUrl) }} style={styles.thumb} />
        <View style={styles.matchText}>
          <Text style={styles.matchTitle} numberOfLines={1}>{teamSize}v{teamSize}  ·  {game.pitchName}</Text>
          <Text style={styles.matchSub}>
            {isSameDay(kickoffDate, new Date()) ? "Today" : format(kickoffDate, "EEE")}  ·  {format(kickoffDate, "h:mm a")}
          </Text>
          {/* Only claim "paid" when the booking actually says so. */}
          {booking && (
            <Text style={styles.matchStatus}>
              you're in{booking.paymentStatus === "paid" ? "  ·  paid" : ""}
            </Text>
          )}
        </View>
      </View>

      {/* Countdown */}
      <View style={styles.countCard}>
        <Text style={styles.countLabel}>check-in opens in</Text>
        <Text style={styles.countValue}>{formatCountdown(remainingMs)}</Text>
        {/* Exact wall-clock time as well as the countdown, per the annotation. */}
        <Text style={styles.countSub}>
          OPENS AT {format(new Date(opensAt ?? 0), "h:mm a").toUpperCase()}  ·  {CHECK_IN_OPENS_MINUTES_BEFORE} MINUTES BEFORE KICKOFF
        </Text>
      </View>

      <Callout
        tone="warning"
        icon={<Text style={styles.bang}>!</Text>}
        title="why there's a window"
        body="the roster freezes once teams start forming. checking in early wouldn't hold your place any better, and late check-ins would break the teams."
        style={styles.callout}
      />

      <View style={styles.actions}>
        <Btn3D
          label={reminderSet ? "we'll notify you" : "notify me when it opens"}
          disabled={reminderSet}
          onPress={scheduleReminder}
        />
        <BtnOutline label="back to the match" tone="neutral" onPress={() => router.replace(`/game/${gameId}`)} style={{ marginTop: 12 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0", paddingHorizontal: 20, paddingTop: 52 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF8F0" },

  header: { flexDirection: "row", alignItems: "center" },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
  },
  backGlyph: { fontSize: 20, fontWeight: "700", color: INK, lineHeight: 22 },
  title: { fontSize: 26, color: "#FA810B", marginLeft: 14, flex: 1 },

  matchCard: {
    flexDirection: "row", minHeight: 92, borderRadius: 18, marginTop: 26, padding: 11,
    backgroundColor: "rgba(255,255,255,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  thumb: { width: 68, height: 68, borderRadius: 14, backgroundColor: "#CFD8C4" },
  matchText: { flex: 1, marginLeft: 12, paddingTop: 6 },
  matchTitle: { fontSize: 16, fontWeight: "600", color: INK },
  matchSub: { fontSize: 13, color: MUTED, marginTop: 6 },
  matchStatus: { fontSize: 13, fontWeight: "600", color: GREEN, marginTop: 4 },

  countCard: {
    height: 150, borderRadius: 24, marginTop: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  countLabel: { fontSize: 13, color: MUTED },
  countValue: { fontSize: 48, fontWeight: "700", color: "#EB6923", marginTop: 4, fontVariant: ["tabular-nums"] },
  countSub: { fontSize: 11, fontWeight: "600", color: MUTED, marginTop: 10, textAlign: "center" },

  callout: { marginTop: 20 },
  bang: { fontSize: 13, fontWeight: "700", color: "#C96A00" },

  actions: { position: "absolute", left: 20, right: 20, bottom: 40 },
});
