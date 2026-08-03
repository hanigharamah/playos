import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Image, type LayoutChangeEvent } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { format, isSameDay } from "date-fns";
import { Search, ArrowLeft } from "lucide-react-native";
import { useListGames } from "@/lib/api";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import { BrowseSkeleton, useDelayedVisible } from "@/components/Skeleton";
import { VenuesEmpty, MatchesEmpty } from "@/components/BrowseEmpty";
import { PlayNothingLive } from "@/components/PlayNothingLive";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { WarmCanvas } from "@/components/WarmCanvas";
import { BAR_INSET, useMatchDayBar } from "@/components/MatchDayBar";
import { colors, spacing } from "@/lib/theme";
import { screen } from "@/lib/analytics";

// Exact palette from the Figma Browse screen (node 1:8)
const INK = "#1C1C1E";
const MUTED = "#6C6C70";

type Tab = "venues" | "matches";

/**
 * Browse — venues / matches toggle (Figma 1:8 and Browse-Matches 324:315).
 *
 * The design shows a star rating and a km distance on each venue row. Neither
 * exists yet: `pitches` has no rating column and there's no device-location
 * wiring, so those are omitted rather than faked. Rows show what's real —
 * venue photo, name, and how many games are open there.
 */
const GLOWS = [
  { cx: 0.8, cy: 0.15, r: 0.9, color: "rgba(255,225,204,0.35)" },
  { cx: 0.65, cy: 0.3, r: 0.6, color: "rgba(255,217,228,0.2)" },
];

