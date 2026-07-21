import { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Image, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { format } from "date-fns";
import { Bell } from "lucide-react-native";
import { useListGames, useGetMyBookings } from "@/lib/api";
import { MatchCard } from "@/components/MatchCard";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { DotWaveBackground } from "@/components/DotWaveBackground";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import { colors, spacing, radius } from "@/lib/theme";
import { screen } from "@/lib/analytics";

const HERO_BG_HEIGHT = 580;

export default function Home() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data: games, isLoading, refetch, isRefetching } = useListGames();
  const { data: bookings } = useGetMyBookings();

  useEffect(() => { screen("Home"); }, []);

  const featured = games?.[0];
  const upcoming = bookings?.upcoming ?? [];
  const isTonight = featured && isSameDay(new Date(featured.kickoffTime), new Date());

  return (
    <View style={styles.wrap}>
      <DotWaveBackground width={width} height={HERO_BG_HEIGHT} />
      <ScrollView
        style={styles.scroll}
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
          {featured
            ? `your next match is ${isTonight ? "tonight." : "coming up."}`
            : "let's get you\non the pitch."}
        </HandwrittenHeader>

        {featured && (
          <View style={{ marginTop: spacing.xl }}>
            <MatchCard game={featured} variant="hero" onPress={() => router.push(`/game/${featured.id}`)} />
          </View>
        )}

        {upcoming.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <View style={styles.rowBetween}>
              <HandwrittenHeader style={styles.sectionLabel}>coming up</HandwrittenHeader>
              <Pressable onPress={() => router.push("/(tabs)/my-games")}>
                <Text style={styles.viewAll}>see all</Text>
              </Pressable>
            </View>
            {upcoming.slice(0, 3).map((b) => {
              const teamSize = b.game.capacity / 2;
              return (
                <Pressable key={b.id} onPress={() => router.push(`/game/${b.gameId}`)}>
                  <View style={styles.upcomingCard}>
                    <Image
                      source={{ uri: getVenuePhoto(b.game.pitchName, b.game.pitchPhotoUrl) }}
                      style={styles.upcomingThumb}
                    />
                    <View style={styles.upcomingText}>
                      <Text style={styles.upcomingMeta}>
                        {format(new Date(b.game.kickoffTime), "EEE, h:mm a").toUpperCase()}
                      </Text>
                      <Text style={styles.upcomingTitle} numberOfLines={1}>{b.game.title}</Text>
                      <Text style={styles.upcomingSub}>{teamSize}v{teamSize} · Outdoor</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {!isLoading && !featured && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No games nearby yet</Text>
            <Text style={styles.emptyBody}>Check the Play tab to browse all venues.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xxl * 2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { fontSize: 18, fontWeight: "800", color: colors.inkNavy, letterSpacing: -0.3 },
  bellWrap: { position: "relative" },
  bellDot: { position: "absolute", top: -1, right: -1, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.pink },
  headline: { fontSize: 44, color: colors.orange, marginTop: spacing.lg, lineHeight: 50 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  sectionLabel: { fontSize: 26, color: colors.orange },
  viewAll: { fontSize: 13, fontWeight: "600", color: colors.inkMuted },
  upcomingCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: radius.lg, overflow: "hidden", marginBottom: spacing.sm, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  upcomingThumb: { width: 72, height: 72 },
  upcomingText: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  upcomingMeta: { fontSize: 11, fontWeight: "700", color: colors.orange, textTransform: "uppercase" },
  upcomingTitle: { fontSize: 15, fontWeight: "700", color: colors.ink, marginTop: 2 },
  upcomingSub: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: spacing.xxl * 2 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.ink },
  emptyBody: { fontSize: 13, color: colors.inkMuted, marginTop: 4 },
});
