import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { format, isToday } from "date-fns";
import { useGetGame, useOpsRoster, useIsOperator, useCancelMatch, type CancelReason } from "@/lib/api";
import { DotWaveBackground } from "@/components/DotWaveBackground";
import { WarmCanvas } from "@/components/WarmCanvas";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { Callout } from "@/components/Callout";
import { useServerCountdown } from "@/lib/serverTime";
import { screen } from "@/lib/analytics";

const INK = "#1C1C1E";
const MUTED = "#6C6C70";
const RED = "#BF2626";
const NAVY = "#1D3557";
const AMBER = "#C96A00";

const GLOWS = [
  { cx: 0.8, cy: 0.15, r: 0.9, color: "rgba(255,225,204,0.35)" },
  { cx: 0.65, cy: 0.3, r: 0.6, color: "rgba(255,217,228,0.2)" },
];

const REASONS: { key: CancelReason; label: string }[] = [
  { key: "venue_closed", label: "venue closed" },
  { key: "weather", label: "weather" },
  { key: "not_enough_players", label: "not enough players" },
];

/** Destructive and irreversible, so the operator types this, not taps once. */
const CONFIRM_WORD = "CANCEL";

/**
 * Operator — cancel match (Figma 685:596).
 *
 * Fires the player-facing cancellation to every booked player and queues
 * refunds. Per the ratified policy: a PlayOS or venue cancellation refunds
 * CASH by default, the player may choose a game token instead, streak is
 * preserved either way, no XP either way, and after 48 hours with no choice
 * we auto-refund cash. Game tokens expire in 30 days.
 *
 * Venue payout is deliberately not on this screen — it is a back-office
 * concern, and the callout says so explicitly so nobody assumes otherwise.
 */
