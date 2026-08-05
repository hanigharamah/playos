import { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format, isSameDay } from "date-fns";
import { ArrowLeft, ChevronRight, AlertTriangle } from "lucide-react-native";
import { useListGames, useIsOperator } from "@/lib/api";
import { WarmCanvas } from "@/components/WarmCanvas";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { GlassCard } from "@/components/GlassCard";
import { VenueArt } from "@/components/VenueArt";
import { serverNow } from "@/lib/serverTime";
import { colors } from "@/lib/theme";
import { screen } from "@/lib/analytics";

const INK = "#1C1C1E";
const MUTED = "#6C6C70";
const DANGER = "#BF2626";

/**
 * Operator hub — the way in to the two match-day screens.
 *
 * Both /ops/at-risk/[gameId] and /ops/cancel/[gameId] were built and neither
 * was reachable: nothing in the app routed to /ops/* at all. This is the
 * missing entry point, and it is deliberately only that.
 *
 * WHAT IS NOT HERE, on purpose: creating fixtures, settling cash refunds,
 * setting pitch surfaces. Those are desk work, one-row edits, done by one
 * person — the Supabase dashboard is the better tool and it already exists.
 * Build screens for them when there is a second operator, or when a typo in
 * the raw table would be expensive. Neither is true yet.
 *
 * Ordered soonest first, which is the opposite of every player-facing list on
 * this app. A player is shopping and wants the fullest game; an operator is
 * working tonight's fixture and wants the one that kicks off next.
 */
export default function OpsHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: isOperator, isLoading: roleLoading } = useIsOperator();
  const { data: games, isLoading } = useListGames();

  useEffect(() => { screen("OpsHub"); }, []);

  const upcoming = useMemo(() => {
    const now = serverNow();
    return (games ?? [])
      .filter((g) => g.status !== "cancelled" && new Date(g.kickoffTime).getTime() > now)
      .sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime());
  }, [games]);

  if (roleLoading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={colors.orange} />
      </View>
    );
  }

  // A non-operator reaching this route is not an error worth explaining. The
  // real gate is the database — cancel_match and release_spot both call
  // is_operator() and throw — so this is only about not showing someone a
  // screen full of buttons that would all fail.
  if (!isOperator) {
    return (
      <View style={styles.centre}>
        <Text style={styles.plain}>Nothing here for you.</Text>
        <Pressable onPress={() => router.replace("/(tabs)")} hitSlop={10}>
          <Text style={styles.link}>back to PlayOS</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <WarmCanvas base="#FFF8F0" glows={[{ cx: 0.8, cy: 0.1, r: 0.9, color: "rgba(255,225,204,0.3)" }]} />
      <ScrollView
        style={styles.wrap}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backCircle}>
          <ArrowLeft size={18} color={INK} strokeWidth={2} />
        </Pressable>

        <HandwrittenHeader style={styles.header}>operator</HandwrittenHeader>
        <Text style={styles.sub}>tonight's matches, soonest first</Text>

        {isLoading && <ActivityIndicator color={colors.orange} style={{ marginTop: 24 }} />}

        {!isLoading && upcoming.length === 0 && (
          <Text style={styles.empty}>No upcoming matches.</Text>
        )}

        {upcoming.map((g) => {
          const kickoff = new Date(g.kickoffTime);
          const today = isSameDay(kickoff, new Date(serverNow()));
          const minsToKickoff = Math.round((kickoff.getTime() - serverNow()) / 60000);
          // The at-risk review is designed for T-10. Surfaced as a hint rather
          // than a gate: an operator who wants the roster at T-40 should get it.
          const nearKickoff = minsToKickoff <= 30;

          return (
            <GlassCard key={g.id} variant="soft" round={18} padding={0} style={styles.card}>
              <View style={styles.row}>
                <VenueArt name={g.pitchName} style={styles.thumb} />
                <View style={styles.rowText}>
                  <Text style={styles.title} numberOfLines={1}>
                    {Math.floor(g.capacity / 2)}v{Math.floor(g.capacity / 2)}  ·  {g.pitchName}
                  </Text>
                  <Text style={styles.when}>
                    {today ? "tonight" : format(kickoff, "EEE d MMM")}  ·  {format(kickoff, "h:mm a").toLowerCase()}
                  </Text>
                  <Text style={styles.fill}>
                    {g.bookedCount}/{g.capacity} booked
                    {nearKickoff ? `  ·  kicks off in ${minsToKickoff} min` : ""}
                  </Text>
                </View>
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={styles.action}
                  onPress={() => router.push(`/ops/at-risk/${g.id}`)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.actionText, nearKickoff && styles.actionTextLive]}>
                    who's here
                  </Text>
                  <ChevronRight size={15} color={nearKickoff ? colors.orange : MUTED} strokeWidth={2} />
                </Pressable>

                <View style={styles.divider} />

                <Pressable
                  style={styles.action}
                  onPress={() => router.push(`/ops/cancel/${g.id}`)}
                  accessibilityRole="button"
                >
                  <AlertTriangle size={14} color={DANGER} strokeWidth={2} />
                  <Text style={[styles.actionText, { color: DANGER }]}>cancel</Text>
                </Pressable>
              </View>
            </GlassCard>
          );
        })}

        {/* Says where the rest of the job lives, so nobody goes looking for a
            screen that was decided against rather than forgotten. */}
        <Text style={styles.footnote}>
          Fixtures, cash refunds and pitch details are edited in the Supabase dashboard.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 60 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#FFF8F0" },
  plain: { fontSize: 15, color: MUTED },
  link: { fontSize: 15, fontWeight: "600", color: colors.orange },

  backCircle: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.8)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    marginBottom: 10,
  },
  header: { fontSize: 30, color: colors.orange },
  sub: { fontSize: 13, color: MUTED, marginTop: 2, marginBottom: 16 },
  empty: { fontSize: 14, color: MUTED, marginTop: 24 },

  card: { marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", padding: 12 },
  thumb: { width: 74, height: 56, borderRadius: 12 },
  rowText: { flex: 1, marginLeft: 12 },
  title: { fontSize: 15, fontWeight: "600", color: INK },
  when: { fontSize: 12.5, color: MUTED, marginTop: 3 },
  fill: { fontSize: 12, color: MUTED, marginTop: 3 },

  actions: {
    flexDirection: "row", alignItems: "stretch",
    borderTopWidth: 1, borderTopColor: "rgba(140,89,38,0.10)",
  },
  action: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    // 44pt is the Apple minimum and these are tapped on a pitch, in the dark,
    // by someone holding a phone in one hand.
    minHeight: 46,
  },
  actionText: { fontSize: 13.5, fontWeight: "600", color: MUTED },
  actionTextLive: { color: colors.orange },
  divider: { width: 1, backgroundColor: "rgba(140,89,38,0.10)" },

  footnote: { fontSize: 11.5, color: MUTED, marginTop: 18, textAlign: "center", lineHeight: 16 },
});
