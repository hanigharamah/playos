import { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { format } from "date-fns";
import { Bell } from "lucide-react-native";
import { useListGames, useGetMe, useGetMyBookings } from "@/lib/api";
import { MatchCard } from "@/components/MatchCard";
import { GlassCard } from "@/components/GlassCard";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { colors, spacing } from "@/lib/theme";
import { screen } from "@/lib/analytics";

export default function Home() {
  const router = useRouter();
  const { data: games, isLoading, refetch, isRefetching } = useListGames();
  const { data: bookings } = useGetMyBookings();

  useEffect(() => { screen("Home"); }, []);

  const featured = games?.[0];
  const upcoming = bookings?.upcoming ?? [];
  const isTonight = featured && isSameDay(new Date(featured.kickoffTime), new Date());

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.orange} />}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>PLAYOS</Text>
        <Pressable hitSlop={12} style={styles.bellWrap}>
          <Bell size={22} color={colors.ink} />
          {upcoming.length > 0 && <View style={styles.bellDot} />}
        </Pressable>
      </View>

      <HandwrittenHeader style={styles.headline}>
        {featured ? `your next match is ${isTonight ? "tonight" : "coming up"}.` : "let's get you\non the pitch."}
      </HandwrittenHeader>

      <Pressable onPress={() => router.push("/activity")} style={styles.activityLink}>
        <Text style={styles.activityLinkText}>view your activity →</Text>
      </Pressable>

      {featured && (
        <View style={{ marginTop: spacing.lg }}>
          <MatchCard game={featured} variant="hero" onPress={() => router.push(`/game/${featured.id}`)} />
        </View>
      )}

      {upcoming.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionLabel}>coming up</Text>
            <Pressable onPress={() => router.push("/(tabs)/my-games")}>
              <Text style={styles.viewAll}>see all</Text>
            </Pressable>
          </View>
          {upcoming.slice(0, 3).map((b) => (
            <Pressable key={b.id} onPress={() => router.push(`/game/${b.gameId}`)}>
              <GlassCard style={styles.upcomingCard}>
                <Text style={styles.upcomingMeta}>{format(new Date(b.game.kickoffTime), "EEE, h:mm a").toUpperCase()}</Text>
                <Text style={styles.upcomingTitle}>{b.game.title}</Text>
                <Text style={styles.upcomingSub}>{b.game.pitchName}</Text>
              </GlassCard>
            </Pressable>
          ))}
        </View>
      )}

      {!isLoading && !featured && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No games nearby yet</Text>
          <Text style={styles.emptyBody}>Check the Play tab to browse all venues.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep },
  content: { padding: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xxl * 2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { fontSize: 18, fontWeight: "800", color: colors.inkNavy, letterSpacing: -0.3 },
  bellWrap: { position: "relative" },
  bellDot: { position: "absolute", top: -1, right: -1, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.pink },
  headline: { fontSize: 34, color: colors.orange, marginTop: spacing.lg, lineHeight: 38 },
  activityLink: { marginTop: spacing.sm },
  activityLinkText: { fontSize: 13, fontWeight: "600", color: colors.inkMuted },
  sectionLabel: { fontSize: 14, fontWeight: "700", color: colors.orange, marginBottom: spacing.sm },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  viewAll: { fontSize: 13, fontWeight: "600", color: colors.inkMuted },
  upcomingCard: { marginBottom: spacing.sm },
  upcomingMeta: { fontSize: 11, fontWeight: "700", color: colors.orange, textTransform: "uppercase" },
  upcomingTitle: { fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 2 },
  upcomingSub: { fontSize: 13, color: colors.inkMuted, marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: spacing.xxl * 2 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.ink },
  emptyBody: { fontSize: 13, color: colors.inkMuted, marginTop: 4 },
});
