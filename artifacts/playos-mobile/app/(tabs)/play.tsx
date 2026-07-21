import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { isToday, isTomorrow, addDays, isWithinInterval, startOfDay, endOfDay, getHours } from "date-fns";
import { Search, SlidersHorizontal, X } from "lucide-react-native";
import { useListGames } from "@/lib/api";
import { MatchCard } from "@/components/MatchCard";
import { BottomSheet } from "@/components/BottomSheet";
import { RadioRow } from "@/components/RadioRow";
import { PillButton } from "@/components/PillButton";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import { colors, radius, spacing } from "@/lib/theme";
import { screen } from "@/lib/analytics";

const MOODS = ["Casual", "Competitive", "Just for fun"] as const;
const WHEN_OPTIONS = ["Any day", "Today", "Tomorrow", "This weekend"] as const;
const TIME_OPTIONS = ["Any time", "Morning (6AM–12PM)", "Afternoon (12PM–6PM)", "Evening (6PM–12AM)"] as const;
const PLAYER_OPTIONS = ["Any", "6v6", "7v7", "8v8"] as const;

function matchesWhen(kickoff: Date, when: (typeof WHEN_OPTIONS)[number]) {
  if (when === "Any day") return true;
  if (when === "Today") return isToday(kickoff);
  if (when === "Tomorrow") return isTomorrow(kickoff);
  if (when === "This weekend") {
    const now = new Date();
    const day = now.getDay(); // Fri=5, Sat=6 (weekend in Saudi Arabia)
    const daysUntilFri = (5 - day + 7) % 7;
    const weekendStart = startOfDay(addDays(now, daysUntilFri));
    const weekendEnd = endOfDay(addDays(weekendStart, 1));
    return isWithinInterval(kickoff, { start: weekendStart, end: weekendEnd });
  }
  return true;
}

function matchesTime(kickoff: Date, time: (typeof TIME_OPTIONS)[number]) {
  if (time === "Any time") return true;
  const h = getHours(kickoff);
  if (time === "Morning (6AM–12PM)") return h >= 6 && h < 12;
  if (time === "Afternoon (12PM–6PM)") return h >= 12 && h < 18;
  if (time === "Evening (6PM–12AM)") return h >= 18;
  return true;
}