export default function OpsCancelMatch() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data: game } = useGetGame(gameId!);
  const { data: isOperator, isLoading: roleLoading } = useIsOperator();
  const { data: roster } = useOpsRoster(gameId ?? null);
  const cancelMatch = useCancelMatch();

  const [reason, setReason] = useState<CancelReason>("venue_closed");
  const [typed, setTyped] = useState("");

  useEffect(() => { screen("OpsCancelMatch", { gameId }); }, [gameId]);

  const kickoff = game ? new Date(game.kickoffTime).getTime() : null;
  const { remainingMs } = useServerCountdown(kickoff);

  if (roleLoading) return <View style={styles.wrap} />;

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

  const players = roster?.length ?? 0;
  const toRefund = players * (game?.price ?? 0);

  const hours = Math.floor(remainingMs / 3_600_000);
  const mins = Math.floor((remainingMs % 3_600_000) / 60_000);
  const toKickoff = remainingMs <= 0 ? "kicked off" : hours > 0 ? `${hours}h to kickoff` : `${mins}m to kickoff`;

  const armed = typed.trim().toUpperCase() === CONFIRM_WORD && players > 0;

  const confirm = () => {
    cancelMatch.mutate(
      { gameId: gameId!, reason },
      {
        onSuccess: () => {
          Alert.alert("Match cancelled", `${players} ${players === 1 ? "player has" : "players have"} been notified.`);
          router.replace("/(tabs)");
        },
        // cancel_match ships in supabase/2026-07-operator-surface.sql, which is
        // not yet applied. Surface the real failure rather than reporting a
        // cancellation that never reached a single player.
        onError: () => Alert.alert(
          "Couldn't cancel",
          "The cancellation action isn't available on this server yet. No player has been notified and no refund was queued.",
        ),
      },
    );
  };

  return (
    <View style={styles.wrap}>
      <WarmCanvas base="#FFF8F0" glows={GLOWS} />
      <View style={styles.dotWrap}><DotWaveBackground width={width} height={600} /></View>

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <HandwrittenHeader style={styles.title}>cancel match?</HandwrittenHeader>
          {game && (
            <Text style={styles.subtitle}>
              {Math.floor(game.capacity / 2)}v{Math.floor(game.capacity / 2)} {game.pitchName}
              {"  ·  "}
              {isToday(new Date(game.kickoffTime)) ? "today" : format(new Date(game.kickoffTime), "EEE")}
              {" "}{format(new Date(game.kickoffTime), "HH:mm")}
            </Text>
          )}
        </View>
        <View style={styles.opsChip}><Text style={styles.opsChipText}>OPERATOR</Text></View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsCard}>
          <View>
            <Text style={styles.statNum}>{players}</Text>
            <Text style={styles.statLabel}>PLAYERS</Text>
          </View>
          <View>
            <Text style={styles.statMoney}>SAR {toRefund}</Text>
            <Text style={styles.statLabel}>TO REFUND</Text>
          </View>
          <Text style={styles.toKickoff}>{toKickoff}</Text>
        </View>

        <HandwrittenHeader style={styles.sectionLabel}>reason</HandwrittenHeader>
        <View style={styles.reasonRow}>
          {REASONS.map((r) => {
            const active = r.key === reason;
            return (
              <Pressable
                key={r.key}
                onPress={() => setReason(r.key)}
                style={[styles.reasonChip, active && styles.reasonChipActive]}
              >
                <Text style={[styles.reasonText, active && styles.reasonTextActive]}>{r.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.firesCard}>
          <Text style={styles.firesTitle}>what fires</Text>
          {[
            `push + in-app to all ${players} ${players === 1 ? "player" : "players"}`,
            "every booking moves to refund_pending",
            "each player picks cash or a game token",
            "no XP either way, no game was played",
            "48h with no choice, we auto-refund cash",
          ].map((line) => (
            <View key={line} style={styles.firesRow}>
              <Text style={styles.firesArrow}>→</Text>
              <Text style={styles.firesText}>{line}</Text>
            </View>
          ))}
        </View>

        <Callout
          tone="blocker"
          icon={<Text style={styles.bang}>!</Text>}
          title="the venue is not refunded automatically"
          body={`settle the pitch fee with ${game?.pitchName ?? "the venue"} yourself. this only moves player money.`}
          style={{ marginTop: 16 }}
        />

        {/* Typed confirmation — the annotation requires more than one tap. */}
        <Text style={styles.confirmLabel}>type {CONFIRM_WORD} to confirm</Text>
        <TextInput
          style={styles.confirmInput}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={CONFIRM_WORD}
          placeholderTextColor="#ADADB2"
        />

        <Pressable onPress={confirm} disabled={!armed || cancelMatch.isPending} style={!armed && styles.ctaOff}>
          <LinearGradient
            colors={["#E86A6A", "#D13B3B", "#8F1B1B"]}
            locations={[0, 0.5, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>
              {cancelMatch.isPending
                ? "cancelling…"
                : `cancel match and notify ${players} ${players === 1 ? "player" : "players"}`}
            </Text>
          </LinearGradient>
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
  wrap: { flex: 1, backgroundColor: "#FFF8F0", paddingTop: 52 },
  centre: { alignItems: "center", justifyContent: "center" },
  dotWrap: { ...StyleSheet.absoluteFillObject, opacity: 0.35 / 0.75 },

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

  statsCard: { ...card, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", minHeight: 84, borderRadius: 20, paddingHorizontal: 19, paddingTop: 17 },
  statNum: { fontSize: 30, fontWeight: "700", color: INK },
  statMoney: { fontSize: 26, fontWeight: "700", color: INK, marginTop: 2 },
  statLabel: { fontSize: 10, fontWeight: "600", color: MUTED, marginTop: 6, letterSpacing: 0.3 },
  toKickoff: { fontSize: 13, fontWeight: "600", color: AMBER, marginTop: 12 },

  sectionLabel: { fontSize: 22, color: "#FF9F0A", marginTop: 24, marginBottom: 12 },
  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  reasonChip: {
    height: 36, borderRadius: 18, paddingHorizontal: 18, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.5)", borderWidth: 1, borderColor: "#ADADB2",
  },
  reasonChipActive: { backgroundColor: "#F28C26", borderWidth: 1.5, borderColor: "#F28C26" },
  reasonText: { fontSize: 12.5, fontWeight: "600", color: MUTED },
  reasonTextActive: { color: "#FFFFFF" },

  firesCard: { ...card, borderRadius: 24, marginTop: 22, paddingHorizontal: 19, paddingVertical: 17 },
  firesTitle: { fontSize: 13, fontWeight: "600", color: INK },
  firesRow: { flexDirection: "row", marginTop: 14 },
  firesArrow: { fontSize: 12, fontWeight: "700", color: "#FA810B", width: 22 },
  firesText: { flex: 1, fontSize: 13, color: MUTED },

  bang: { fontSize: 13, fontWeight: "700", color: RED },

  confirmLabel: { fontSize: 12, fontWeight: "600", color: MUTED, marginTop: 26, marginLeft: 4, letterSpacing: 0.3 },
  confirmInput: {
    ...card, height: 52, borderRadius: 16, marginTop: 10, paddingHorizontal: 17,
    fontSize: 16, fontWeight: "700", color: INK, letterSpacing: 1,
  },

  ctaOff: { opacity: 0.4 },
  cta: {
    height: 56, borderRadius: 28, marginTop: 20, alignItems: "center", justifyContent: "center",
    shadowColor: "#8F1B1B", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 6,
  },
  ctaText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
});
