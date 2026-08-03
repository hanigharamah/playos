import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGameRoster, useClaimSide, useStartMatch, useGetGame, useGetMyBookings, useCheckIn, MIN_PLAYERS_TO_START } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PillButton } from "@/components/PillButton";
import { GlassCard } from "@/components/GlassCard";
import { ReconnectingState, useIsOffline } from "@/components/ReconnectingState";
import { colors, spacing, radius } from "@/lib/theme";
import { screen, track } from "@/lib/analytics";

/**
 * Match-day flashcard — opened by tapping the T-20 push notification
 * (deep link `/match/:id`, wired in app/_layout.tsx) or from a "Match day"
 * banner on the game screen.
 *
 * Real flow, not a mock: check-in happens by scanning a pitch QR code at the
 * venue BEFORE this screen is useful (see SPEC.md "Match flow" note and the
 * web's /checkin/[pitchId] page + check_in_by_pitch RPC — porting that scan
 * screen is a separate SPEC item, since it's operator/venue-triggered, not
 * something this screen can self-serve). Here we show live roster, let a
 * checked-in player claim a side via the race-safe `claim_side` RPC, and
 * surface `start_match` once both sides are ready.
 */
export default function MatchDay() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: roster, isLoading, refetch } = useGameRoster(id ?? null);
  const { data: game } = useGetGame(id ?? "");
  const isOffline = useIsOffline();
  const { data: myBookings } = useGetMyBookings();
  const claimSide = useClaimSide();
  const startMatch = useStartMatch();
  const [claimedTeam, setClaimedTeam] = useState<1 | 2 | null>(null);

  useEffect(() => {
    screen("MatchDay", { gameId: id });
    track("matchday_flashcard_started", { gameId: id });
  }, [id]);

  // Search past as well as upcoming: the moment kickoff passes, useGetMyBookings
  // moves the booking to `past`, and this screen deliberately stays alive to
  // T+15. Looking only at `upcoming` told every player "not checked in yet"
  // from kickoff onward.
  const myBookingId = [...(myBookings?.upcoming ?? []), ...(myBookings?.past ?? [])]
    .find((b) => b.gameId === id)?.id;
  const myEntry = myBookingId ? roster?.entries.find((e) => e.bookingId === myBookingId) : undefined;
  const isLocked = !!roster?.teamsLockedAt;
  // Seed from the roster so a pick survives leaving and reopening the screen —
  // it was local state only, so both buttons looked unclaimed on return and
  // tapping either just produced an "already picked" alert.
  const shownTeam = claimedTeam ?? myEntry?.team ?? null;

  const [claimingTeam, setClaimingTeam] = useState<1 | 2 | null>(null);
  const checkIn = useCheckIn();

  const doCheckIn = () => {
    if (!id) return;
    checkIn.mutate({ gameId: id }, {
      onSuccess: (result) => {
        if (result === "ok" || result === "already_checked_in") return;
        Alert.alert(
          "Couldn't check in",
          result === "too_early" ? "Check-in opens 20 minutes before kickoff."
          : result === "too_late" ? "Check-in closed at kickoff — find the operator."
          : result === "no_booking" ? "You don't have a spot in this match."
          : "Please try again.",
        );
      },
      // The check_in RPC ships in supabase/2026-08-match-day.sql.
      onError: () => Alert.alert("Couldn't check in", "Check-in isn't available on this server yet."),
    });
  };

  const claim = (team: 1 | 2) => {
    if (!id) return;
    setClaimingTeam(team);
    claimSide.mutate(
      { gameId: id, team },
      {
        onSuccess: (result) => {
          if (result === "ok") {
            setClaimedTeam(team);
            track("matchday_flashcard_completed", { gameId: id, team });
          } else if (result === "not_checked_in") {
            // No QR, no geofence — check-in is a tap on the clock. The old copy
            // described the web app's pitch-scan flow, which is superseded.
            Alert.alert("Check in first", "Tap check in, then pick your side.");
          } else if (result === "full") {
            Alert.alert("Team full", "That side just filled up — try the other team.");
          } else if (result === "already_picked") {
            Alert.alert("Already picked", "You've already picked a side for this game.");
          }
        },
        onError: () => Alert.alert("Something went wrong", "Please try again."),
      },
    );
  };

  // Connection lost on match day (Figma 698:699). Shown ahead of the loading
  // spinner: the player needs to know their check-in survived, not watch a
  // spinner. The last known roster stays on screen, dimmed.
  if (isOffline) {
    return (
      <ReconnectingState
        pitchName={game?.pitchName ?? "your match"}
        kickoffTime={game?.kickoffTime ?? new Date().toISOString()}
        isCheckedIn={!!myEntry?.checkedIn}
        onRetry={() => void refetch()}
      />
    );
  }

  if (isLoading || !roster) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.orange} />
      </View>
    );
  }

  const canStart = roster.checkedInCount >= MIN_PLAYERS_TO_START;

  const start = () => {
    if (!id) return;
    startMatch.mutate({ gameId: id }, {
      onSuccess: (result) => {
        if (result === "ok" || result === "already_locked") {
          track("matchday_started", { gameId: id });
          return;
        }
        if (result === "too_few") {
          Alert.alert("Not enough players", `At least ${MIN_PLAYERS_TO_START} players need to be checked in.`);
        } else {
          Alert.alert("Couldn't start", "Please try again.");
        }
      },
      onError: () => Alert.alert("Couldn't start", "Please try again."),
    });
  };

  if (isLocked) {
    return (
      <View style={styles.wrap}>
        <GlassCard style={styles.card}>
          <Text style={styles.title}>Teams are locked in</Text>
          <Text style={styles.sub}>
            {roster.kickoffTeam === null
              ? "Kickoff side is being decided."
              : `${roster.kickoffTeam === 1 ? "Yellow" : "Purple"} kicks off first.`}
          </Text>
          <PillButton label="Back to game" onPress={() => router.replace(`/game/${id}`)} fullWidth />
        </GlassCard>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <GlassCard style={styles.card}>
        <Text style={styles.title}>{myEntry?.checkedIn ? "Pick your team" : "Check in"}</Text>
        <Text style={styles.sub}>{roster.checkedInCount} of {roster.capacity} checked in</Text>

        {!myEntry?.checkedIn && (
          <View style={{ width: "100%", marginTop: spacing.lg }}>
            <PillButton
              label={checkIn.isPending ? "checking in…" : "I'm here"}
              onPress={doCheckIn}
              loading={checkIn.isPending}
              fullWidth
            />
          </View>
        )}

        <View style={styles.teamsRow}>
          <PillButton
            label={`Yellow (${roster.yellowCount})`}
            variant={shownTeam === 1 ? "primary" : "outline"}
            onPress={() => claim(1)}
            loading={claimSide.isPending && claimingTeam === 1}
            disabled={claimSide.isPending || startMatch.isPending}
          />
          <PillButton
            label={`Purple (${roster.purpleCount})`}
            variant={shownTeam === 2 ? "secondary" : "outline"}
            onPress={() => claim(2)}
            loading={claimSide.isPending && claimingTeam === 2}
            disabled={claimSide.isPending || startMatch.isPending}
          />
        </View>

        {shownTeam && <Text style={styles.confirmed}>You're on {shownTeam === 1 ? "Yellow" : "Purple"} ✓</Text>}

        {/* Locking teams runs the server-side coin flip and balances anyone who
            never picked. Gated on the decided auto-start floor. */}
        {canStart && (
          <View style={styles.startBlock}>
            <PillButton
              label={startMatch.isPending ? "starting…" : "lock teams and start"}
              onPress={start}
              loading={startMatch.isPending}
              fullWidth
            />
            <Text style={styles.startHint}>
              {roster.checkedInCount} checked in · balances anyone who hasn't picked
            </Text>
          </View>
        )}
        {!canStart && (
          <Text style={styles.startHint}>
            {MIN_PLAYERS_TO_START - roster.checkedInCount} more to check in before the match can start
          </Text>
        )}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.creamDeep },
  card: { width: "100%", maxWidth: 420, alignItems: "center", padding: spacing.xl, gap: spacing.md },
  title: { fontSize: 22, fontWeight: "800", color: colors.inkNavy, textAlign: "center" },
  sub: { fontSize: 14, color: colors.inkMuted, textAlign: "center" },
  teamsRow: { flexDirection: "row", gap: spacing.md, width: "100%" },
  startBlock: { marginTop: spacing.lg, width: "100%" },
  startHint: { fontSize: 12, color: colors.inkMuted, textAlign: "center", marginTop: spacing.sm },
  confirmed: { color: colors.success, fontWeight: "700" },
});