export default function Play() {
  const router = useRouter();
  const { data: games } = useListGames();
  const [mood, setMood] = useState<(typeof MOODS)[number] | null>(null);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [when, setWhen] = useState<(typeof WHEN_OPTIONS)[number]>("Any day");
  const [time, setTime] = useState<(typeof TIME_OPTIONS)[number]>("Any time");
  const [players, setPlayers] = useState<(typeof PLAYER_OPTIONS)[number]>("Any");

  useEffect(() => { screen("Play"); }, []);

  const areas = useMemo(() => {
    const map = new Map<string, { count: number; photo: string | null }>();
    for (const g of games ?? []) {
      const existing = map.get(g.pitchName);
      map.set(g.pitchName, { count: (existing?.count ?? 0) + 1, photo: existing?.photo ?? g.pitchPhotoUrl });
    }
    return Array.from(map.entries()).slice(0, 6);
  }, [games]);

  const filtered = (games ?? []).filter((g) => {
    if (!g.title.toLowerCase().includes(query.toLowerCase()) && !g.pitchName.toLowerCase().includes(query.toLowerCase())) return false;
    const kickoff = new Date(g.kickoffTime);
    if (!matchesWhen(kickoff, when)) return false;
    if (!matchesTime(kickoff, time)) return false;
    if (players !== "Any" && g.capacity !== Number(players[0]) * 2) return false;
    return true;
  });

  const activeFilterCount = [when !== "Any day", time !== "Any time", players !== "Any"].filter(Boolean).length;

  const clearFilters = () => { setWhen("Any day"); setTime("Any time"); setPlayers("Any"); };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <View style={styles.searchRow}>
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
        <Pressable style={styles.filterBtn} onPress={() => setFiltersOpen(true)}>
          <SlidersHorizontal size={18} color={colors.ink} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeFilterCount}</Text></View>
          )}
        </Pressable>
      </View>

      <Text style={styles.label}>how do you feel like playing?</Text>
      <View style={styles.moodRow}>
        {MOODS.map((m) => {
          const active = mood === m;
          return (
            <Pressable key={m} onPress={() => setMood(active ? null : m)} style={[styles.moodChip, active && styles.moodChipActive]}>
              <Text style={[styles.moodText, active && styles.moodTextActive]}>{m.toLowerCase()}</Text>
            </Pressable>
          );
        })}
      </View>

      {areas.length > 0 && (
        <>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>popular areas</Text>
            <Text style={styles.seeAll}>see all</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {areas.map(([name, { count, photo }]) => (
              <View key={name} style={styles.areaCard}>
                <Image source={{ uri: getVenuePhoto(name, photo) }} style={styles.areaPhoto} />
                <View style={styles.areaTextWrap}>
                  <Text style={styles.areaName} numberOfLines={1}>{name}</Text>
                  <Text style={styles.areaCount}>{count} game{count === 1 ? "" : "s"}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      )}

      <Text style={styles.label}>recommended for you</Text>
      {filtered.map((g) => (
        <View key={g.id} style={{ marginBottom: spacing.sm }}>
          <MatchCard game={g} variant="compact" onPress={() => router.push(`/game/${g.id}`)} />
        </View>
      ))}
      {filtered.length === 0 && (
        <Text style={styles.noResults}>No games match your filters.</Text>
      )}

      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Filters</Text>
          <Pressable onPress={clearFilters}><Text style={styles.clearText}>Clear</Text></Pressable>
        </View>

        <Text style={styles.groupLabel}>When</Text>
        {WHEN_OPTIONS.map((opt) => (
          <RadioRow key={opt} label={opt} selected={when === opt} onPress={() => setWhen(opt)} />
        ))}

        <Text style={styles.groupLabel}>Time</Text>
        {TIME_OPTIONS.map((opt) => (
          <RadioRow key={opt} label={opt} selected={time === opt} onPress={() => setTime(opt)} />
        ))}

        <Text style={styles.groupLabel}>Players</Text>
        {PLAYER_OPTIONS.map((opt) => (
          <RadioRow key={opt} label={opt} selected={players === opt} onPress={() => setPlayers(opt)} />
        ))}

        <View style={{ marginTop: spacing.xl }}>
          <PillButton label="Show results" onPress={() => setFiltersOpen(false)} fullWidth />
        </View>
      </BottomSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep },
  content: { padding: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xxl * 2 },
  searchRow: { flexDirection: "row", gap: spacing.sm },
  searchBar: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "#FFFFFF", borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 10, borderWidth: 1, borderColor: colors.hairline },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink },
  filterBtn: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.hairline, alignItems: "center", justifyContent: "center" },
  filterBadge: { position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.pink, alignItems: "center", justifyContent: "center" },
  filterBadgeText: { fontSize: 9, color: "#FFFFFF", fontWeight: "700" },
  label: { fontSize: 15, fontWeight: "700", color: colors.orange, marginTop: spacing.xl, marginBottom: spacing.sm },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  seeAll: { fontSize: 13, fontWeight: "600", color: colors.inkMuted, marginTop: spacing.xl },
  moodRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  moodChip: { paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: "#F2F2F7" },
  moodChipActive: { backgroundColor: colors.orange },
  moodText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  moodTextActive: { color: "#FFFFFF" },
  areaCard: { width: 130, backgroundColor: "#FFFFFF", borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.hairline },
  areaPhoto: { width: "100%", height: 70 },
  areaTextWrap: { padding: spacing.sm },
  areaName: { fontSize: 13, fontWeight: "700", color: colors.ink },
  areaCount: { fontSize: 11, color: colors.inkMuted, marginTop: 2 },
  noResults: { textAlign: "center", color: colors.inkMuted, marginTop: spacing.xl },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: colors.inkNavy },
  clearText: { fontSize: 14, fontWeight: "600", color: colors.pink },
  groupLabel: { fontSize: 13, fontWeight: "700", color: colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.xs },
});
