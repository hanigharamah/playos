import { useEffect, useMemo, useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, type LayoutChangeEvent } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { format, isSameDay } from "date-fns";
import { Search, ArrowLeft, LocateFixed, MapPin, Navigation, ChevronRight } from "lucide-react-native";
import { useListGames, usePitchMeta } from "@/lib/api";
import { VenueArt } from "@/components/VenueArt";
import { useMyLocation, sortByDistance, distanceKm, distanceLabel } from "@/lib/nearby";
import { PitchSchematic } from "@/components/PitchSchematic";
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

// Sampled off the Browse mock at 2x rather than the Figma tokens — the mock
// runs materially darker on ink and colder on the greys.
//
// Its orange was screen-local at first, for exactly the reason you would
// expect: repainting the shared token against a mock that covers one screen
// is a big change from a small sample. It has since been promoted —
// colors.orange IS the mock's vermilion now, app-wide — so this screen uses
// the token and there is no second orange to drift from.
//
// INK and MUTED stay local. They are the mock's, they differ from the Figma
// values on purpose, and nothing has argued they should be everyone's.
const INK = "#0B0B0C";
const MUTED = "#67676A";
/** Card ink, one step lighter than the headline — mock samples ~(91,88,88). */
const META = "#5B5858";

type Tab = "venues" | "matches";

