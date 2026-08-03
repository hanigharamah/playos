import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, Linking, Alert, useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format, formatDistanceToNowStrict, isToday } from "date-fns";
import { useGetGame, useOpsRoster, useIsOperator, useReleaseSpot } from "@/lib/api";
import { AUTO_CANCEL_MIN_CHECKED_IN } from "@/lib/refunds";
import { DotWaveBackground } from "@/components/DotWaveBackground";
import { WarmCanvas } from "@/components/WarmCanvas";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { Callout } from "@/components/Callout";
import { Avatar } from "@/components/Avatar";
import { useServerCountdown, serverNow } from "@/lib/serverTime";
import { screen, track } from "@/lib/analytics";

const INK = "#1C1C1E";
const MUTED = "#6C6C70";
const RED = "#BF2626";
const NAVY = "#1D3557";
const AMBER = "#C96A00";

const GLOWS = [
  { cx: 0.8, cy: 0.15, r: 0.9, color: "rgba(255,225,204,0.35)" },
  { cx: 0.65, cy: 0.3, r: 0.6, color: "rgba(255,217,228,0.2)" },
];

/** The at-risk review opens 10 minutes before kickoff. */
const AT_RISK_MINUTES_BEFORE = 10;

/**
 * Operator — match at risk at T-10 (Figma 685:502).
 *
 * Entry: confirmed check-ins are below the viable threshold ten minutes before
 * kickoff. Three actions: call the unchecked players, release a spot, or
 * cancel the match.
 *
 * Two rules from the annotation are load-bearing:
 *  - ops chrome, never mistakable for a player screen: dot wave at 0.35 and
 *    the navy OPERATOR chip
 *  - a single shared admin login means no attribution, so every action is
 *    logged with a timestamp and the operator initial captured at entry
 *
 * The mock also shows a per-player no-show count ("0 no-shows"). Nothing
 * tracks no-shows yet — `payment_status` has no terminal state for one, see
 * supabase/2026-07-booking-integrity.sql — so it is omitted rather than
 * printed as a zero that would look authoritative and always read "0".
 */
