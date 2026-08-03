import { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Image, useWindowDimensions, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BAR_INSET, useMatchDayBar } from "@/components/MatchDayBar";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { format } from "date-fns";
import { Bell, Users, MapPin, User, ArrowRight } from "lucide-react-native";
import { useListGames, useGetMyBookings, useGetMe } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { DotWaveBackground } from "@/components/DotWaveBackground";
import { HomeSkeleton, useDelayedVisible } from "@/components/Skeleton";
import { HomeNothingBooked } from "@/components/HomeNothingBooked";
import { WarmCanvas } from "@/components/WarmCanvas";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import { serverNow } from "@/lib/serverTime";
import { colors, spacing } from "@/lib/theme";
import { screen } from "@/lib/analytics";

// Exact palette from the Figma Home (node 1:2)
const INK = "#1C1C1E";
const CARD_TITLE = "#262D48";
const CARD_META = "#5A564E";
const CARD_LABEL = "#8A8178";
const MUTED = "#6C6C70";

/** Check-in opens 20 minutes before kickoff. */
const CHECK_IN_OPENS_MS = 20 * 60_000;

/** "2d 4h" / "4h 12m" / "12m" — coarse enough not to need a ticking timer. */
function formatOpensIn(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

const HOME_GLOWS = [
  { cx: 0.8, cy: 0.15, r: 0.9, color: "rgba(255,225,204,0.35)" },
  { cx: 0.65, cy: 0.3, r: 0.6, color: "rgba(255,217,228,0.2)" },
];

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Content drops by the bar's height while it is showing (Figma 834:470).
  const barInset = useMatchDayBar() ? BAR_INSET : 0;
  const { width } = useWindowDimensions();
  const { data: games, isLoading, isError, refetch, isRefetching } = useListGames();
  const { data: bookings, isLoading: bookingsLoading } = useGetMyBookings();
  const { data: me } = useGetMe();

  // Skeleton is held back 300ms so a fast response doesn't flash it (698:518).
  const showSkeleton = useDelayedVisible(isLoading && !games);

  useEffect(() => { screen("Home"); }, []);

  // Never leave the skeleton pulsing on a failed request — hand off to the
  // server error screen, which owns retry.
  useEffect(() => { if (isError) router.push("/error/server"); }, [isError, router]);

  const upcoming = bookings?.upcoming ?? [];
  // "your next match" means a match you actually booked. Before this, the hero
  // showed games[0] — any open game — under a headline claiming it was yours.
  const nextBooking = upcoming[0];
  const featured = nextBooking
    ? games?.find((g) => g.id === nextBooking.gameId)
    : undefined;
  // Gate on the BOOKINGS query, not the games one. These are independent
  // parallel queries, so a warm games cache made "nothing booked yet" render
  // to players who did have bookings, until the second response landed.
  const nothingBooked = !bookingsLoading && !!bookings && upcoming.length === 0;
  const isTonight = featured && isSameDay(new Date(featured.kickoffTime), new Date());

  // This card is always a match the player has booked, so the CTA must reflect
  // their state in it, not invite them to join something they are already in.
  const heroCta = (() => {
    if (!featured) return null;
    const msToKickoff = new Date(featured.kickoffTime).getTime() - serverNow();
    const msToCheckIn = msToKickoff - CHECK_IN_OPENS_MS;
    if (msToKickoff <= 0) return { label: "match day", href: `/match/${featured.id}` as const };
    if (msToCheckIn <= 0) return { label: "check in now", href: `/match/${featured.id}` as const };
    return { label: `check-in opens in ${formatOpensIn(msToCheckIn)}`, href: `/check-in/${featured.id}` as const };
  })();
  const featuredCount = featured?.bookedCount ?? 0;
  const shownAvatars = Math.min(featuredCount, 4);
  const overflow = featuredCount - shownAvatars;

  return (
    <View style={styles.wrap}>
      <WarmCanvas base="#FFF8F0" glows={HOME_GLOWS} />
      <DotWaveBackground width={width} height={600} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 + barInset }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.orange} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header (Figma 2:4) */}
        <View style={styles.header}>
          <Text style={styles.logo}>PLAYOS</Text>
          <Pressable hitSlop={12} onPress={() => router.push("/activity")}>
            <Bell size={22} color={INK} strokeWidth={1.8} />
            {upcoming.length > 0 && <View style={styles.bellDot} />}
          </Pressable>
        </View>

        {/* Headline — Caveat Bold 42, 3 lines (Figma 2:7) */}
        <HandwrittenHeader style={styles.headline}>
          {featured
            ? `your next\nmatch is\n${isTonight ? "tonight." : "coming up."}`
            : `hey ${me?.name?.trim().split(" ")[0]?.toLowerCase() || "there"}`}
        </HandwrittenHeader>

        {/* Cold start with no cached payload (Figma 698:518) */}
        {showSkeleton && <HomeSkeleton />}

        {/* Hero Match Card (Figma 71:277 — 350×238 glass) */}
        {featured && (
          <Pressable onPress={() => router.push(heroCta?.href ?? `/game/${featured.id}`)} style={styles.heroShadow}>
            <BlurView intensity={Platform.OS === "ios" ? 18 : 0} tint="light" style={styles.heroCard}>
              {/* Sheen + rim, same as every other glass surface. The fill is
                  deliberately thin: white fill stacked on a blur is what makes
                  a card read as frost rather than glass. */}
              <LinearGradient
                colors={["rgba(255,255,255,0.5)", "rgba(255,255,255,0.06)", "rgba(255,246,236,0.14)"]}
                locations={[0, 0.55, 1]}
                start={{ x: 0.15, y: 0 }}
                end={{ x: 0.85, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <View style={styles.heroRim} pointerEvents="none" />
              <Text style={styles.heroLabel}>
                {isTonight ? "TONIGHT" : format(new Date(featured.kickoffTime), "EEE").toUpperCase()} • {format(new Date(featured.kickoffTime), "h:mm a")}
              </Text>
              <Text style={styles.heroTitle} numberOfLines={1}>{featured.title}</Text>
              <View style={styles.heroMetaRow}>
                <Users size={20} color={CARD_META} strokeWidth={1.7} />
                <Text style={styles.heroMeta}>{featured.capacity / 2}v{featured.capacity / 2}</Text>
                {/* The mock also shows surface and skill level. Neither has a
                    column on `games`, so both are omitted rather than
                    hardcoded — they used to read "Outdoor · Intermediate" for
                    every match regardless of the pitch. */}
              </View>
              <View style={styles.heroAvatars}>
                {Array.from({ length: shownAvatars }).map((_, i) => (
                  <View key={i} style={[styles.heroAvatar, { marginLeft: i === 0 ? 0 : -11 }]}>
                    <Avatar name={`P${i + 1}`} size={34} />
                  </View>
                ))}
                {overflow > 0 && (
                  <View style={styles.heroOverflow}>
                    <Text style={styles.heroOverflowText}>+{overflow}</Text>
                  </View>
                )}
              </View>
              {heroCta && (
                <View style={styles.heroJoinRow}>
                  <View style={styles.heroJoinCircle}>
                    <ArrowRight size={24} color="#FFFFFF" strokeWidth={2.4} />
                  </View>
                  <Text style={styles.heroJoinText} numberOfLines={1}>{heroCta.label}</Text>
                </View>
              )}
            </BlurView>
          </Pressable>
        )}

        {/* Coming up (Figma 2:33) */}
        {upcoming.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <View style={styles.rowBetween}>
              <HandwrittenHeader style={styles.sectionLabel}>coming up</HandwrittenHeader>
              <Pressable onPress={() => router.push("/(tabs)/my-games")}>
                <Text style={styles.viewAll}>see all</Text>
              </Pressable>
            </View>
            {upcoming.slice(0, 2).map((b) => {
              const teamSize = b.game.capacity / 2;
              const rowTonight = isSameDay(new Date(b.game.kickoffTime), new Date());
              return (
                <Pressable key={b.id} onPress={() => router.push(`/game/${b.gameId}`)}>
                  <View style={styles.miniCard}>
                    <Image
                      source={{ uri: getVenuePhoto(b.game.pitchName, b.game.pitchPhotoUrl) }}
                      style={styles.miniThumb}
                    />
                    <View style={styles.miniText}>
                      <Text style={styles.miniMeta}>
                        {rowTonight
                          ? `TONIGHT • ${format(new Date(b.game.kickoffTime), "h:mm a")}`
                          : format(new Date(b.game.kickoffTime), "EEE • h:mm a").toUpperCase()}
                      </Text>
                      <Text style={styles.miniTitle} numberOfLines={1}>{b.game.title}</Text>
                      <Text style={styles.miniSub}>{teamSize}v{teamSize}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Nothing booked (Figma 684:570) — the default home for most players,
            so it lists real open games rather than being a dead end. */}
        {nothingBooked && !showSkeleton && <HomeNothingBooked games={games ?? []} />}
      </ScrollView>
    </View>
  );
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0" },
  scroll: { flex: 1 },
    // paddingTop is applied at the call site from the safe-area inset: the
  // fixed value here was smaller than the Dynamic Island's inset, so the first
  // element rendered underneath it.
  content: { paddingHorizontal: 20, paddingBottom: 130 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { fontSize: 17, fontWeight: "700", color: INK },
  bellDot: { position: "absolute", top: -1, right: -1, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange },
  headline: { fontSize: 42, lineHeight: 50, marginTop: spacing.xl },
  heroShadow: {
    marginTop: spacing.xxl + 12, borderRadius: 28,
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.14, shadowRadius: 32, elevation: 6,
  },
  heroCard: {
    // minHeight, not height: the mock is 238 but the stacked content reaches
    // ~254 at default line heights, and with overflow hidden that clipped the
    // bottom of the join circle. Larger Dynamic Type made it worse.
    minHeight: 238, borderRadius: 28, overflow: "hidden", padding: 23,
    backgroundColor: "rgba(255,255,255,0.22)", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
  },
  heroRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28, borderWidth: 1, borderColor: "transparent",
    borderTopColor: "rgba(255,255,255,0.95)",
    borderLeftColor: "rgba(255,255,255,0.5)",
    borderRightColor: "rgba(255,255,255,0.5)",
  },
  heroLabel: { fontSize: 13, fontWeight: "600", color: CARD_LABEL, letterSpacing: 1.04 },
  heroTitle: { fontSize: 30, fontWeight: "700", color: CARD_TITLE, marginTop: 4 },
  heroMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 14 },
  heroMeta: { fontSize: 15, color: CARD_META },
  heroMetaGap: { marginLeft: 14 },
  heroAvatars: { flexDirection: "row", alignItems: "center", marginTop: 13 },
  heroAvatar: { borderWidth: 2, borderColor: "#FFFFFF", borderRadius: 17 },
  heroOverflow: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center", marginLeft: -8,
  },
  heroOverflowText: { fontSize: 13, fontWeight: "600", color: "#F07C1A" },
  heroJoinRow: { flexDirection: "row", alignItems: "center", gap: 15, marginTop: 6 },
  heroJoinCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.orange,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.orange, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 4,
  },
  heroJoinText: { fontSize: 19, fontWeight: "500", color: INK },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: spacing.sm },
  sectionLabel: { fontSize: 24 },
  viewAll: { fontSize: 13, fontWeight: "600", color: MUTED, marginBottom: 4 },
  miniCard: {
    flexDirection: "row", alignItems: "center", height: 68, borderRadius: 16, padding: 6,
    backgroundColor: "rgba(255,255,255,0.34)", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    marginBottom: spacing.sm,
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 18, elevation: 3,
  },
  miniThumb: { width: 54, height: 54, borderRadius: 12 },
  miniText: { flex: 1, paddingHorizontal: 11 },
  miniMeta: { fontSize: 10, fontWeight: "600", color: colors.orange },
  miniTitle: { fontSize: 15, fontWeight: "700", color: INK, marginTop: 2 },
  miniSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: spacing.xxl * 2 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: INK },
  emptyBody: { fontSize: 13, color: MUTED, marginTop: 4 },
});
