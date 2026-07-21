import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Star, Trophy, Users2 } from "lucide-react-native";
import { useGetGame, useSubmitMatchStats } from "@/lib/api";
import { PillButton } from "@/components/PillButton";
import { GlassCard } from "@/components/GlassCard";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { colors, radius, spacing } from "@/lib/theme";
import { screen, track } from "@/lib/analytics";

/**
 * "great game!" — self-reported post-match stats. There's no referee or
 * automated tracking system, so goals/assists/distance/rating are entered
 * by the player themselves (a real, working feature — not a mockup with
 * fabricated numbers). RLS (see 2026-07-activity-and-stats.sql) only lets
 * this be submitted for a game the player actually checked into, within
 * 24h of it ending.
 */
export default function PostMatch() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: game } = useGetGame(id!);
  const submitStats = useSubmitMatchStats();

  const [goals, setGoals] = useState("0");
  const [assists, setAssists] = useState("0");
  const [rating, setRating] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { screen("PostMatch", { gameId: id }); }, [id]);

  const submit = () => {
    if (!id) return;
    setError(null);
    submitStats.mutate(
      { gameId: id, goals: Number(goals) || 0, assists: Number(assists) || 0, rating: rating ?? undefined },
      {
        onSuccess: () => {
          track("match_stats_submitted", { gameId: id, goals: Number(goals), assists: Number(assists), rating });
          setSubmitted(true);
        },
        onError: (err: any) => setError(err?.data?.error ?? "Could not submit — you may not be checked in to this game, or the 24h window has closed."),
      },
    );
  };

  if (submitted) {
    const xpGained = 100 + Number(goals) * 20 + Number(assists) * 10;
    return (
      <View style={styles.wrap}>
        <HandwrittenHeader style={styles.celebrateTitle}>great game! 🔥</HandwrittenHeader>
        <Text style={styles.celebrateSub}>here's how you did</Text>

        <GlassCard style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.ratingLabel}>match rating</Text>
              <Text style={styles.ratingValue}>{rating ?? "—"}</Text>
            </View>
            <View style={styles.xpBadge}>
              <Text style={styles.xpBadgeText}>+{xpGained} XP</Text>
            </View>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statCol}><Text style={styles.statNum}>{goals}</Text><Text style={styles.statLabel}>GOALS</Text></View>
            <View style={styles.statCol}><Text style={styles.statNum}>{assists}</Text><Text style={styles.statLabel}>ASSISTS</Text></View>
          </View>
        </GlassCard>

        <View style={styles.actions}>
          <PillButton label="view your activity" onPress={() => router.push("/activity")} fullWidth />
          <Pressable onPress={() => router.push("/(tabs)")}><Text style={styles.backLink}>back to home</Text></Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.formTitle}>How did it go?</Text>
      <Text style={styles.formSub}>{game?.title ?? "Your match"}</Text>

      <GlassCard style={styles.formCard}>
        <Text style={styles.fieldLabel}>Rate your performance</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)}>
              <Star size={20} color={colors.orange} fill={rating != null && n <= rating ? colors.orange : "transparent"} />
            </Pressable>
          ))}
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}><Trophy size={13} color={colors.inkMuted} /> Goals</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={goals} onChangeText={setGoals} />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}><Users2 size={13} color={colors.inkMuted} /> Assists</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={assists} onChangeText={setAssists} />
          </View>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {submitStats.isPending ? (
          <ActivityIndicator color={colors.orange} style={{ marginTop: spacing.lg }} />
        ) : (
          <View style={{ marginTop: spacing.lg }}>
            <PillButton label="Submit" onPress={submit} fullWidth />
          </View>
        )}
      </GlassCard>

      <Pressable onPress={() => router.push("/(tabs)")}><Text style={styles.skipLink}>skip for now</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep, padding: spacing.xl, paddingTop: spacing.xxl * 1.5, alignItems: "center" },
  formTitle: { fontSize: 24, fontWeight: "800", color: colors.inkNavy, alignSelf: "flex-start" },
  formSub: { fontSize: 14, color: colors.inkMuted, marginTop: 2, alignSelf: "flex-start" },
  formCard: { width: "100%", marginTop: spacing.xl },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: colors.inkMuted, marginBottom: spacing.sm },
  starsRow: { flexDirection: "row", gap: 6, marginBottom: spacing.lg },
  fieldRow: { flexDirection: "row", gap: spacing.md },
  fieldHalf: { flex: 1 },
  input: { backgroundColor: "#F2F2F7", borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 16, color: colors.ink, textAlign: "center" },
  error: { color: colors.danger, fontSize: 13, textAlign: "center", marginTop: spacing.md },
  skipLink: { color: colors.inkMuted, fontSize: 13, fontWeight: "600", marginTop: spacing.lg },
  celebrateTitle: { fontSize: 34, color: colors.orange, marginTop: spacing.xxl },
  celebrateSub: { fontSize: 14, color: colors.inkMuted, marginTop: -spacing.sm },
  summaryCard: { width: "100%", marginTop: spacing.xl },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ratingLabel: { fontSize: 12, color: colors.inkMuted, fontWeight: "700", textTransform: "uppercase" },
  ratingValue: { fontSize: 32, fontWeight: "800", color: colors.ink, marginTop: 2 },
  xpBadge: { backgroundColor: colors.orange + "1F", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  xpBadgeText: { color: colors.orange, fontWeight: "800", fontSize: 14 },
  statsGrid: { flexDirection: "row", marginTop: spacing.lg, gap: spacing.xl },
  statCol: { alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "800", color: colors.ink },
  statLabel: { fontSize: 10, color: colors.inkMuted, fontWeight: "700", marginTop: 2 },
  actions: { width: "100%", marginTop: spacing.xxl, alignItems: "center", gap: spacing.md },
  backLink: { color: colors.inkMuted, fontSize: 13, fontWeight: "600" },
});
