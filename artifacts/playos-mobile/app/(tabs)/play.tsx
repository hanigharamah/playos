import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ScrollView as HScroll } from "react-native";
import { useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import { useListGames } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { OccupancyChip } from "@/components/OccupancyChip";
import { colors, radius, spacing } from "@/lib/theme";
import { screen } from "@/lib/analytics";

const MOODS = ["Casual", "Competitive", "Just for fun"] as const;

export default function Play() {
  const router = useRouter();
  const { data: games } = useListGames();
  const [mood, setMood] = useState<(typeof MOODS)[number] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => { screen("Play"); }, []);

  // Areas derived from real pitch names (no separate "area" field in Supabase) —
  // grouping by pitchName stand-in until a proper area/city field exists.
  const areas = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of games ?? []) map.set(g.pitchName, (map.get(g.pitchName) ?? 0) + 1);
    return Array.from(map.entries()).slice(0, 4);
  }, [games]);

  const filtered = (games ?? []).filter((g) => g.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <View style={styles.searchBar}>
        <Search size={16} color={colors.inkFaint} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search venues or areas"
          placeholderTextColor={colors.inkFaint}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <Text style={styles.label}>What do you feel like?</Text>
      <View style={styles.moodRow}>
        {MOODS.map((m) => {
          const active = mood === m;
          return (
            <Pressable key={m} onPress={() => setMood(active ? null : m)} style={[styles.moodChip, active && styles.moodChipActive]}>
              <Text style={[styles.moodText, active && styles.moodTextActive]}>{m}</Text>
            </Pressable>
          );
        })}
      </View>

      {areas.length > 0 && (
        <>
          <Text style={[styles.label, { marginTop: spacing.xl }]}>Popular areas</Text>
          <HScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {areas.map(([name, count]) => (
              <View key={name} style={styles.areaCard}>
                <Text style={styles.areaName} numberOfLines={1}>{name}</Text>
                <Text style={styles.areaCount}>{count} game{count === 1 ? "" : "s"}</Text>
              </View>
            ))}
          </HScroll>
        </>
      )}

      <Text style={[styles.label, { marginTop: spacing.xl }]}>Recommended for you</Text>
      {filtered.map((g) => (
        <Pressable key={g.id} onPress={() => router.push(`/game/${g.id}`)}>
          <GlassCard style={styles.gameCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.gameTitle} numberOfLines={1}>{g.title}</Text>
              <Text style={styles.gamePrice}>SAR {g.price}</Text>
            </View>
            <Text style={styles.gameMeta}>{g.pitchName}</Text>
            <View style={{ marginTop: spacing.sm }}>
              <OccupancyChip booked={g.bookedCount} capacity={g.capacity} />
            </View>
          </GlassCard>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep },
  content: { padding: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xxl * 2 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "#FFFFFF", borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 10, borderWidth: 1, borderColor: colors.hairline },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink },
  label: { fontSize: 15, fontWeight: "700", color: colors.ink, marginTop: spacing.xl, marginBottom: spacing.sm },
  moodRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  moodChip: { paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: "#F2F2F7" },
  moodChipActive: { backgroundColor: colors.inkNavy },
  moodText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  moodTextActive: { color: "#FFFFFF" },
  areaCard: { width: 130, backgroundColor: "#FFFFFF", borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.hairline },
  areaName: { fontSize: 14, fontWeight: "700", color: colors.ink },
  areaCount: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  gameCard: { marginBottom: spacing.sm },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  gameTitle: { fontSize: 15, fontWeight: "700", color: colors.ink, flex: 1, marginRight: spacing.sm },
  gamePrice: { fontSize: 14, fontWeight: "800", color: colors.pink },
  gameMeta: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
});
