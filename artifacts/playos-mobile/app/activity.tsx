import { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, useWindowDimensions, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import { ArrowLeft, Flame, Check, Star, Trophy } from "lucide-react-native";
import { useGetMyActivity } from "@/lib/api";
import { DotWaveBackground } from "@/components/DotWaveBackground";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { EmptyState } from "@/components/EmptyState";
import { colors, spacing } from "@/lib/theme";
import { screen } from "@/lib/analytics";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKLY_GOAL = 4;

// Exact palette from the Figma Activity screen (node 1:9)
const INK = "#1C1C1E";
const MUTED = "#6C6C70";
const RING_INK = "#262E47";
const SUBTLE = "#8C8780";

/**
 * Real computed activity — every number comes from get_my_activity()
 * (supabase/2026-07-activity-and-stats.sql), derived live from check-in
 * history. Layout is a 1:1 port of Figma node 1:9.
 */
export default function Activity() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data } = useGetMyActivity();

  useEffect(() => { screen("Activity"); }, []);

  const matches = data?.matchesThisWeek ?? 0;
  const pct = Math.min(1, matches / WEEKLY_GOAL);
  const days = data?.weekDaysPlayed ?? [false, false, false, false, false, false, false];

  // Donut ring (68px outer, 6px stroke)
  const R = 29;
  const C = 2 * Math.PI * R;

  const xpInto = data?.xpIntoLevel ?? 0;
  const xpNext = data?.xpForNextLevel ?? 250;
  const levelPct = xpNext > 0 ? Math.min(1, xpInto / xpNext) : 0;

  // A brand-new player has no XP, no streak and no days played — showing a
  // grid of zeros reads as broken, so swap in the empty state.
  const hasNoHistory =
    !!data && data.xp === 0 && data.currentStreakDays === 0 && data.matchesThisWeek === 0;

  return (
    <View style={styles.wrap}>
      <DotWaveBackground width={width} height={600} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={20} color={INK} strokeWidth={2} />
          </Pressable>
        </View>

        <HandwrittenHeader style={styles.header}>activity</HandwrittenHeader>

        {/* Nothing tracked yet — show the empty state instead of a wall of zeros
            (Figma Activity-Empty 353:546). */}
        {hasNoHistory && (
          <EmptyState
            icon={<Trophy size={38} color="#C2703A" strokeWidth={1.8} />}
            title="no activity yet"
            body="play your first match and your streak, level and XP start here."
            actionLabel="browse matches"
            onAction={() => router.push("/browse")}
          />
        )}

        {!hasNoHistory && <>
        {/* This week + weekly-goal ring (Figma 11:14 / 142:280) */}
        <View style={styles.weekHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.thisWeek}>this week</Text>
            <Text style={styles.matchesLine}>
              <Text style={styles.matchesCount}>{matches}</Text>
              <Text style={styles.matchesRest}> / {WEEKLY_GOAL} matches</Text>
            </Text>
          </View>

          <BlurView intensity={Platform.OS === "ios" ? 24 : 0} tint="light" style={styles.ringCard}>
            <Svg width={68} height={68}>
              <Defs>
                <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#FF8A00" />
                  <Stop offset="1" stopColor="#D933BF" />
                </SvgGradient>
              </Defs>
              <Circle cx={34} cy={34} r={R} stroke="#EFE7DE" strokeWidth={6} fill="none" />
              <Circle
                cx={34} cy={34} r={R}
                stroke="url(#ringGrad)" strokeWidth={6} fill="none"
                strokeDasharray={`${C}, ${C}`}
                strokeDashoffset={C * (1 - pct)}
                strokeLinecap="round"
                transform="rotate(-90 34 34)"
              />
            </Svg>
            <Text style={styles.ringPct}>{Math.round(pct * 100)}%</Text>
            <Text style={styles.ringLabel}>weekly goal</Text>
          </BlurView>
        </View>

        {/* Week day bubbles (Figma 142:281) */}
        <BlurView intensity={Platform.OS === "ios" ? 24 : 0} tint="light" style={styles.weekCard}>
          <View style={styles.weekRow}>
            {DAY_LABELS.map((label, i) => (
              <View key={i} style={styles.dayCol}>
                <Text style={styles.dayLabel}>{label}</Text>
                {days[i] ? (
                  <LinearGradient
                    colors={["#FF8A5B", "#F0455E"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.dayBubble}
                  >
                    <Check size={15} color="#FFFFFF" strokeWidth={3} />
                  </LinearGradient>
                ) : (
                  <View style={[styles.dayBubble, styles.dayBubbleEmpty]} />
                )}
              </View>
            ))}
          </View>
        </BlurView>

        {/* Streak (Figma 142:282) */}
        <BlurView intensity={Platform.OS === "ios" ? 24 : 0} tint="light" style={styles.streakCard}>
          <LinearGradient
            colors={["#FF9933", "#FF4D40"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.flameBox}
          >
            <Flame size={26} color="#FFFFFF" strokeWidth={2} fill="#FFFFFF" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.streakLabel}>playing streak</Text>
            <Text style={styles.streakValue}>{data?.currentStreakDays ?? 0} days</Text>
          </View>
          <Text style={styles.streakBest}>best: {data?.longestStreakDays ?? 0} days</Text>
        </BlurView>

        {/* Level (Figma 142:286) */}
        <BlurView intensity={Platform.OS === "ios" ? 24 : 0} tint="light" style={styles.levelCard}>
          <View style={styles.levelTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.levelLabel}>level</Text>
              <Text style={styles.levelValue}>{data?.level ?? 1}</Text>
            </View>
            <View style={styles.starOuterGlow}>
              <View style={styles.starInnerGlow}>
                <LinearGradient
                  colors={["#FFB33C", "#FF8A00"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.starBadge}
                >
                  <Star size={24} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
                </LinearGradient>
              </View>
            </View>
          </View>

          <View style={styles.xpBlock}>
            <View style={styles.xpTrack}>
              <LinearGradient
                colors={["#FF8A00", "#D940D9"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.xpFill, { width: `${Math.round(levelPct * 100)}%` }]}
              />
            </View>
            <Text style={styles.xpText}>
              <Text style={styles.xpCurrent}>{xpInto.toLocaleString()}</Text>
              <Text style={styles.xpTotal}> / {xpNext.toLocaleString()} XP</Text>
            </Text>
          </View>
        </BlurView>
        </>}
      </ScrollView>
    </View>
  );
}

const glassCard = {
  backgroundColor: "rgba(255,255,255,0.38)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.75)",
  overflow: "hidden" as const,
  shadowColor: "#8C5926",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.1,
  shadowRadius: 24,
  elevation: 3,
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0" },
    // paddingTop is applied at the call site from the safe-area inset: the
  // fixed value here was smaller than the Dynamic Island's inset, so the first
  // element rendered underneath it.
  content: { paddingHorizontal: 20, paddingBottom: 130 },

  topRow: { height: 24, justifyContent: "center" },
  header: { fontSize: 34, marginTop: 10 },

  weekHeaderRow: { flexDirection: "row", alignItems: "flex-start", marginTop: spacing.lg },
  thisWeek: { fontSize: 13, fontWeight: "600", color: MUTED },
  matchesLine: { marginTop: 8 },
  matchesCount: { fontSize: 36, fontWeight: "700", color: "#FF8A00" },
  matchesRest: { fontSize: 36, fontWeight: "700", color: "#1C2133" },

  ringCard: {
    ...glassCard,
    width: 104, height: 112, borderRadius: 24,
    alignItems: "center", justifyContent: "center", paddingTop: 6,
  },
  ringPct: { position: "absolute", top: 33, fontSize: 17, fontWeight: "700", color: RING_INK },
  ringLabel: { fontSize: 9, color: SUBTLE, marginTop: 4 },

  weekCard: { ...glassCard, minHeight: 92, borderRadius: 22, marginTop: spacing.xl, justifyContent: "center" },
  weekRow: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 8 },
  dayCol: { alignItems: "center", width: 36 },
  dayLabel: { fontSize: 11, color: MUTED },
  dayBubble: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 6 },
  dayBubbleEmpty: { backgroundColor: "rgba(230,228,224,0.7)" },

  streakCard: {
    ...glassCard,
    flexDirection: "row", alignItems: "center", gap: 16,
    height: 96, borderRadius: 22, marginTop: spacing.lg, paddingHorizontal: 16,
  },
  flameBox: {
    width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center",
    shadowColor: "#FF6B33", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 4,
  },
  streakLabel: { fontSize: 13, fontWeight: "600", color: MUTED },
  streakValue: { fontSize: 36, fontWeight: "700", color: INK, marginTop: 2 },
  streakBest: { fontSize: 13, color: MUTED, alignSelf: "flex-end", marginBottom: 12 },

  levelCard: { ...glassCard, borderRadius: 22, marginTop: spacing.lg, padding: 20, minHeight: 284 },
  levelTop: { flexDirection: "row", alignItems: "flex-start" },
  levelLabel: { fontSize: 13, fontWeight: "600", color: MUTED },
  levelValue: { fontSize: 48, fontWeight: "700", color: INK, marginTop: 2 },
  starOuterGlow: {
    width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,170,60,0.10)",
  },
  starInnerGlow: {
    width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,170,60,0.16)",
  },
  starBadge: {
    width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center",
    shadowColor: "#FF8A00", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 5,
  },
  xpBlock: { marginTop: "auto", paddingTop: spacing.xxl },
  xpTrack: { height: 8, borderRadius: 4, backgroundColor: "#E5E3DE", overflow: "hidden" },
  xpFill: { height: 8, borderRadius: 4 },
  xpText: { marginTop: 8 },
  xpCurrent: { fontSize: 12, color: "#FF8A00" },
  xpTotal: { fontSize: 12, color: SUBTLE },
});