/**
 * Browse — venues / matches toggle (Figma 1:8 and Browse-Matches 324:315).
 *
 * The design shows a star rating and a km distance on each venue row. Neither
 * exists yet: `pitches` has no rating column and there's no device-location
 * wiring, so those are omitted rather than faked. Rows show what's real —
 * a drawn site plan, the name, the district, and the next kickoff. Spot
 * counts belong to a match, not a venue, so they live on the matches tab.
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

  const { data: pitchMeta } = usePitchMeta();
  const { coords: me, status: locStatus, request: requestLocation } = useMyLocation();

  /**
   * The venue list, nearest-first when that is knowable.
   *
   * "Knowable" needs two things that are independently absent: a location fix
   * the player granted, and coordinates an operator typed in. When either is
   * missing this falls back to most-open-games-first — the order the screen
   * shipped with — rather than to an arbitrary one. A venue without
   * coordinates keeps its row and sorts after the located ones; it still has
   * real bookable games and hiding it would hide football.
   */
  const venues = useMemo(() => {
    const map = new Map<string, {
      count: number; photo: string | null; area: string | null;
      tonight: number; next: Date | null;
    }>();
    for (const g of matches) {
      const e = map.get(g.pitchName);
      const kickoff = new Date(g.kickoffTime);
      map.set(g.pitchName, {
        count: (e?.count ?? 0) + 1,
        photo: e?.photo ?? g.pitchPhotoUrl,
        area: e?.area ?? g.locationText ?? null,
        tonight: (e?.tonight ?? 0) + (isSameDay(kickoff, new Date()) ? 1 : 0),
        // Soonest, not first seen — the feed is not guaranteed sorted.
        next: !e?.next || kickoff < e.next ? kickoff : e.next,
      });
    }

    const entries = Array.from(map.entries());
    return sortByDistance(
      entries,
      me,
      ([name]) => {
        const p = pitchMeta?.get(name);
        return p?.lat != null && p?.lng != null ? { lat: p.lat, lng: p.lng } : null;
      },
      (a, b) => b[1].count - a[1].count,
    );
  }, [matches, me, pitchMeta]);

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

      {/* Search (Figma 9:3). The locate control sits INSIDE the pill in the
          mock — a 27pt disc inset 8pt from the right end, not a sibling
          button beside it. */}
      <View style={styles.searchRow}>
        <GlassCard variant="soft" round={14} padding={0} style={{ flex: 1 }}>
          <View style={styles.searchBar}>
            <Search size={14} color="#919093" strokeWidth={1.8} />
            <TextInput
              style={styles.searchInput}
              placeholder="search venues or matches"
              placeholderTextColor="#989698"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
            {/* Asks for location, which is what a locate control should do.
                Deliberately NOT asked for on mount: a permission sheet that
                appears the moment Browse opens, before the player knows why,
                is how you earn a permanent denial — and iOS never asks twice.
                Here the player has just tapped the thing that means "sort by
                how close these are", so the prompt has a reason attached.
                Falls back to the area picker once denied, since that is then
                the only way left to narrow by place. Dark icon, not orange:
                the mock draws it in ink. */}
            <Pressable
              onPress={async () => {
                if (locStatus === "denied") { router.push("/permission/location"); return; }
                const ok = await requestLocation();
                if (!ok) router.push("/permission/location");
              }}
              style={styles.locateBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Sort pitches by how close they are"
            >
              <LocateFixed size={14} color={INK} strokeWidth={2} />
            </Pressable>
          </View>
        </GlassCard>
      </View>

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

      {/* "N pitches near you". The count is real — it is the venues that
          actually have open games. Whether "near" is true depends on
          `sortedByDistance`: with a fix and coordinates the list really is
          nearest-first, and without either it falls back to most-games-first.
          See the note on `venues` above. */}
      <View style={styles.countRow}>
        {/* Solid pin, not an outline — the mock's marker is filled. */}
        <MapPin size={12} color={colors.orange} fill={colors.orange} strokeWidth={2} />
        <Text style={styles.countText}>
          <Text style={styles.countStrong}>
            {tab === "venues" ? venues.length : matches.length}
          </Text>
          {tab === "venues"
            ? ` ${venues.length === 1 ? "pitch" : "pitches"} near you`
            : ` ${matches.length === 1 ? "match" : "matches"} open`}
        </Text>
      </View>


      {showSkeleton && <BrowseSkeleton />}

      {!showSkeleton && (tab === "venues"
        ? venues.map(([name, { count, area, tonight, next }]) => (
            <Pressable key={name} onPress={() => { setQuery(name); setTab("matches"); }}>
              <GlassCard variant="soft" round={16} padding={0} style={styles.venueCard}>
                <View style={styles.venueRow}>
                  {/* The mock's thumbnail is a drawn site plan, not a photo. */}
                  <PitchSchematic name={name} width={156} height={86} />
                  <View style={styles.venueText}>
                    <View style={styles.venueTitleRow}>
                      <Text style={styles.venueName} numberOfLines={1}>{name}</Text>
                      <ChevronRight size={16} color="#6F6E71" strokeWidth={2.2} />
                    </View>

                    {/* The mock's "2.1 km away". Real when the player has
                        granted location AND the operator has recorded this
                        venue's coordinates; the district is the fallback when
                        either is missing, and it is what a Riyadh player
                        navigates by anyway. Never both — one line, one fact. */}
                    {(() => {
                      const p = pitchMeta?.get(name);
                      const km = me && p?.lat != null && p?.lng != null
                        ? distanceKm(me, { lat: p.lat, lng: p.lng })
                        : null;
                      const line = km != null ? distanceLabel(km) : area;
                      if (!line) return null;
                      return (
                        <View style={styles.venueMeta}>
                          <Navigation size={10} color={META} strokeWidth={2} />
                          <Text style={styles.venueMetaText} numberOfLines={1}>{line}</Text>
                        </View>
                      );
                    })()}

                    {/* No spots-left pill on a VENUE. Summing spots across a
                        venue's open games gives a number that belongs to no
                        single match and that nobody can book — "11 spots" at
                        KAFD might be 3 in one game and 8 in another next
                        Tuesday. It stays on the matches tab, where a spot
                        count describes one game and means something.

                        The surface pill renders only when the operator has
                        recorded one — null means "not said yet", and
                        defaulting it to Outdoor would be a guess printed as
                        a fact. */}
                    <View style={styles.pillRow}>
                      {!!pitchMeta?.get(name)?.surface && (
                        <View style={styles.pill}>
                          <Text style={styles.pillText}>{pitchMeta.get(name)!.surface}</Text>
                        </View>
                      )}
                      {!!next && (
                        <View style={styles.pill}>
                          <Text style={styles.pillText}>next {format(next, "h:mm a").toLowerCase()}</Text>
                        </View>
                      )}
                    </View>

                    {/* The mock's "4 matches tonight". "tonight" only shows
                        when a game actually kicks off today. */}
                    <Text style={styles.venueTail} numberOfLines={1}>
                      {tonight > 0 ? (
                        <>
                          {tonight} {tonight === 1 ? "match" : "matches"}{" "}
                          <Text style={styles.venueTailAccent}>tonight</Text>
                        </>
                      ) : (
                        `${count} ${count === 1 ? "match" : "matches"} open`
                      )}
                    </Text>
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
                    <VenueArt name={g.pitchName} style={styles.thumb} />
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
  // 30pt gutters: the mock's cards, search pill and segment all start at 58px
  // (=29pt) and end at 783px (=34.5pt from the right). Symmetric 30 splits the
  // difference; the mock's own 2.75pt off-centre is a render artefact.
  content: { paddingHorizontal: 30, paddingBottom: 130 },

  // 63px across in the mock = 31.5pt, with a 26px arrow.
  backCircle: {
    width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
    marginBottom: 16,
  },

  // Script eyebrow, big ink headline, muted line — the mock's masthead.
  // Title cap height measures 41px = 20.5pt, which is ~29pt of a 0.71-cap
  // face; the mock's headline face is narrower than SF, so the line runs wide
  // of the mock's 142pt at the size that matches its height. Height wins.
  eyebrow: { fontSize: 17, color: colors.orange },
  title: { fontSize: 29, fontWeight: "800", color: INK, marginTop: 0, letterSpacing: -1 },
  subtitle: { fontSize: 12, color: "#8E8D8F", marginTop: 4 },

  searchRow: { flexDirection: "row", alignItems: "center", marginTop: 18 },
  // A 27pt disc riding inside the right end of the pill, 8pt from the edge.
  locateBtn: {
    width: 27, height: 27, borderRadius: 13.5, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },

  // No inner padding: in the mock the white half runs edge to edge and is
  // exactly half the track, both ends fully rounded.
  segment: {
    flexDirection: "row", marginTop: 14, borderRadius: 17, height: 34,
    backgroundColor: "#F2EBE5",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.7)",
  },
  segmentHalf: { flex: 1, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  segmentOn: {
    backgroundColor: "#FCF7F2",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 2,
  },
  segmentText: { fontSize: 12, color: MUTED, fontWeight: "500" },
  segmentTextOn: { color: INK, fontWeight: "700" },

  // 110pt tall, 5.5pt apart, 16pt radius, 12pt padding — all measured.
  venueCard: { marginBottom: 6 },
  venueRow: { flexDirection: "row", alignItems: "center", minHeight: 110, padding: 12 },
  venueText: { flex: 1, marginLeft: 14 },
  venueTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  venueName: { flex: 1, fontSize: 14, fontWeight: "700", color: INK, lineHeight: 18 },
  venueMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  venueMetaText: { flex: 1, fontSize: 11, color: META },
  venueTail: { fontSize: 11.5, color: "#706E6E", marginTop: 8 },
  venueTailAccent: { color: colors.orange, fontWeight: "600" },

  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    height: 18, paddingHorizontal: 9, borderRadius: 9,
    backgroundColor: "#FAF1EA",
  },
  pillWarm: { backgroundColor: "#FCF1E7" },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.orange },
  pillText: { fontSize: 11, fontWeight: "600", color: "#363739" },
  // The mock runs this in full-strength orange rather than the dark
  // `colors.orangeText` this app reserves for small type. #FD6A03 on the pill
  // measures ~2.8:1 — better than the amber it replaces, still under 4.5:1.
  pillTextWarm: { color: colors.orange },

  countRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 19, marginBottom: 7 },
  countText: { fontSize: 12, color: INK },
  countStrong: { fontWeight: "700", color: INK },

  pageTitle: { fontSize: 34, color: colors.orange, marginBottom: 18 },

  // Ported from the Play tab, which Browse absorbed — geometry unchanged.

  // Layout only — fill, stroke and shadows come from <GlassCard>. minHeight
  // rather than the height it was: the field holds text.
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 7,
    minHeight: 40, paddingLeft: 14, paddingRight: 8,
  },
  searchInput: { flex: 1, fontSize: 12, color: INK, padding: 0 },

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
