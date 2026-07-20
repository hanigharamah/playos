import { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { format } from "date-fns";
import { useListGames, type GameSummary } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { FillBar } from "@/components/FillBar";
import { OccupancyChip } from "@/components/OccupancyChip";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { colors, spacing, radius } from "@/lib/theme";
import { screen } from "@/lib/analytics";

interface DayGroup {
  dayKey: string;
  label: string;
  games: GameSummary[];
}

/** Games list — grouped by day, mirrors ../playos/src/pages/games.tsx. */
export default function Games() {
  const router = useRouter();
  const { data: games, isLoading, refetch, isRefetching } = useListGames();

  useEffect(() => { screen("Games"); }, []);

  const dayGroups = useMemo((): DayGroup[] => {
    const groups: DayGroup[] = [];
    for (const game of games ?? []) {
      const dayKey = format(new Date(game.kickoffTime), "yyyy-MM-dd");
      let group = groups.find((g) => g.dayKey === dayKey);
      if (!group) {
        group = { dayKey, label: format(new Date(game.kickoffTime), "EEEE, d MMM"), games: [] };
        groups.push(group);
      }
      group.games.push(game);
    }
    return groups;
  }, [games]);

  return (
    <FlatList
      style={styles.wrap}
      contentContainerStyle={styles.content}
      data={dayGroups}
      keyExtractor={(g) => g.dayKey}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.orange} />}
      ListHeaderComponent={
        <Text style={styles.header}>Browse Games</Text>
      }
      ListEmptyComponent={
        !isLoading ? (
          <View style={styles.empty}>
            <HandwrittenHeader style={styles.emptyTitle}>No games yet</HandwrittenHeader>
            <Text style={styles.emptyBody}>Check back soon, or ask a pitch to list here.</Text>
          </View>
        ) : null
      }
      renderItem={({ item: group }) => (
        <View style={styles.daySection}>
          <Text style={styles.dayLabel}>{group.label}</Text>
          {group.games.map((game) => (
            <Pressable key={game.id} onPress={() => router.push(`/game/${game.id}`)} style={styles.cardWrap}>
              <GlassCard>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{game.title}</Text>
                  <Text style={styles.cardPrice}>SAR {game.price}</Text>
                </View>
                <Text style={styles.cardMeta}>{game.pitchName} · {format(new Date(game.kickoffTime), "h:mm a")}</Text>
                <View style={styles.cardBottom}>
                  <OccupancyChip booked={game.bookedCount} capacity={game.capacity} />
                </View>
                <View style={{ marginTop: spacing.sm }}>
                  <FillBar booked={game.bookedCount} capacity={game.capacity} />
                </View>
              </GlassCard>
            </Pressable>
          ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep },
  content: { padding: spacing.lg, paddingTop: spacing.xxl * 1.5, paddingBottom: spacing.xxl * 2 },
  header: { fontSize: 28, fontWeight: "800", color: colors.inkNavy, marginBottom: spacing.lg },
  daySection: { marginBottom: spacing.xl },
  dayLabel: { fontSize: 13, fontWeight: "700", color: colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.sm },
  cardWrap: { marginBottom: spacing.md },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardTitle: { fontSize: 17, fontWeight: "700", color: colors.ink, flex: 1, marginRight: spacing.sm },
  cardPrice: { fontSize: 16, fontWeight: "800", color: colors.pink },
  cardMeta: { fontSize: 13, color: colors.inkMuted, marginTop: 2 },
  cardBottom: { marginTop: spacing.sm },
  empty: { alignItems: "center", paddingVertical: spacing.xxl * 2 },
  emptyTitle: { fontSize: 32 },
  emptyBody: { color: colors.inkMuted, marginTop: spacing.sm },
});