export default function OpsAtRisk() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data: game } = useGetGame(gameId!);
  const { data: isOperator, isLoading: roleLoading } = useIsOperator();
  const { data: roster } = useOpsRoster(gameId ?? null);
  const releaseSpot = useReleaseSpot();
  const [operatorInitial, setOperatorInitial] = useState<string | null>(null);

  useEffect(() => { screen("OpsAtRisk", { gameId }); }, [gameId]);

  const kickoff = game ? new Date(game.kickoffTime).getTime() : null;
  const { remainingMs } = useServerCountdown(kickoff);

  // Ask once per visit. A shared login means the initial is the only
  // attribution the audit log will ever have.
  useEffect(() => {
    if (!isOperator || operatorInitial) return;
    Alert.prompt?.(
      "Operator initial",
      "Every action on this screen is logged against it.",
      (value) => setOperatorInitial((value ?? "").trim().slice(0, 3).toUpperCase() || "??"),
    );
  }, [isOperator, operatorInitial]);

  if (roleLoading) return <View style={[styles.wrap, { paddingTop: insets.top + 5 }]} />;

  // Players must never reach this screen, even by deep link.
  if (!isOperator) {
    return (
      <View style={[styles.wrap, styles.centre]}>
        <Text style={styles.denied}>This screen is for match operators.</Text>
        <Pressable onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.deniedLink}>back to home</Text>
        </Pressable>
      </View>
    );
  }

  const entries = roster ?? [];
  const checkedIn = entries.filter((e) => e.checkedIn).length;
  const missing = entries.length - checkedIn;
  const capacity = game?.capacity ?? entries.length;
  const notCheckedIn = entries.filter((e) => !e.checkedIn);

  const minsToKickoff = Math.floor(remainingMs / 60_000);
  const clockLabel = remainingMs <= 0 ? "KICKOFF" : `T-${minsToKickoff}`;

  const call = (entry: (typeof entries)[number]) => {
    if (!entry.phone) return;
    track("ops_called_player", { gameId, bookingId: entry.bookingId, by: operatorInitial });
    void Linking.openURL(`tel:${entry.phone.replace(/[^+\d]/g, "")}`);
  };

  const release = (entry: (typeof entries)[number]) => {
    Alert.alert(
      `Release ${entry.name}'s spot?`,
      "They lose the spot and the money. Only do this after calling.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Release",
          style: "destructive",
          onPress: () =>
            releaseSpot.mutate(
              { bookingId: entry.bookingId, gameId: gameId!, operatorInitial: operatorInitial ?? "??" },
              {
                onSuccess: (result) => {
                  if (result === "ok") return;
                  Alert.alert("Not released", result === "already_released" ? "That spot was already released." : "You don't have permission to do that.");
                },
                // The release_spot RPC ships in 2026-07-operator-surface.sql.
                // Until that migration is applied this surfaces the real error
                // rather than showing a spot as released when it isn't.
                onError: () => Alert.alert("Couldn't release", "The release action isn't available yet on this server."),
              },
            ),
        },
      ],
    );
  };

  return (
    <View style={styles.wrap}>
      <WarmCanvas base="#FFF8F0" glows={GLOWS} />
      {/* 0.35, not the player-facing 0.75 — ops chrome must read differently. */}
      <DotWaveBackground width={width} height={600} opacity={0.35} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <HandwrittenHeader style={styles.title}>match day</HandwrittenHeader>
          {game && (
            <Text style={styles.subtitle}>
              {game.pitchName}  ·  kickoff {format(new Date(game.kickoffTime), "HH:mm")}
            </Text>
          )}
        </View>
        <View style={styles.opsChip}>
          <Text style={styles.opsChipText}>OPERATOR</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Live counts */}
        <View style={styles.statsCard}>
          <View>
            <Text style={styles.statNum}>{checkedIn}</Text>
            <Text style={styles.statLabel}>CHECKED IN</Text>
          </View>
          <View>
            <Text style={[styles.statNum, checkedIn < AUTO_CANCEL_MIN_CHECKED_IN && styles.statNumBad]}>{missing}</Text>
            <Text style={styles.statLabel}>MISSING</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.clock}>{clockLabel}</Text>
            {/* The T-10 rule is the auto-cancel floor, not capacity and not the
              T+15 start floor. Showing capacity told the operator two more
              were needed when the ratified threshold had already been met. */}
          <Text style={styles.statLabel}>AUTO-CANCEL BELOW {AUTO_CANCEL_MIN_CHECKED_IN}</Text>
          </View>
        </View>

        <Callout
          tone="neutral"
          icon={<Text style={styles.phoneGlyph}>☎</Text>}
          title="call them now, in this order"
          body="longest-standing booking first. coming means grace, can't make it means release now, no answer means release after the attempt."
          style={styles.callout}
        />

        <HandwrittenHeader style={styles.sectionLabel}>not checked in</HandwrittenHeader>

        {notCheckedIn.length === 0 && (
          <Text style={styles.allIn}>everyone is checked in</Text>
        )}

        {notCheckedIn.map((entry) => (
          <View key={entry.bookingId} style={styles.row}>
            <Avatar name={entry.name} size={48} />
            <View style={styles.rowText}>
              <Text style={styles.rowName} numberOfLines={1}>{entry.name}</Text>
              <Text style={styles.rowMeta}>
                {isToday(new Date(entry.bookedAt))
                  ? "booked today"
                  : `booked ${formatDistanceToNowStrict(new Date(entry.bookedAt))} ago`}
              </Text>
              <View style={styles.riskChip}>
                <Text style={styles.riskChipText}>at risk</Text>
              </View>
            </View>

            {/* Only offer the call when there is a number behind it. */}
            {entry.phone && (
              <Pressable style={styles.callBtn} onPress={() => call(entry)}>
                <Text style={styles.callBtnText}>call</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.releaseBtn}
              onPress={() => release(entry)}
              disabled={releaseSpot.isPending}
            >
              <Text style={styles.releaseBtnText}>release</Text>
            </Pressable>
          </View>
        ))}

        <Text style={styles.footnote}>players never see who is flagged</Text>

        {/* Third action from the annotation: cancel opens the operator
            cancel-match flow. */}
        <Pressable style={styles.cancelLink} onPress={() => router.push(`/ops/cancel/${gameId}`)}>
          <Text style={styles.cancelLinkText}>cancel this match</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const card = {
  backgroundColor: "rgba(255,255,255,0.55)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.85)",
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.12,
  shadowRadius: 8,
  elevation: 3,
};

const styles = StyleSheet.create({
  // paddingTop comes from the safe-area inset at the call site; the fixed
  // value was smaller than the Dynamic Island's inset.
  wrap: { flex: 1, backgroundColor: "#FFF8F0" },
  centre: { alignItems: "center", justifyContent: "center" },

  denied: { fontSize: 15, color: INK },
  deniedLink: { fontSize: 15, fontWeight: "600", color: AMBER, marginTop: 12 },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20 },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
  },
  backGlyph: { fontSize: 20, fontWeight: "700", color: INK, lineHeight: 22 },
  headerText: { flex: 1, marginLeft: 14 },
  title: { fontSize: 26, color: "#FA810B" },
  subtitle: { fontSize: 12.5, color: MUTED, marginTop: 2 },
  opsChip: { height: 26, borderRadius: 13, paddingHorizontal: 14, backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
  opsChipText: { fontSize: 10, fontWeight: "700", color: "#FFFFFF", letterSpacing: 0.4 },

  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 60 },

  statsCard: { ...card, flexDirection: "row", justifyContent: "space-between", minHeight: 84, borderRadius: 20, paddingHorizontal: 19, paddingTop: 17 },
  statNum: { fontSize: 30, fontWeight: "700", color: INK },
  statNumBad: { color: RED },
  statLabel: { fontSize: 10, fontWeight: "600", color: MUTED, marginTop: 6, letterSpacing: 0.3 },
  clock: { fontSize: 22, fontWeight: "700", color: AMBER, marginTop: 6 },

  callout: { marginTop: 14 },
  phoneGlyph: { fontSize: 13, fontWeight: "700", color: NAVY },

  sectionLabel: { fontSize: 22, color: "#FF9F0A", marginTop: 28, marginBottom: 14 },
  allIn: { fontSize: 14, color: MUTED, marginLeft: 4 },

  row: { ...card, flexDirection: "row", alignItems: "center", minHeight: 72, borderRadius: 18, paddingHorizontal: 9, paddingVertical: 11, marginBottom: 12 },
  rowText: { flex: 1, marginLeft: 10 },
  rowName: { fontSize: 15, fontWeight: "600", color: INK },
  rowMeta: { fontSize: 12, color: MUTED, marginTop: 4 },
  riskChip: { alignSelf: "flex-start", height: 20, borderRadius: 10, paddingHorizontal: 10, marginTop: 6, backgroundColor: "rgba(191,38,38,0.12)", justifyContent: "center" },
  riskChipText: { fontSize: 10, fontWeight: "600", color: RED },

  callBtn: { height: 36, minWidth: 44, borderRadius: 18, paddingHorizontal: 12, backgroundColor: "#F28C26", alignItems: "center", justifyContent: "center" },
  callBtnText: { fontSize: 12, fontWeight: "600", color: "#FFFFFF" },
  releaseBtn: {
    height: 36, minWidth: 50, borderRadius: 18, paddingHorizontal: 10, marginLeft: 8,
    backgroundColor: "rgba(255,255,255,0.4)", borderWidth: 1.5, borderColor: RED,
    alignItems: "center", justifyContent: "center",
  },
  releaseBtnText: { fontSize: 11, fontWeight: "600", color: RED },

  footnote: { fontSize: 12.5, color: MUTED, textAlign: "center", marginTop: 18 },
  cancelLink: { alignItems: "center", marginTop: 28 },
  cancelLinkText: { fontSize: 14, fontWeight: "600", color: RED },
});
