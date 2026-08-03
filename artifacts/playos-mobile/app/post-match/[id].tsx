import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator , useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Star, Trophy, Users2 } from "lucide-react-native";
import { useGetGame, useSubmitMatchStats, useMyMatchStats } from "@/lib/api";
import { Btn3D } from "@/components/Btn3D";
import { BtnOutline } from "@/components/BtnOutline";
import { GlassCard } from "@/components/GlassCard";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { WarmCanvas } from "@/components/WarmCanvas";
import { DotWaveBackground } from "@/components/DotWaveBackground";
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
const GLOWS = [
  { cx: 0.8, cy: 0.15, r: 0.9, color: "rgba(255,225,204,0.35)" },
  { cx: 0.65, cy: 0.3, r: 0.6, color: "rgba(255,217,228,0.2)" },
];

export default function PostMatch() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: game } = useGetGame(id!);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const submitStats = useSubmitMatchStats();

  // Prefill from what was already submitted. The write is an upsert, so
  // opening this again inside the 24h window and submitting used to overwrite
  // real figures with zeroes and take the player's XP down with them.
  const { data: existing, isLoading: statsLoading } = useMyMatchStats(id ?? null);
  const [goals, setGoals] = useState("0");
  const [assists, setAssists] = useState("0");
  const [rating, setRating] = useState<number | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (prefilled || !existing) return;
    setGoals(String(existing.goals));
    setAssists(String(existing.assists));
    setRating(existing.rating);
    setPrefilled(true);
  }, [existing, prefilled]);
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
          track("match_stats_submitted", { gameId: id, goals: Number(goals) || 0, assists: Number(assists) || 0, rating });
          setSubmitted(true);
        },
        onError: (err: any) => setError(err?.data?.error ?? "Could not submit — you may not be checked in to this game, or the 24h window has closed."),
      },
    );
  };

  if (submitted) {
    // get_my_activity() awards the flat 100 for the CHECKED-IN booking, which
    // was already credited before this screen opened. Adding it here again
    // claimed XP that /activity would never show. Only the stats just
    // submitted are earned here.
    const goalsNum = Number(goals) || 0;
    const assistsNum = Number(assists) || 0;
    const xpGained = goalsNum * 20 + assistsNum * 10;
    return (
      <View style={styles.wrap}>
      <WarmCanvas base="#FFF8F0" glows={GLOWS} />
      <DotWaveBackground width={width} height={600} />
        <HandwrittenHeader style={styles.celebrateTitle}>great game! 🔥</HandwrittenHeader>
        <Text style={styles.celebrateSub}>here's how you did</Text>

        <GlassCard style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.ratingLabel}>match rating</Text>
              <Text style={styles.ratingValue}>{rating ?? "—"}</Text>
            </View>
            {xpGained > 0 && (
              <View style={styles.xpBadge}>
                <Text style={styles.xpBadgeText}>+{xpGained} XP</Text>
              </View>
            )}
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statCol}><Text style={styles.statNum}>{goalsNum}</Text><Text style={styles.statLabel}>GOALS</Text></View>
            <View style={styles.statCol}><Text style={styles.statNum}>{assistsNum}</Text><Text style={styles.statLabel}>ASSISTS</Text></View>
          </View>
        </GlassCard>

        <View style={styles.actions}>
          {/* The ratified primary CTA is Btn3D's four-stop gradient, never a
              flat colour, one per screen. This branch's sole action was the one
              button in the app that didn't look like a primary action. */}
          <Btn3D label="view your activity" onPress={() => router.push("/activity")} />
          <Pressable onPress={() => router.replace("/(tabs)")}><Text style={styles.backLink}>back to home</Text></Pressable>
        </View>
      </View>
    );
  }

  // Hold the form until saved stats land, or it renders 0 / 0 / no rating and
  // then visibly repopulates — which looks like the values were just reset.
  if (statsLoading) {
    return (
      <View style={[styles.wrap, { paddingTop: insets.top + spacing.xl }]}>
        <WarmCanvas base="#FFF8F0" glows={GLOWS} />
        <ActivityIndicator color={colors.orange} style={{ marginTop: spacing.xxl }} />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.xl }]}>
      {/* The glows belong here too. Rendering them only on submit made the
          background pop into existence at the celebration, which read as a
          glitch rather than a reward. */}
      <WarmCanvas base="#FFF8F0" glows={GLOWS} />
      <Text style={styles.formTitle}>How did it go?</Text>
      <Text style={styles.formSub}>{game?.title ?? "Your match"}</Text>

      <GlassCard style={styles.formCard}>
        <Text style={styles.fieldLabel}>Rate your performance</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)} hitSlop={{ top: 12, bottom: 12, left: 9, right: 9 }}>
              <Star size={20} color={colors.orange} fill={rating != null && n <= rating ? colors.orange : "transparent"} />
            </Pressable>
          ))}
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}><Trophy size={13} color={colors.inkMuted} /> Goals</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={goals} onChangeText={setGoals} selectTextOnFocus />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}><Users2 size={13} color={colors.inkMuted} /> Assists</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={assists} onChangeText={setAssists} selectTextOnFocus />
          </View>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {submitStats.isPending ? (
          <ActivityIndicator color={colors.orange} style={{ marginTop: spacing.lg }} />
        ) : (
          <View style={{ marginTop: spacing.lg }}>
            <Btn3D label="Submit" onPress={submit} />
          </View>
        )}
      </GlassCard>

      {/* Secondary, deliberately. In this branch Submit is the primary action —
          promoting this one too would put two gradient CTAs on screen and rank
          leaving the form above finishing it. */}
      <BtnOutline
        label="book your next match"
        tone="neutral"
        onPress={() => router.replace("/browse")}
        style={{ marginTop: spacing.lg }}
      />

      <Pressable onPress={() => router.replace("/(tabs)")}><Text style={styles.skipLink}>skip for now</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // paddingTop comes from the safe-area inset at the call site: a fixed 48
  // is under the Dynamic Island on the phones the launch cohort carries.
  wrap: { flex: 1, backgroundColor: colors.creamDeep, padding: spacing.xl, alignItems: "center" },
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
  celebrateTitle: { fontSize: 38, color: colors.orange, marginTop: spacing.xxl },
  celebrateSub: { fontSize: 15, fontWeight: "600", color: "#1C1C1E", marginTop: -spacing.sm },
  summaryCard: { width: "100%", marginTop: spacing.xl },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ratingLabel: { fontSize: 12, color: colors.inkMuted, fontWeight: "700", textTransform: "uppercase" },
  ratingValue: { fontSize: 44, fontWeight: "800", color: colors.ink, marginTop: 2 },
  xpBadge: { backgroundColor: colors.orange + "1F", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  xpBadgeText: { color: colors.orange, fontWeight: "800", fontSize: 14 },
  statsGrid: { flexDirection: "row", marginTop: spacing.lg, gap: spacing.xl },
  statCol: { alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "800", color: colors.ink },
  statLabel: { fontSize: 10, color: colors.inkMuted, fontWeight: "700", marginTop: 2 },
  actions: { width: "100%", marginTop: spacing.xxl, alignItems: "center", gap: spacing.md },
  backLink: { color: colors.inkMuted, fontSize: 13, fontWeight: "600" },
});
