import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Share, Pressable, Image, Linking, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { format } from "date-fns";
import { ArrowLeft, ArrowRight, Share2, Users, Clock, Navigation, MapPin, Calendar, Grid3x3, BarChart3, Lock, ShieldCheck } from "lucide-react-native";
import { MIN_PLAYERS_TO_START } from "@/lib/api";
import { useGetMyBookings, useGetGame, useBookSpot } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PitchSVG } from "@/components/PitchSVG";
import { Avatar } from "@/components/Avatar";
import { MatchGone } from "@/components/MatchGone";
import { GameDetailSkeleton, useDelayedVisible } from "@/components/Skeleton";
import { colors, spacing } from "@/lib/theme";
import { screen, track } from "@/lib/analytics";
import { getVenuePhoto } from "@/lib/placeholderPhotos";

function isWithinHours(isoTime: string, hours: number): boolean {
  const ms = new Date(isoTime).getTime() - Date.now();
  return ms > 0 && ms <= hours * 3_600_000;
}

// Exact palette from the Figma "Game Detail" page (node 552:483)
const INK = "#211C33";
const MUTED = "#858091";
const BODY = "#4D475C";
const TITLE_ORANGE = "#FF9E0A";

/**
 * Game detail — 1:1 port of the standalone Figma "Game Detail" page
 * (node 552:483, its own page in the file — supersedes the older 1:4).
 * Booking mechanics unchanged: tap a slot → Join match → checkout.
 */