export default function Browse() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Browse is a tab screen now, so the match-day bar renders over it and its
  // content has to drop by the bar's height while it shows (Figma 834:470).
  const barInset = useMatchDayBar() ? BAR_INSET : 0;
  const { data: games, isLoading, isError } = useListGames();
  // permission/location.tsx replaces to /browse with the chosen area. Nothing
  // read it, so picking an area landed on an unfiltered list.
  const { area } = useLocalSearchParams<{ area?: string }>();
  const [query, setQuery] = useState(area ?? "");
  const [tab, setTab] = useState<Tab>("venues");

  useEffect(() => { screen("Browse"); }, []);

  // Held back 300ms so a warm cache doesn't flash it (Figma 698:553).
  const showSkeleton = useDelayedVisible(isLoading && !games);

  // A failed list must not leave the skeleton pulsing.
  useEffect(() => { if (isError) router.push("/error/server"); }, [isError, router]);

  const q = query.trim().toLowerCase();
  const matches = (games ?? []).filter(
    (g) => !q || g.title.toLowerCase().includes(q) || g.pitchName.toLowerCase().includes(q),
  );

  // Underline position comes from the tabs' own layout.
  const [tabRects, setTabRects] = useState<Record<Tab, { x: number; w: number }>>({
    venues: { x: 0, w: 54 },
    matches: { x: 88, w: 64 },
  });
  const measure = (key: Tab) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setTabRects((prev) =>
      prev[key].x === x && prev[key].w === width ? prev : { ...prev, [key]: { x, w: width } },
    );
  };
  const tabBar = tabRects[tab];

  const venues = useMemo(() => {
    const map = new Map<string, { count: number; photo: string | null }>();
    for (const g of matches) {
      const existing = map.get(g.pitchName);
      map.set(g.pitchName, { count: (existing?.count ?? 0) + 1, photo: existing?.photo ?? g.pitchPhotoUrl });
    }
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [matches]);

  // Areas near you (Figma 3:12) — carried over from the Play tab, which this
  // screen absorbed. Derived from the whole feed, not the filtered list, so
  // the strip stays put while a search narrows the rows beneath it.
  const areas = useMemo(() => {
    const map = new Map<string, { count: number; photo: string | null }>();
    for (const g of games ?? []) {
      const existing = map.get(g.pitchName);
      map.set(g.pitchName, { count: (existing?.count ?? 0) + 1, photo: existing?.photo ?? g.pitchPhotoUrl });
    }
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count).slice(0, 6);
  }, [games]);

  // At a tab root there is nothing to go back to, so the arrow would be a dead
  // tap. It still renders when Browse was pushed — from activity, refund, the
  // location picker or an empty state — which is where it was ratified.
  const canGoBack = router.canGoBack();

  return (
    <View style={{ flex: 1 }}>
      <WarmCanvas base="#FFF8F0" glows={GLOWS} />
      <ScrollView style={styles.wrap} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 + barInset }]} showsVerticalScrollIndicator={false}>
      {canGoBack ? (
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <ArrowLeft size={20} color={INK} strokeWidth={2} />
        </Pressable>
      ) : (
        // Without the arrow the screen would start flush against the status
        // bar, so the tab root gets the title the pushed screen doesn't need.
        <HandwrittenHeader style={styles.pageTitle}>browse</HandwrittenHeader>
      )}

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

      {/* Areas near you (Figma 3:12) */}
      {areas.length > 0 && (
        <>
          <HandwrittenHeader style={styles.areasLabel}>areas near you</HandwrittenHeader>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tileRow}>
            {areas.map(([name, { count, photo }], i) => (
              <Pressable
                key={name}
                style={styles.areaTile}
                onPress={() => { setQuery(name); setTab("matches"); }}
              >
                <Image source={{ uri: getVenuePhoto(name, photo) }} style={StyleSheet.absoluteFill} />
                <LinearGradient colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.62)"]} style={StyleSheet.absoluteFill} />
                {i === 0 && (
                  <View style={styles.closestBadge}>
                    <Text style={styles.closestBadgeText}>most games</Text>
                  </View>
                )}
                <View style={styles.areaTileText}>
                  <Text style={styles.areaName} numberOfLines={2}>{name}</Text>
                  {/* TODO: prefix travel time once device location is wired up */}
                  <Text style={styles.areaMeta}>{count} {count === 1 ? "game" : "games"}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      {/* Tabs (Figma 9:7 / 9:8) */}
      <View style={styles.tabs}>
        <Pressable onPress={() => setTab("venues")} onLayout={measure("venues")}>
          <Text style={[styles.tab, tab === "venues" && styles.tabActive]}>venues</Text>
        </Pressable>
        <Pressable onPress={() => setTab("matches")} onLayout={measure("matches")}>
          <Text style={[styles.tab, tab === "matches" && styles.tabActive]}>matches</Text>
        </Pressable>
      </View>
      {/* Measured rather than hard-coded: the offsets were pixel values tied to
          a tab gap that has since changed, so the bar drifted off its label. */}
      <View style={[styles.underline, { marginLeft: tabBar.x, width: tabBar.w }]} />

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

      {/* Nothing live at all (Figma 697:506) — the designed state, carried over
          from the Play tab. Distinct from a search that matched nothing, which
          is what the two empties below are for: the feed itself is not empty. */}
      {!showSkeleton && !isLoading && (games ?? []).length === 0 && <PlayNothingLive />}

      {/* Empty states, picked by tab (Figma 697:540 venues / 697:585 matches). */}
      {!showSkeleton && !isLoading && (games ?? []).length > 0 && tab === "venues" && venues.length === 0 && (
        <VenuesEmpty
            query={query}
            allGames={games ?? []}
            onClearSearch={() => setQuery("")}
            onPickVenue={(name) => { setQuery(name); setTab("matches"); }}
          />
      )}
      {!showSkeleton && !isLoading && (games ?? []).length > 0 && tab === "matches" && matches.length === 0 && (
        <MatchesEmpty query={query} allGames={games ?? []} onClearSearch={() => setQuery("")} />
      )}
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent: this ScrollView sits above <WarmCanvas />, which is
  // absoluteFill, so an opaque cream here hid the peach glow completely.
  wrap: { flex: 1, backgroundColor: "transparent" },
  content: { paddingHorizontal: 20, paddingBottom: 130 },

  back: { height: 28, justifyContent: "center", marginBottom: 8 },
  pageTitle: { fontSize: 34, color: "#FF9F0A", marginBottom: 18 },

  // Ported from the Play tab, which Browse absorbed — geometry unchanged.
  areasLabel: { fontSize: 20, marginTop: spacing.xl },
  tileRow: { gap: 10, marginTop: spacing.md, paddingRight: spacing.lg },
  areaTile: {
    width: 105, height: 130, borderRadius: 16, overflow: "hidden", justifyContent: "flex-end",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  closestBadge: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: "rgba(255,138,0,0.9)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 11,
    shadowColor: "#E56600", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 2,
  },
  closestBadgeText: { fontSize: 10, fontWeight: "600", color: "#FFFFFF" },
  areaTileText: { padding: 10 },
  areaName: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  areaMeta: { fontSize: 10, color: "#FFFFFF", marginTop: 4 },

  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 2,
    height: 44, borderRadius: 14, paddingHorizontal: 11,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: INK, padding: 0 },

  tabs: { flexDirection: "row", gap: 34, marginTop: spacing.xl },
  tab: { fontSize: 15, color: "#6C6C70" },
  tabActive: { fontWeight: "700", color: INK },
  underline: { width: 54, height: 2, backgroundColor: colors.orange, marginTop: 6, marginBottom: 18 },

  row: {
    // minHeight, not height: the matches rows stack three lines of text plus
    // their margins inside 70pt of inner box, which overflows at larger text
    // sizes. With a fixed height and centred content the spill lands on the
    // neighbouring row instead of growing the card.
    flexDirection: "row", alignItems: "center", minHeight: 92, borderRadius: 18, padding: 11,
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
