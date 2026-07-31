import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGameRoster, useClaimSide, useStartMatch, useGetGame, useGetMyBookings } from "@/lib/api";
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

  const claim = (team: 1 | 2) => {
    if (!id) return;
    claimSide.mutate(
      { gameId: id, team },
      {
        onSuccess: (result) => {
          if (result === "ok") {
            setClaimedTeam(team);
            track("matchday_flashcard_completed", { gameId: id, team });
          } else if (result === "not_checked_in") {
            Alert.alert("Check in first", "Scan the QR code at the pitch to check in before picking a side.");
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

  if (isLocked) {
    return (
      <View style={styles.wrap}>
        <GlassCard style={styles.card}>
          <Text style={styles.title}>Teams are locked in</Text>
          <Text style={styles.sub}>
            {roster.kickoffTeam === 1 ? "Yellow" : "Purple"} kicks off first.
          </Text>
          <PillButton label="Back to game" onPress={() => router.replace(`/game/${id}`)} fullWidth />
        </GlassCard>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <GlassCard style={styles.card}>
        <Text style={styles.title}>Pick your team</Text>
        <Text style={styles.sub}>{roster.checkedInCount} of {roster.capacity} checked in</Text>

        <View style={styles.teamsRow}>
          <PillButton
            label={`Yellow (${roster.yellowCount})`}
            variant={claimedTeam === 1 ? "primary" : "outline"}
            onPress={() => claim(1)}
            loading={claimSide.isPending}
          />
          <PillButton
            label={`Purple (${roster.purpleCount})`}
            variant={claimedTeam === 2 ? "secondary" : "outline"}
            onPress={() => claim(2)}
            loading={claimSide.isPending}
          />
        </View>

        {claimedTeam && <Text style={styles.confirmed}>You're on {claimedTeam === 1 ? "Yellow" : "Purple"} ✓</Text>}
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
  confirmed: { color: colors.success, fontWeight: "700" },
});
