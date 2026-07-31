import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { format, isSameDay } from "date-fns";
import { Search } from "lucide-react-native";
import { useListGames } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { PlayNothingLive } from "@/components/PlayNothingLive";
import { BrowseSkeleton, useDelayedVisible } from "@/components/Skeleton";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import { colors, spacing } from "@/lib/theme";
import { screen } from "@/lib/analytics";

// Exact palette from the Figma Play screen (node 1:3)
const INK = "#1C1C1E";
const MUTED = "#6C6C70";
const CARD_SUB = "#B3B3B3";

export default function Play() {
  const router = useRouter();
  const { data: games, isLoading, isError } = useListGames();
  const [query, setQuery] = useState("");

  useEffect(() => { screen("Play"); }, []);

  const showSkeleton = useDelayedVisible(isLoading && !games);

  // A failed feed must not masquerade as an empty one.
  useEffect(() => { if (isError) router.replace("/error/server"); }, [isError, router]);

  // Areas are derived from the games feed: one tile per venue, most games first.
  const areas = useMemo(() => {
    const map = new Map<string, { count: number; photo: string | null }>();
    for (const g of games ?? []) {
      const existing = map.get(g.pitchName);
      map.set(g.pitchName, { count: (existing?.count ?? 0) + 1, photo: existing?.photo ?? g.pitchPhotoUrl });
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6);
  }, [games]);

  const q = query.trim().toLowerCase();
  const filtered = (games ?? []).filter(
    (g) => !q || g.title.toLowerCase().includes(q) || g.pitchName.toLowerCase().includes(q),
  );
  // filtered is ordered by kickoff (useListGames sorts kickoff_time ASC), so
  // this is the next match, not the nearest one. There is no device location
  // and no venue coordinates, so nothing here can rank by distance.
  const nextUp = filtered[0];

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Search (Figma 3:3 — glass 350×44) */}
      <View style={styles.searchBar}>
        <Search size={20} color={MUTED} strokeWidth={1.8} />
        <TextInput
          style={styles.searchInput}
          placeholder="search venues or areas"
          placeholderTextColor={MUTED}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {/* Areas near you (Figma 3:12) */}
      {areas.length > 0 && (
        <>
          <View style={styles.rowBetween}>
            <HandwrittenHeader style={styles.sectionLabel}>areas near you</HandwrittenHeader>
            <Pressable onPress={() => router.push("/browse")}>
              <Text style={styles.seeAll}>see all</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tileRow}
          >
            {areas.map(([name, { count, photo }], i) => (
              <Pressable key={name} style={styles.areaTile} onPress={() => setQuery(name)}>
                <Image source={{ uri: getVenuePhoto(name, photo) }} style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.62)"]}
                  style={StyleSheet.absoluteFill}
                />
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

      {/* Figma 3:23 + 3:24 label this "Closest to you". Renamed: there is no
          location data, so claiming proximity would be a lie. */}
      {nextUp && (
        <>
          <HandwrittenHeader style={[styles.sectionLabel, styles.closestLabel]}>Next up</HandwrittenHeader>
          <Pressable style={styles.matchCard} onPress={() => router.push(`/game/${nextUp.id}`)}>
            <Image
              source={{ uri: getVenuePhoto(nextUp.pitchName, nextUp.pitchPhotoUrl) }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.72)"]}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.cardMeta}>
              {isSameDay(new Date(nextUp.kickoffTime), new Date())
                ? "TONIGHT"
                : format(new Date(nextUp.kickoffTime), "EEE").toUpperCase()}
              {" • "}
              {format(new Date(nextUp.kickoffTime), "h:mm a")}
            </Text>
            <Text style={styles.cardTitle} numberOfLines={1}>{nextUp.title}</Text>
            <Text style={styles.cardSub}>
              {Math.floor(nextUp.capacity / 2)}v{Math.floor(nextUp.capacity / 2)}
            </Text>

            <View style={styles.cardAvatars}>
              {Array.from({ length: Math.min(nextUp.bookedCount, 4) }).map((_, i) => (
                <View key={i} style={[styles.cardAvatar, { marginLeft: i === 0 ? 0 : -8 }]}>
                  <Avatar name={`P${i + 1}`} size={28} />
                </View>
              ))}
              {nextUp.bookedCount > 4 && (
                <View style={styles.avatarBadge}>
                  <Text style={styles.avatarBadgeText}>+{nextUp.bookedCount - 4}</Text>
                </View>
              )}
            </View>

            <View style={styles.joinBtn}>
              <Text style={styles.joinBtnText}>join</Text>
            </View>
          </Pressable>
        </>
      )}

      {/* Nothing live at all (Figma 697:506) — the designed state. A search
          that happens to match nothing is a different situation and keeps the
          plain no-results line, since the tab itself is not empty. */}
      {/* Without this gate the tab flashed "nothing is live right now" during
          every cold fetch, and showed it permanently when the request failed. */}
      {showSkeleton && <BrowseSkeleton />}
      {!showSkeleton && !isLoading && (games ?? []).length === 0 && <PlayNothingLive />}

      {(games ?? []).length > 0 && filtered.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No games found</Text>
          <Text style={styles.emptyBody}>Try a different search.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0" },
  content: { paddingHorizontal: 20, paddingTop: spacing.xxl + 20, paddingBottom: 130 },

  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 2,
    height: 44, borderRadius: 14, paddingHorizontal: 11,
    backgroundColor: "rgba(255,255,255,0.4)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.75)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: INK, padding: 0 },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: spacing.xl },
  sectionLabel: { fontSize: 20 },
  closestLabel: { marginTop: spacing.xl, marginBottom: spacing.md },
  seeAll: { fontSize: 13, fontWeight: "600", color: MUTED, marginBottom: 2 },

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

  matchCard: {
    height: 160, borderRadius: 20, overflow: "hidden", padding: 16,
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 5,
  },
  cardMeta: { fontSize: 11, fontWeight: "600", color: colors.orange },
  cardTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF", marginTop: 4 },
  cardSub: { fontSize: 13, color: CARD_SUB, marginTop: 8 },
  cardAvatars: { flexDirection: "row", alignItems: "center", position: "absolute", left: 16, bottom: 36 },
  cardAvatar: { borderWidth: 1.5, borderColor: "rgba(255,255,255,0.9)", borderRadius: 15 },
  avatarBadge: {
    width: 28, height: 28, borderRadius: 14, marginLeft: -8,
    backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center", justifyContent: "center",
  },
  avatarBadgeText: { fontSize: 11, fontWeight: "700", color: "#FFFFFF" },
  joinBtn: {
    position: "absolute", right: 16, bottom: 16,
    width: 72, height: 36, borderRadius: 18,
    backgroundColor: "#F0731F", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
  },
  joinBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },

  empty: { alignItems: "center", paddingVertical: spacing.xxl * 2 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: INK },
  emptyBody: { fontSize: 13, color: MUTED, marginTop: 4 },
});
