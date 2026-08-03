import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Image, useWindowDimensions, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BAR_INSET, useMatchDayBar } from "@/components/MatchDayBar";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { format } from "date-fns";
import { Bell, Users, MapPin, User, ArrowRight } from "lucide-react-native";
import { useListGames, useGetMyBookings, useGetMe, rankOpenGames } from "@/lib/api";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { DotWaveBackground } from "@/components/DotWaveBackground";
import { HomeSkeleton, useDelayedVisible } from "@/components/Skeleton";
import { HomeNothingBooked } from "@/components/HomeNothingBooked";
import { WarmCanvas } from "@/components/WarmCanvas";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import { serverNow } from "@/lib/serverTime";
import { colors, gradients, spacing } from "@/lib/theme";
import { useScrollToTop } from "@/lib/scrollToTop";
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
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop("index", scrollRef);

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
  // showed games[0] — any open game — under a headline claiming it was yours.
  const ranked = rankOpenGames(games ?? [], serverNow());



  return (
    <View style={styles.wrap}>
      <WarmCanvas base="#FFF8F0" glows={HOME_GLOWS} />
      <DotWaveBackground width={width} height={600} />
      <ScrollView
        ref={scrollRef}
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
        {/* Home sells; it no longer narrates your own booking back to you. */}
        <HandwrittenHeader style={styles.headline}>
          {`hey ${me?.name?.trim().split(" ")[0]?.toLowerCase() || "there"}`}
        </HandwrittenHeader>

        {/* Cold start with no cached payload (Figma 698:518) */}
        {showSkeleton && <HomeSkeleton />}

        {/* The storefront, ALWAYS — not gated on having no bookings. That gate
            was the revenue bug: a player who booked one match stopped seeing a
            single bookable game. Match-day state is the mini-bar's job. */}
        {!showSkeleton && <HomeNothingBooked games={ranked.games} isToday={ranked.isToday} />}
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
    // No elevation here: this wrapper has no background, and Android derives
    // its shadow from the background outline, so it drew nothing at all —
    // the biggest surface in the app sat flat on Android while every fixed
    // primitive floated. It lives on heroCard, which has a fill.
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.14, shadowRadius: 32,
  },
  // CARD_META, not CARD_LABEL: this is WHEN the match is, and #8A8178 put it
  // at ~3.4:1 — the faintest thing on the card, read outdoors one-handed.
  // 38/-11 to match the avatars' border box and overlap — it was 32/-8, so the
  // stack ended on a visibly smaller, differently-spaced disc.
  heroJoinCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.orange,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.orange, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 4,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: spacing.sm },
  sectionLabel: { fontSize: 24 },
  viewAll: { fontSize: 13, fontWeight: "600", color: MUTED, marginBottom: 4 },
  miniCard: {
    // minHeight, not height: three text rows plus 6pt padding just fit at
    // default type and clip the format line at Larger Text.
    flexDirection: "row", alignItems: "center", minHeight: 68, borderRadius: 16, padding: 6,
    backgroundColor: "rgba(255,255,255,0.34)", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    marginBottom: spacing.sm,
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 18, elevation: 3,
  },
  miniThumb: { width: 54, height: 54, borderRadius: 12 },
  miniText: { flex: 1, paddingHorizontal: 11 },
  miniMeta: { fontSize: 11, fontWeight: "600", color: colors.orangeText },
  miniTitle: { fontSize: 15, fontWeight: "700", color: INK, marginTop: 2 },
  miniSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: spacing.xxl * 2 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: INK },
  emptyBody: { fontSize: 13, color: MUTED, marginTop: 4 },
});
