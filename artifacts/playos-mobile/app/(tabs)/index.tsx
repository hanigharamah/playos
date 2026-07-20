import { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { format } from "date-fns";
import { Bell } from "lucide-react-native";
import { useListGames, useGetMe, useGetMyBookings } from "@/lib/api";
import { MatchCard } from "@/components/MatchCard";
import { GlassCard } from "@/components/GlassCard";
import { colors, spacing } from "@/lib/theme";
import { screen } from "@/lib/analytics";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const router = useRouter();
  const { data: me } = useGetMe();
  const { data: games, isLoading, refetch, isRefetching } = useListGames();
  const { data: bookings } = useGetMyBookings();

  useEffect(() => { screen("Home"); }, []);

  const featured = games?.[0];
  const upcoming = bookings?.upcoming ?? [];

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.orange} />}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>PLAY<Text style={styles.logoAccent}>OS</Text></Text>
        <Pressable hitSlop={12}>
          <Bell size={22} color={colors.ink} />
        </Pressable>
      </View>

      <Text style={styles.hi}>{greeting()}{me?.name ? `, ${me.name.split(" ")[0]}` : ""} 👋</Text>
      <Text style={styles.headline}>Let's get you on the pitch.</Text>

      {featured && (
        <View style={{ marginTop: spacing.xl }}>
          <Text style={styles.sectionLabel}>Best match for you</Text>
          <MatchCard game={featured} onPress={() => router.push(`/game/${featured.id}`)} />
        </View>
      )}

      {upcoming.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionLabel}>Upcoming</Text>
            <Pressable onPress={() => router.push("/(tabs)/my-games")}>
              <Text style={styles.viewAll}>View all</Text>
            </Pressable>
          </View>
          {upcoming.slice(0, 3).map((b) => (
            <Pressable key={b.id} onPress={() => router.push(`/game/${b.gameId}`)}>
              <GlassCard style={styles.upcomingCard}>
                <Text style={styles.upcomingMeta}>{format(new Date(b.game.kickoffTime), "EEE, h:mm a")}</Text>
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

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep },
  content: { padding: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xxl * 2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { fontSize: 20, fontWeight: "800", color: colors.inkNavy, letterSpacing: -0.5 },
  logoAccent: { color: colors.pink },
  hi: { fontSize: 15, color: colors.inkMuted, marginTop: spacing.xl },
  headline: { fontSize: 28, fontWeight: "800", color: colors.inkNavy, marginTop: 2, lineHeight: 34 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.sm },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  viewAll: { fontSize: 13, fontWeight: "600", color: colors.pink },
  upcomingCard: { marginBottom: spacing.sm },
  upcomingMeta: { fontSize: 11, fontWeight: "700", color: colors.orange, textTransform: "uppercase" },
  upcomingTitle: { fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 2 },
  upcomingSub: { fontSize: 13, color: colors.inkMuted, marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: spacing.xxl * 2 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.ink },
  emptyBody: { fontSize: 13, color: colors.inkMuted, marginTop: 4 },
});
