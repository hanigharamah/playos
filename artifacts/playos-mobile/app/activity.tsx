import { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import { ArrowLeft, Flame, Medal, Check } from "lucide-react-native";
import { useGetMyActivity } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { colors, radius, spacing } from "@/lib/theme";
import { screen } from "@/lib/analytics";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKLY_GOAL = 4;

/**
 * Real computed activity — every number here comes from get_my_activity()
 * (see supabase/2026-07-activity-and-stats.sql), derived live from actual
 * check-in history. Nothing here is a stored counter that could drift out
 * of sync or a mockup placeholder.
 */
export default function Activity() {
  const router = useRouter();
  const { data } = useGetMyActivity();

  useEffect(() => { screen("Activity"); }, []);

  const matches = data?.matchesThisWeek ?? 0;
  const pct = Math.min(1, matches / WEEKLY_GOAL);
  const radiusPx = 44;
  const circumference = 2 * Math.PI * radiusPx;

  const levelPct = data ? data.xpIntoLevel / data.xpForNextLevel : 0;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}><ArrowLeft size={20} color={colors.ink} /></Pressable>
        <Text style={styles.headerTitle}>activity</Text>
        <View style={{ width: 20 }} />
      </View>

      <GlassCard style={styles.weekCard}>
        <Text style={styles.weekLabel}>this week</Text>
        <View style={styles.weekRow}>
          <Text style={styles.weekCount}>{matches} / {WEEKLY_GOAL} matches</Text>
          <View style={styles.ring}>
            <Svg width={100} height={100}>
              <Circle cx={50} cy={50} r={radiusPx} stroke={colors.hairline} strokeWidth={8} fill="none" />
              <Circle
                cx={50} cy={50} r={radiusPx}
                stroke={colors.orange} strokeWidth={8} fill="none"
                strokeDasharray={`${circumference}, ${circumference}`}
                strokeDashoffset={circumference * (1 - pct)}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
            </Svg>
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.section}>
        <Text style={styles.weekLabel}>playing streak</Text>
        <View style={styles.dayRow}>
          {DAY_LABELS.map((label, i) => (
            <View key={i} style={styles.dayCol}>
              <View style={[styles.dayDot, data?.weekDaysPlayed[i] && styles.dayDotActive]}>
                {data?.weekDaysPlayed[i] && <Check size={12} color="#FFFFFF" />}
              </View>
              <Text style={styles.dayLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.streakRow}>
          <Flame size={18} color={colors.orange} />
          <Text style={styles.streakText}>{data?.currentStreakDays ?? 0} days</Text>
          <Text style={styles.streakBest}>best: {data?.longestStreakDays ?? 0} days</Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.section}>
        <View style={styles.levelHeader}>
          <View>
            <Text style={styles.weekLabel}>level</Text>
            <Text style={styles.levelNumber}>{data?.level ?? 1}</Text>
          </View>
          <Medal size={28} color={colors.orange} />
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${Math.round(levelPct * 100)}%` }]} />
        </View>
        <Text style={styles.xpText}>{data?.xpIntoLevel ?? 0} / {data?.xpForNextLevel ?? 250} XP</Text>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep },
  content: { padding: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xxl * 2 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  headerTitle: { fontSize: 20, fontWeight: "800", color: colors.orange },
  weekCard: { marginBottom: spacing.lg },
  weekLabel: { fontSize: 13, fontWeight: "700", color: colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  weekRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  weekCount: { fontSize: 20, fontWeight: "800", color: colors.ink },
  ring: { width: 100, height: 100 },
  section: { marginBottom: spacing.lg },
  dayRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md },
  dayCol: { alignItems: "center", gap: 6 },
  dayDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#F2F2F7", alignItems: "center", justifyContent: "center" },
  dayDotActive: { backgroundColor: colors.orange },
  dayLabel: { fontSize: 11, color: colors.inkMuted, fontWeight: "600" },
  streakRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  streakText: { fontSize: 16, fontWeight: "800", color: colors.ink },
  streakBest: { fontSize: 12, color: colors.inkMuted, marginLeft: "auto" },
  levelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  levelNumber: { fontSize: 28, fontWeight: "800", color: colors.ink, marginTop: 2 },
  xpTrack: { height: 8, borderRadius: 4, backgroundColor: colors.hairline, marginTop: spacing.md, overflow: "hidden" },
  xpFill: { height: "100%", borderRadius: 4, backgroundColor: colors.orange },
  xpText: { fontSize: 12, color: colors.inkMuted, marginTop: spacing.xs, textAlign: "right" },
});
