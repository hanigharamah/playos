import { useEffect, useMemo, useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Image, type LayoutChangeEvent } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { format, isSameDay } from "date-fns";
import { Search, ArrowLeft, LocateFixed, MapPin, Navigation, ChevronRight } from "lucide-react-native";
import { useListGames } from "@/lib/api";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import { BrowseSkeleton, useDelayedVisible } from "@/components/Skeleton";
import { VenuesEmpty, MatchesEmpty } from "@/components/BrowseEmpty";
import { PlayNothingLive } from "@/components/PlayNothingLive";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { WarmCanvas } from "@/components/WarmCanvas";
import { GlassCard } from "@/components/GlassCard";
import { BAR_INSET, useMatchDayBar } from "@/components/MatchDayBar";
import { colors, spacing } from "@/lib/theme";
import { useScrollToTop } from "@/lib/scrollToTop";
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
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop("browse", scrollRef);

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

  const venues = useMemo(() => {
    // Also totals the open spots across a venue's games and keeps its district,
    // which is what the card shows in place of the mock's distance.
    const map = new Map<string, { count: number; photo: string | null; spots: number; area: string | null }>();
    for (const g of matches) {
      const e = map.get(g.pitchName);
      map.set(g.pitchName, {
        count: (e?.count ?? 0) + 1,
        photo: e?.photo ?? g.pitchPhotoUrl,
        spots: (e?.spots ?? 0) + Math.max(0, g.capacity - g.bookedCount),
        area: e?.area ?? g.locationText ?? null,
      });
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
      <ScrollView ref={scrollRef} style={styles.wrap} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 + barInset }]} showsVerticalScrollIndicator={false}>
      {/* The arrow only renders where it can go somewhere — at the tab root it
          would be a dead tap. The heading below carries the screen either way,
          which is why the title no longer has to substitute for it. */}
      {canGoBack && (
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backCircle}>
          <ArrowLeft size={20} color={INK} strokeWidth={2} />
        </Pressable>
      )}

      <HandwrittenHeader style={styles.eyebrow}>browse</HandwrittenHeader>
      <Text style={styles.title}>Find a pitch</Text>
      <Text style={styles.subtitle}>book a game near you</Text>

      {/* Search (Figma 9:3) */}
      <View style={styles.searchRow}>
        <GlassCard variant="soft" round={26} padding={0} style={{ flex: 1 }}>
          <View style={styles.searchBar}>
            <Search size={20} color={MUTED} strokeWidth={1.8} />
            <TextInput
              style={styles.searchInput}
              placeholder="search venues or matches"
              placeholderTextColor={MUTED}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
          </View>
        </GlassCard>
        {/* Area picker, not GPS. The design shows a locate control, but there
            is no device-location wiring and no venue coordinates — so this
            opens the area chooser, which is the real thing behind it. */}
        <Pressable
          onPress={() => router.push("/permission/location")}
          style={styles.locateBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Choose your area"
        >
          <LocateFixed size={20} color={colors.orange} strokeWidth={2} />
        </Pressable>
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

      {/* A segmented control, not underlined tabs: the two halves are peers
          and a filled thumb says which one you are on more plainly than a
          2pt rule. Replaces the measured-underline machinery entirely. */}
      <View style={styles.segment}>
        {(["venues", "matches"] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.segmentHalf, tab === t && styles.segmentOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
          >
            <Text style={[styles.segmentText, tab === t && styles.segmentTextOn]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {/* The count, from the data rather than the mock's "24 pitches near
          you" — there is no distance, and the venue list is whatever the open
          games actually name. */}
      <View style={styles.countRow}>
        <MapPin size={15} color={colors.orange} strokeWidth={2.2} />
        <Text style={styles.countText}>
          <Text style={styles.countStrong}>
            {tab === "venues" ? venues.length : matches.length}
          </Text>
          {tab === "venues"
            ? ` ${venues.length === 1 ? "venue" : "venues"} with games open`
            : ` ${matches.length === 1 ? "match" : "matches"} open`}
        </Text>
      </View>


      {showSkeleton && <BrowseSkeleton />}

      {!showSkeleton && (tab === "venues"
        ? venues.map(([name, { count, photo, spots, area }]) => (
            <Pressable key={name} onPress={() => { setQuery(name); setTab("matches"); }}>
              <GlassCard variant="soft" round={22} padding={0} style={styles.venueCard}>
                <View style={styles.venueRow}>
                  <Image source={{ uri: getVenuePhoto(name, photo) }} style={styles.venueThumb} />
                  <View style={styles.venueText}>
                    <View style={styles.venueTitleRow}>
                      <Text style={styles.venueName} numberOfLines={1}>{name}</Text>
                      <ChevronRight size={18} color={MUTED} strokeWidth={2.2} />
                    </View>

                    {/* The mock puts "2.1 km away" here. There is no device
                        location and no venue coordinates, so the district is
                        what is actually known — and it is the thing a Riyadh
                        player navigates by anyway. */}
                    {!!area && (
                      <View style={styles.venueMeta}>
                        <Navigation size={12} color={MUTED} strokeWidth={2} />
                        <Text style={styles.venueMetaText}>{area}</Text>
                      </View>
                    )}

                    {/* Two pills, not four. The mock's Outdoor/Indoor needs a
                        surface column and its 4.8 needs a ratings system;
                        neither exists, and inventing them is exactly what the
                        omitted star rating and distance were omitted for. */}
                    <View style={styles.pillRow}>
                      <View style={styles.pill}>
                        <View style={styles.pillDot} />
                        <Text style={styles.pillText}>
                          {spots} {spots === 1 ? "spot" : "spots"} left
                        </Text>
                      </View>
                      <View style={styles.pill}>
                        <Text style={styles.pillText}>
                          {count} {count === 1 ? "match" : "matches"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          ))
        : matches.map((g) => {
            const kickoff = new Date(g.kickoffTime);
            const teamSize = g.capacity / 2;
            const spotsLeft = g.capacity - g.bookedCount;
            return (
              <Pressable key={g.id} onPress={() => router.push(`/game/${g.id}`)}>
                <GlassCard variant="soft" round={18} padding={0} style={styles.rowCard}>
                  <View style={styles.row}>
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
                  </View>
                </GlassCard>
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

  backCircle: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
    marginBottom: 18,
  },

  // Script eyebrow, big ink headline, muted line — the mock's masthead.
  eyebrow: { fontSize: 22, color: colors.orange },
  title: { fontSize: 34, fontWeight: "800", color: INK, marginTop: 2, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: MUTED, marginTop: 4 },

  searchRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 22 },
  locateBtn: {
    width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 2,
  },

  segment: {
    flexDirection: "row", marginTop: 18, borderRadius: 26, padding: 5,
    backgroundColor: "rgba(240,232,224,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.7)",
  },
  segmentHalf: { flex: 1, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  segmentOn: {
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 2,
  },
  segmentText: { fontSize: 15, color: MUTED, fontWeight: "500" },
  segmentTextOn: { color: INK, fontWeight: "700" },

  // Bigger, rounder card than the old row: the mock gives the venue a block,
  // not a list line. minHeight because the pill row wraps at larger type.
  venueCard: { marginBottom: 14 },
  venueRow: { flexDirection: "row", alignItems: "center", minHeight: 104, padding: 12 },
  venueThumb: { width: 104, height: 80, borderRadius: 16, backgroundColor: "#EFE3D6" },
  venueText: { flex: 1, marginLeft: 14 },
  venueTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  venueName: { flex: 1, fontSize: 18, fontWeight: "700", color: INK },
  venueMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  venueMetaText: { fontSize: 12.5, color: MUTED },

  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    height: 26, paddingHorizontal: 10, borderRadius: 13,
    backgroundColor: "rgba(255,236,222,0.9)",
  },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.orange },
  pillText: { fontSize: 11.5, fontWeight: "600", color: "#A85A00" },

  countRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 22, marginBottom: 14 },
  countText: { fontSize: 14, color: MUTED },
  countStrong: { fontWeight: "700", color: INK },

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

  // Layout only — fill, stroke and shadows come from <GlassCard>. minHeight
  // rather than the height it was: the field holds text.
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 2,
    minHeight: 44, paddingHorizontal: 11,
  },
  searchInput: { flex: 1, fontSize: 14, color: INK, padding: 0 },

  tabs: { flexDirection: "row", gap: 34, marginTop: spacing.xl },
  tab: { fontSize: 15, color: "#6C6C70" },
  tabActive: { fontWeight: "700", color: INK },
  underline: { width: 54, height: 2, backgroundColor: colors.orange, marginTop: 6, marginBottom: 18 },

  rowCard: { marginBottom: 12 },
  row: {
    // minHeight, not height: the matches rows stack three lines of text plus
    // their margins inside 70pt of inner box, which overflows at larger text
    // sizes. With a fixed height and centred content the spill lands on the
    // neighbouring row instead of growing the card.
    flexDirection: "row", alignItems: "center", minHeight: 92, padding: 11,
  },
  thumb: { width: 68, height: 68, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.6)" },
  rowText: { flex: 1, marginLeft: 12 },
  rowTitle: { fontSize: 17, fontWeight: "700", color: INK },
  rowSub: { fontSize: 13, color: MUTED, marginTop: 6 },
  rowSpots: { fontSize: 13, fontWeight: "600", color: "#FF8A00", marginTop: 5 },
  chevron: { fontSize: 18, fontWeight: "700", color: MUTED },
});
