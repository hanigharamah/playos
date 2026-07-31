import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { format, isSameDay } from "date-fns";
import { Search, ArrowLeft } from "lucide-react-native";
import { useListGames } from "@/lib/api";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import { BrowseSkeleton, useDelayedVisible } from "@/components/Skeleton";
import { VenuesEmpty, MatchesEmpty } from "@/components/BrowseEmpty";
import { colors, spacing } from "@/lib/theme";
import { screen } from "@/lib/analytics";

// Exact palette from the Figma Browse screen (node 1:8)
const INK = "#1C1C1E";
const MUTED = "#6C6C70";

/**
 * Browse — venues / matches toggle (Figma 1:8 and Browse-Matches 324:315).
 *
 * The design shows a star rating and a km distance on each venue row. Neither
 * exists yet: `pitches` has no rating column and there's no device-location
 * wiring, so those are omitted rather than faked. Rows show what's real —
 * venue photo, name, and how many games are open there.
 */
export default function Browse() {
  const router = useRouter();
  const { data: games, isLoading, isError } = useListGames();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"venues" | "matches">("venues");

  useEffect(() => { screen("Browse"); }, []);

  // Held back 300ms so a warm cache doesn't flash it (Figma 698:553).
  const showSkeleton = useDelayedVisible(isLoading && !games);

  // A failed list must not leave the skeleton pulsing.
  useEffect(() => { if (isError) router.replace("/error/server"); }, [isError, router]);

  const q = query.trim().toLowerCase();
  const matches = (games ?? []).filter(
    (g) => !q || g.title.toLowerCase().includes(q) || g.pitchName.toLowerCase().includes(q),
  );

  const venues = useMemo(() => {
    const map = new Map<string, { count: number; photo: string | null }>();
    for (const g of matches) {
      const existing = map.get(g.pitchName);
      map.set(g.pitchName, { count: (existing?.count ?? 0) + 1, photo: existing?.photo ?? g.pitchPhotoUrl });
    }
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [matches]);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
        <ArrowLeft size={20} color={INK} strokeWidth={2} />
      </Pressable>

      {/* Search (Figma 9:3) */}
      <View style={styles.searchBar}>
        <Search size={20} color={MUTED} strokeWidth={1.8} />
        <TextInput
          style={styles.searchInput}
          placeholder="search venues or matches"
          placeholderTextColor={MUTED}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {/* Tabs (Figma 9:7 / 9:8) */}
      <View style={styles.tabs}>
        <Pressable onPress={() => setTab("venues")}>
          <Text style={[styles.tab, tab === "venues" && styles.tabActive]}>venues</Text>
        </Pressable>
        <Pressable onPress={() => setTab("matches")}>
          <Text style={[styles.tab, tab === "matches" && styles.tabActive]}>matches</Text>
        </Pressable>
      </View>
      <View style={[styles.underline, tab === "matches" && styles.underlineMatches]} />

      {showSkeleton && <BrowseSkeleton />}

      {!showSkeleton && (tab === "venues"
        ? venues.map(([name, { count, photo }]) => (
            <Pressable key={name} style={styles.row} onPress={() => { setQuery(name); setTab("matches"); }}>
              <Image source={{ uri: getVenuePhoto(name, photo) }} style={styles.thumb} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>{name}</Text>
                <Text style={styles.rowSub}>{count} {count === 1 ? "game" : "games"} open</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))
        : matches.map((g) => {
            const kickoff = new Date(g.kickoffTime);
            const teamSize = g.capacity / 2;
            const spotsLeft = g.capacity - g.bookedCount;
            return (
              <Pressable key={g.id} style={styles.row} onPress={() => router.push(`/game/${g.id}`)}>
                <Image source={{ uri: getVenuePhoto(g.pitchName, g.pitchPhotoUrl) }} style={styles.thumb} />
                <View style={styles.rowText}>
                  {/* Figma Match Row (323:315): format · venue, then when, then spots */}
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {teamSize}v{teamSize} · {g.pitchName}
                  </Text>
                  <Text style={styles.rowSub}>
                    {isSameDay(kickoff, new Date()) ? "Today" : format(kickoff, "EEE")} · {format(kickoff, "h:mm a")}
                  </Text>
                  <Text style={styles.rowSpots}>
                    {spotsLeft > 0 ? `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} left` : "full"}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            );
          }))}

      {/* Empty states, picked by tab (Figma 697:540 venues / 697:585 matches). */}
      {!showSkeleton && !isLoading && tab === "venues" && venues.length === 0 && (
        <VenuesEmpty query={query} allGames={games ?? []} onClearSearch={() => setQuery("")} />
      )}
      {!showSkeleton && !isLoading && tab === "matches" && matches.length === 0 && (
        <MatchesEmpty query={query} allGames={games ?? []} onClearSearch={() => setQuery("")} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0" },
  content: { paddingHorizontal: 20, paddingTop: spacing.xxl, paddingBottom: 130 },

  back: { height: 28, justifyContent: "center", marginBottom: 8 },

  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 11,
    height: 44, borderRadius: 14, paddingHorizontal: 11,
    backgroundColor: "rgba(255,255,255,0.4)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.75)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: INK, padding: 0 },

  tabs: { flexDirection: "row", gap: 26, marginTop: spacing.xl },
  tab: { fontSize: 15, color: "#99999E" },
  tabActive: { fontWeight: "700", color: INK },
  underline: { width: 54, height: 2, backgroundColor: colors.orange, marginTop: 6, marginBottom: 18 },
  underlineMatches: { marginLeft: 80, width: 64 },

  row: {
    flexDirection: "row", alignItems: "center", height: 92, borderRadius: 18, padding: 11,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    marginBottom: 12,
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 18, elevation: 3,
  },
  thumb: { width: 68, height: 68, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.6)" },
  rowText: { flex: 1, marginLeft: 12 },
  rowTitle: { fontSize: 17, fontWeight: "700", color: INK },
  rowSub: { fontSize: 13, color: MUTED, marginTop: 6 },
  rowSpots: { fontSize: 13, fontWeight: "600", color: "#FF8A00", marginTop: 5 },
  chevron: { fontSize: 18, fontWeight: "700", color: MUTED },
});