export default function GameDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: game, isLoading } = useGetGame(id!);
  const bookSpot = useBookSpot();
  const { data: myBookings } = useGetMyBookings();

  // A spot this player already holds in THIS game, if any.
  const myBooking = [...(myBookings?.upcoming ?? []), ...(myBookings?.past ?? [])]
    .find((b) => b.gameId === id);
  const [selectedSlot, setSelectedSlot] = useState<{ team: number; slot: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { screen("GameDetail", { gameId: id }); }, [id]);

  const showSkeleton = useDelayedVisible(isLoading);

  if (isLoading) {
    // Figma 698:636. Held back 300ms so a warm cache doesn't flash it; under
    // that the screen just stays on the previous view for a beat.
    return <View style={styles.loading}>{showSkeleton && <GameDetailSkeleton />}</View>;
  }

  // Dead deep link — the game was cancelled or has already kicked off.
  if (!game) return <MatchGone />;

  const kickoff = new Date(game.kickoffTime);
  // A spot is occupied the moment it is booked. Counting only "paid" left
  // this screen advertising a full game as empty, because the app only ever
  // inserts "pending" — matches useBookSpot and PitchSVG.
  const bookedCount = game.bookings.filter(
    (b) => b.paymentStatus !== "refunded" && b.paymentStatus !== "forfeited",
  ).length;
  const spotsLeft = game.capacity - bookedCount;
  const teamSize = game.capacity / 2;
  // Decided product rule (FIGMA-MAP "Product rules"): a match auto-starts at
  // T+15 with 6 or more, otherwise it auto-cancels. The old formula here was
  // half of capacity, which told an 8-player game it needed 4.
  const minPlayers = MIN_PLAYERS_TO_START;
  const gameOpen = game.status === "open";
  const shownAvatars = Math.min(bookedCount, 3);
  const overflow = bookedCount - shownAvatars;

  const handleSlotClick = (team: number, slot: number) => {
    if (!user) return router.push("/(auth)/login");
    setSelectedSlot({ team, slot });
  };

  const confirmBooking = () => {
    if (!selectedSlot) return;
    setError(null);
    bookSpot.mutate(
      { gameId: game.id, team: selectedSlot.team, slotIndex: selectedSlot.slot },
      {
        onSuccess: ({ bookingId }) => {
          track("booking_started", { gameId: game.id });
          router.push({ pathname: "/checkout/[bookingId]", params: { bookingId, gameId: game.id } });
        },
        onError: (err: any) => setError(err?.data?.error ?? "Could not book that spot"),
      },
    );
  };

  const onShare = () => {
    Share.share({ message: `Join my game "${game.title}" on PlayOS`, url: `https://playos.sa/game/${game.id}` });
  };

  const openMaps = () => {
    const q = encodeURIComponent(game.locationText || game.pitchName);
    Linking.openURL(`https://maps.apple.com/?q=${q}`);
  };

  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Full-bleed hero photo (Figma 602:8 — 455×251, bleeds both edges) */}
        <View style={styles.hero} pointerEvents="none">
          <Image source={{ uri: getVenuePhoto(game.pitchName, game.pitchPhotoUrl) }} style={styles.heroImg} />
          <LinearGradient
            colors={["transparent", "rgba(255,248,240,0.65)", "#FFF8F0"]}
            locations={[0.45, 0.82, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Nav row */}
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <BlurView intensity={Platform.OS === "ios" ? 20 : 0} tint="light" style={styles.navCircle}>
              <ArrowLeft size={20} color={INK} strokeWidth={2} />
            </BlurView>
          </Pressable>
          <Pressable onPress={onShare} hitSlop={10} style={styles.shareCircle}>
            <Share2 size={17} color={INK} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Title over the photo */}
        <Text style={styles.title} numberOfLines={1}>{game.title}</Text>

        {/* Meta pills (Figma 585:482-484) */}
        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Users size={17} color={INK} strokeWidth={2} />
            <Text style={styles.metaText}>{teamSize}v{teamSize}</Text>
          </View>
          <View style={styles.metaPill}>
            <Clock size={17} color={INK} strokeWidth={2} />
            <Text style={styles.metaText}>{game.durationMinutes ? `${game.durationMinutes} mins` : "—"}</Text>
          </View>
          <View style={styles.metaPill}>
            <Navigation size={17} color={INK} strokeWidth={2} />
            <Text style={styles.metaText} numberOfLines={1}>{game.pitchName}</Text>
          </View>
        </View>

        {/* Spots card (Figma 552:511 — 358×70 warm card) */}
        <View style={[styles.card, styles.spotsCard]}>
          <View style={{ flex: 1 }}>
            <View style={styles.spotsLine}>
              <Text style={styles.spotsNumber}>{spotsLeft}</Text>
              <Text style={styles.spotsLabel}>{spotsLeft === 1 ? "spot left" : "spots left"}</Text>
            </View>
            <Text style={styles.spotsSub}>Minimum {minPlayers} players to start</Text>
          </View>
          <View style={styles.avatarRow}>
            {Array.from({ length: shownAvatars }).map((_, i) => (
              <View key={i} style={[styles.avatarWrap, { marginLeft: i === 0 ? 0 : 9 }]}>
                <Avatar name={`P${i + 1}`} size={36} />
              </View>
            ))}
            {overflow > 0 && (
              <View style={styles.avatarOverflow}>
                <Text style={styles.avatarOverflowText}>+{overflow}</Text>
              </View>
            )}
          </View>
        </View>

        {isWithinHours(game.kickoffTime, 3) && (
          <Pressable style={styles.getReady} onPress={() => router.push(`/countdown/${game.id}`)}>
            <Text style={styles.getReadyText}>⚡ Kickoff is coming up — get ready</Text>
            <Text style={styles.getReadyText}>→</Text>
          </Pressable>
        )}

        {/* About + rule pills */}
        <View style={styles.aboutRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.aboutLabel}>about the match</Text>
            {/* `games` has no description column; the mock's blurb was
                hardcoded and identical on every match. Show the real title. */}
            <Text style={styles.aboutBody}>{game.title}</Text>
          </View>
          {/* The mock's rule pills ("Fair play", "No slide tackles") have no
              rules column behind them and rendered identically on every match,
              so they're omitted until per-game rules exist. */}
        </View>

        {/* Venue (flat, sits directly on the canvas per the design) */}
        <Text style={styles.venueLabel}>venue</Text>
        <View style={styles.venueRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.venueNameRow}>
              <MapPin size={18} color={colors.orange} strokeWidth={2} />
              <Text style={styles.venueName}>{game.pitchName}</Text>
            </View>
            {!!game.locationText && <Text style={styles.venueAddr}>{game.locationText}</Text>}
          </View>
          <Pressable onPress={openMaps} style={styles.mapTile}>
            {[16, 42, 68].map((t) => (
              <View key={`h${t}`} style={[styles.mapLine, { top: t, transform: [{ rotate: "18deg" }] }]} />
            ))}
            {[10, 44, 78, 112].map((l) => (
              <View key={`v${l}`} style={[styles.mapLineV, { left: l, transform: [{ rotate: "18deg" }] }]} />
            ))}
            <MapPin size={26} color="#FFFFFF" fill={colors.orange} />
          </Pressable>
        </View>

        {/* Info grid (Figma 552:555) */}
        <View style={[styles.card, styles.infoGrid]}>
          <View style={styles.infoCol}>
            <View style={styles.infoHead}>
              <Calendar size={13} color={colors.orange} strokeWidth={2} />
              <Text style={styles.infoLabel}>Date</Text>
            </View>
            <Text style={styles.infoValueSm}>{format(kickoff, "d MMM yyyy")}</Text>
            <Text style={styles.infoSub}>{format(kickoff, "EEEE")}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoCol}>
            <View style={styles.infoHead}>
              <Clock size={13} color={colors.purpleSoft} strokeWidth={2} />
              <Text style={styles.infoLabel}>Kickoff</Text>
            </View>
            <Text style={styles.infoValue}>{format(kickoff, "h:mm a")}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoCol}>
            <View style={styles.infoHead}>
              <Grid3x3 size={13} color={colors.purpleSoft} strokeWidth={2} />
              <Text style={styles.infoLabel}>Format</Text>
            </View>
            <Text style={styles.infoValue}>{teamSize}v{teamSize}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoCol}>
            <View style={styles.infoHead}>
              <BarChart3 size={13} color="#ED5C87" strokeWidth={2} />
              <Text style={styles.infoLabel}>Level</Text>
            </View>
            {/* TODO: bind to game.skillLevel once the backend field exists */}
            <Text style={styles.infoValueSm}>—</Text>
          </View>
        </View>

        {/* Choose your spot (Figma 552:592) */}
        <View style={[styles.card, styles.pitchCard]}>
          <View style={styles.pitchHeader}>
            <Text style={styles.pitchLabel}>choose your spot</Text>
            <View style={styles.legend}>
              <View style={[styles.legendDot, { backgroundColor: colors.teamOrange }]} />
              <Text style={styles.legendText}>Team A</Text>
              <View style={[styles.legendDot, { backgroundColor: colors.teamPurple, marginLeft: 10 }]} />
              <Text style={styles.legendText}>Team B</Text>
            </View>
          </View>
          <View style={styles.pitchWrap}>
            <PitchSVG
              teamSize={teamSize}
              bookings={game.bookings.map((b) => ({
                team: b.team, slotIndex: b.slotIndex, userId: b.userId,
                playerName: b.userId === user?.id ? "You" : "Player", paymentStatus: b.paymentStatus,
              }))}
              selectedSlot={selectedSlot}
              onSlotClick={handleSlotClick}
              currentUserId={user?.id}
              isPending={bookSpot.isPending}
              gameOpen={gameOpen}
            />
          </View>
          <View style={styles.pitchFooter}>
            <Users size={13} color={MUTED} strokeWidth={2} />
            <Text style={styles.pitchFooterText}>Minimum {minPlayers} players to start</Text>
          </View>
          {spotsLeft > 0 && (
            <Text style={styles.pitchFooterSpots}>{spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left</Text>
          )}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {/* CTA (Figma 552:580 — orange gradient) */}
        <View style={[styles.card, styles.ctaCard]}>
          <View>
            <Text style={styles.ctaPrice}>SAR {game.price}</Text>
            <Text style={styles.ctaPer}>per player</Text>
          </View>
          <Pressable
            onPress={myBooking ? () => router.push(`/check-in/${id}`) : confirmBooking}
            disabled={myBooking ? false : !selectedSlot || !gameOpen || bookSpot.isPending}
            style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
          >
            <LinearGradient
              colors={["#FFD6A6", "#FF994D", "#FF6B2E"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[styles.ctaBtn, !myBooking && (!selectedSlot || !gameOpen) && { opacity: 0.55 }]}
            >
              {bookSpot.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.ctaBtnText}>
                    {myBooking ? "You're in" : selectedSlot ? "Join match" : "Pick a spot"}
                  </Text>
                  <View style={styles.ctaOrb}>
                    <ArrowRight size={15} color="#FF7A2E" strokeWidth={2.6} />
                  </View>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        <View style={styles.secureRow}>
          <Lock size={12} color="#807873" strokeWidth={2} />
          <Text style={styles.secureText}>Secure booking</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0" },
  loading: { flex: 1, backgroundColor: "#FFF8F0" },
  content: { paddingBottom: spacing.xxl },

  hero: { position: "absolute", top: 0, left: -32, right: -32, height: 251 },
  heroImg: { width: "100%", height: "100%" },

  nav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 21, paddingTop: 57 },
  navCircle: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
  },
  shareCircle: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)", borderWidth: 0.6, borderColor: "rgba(255,255,255,0.7)",
    shadowColor: "#D9B08C", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 9, elevation: 3,
  },

  title: { fontSize: 31, fontWeight: "700", color: TITLE_ORANGE, marginTop: 24, marginLeft: 22, marginRight: 22 },

  metaRow: { flexDirection: "row", gap: 8, marginTop: 22, paddingHorizontal: 21 },
  metaPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    height: 19, paddingHorizontal: 9, borderRadius: 9.5,
    backgroundColor: "rgba(255,255,255,0.75)", maxWidth: 130,
  },
  metaText: { fontSize: 10, fontWeight: "600", color: INK, flexShrink: 1 },

  // Shared warm card surface (Figma: cream tint + white hairline + soft drop)
  card: {
    backgroundColor: "rgba(255,250,242,0.72)",
    borderWidth: 1.2, borderColor: "rgba(255,255,255,0.8)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.08, shadowRadius: 30, elevation: 3,
  },

  spotsCard: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginTop: 26, borderRadius: 20, paddingHorizontal: 19, paddingVertical: 11,
  },
  spotsLine: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  spotsNumber: { fontSize: 24, fontWeight: "700", color: colors.orange },
  spotsLabel: { fontSize: 14, fontWeight: "600", color: INK },
  spotsSub: { fontSize: 11, color: MUTED, marginTop: 6 },
  avatarRow: { flexDirection: "row", alignItems: "center" },
  avatarWrap: { borderRadius: 18 },
  avatarOverflow: {
    width: 36, height: 36, borderRadius: 18, marginLeft: 9,
    backgroundColor: "rgba(255,255,255,0.9)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center", justifyContent: "center",
  },
  avatarOverflowText: { fontSize: 12, fontWeight: "600", color: INK },

  getReady: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.orange + "1A", borderRadius: 14,
    marginHorizontal: 16, marginTop: 14, paddingVertical: 12, paddingHorizontal: 16,
  },
  getReadyText: { fontSize: 13, fontWeight: "700", color: colors.orange },

  aboutRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 22, paddingHorizontal: 22, gap: 12 },
  aboutLabel: { fontSize: 10, fontWeight: "600", color: INK },
  aboutBody: { fontSize: 8, color: BODY, marginTop: 6 },
  rulePills: { gap: 8, alignItems: "flex-end" },
  rulePill: { flexDirection: "row", alignItems: "center", gap: 5, height: 25, paddingHorizontal: 8, borderRadius: 16 },
  rulePillText: { fontSize: 8.5, fontWeight: "600", color: INK },

  venueLabel: { fontSize: 12, fontWeight: "600", color: INK, marginTop: 26, marginLeft: 22 },
  venueRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 14, paddingHorizontal: 22, gap: 12 },
  venueNameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  venueName: { fontSize: 13, fontWeight: "600", color: INK },
  venueAddr: { fontSize: 11, color: MUTED, marginTop: 8, marginLeft: 25 },
  mapTile: {
    width: 149, height: 82, borderRadius: 16, backgroundColor: "#F6EFE7",
    overflow: "hidden", alignItems: "center", justifyContent: "center",
  },
  mapLine: { position: "absolute", left: -40, width: 230, height: 2, backgroundColor: "rgba(255,255,255,0.95)" },
  mapLineV: { position: "absolute", top: -40, width: 2, height: 180, backgroundColor: "rgba(255,255,255,0.95)" },

  infoGrid: { flexDirection: "row", marginHorizontal: 12, marginTop: 22, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 4 },
  infoCol: { flex: 1, paddingHorizontal: 9 },
  infoHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  infoLabel: { fontSize: 8.5, color: MUTED },
  infoValue: { fontSize: 11, fontWeight: "600", color: INK, marginTop: 6 },
  infoValueSm: { fontSize: 10, fontWeight: "600", color: INK, marginTop: 6 },
  infoSub: { fontSize: 8.5, color: "#8A7D73", marginTop: 4 },
  infoDivider: { width: 1, backgroundColor: "rgba(33,28,51,0.08)", marginVertical: 4 },

  pitchCard: { marginLeft: 15, marginRight: 25, marginTop: 33, borderRadius: 18, padding: 11 },
  pitchHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4 },
  pitchLabel: { fontSize: 12.5, fontWeight: "600", color: INK },
  legend: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 9.5, color: MUTED },
  pitchWrap: { borderRadius: 12, overflow: "hidden", aspectRatio: 326 / 122, marginTop: 12 },
  pitchFooter: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 12, paddingHorizontal: 4 },
  pitchFooterText: { fontSize: 10, color: MUTED },
  pitchFooterSpots: { fontSize: 10, fontWeight: "600", color: colors.orange, marginTop: 4, marginLeft: 22 },

  error: { color: colors.danger, textAlign: "center", marginTop: 12 },

  ctaCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginHorizontal: 12, marginTop: 33, borderRadius: 20, paddingHorizontal: 19, paddingVertical: 7,
  },
  ctaPrice: { fontSize: 17.5, fontWeight: "700", color: INK },
  ctaPer: { fontSize: 10, color: MUTED, marginTop: 4 },
  ctaBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    width: 168, height: 44, borderRadius: 22, paddingLeft: 25, paddingRight: 7,
    borderWidth: 1.2, borderColor: "rgba(255,229,191,0.8)",
    shadowColor: "#FF731A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 4,
  },
  ctaBtnText: { fontSize: 13.5, fontWeight: "600", color: "#FFFFFF" },
  ctaOrb: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },

  secureRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 33 },
  secureText: { fontSize: 13, color: "#807873" },
});
