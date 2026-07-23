import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Share, Pressable, Image, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { format, isSameDay } from "date-fns";
import { ArrowLeft, ArrowRight, ArrowUp, Users, Clock, Navigation, MapPin, Calendar, Grid3x3, BarChart3, Lock, ShieldCheck } from "lucide-react-native";
import { useGetGame, useBookSpot } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PitchSVG } from "@/components/PitchSVG";
import { GlassCard } from "@/components/GlassCard";
import { WarmCanvas } from "@/components/WarmCanvas";
import { AvatarStack } from "@/components/AvatarStack";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { colors, spacing, radius } from "@/lib/theme";
import { screen, track } from "@/lib/analytics";
import { getVenuePhoto } from "@/lib/placeholderPhotos";

function isWithinHours(isoTime: string, hours: number): boolean {
  const ms = new Date(isoTime).getTime() - Date.now();
  return ms > 0 && ms <= hours * 3_600_000;
}

// Exact palette from the Figma booking page (node 1:4)
const INK = "#211C33";
const MUTED = "#858091";
const BODY = "#4D475C";

/**
 * Game detail — 1:1 port of the Figma glass booking page (node 1:4, see
 * FIGMA-MAP.md). Booking mechanics unchanged: tap a slot → join match →
 * checkout.
 */
export default function GameDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: game, isLoading } = useGetGame(id!);
  const bookSpot = useBookSpot();
  const [selectedSlot, setSelectedSlot] = useState<{ team: number; slot: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { screen("GameDetail", { gameId: id }); }, [id]);

  if (isLoading || !game) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.orange} />
      </View>
    );
  }

  const kickoff = new Date(game.kickoffTime);
  const tonight = isSameDay(kickoff, new Date());
  const bookedCount = game.bookings.filter((b) => b.paymentStatus === "paid").length;
  const spotsLeft = game.capacity - bookedCount;
  const teamSize = game.capacity / 2;
  const minPlayers = Math.max(2, Math.floor(game.capacity / 2));
  const gameOpen = game.status === "open";

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
      <WarmCanvas />
      {/* Silky light streaks, top-left (Figma 173:315/316) */}
      <View style={[styles.streak, { top: 70, opacity: 0.3 }]} pointerEvents="none" />
      <View style={[styles.streak, { top: 130, opacity: 0.2 }]} pointerEvents="none" />
      {/* Venue photo bleeding across the top (Figma Skyline: 310×260 @ 80,30) */}
      <View style={styles.skyline} pointerEvents="none">
        <Image source={{ uri: getVenuePhoto(game.pitchName, game.pitchPhotoUrl) }} style={styles.skylineImg} />
        <LinearGradient colors={[colors.canvas, "transparent"]} start={{ x: 0, y: 0.5 }} end={{ x: 0.55, y: 0.5 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={["transparent", colors.canvas]} start={{ x: 0.5, y: 0.3 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Nav: back circle + orange share pill (Figma 173:319 / 316:410) */}
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} style={styles.navCircle} hitSlop={10}>
            <ArrowLeft size={19} color={INK} />
          </Pressable>
          <Pressable onPress={onShare} hitSlop={10}>
            <LinearGradient
              colors={["#FFD7A7", "#FF9A4D", "#FF6B2E"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sharePill}
            >
              <Text style={styles.sharePillText}>share</Text>
              <View style={styles.shareOrb}>
                <ArrowUp size={13} color="#C2551A" />
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Title block */}
        <HandwrittenHeader style={styles.scriptDate}>
          {tonight ? "tonight" : format(kickoff, "EEEE").toLowerCase()}
        </HandwrittenHeader>
        <Text style={styles.title}>{game.title}</Text>
        <View style={styles.metaRow}>
          <Users size={17} color={colors.purpleSoft} />
          <Text style={styles.metaText}>{teamSize}v{teamSize}</Text>
          <Clock size={17} color={colors.purpleSoft} style={styles.metaGap} />
          <Text style={styles.metaText}>90 mins</Text>
          <Navigation size={17} color={colors.purpleSoft} style={styles.metaGap} />
          <Text style={styles.metaText} numberOfLines={1}>{game.pitchName}</Text>
        </View>

        {isWithinHours(game.kickoffTime, 3) && (
          <Pressable style={styles.getReadyBanner} onPress={() => router.push(`/countdown/${game.id}`)}>
            <Text style={styles.getReadyText}>⚡ Kickoff is coming up — get ready</Text>
            <Text style={styles.getReadyText}>→</Text>
          </Pressable>
        )}

        {/* Spots card (Figma 173:342: h72, r20, soft glass) */}
        <GlassCard variant="soft" round={20} style={styles.blockGap} padding={0}>
          <View style={styles.spotsInner}>
            <View style={{ flex: 1 }}>
              <View style={styles.spotsLine}>
                <Text style={styles.spotsNumber}>{spotsLeft}</Text>
                <Text style={styles.spotsLabel}>{spotsLeft === 1 ? "spot left" : "spots left"}</Text>
              </View>
              <Text style={styles.spotsSub}>Minimum {minPlayers} players to start</Text>
            </View>
            <AvatarStack
              names={game.bookings.filter((b) => b.paymentStatus === "paid").map((b) => (b.userId === user?.id ? "You" : "Player"))}
              max={3}
              size={36}
            />
          </View>
        </GlassCard>

        {/* About + rule pills (right-stacked, Figma 174:315–327) */}
        <View style={styles.aboutBlock}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>about the match</Text>
            <Text style={styles.aboutBody}>Competitive game.{"\n"}Good vibes and great players!</Text>
          </View>
          <View style={styles.pillsCol}>
            <View style={styles.rulePill}>
              <ShieldCheck size={14} color={INK} />
              <Text style={styles.rulePillText}>Fair play</Text>
            </View>
            <View style={styles.rulePill}>
              <Users size={14} color={INK} />
              <Text style={styles.rulePillText}>No slide tackles</Text>
            </View>
          </View>
        </View>

        {/* Venue card (Figma 174:328: h108, r22, map 140×89) */}
        <GlassCard variant="soft" round={22} style={styles.blockGap} padding={0}>
          <View style={styles.venueInner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>venue</Text>
              <View style={styles.venueNameRow}>
                <MapPin size={18} color={colors.orange} />
                <Text style={styles.venueName}>{game.pitchName}</Text>
              </View>
              {!!game.locationText && <Text style={styles.venueAddr}>{game.locationText}</Text>}
            </View>
            <Pressable onPress={openMaps} style={styles.mapTile}>
              {[14, 42, 70].map((t) => (
                <View key={`h${t}`} style={[styles.mapLine, { top: t, transform: [{ rotate: "18deg" }] }]} />
              ))}
              {[-10, 20, 50, 80, 110].map((l) => (
                <View key={`v${l}`} style={[styles.mapLineV, { left: l, transform: [{ rotate: "18deg" }] }]} />
              ))}
              <View style={[styles.mapLine, styles.mapMainRoad, { top: 56, transform: [{ rotate: "18deg" }] }]} />
              <MapPin size={26} color="#FFFFFF" fill={colors.orange} />
            </Pressable>
          </View>
        </GlassCard>

        {/* Info grid (Figma 176:315: h48, r16) */}
        <GlassCard variant="soft" round={16} style={styles.blockGap} padding={0}>
          <View style={styles.infoGrid}>
            <View style={styles.infoCol}>
              <View style={styles.infoHead}>
                <Calendar size={13} color={colors.orange} />
                <Text style={styles.infoLabel}>Date</Text>
              </View>
              <Text style={styles.infoValueSm}>{format(kickoff, "d MMM yyyy")}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoCol}>
              <View style={styles.infoHead}>
                <Clock size={13} color={colors.purpleSoft} />
                <Text style={styles.infoLabel}>Kickoff</Text>
              </View>
              <Text style={styles.infoValue}>{format(kickoff, "h:mm a")}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoCol}>
              <View style={styles.infoHead}>
                <Grid3x3 size={13} color={colors.purpleSoft} />
                <Text style={styles.infoLabel}>Format</Text>
              </View>
              <Text style={styles.infoValue}>{teamSize}v{teamSize}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoCol}>
              <View style={styles.infoHead}>
                <BarChart3 size={13} color="#ED5C87" />
                <Text style={styles.infoLabel}>Level</Text>
              </View>
              {/* TODO: replace with game.skillLevel once the backend field exists */}
              <Text style={styles.infoValueSm}>Intermediate</Text>
            </View>
          </View>
        </GlassCard>

        {/* Choose your spot (Figma 351:461: r18, cream pitch, tan lines) */}
        <GlassCard variant="soft" round={18} style={styles.blockGap} padding={0}>
          <View style={styles.pitchInner}>
            <View style={styles.pitchHeader}>
              <Text style={styles.cardLabel}>choose your spot</Text>
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
              <Users size={13} color={MUTED} />
              <Text style={styles.pitchFooterText}>Minimum {minPlayers} players to start</Text>
              {spotsLeft > 0 && (
                <Text style={styles.pitchFooterSpots}>· {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left</Text>
              )}
            </View>
          </View>
        </GlassCard>

        {error && <Text style={styles.error}>{error}</Text>}

        {/* CTA bar (Figma 176:399: solid glass 82% + lavender glass button) */}
        <GlassCard round={20} style={styles.blockGap} padding={0}>
          <View style={styles.ctaInner}>
            <View>
              <Text style={styles.ctaPrice}>SAR {game.price}</Text>
              <Text style={styles.ctaPer}>per player</Text>
            </View>
            <Pressable
              onPress={confirmBooking}
              disabled={!selectedSlot || !gameOpen || bookSpot.isPending}
              style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
            >
              <LinearGradient
                colors={[
                  "rgba(244,217,255,0.38)", "rgba(233,201,250,0.38)", "rgba(220,201,255,0.38)",
                  "rgba(213,215,255,0.38)", "rgba(199,213,255,0.38)",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.ctaBtn, (!selectedSlot || !gameOpen) && { opacity: 0.55 }]}
              >
                {bookSpot.isPending ? (
                  <ActivityIndicator color="#6251E8" size="small" />
                ) : (
                  <>
                    <Text style={styles.ctaBtnText}>{selectedSlot ? "join match" : "pick a spot"}</Text>
                    <View style={styles.ctaOrb}>
                      <ArrowRight size={15} color={INK} />
                    </View>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </GlassCard>

        <View style={styles.secureRow}>
          <Lock size={12} color="#807873" />
          <Text style={styles.secureText}>Secure booking</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  streak: {
    position: "absolute", left: -70, width: 420, height: 26, borderRadius: 13,
    backgroundColor: "#FFFFFF", transform: [{ rotate: "-22deg" }],
  },
  skyline: { position: "absolute", top: 0, right: 0, width: 310, height: 260 },
  skylineImg: { width: "100%", height: "100%", opacity: 0.92 },
  content: { paddingHorizontal: spacing.lg, paddingTop: 52, paddingBottom: spacing.xxl },
  nav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  navCircle: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.glassStroke,
    shadowColor: "#997359", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 3,
  },
  sharePill: {
    flexDirection: "row", alignItems: "center", gap: 7, height: 30,
    paddingLeft: 15, paddingRight: 3, borderRadius: 15,
    borderWidth: 0.6, borderColor: "rgba(255,255,255,0.7)",
    shadowColor: "#D9B08C", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 3,
  },
  sharePillText: { fontSize: 13.5, fontWeight: "500", color: "#7A3B1E", letterSpacing: -0.13 },
  shareOrb: {
    width: 25, height: 25, borderRadius: 12.5, backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center", justifyContent: "center",
  },
  scriptDate: { fontSize: 23, marginTop: spacing.xl },
  title: { fontSize: 32, fontWeight: "800", color: INK, marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: spacing.md },
  metaGap: { marginLeft: spacing.lg },
  metaText: { fontSize: 14, fontWeight: "600", color: INK, flexShrink: 1 },
  getReadyBanner: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.orange + "1A", borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.lg,
  },
  getReadyText: { fontSize: 13, fontWeight: "700", color: colors.orange },
  blockGap: { marginTop: spacing.lg },
  spotsInner: { flexDirection: "row", alignItems: "center", paddingHorizontal: 17, paddingVertical: 12 },
  spotsLine: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  spotsNumber: { fontSize: 28, fontWeight: "800", color: colors.orange },
  spotsLabel: { fontSize: 15, fontWeight: "700", color: INK },
  spotsSub: { fontSize: 11, color: MUTED, marginTop: 3 },
  aboutBlock: { flexDirection: "row", marginTop: spacing.xl, gap: spacing.md },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: INK },
  aboutBody: { fontSize: 12, color: BODY, lineHeight: 20, marginTop: spacing.sm },
  pillsCol: { gap: spacing.sm, alignItems: "flex-end", justifyContent: "center" },
  rulePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.4)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 11, height: 29, borderRadius: 16,
    shadowColor: "#997359", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 2,
  },
  rulePillText: { fontSize: 10.5, fontWeight: "600", color: INK },
  cardLabel: { fontSize: 13, fontWeight: "600", color: INK },
  venueInner: { flexDirection: "row", padding: 15, gap: spacing.md },
  venueNameRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: spacing.md },
  venueName: { fontSize: 14, fontWeight: "700", color: INK },
  venueAddr: { fontSize: 11.5, color: MUTED, marginTop: 6, marginLeft: 25 },
  mapTile: {
    width: 140, height: 89, borderRadius: 16, backgroundColor: "#F9EFE6",
    overflow: "hidden", alignItems: "center", justifyContent: "center",
  },
  mapLine: { position: "absolute", left: -40, width: 220, height: 2, backgroundColor: "rgba(255,255,255,0.95)" },
  mapLineV: { position: "absolute", top: -40, width: 2, height: 200, backgroundColor: "rgba(255,255,255,0.95)" },
  mapMainRoad: { height: 3.5, backgroundColor: "#FFFFFF" },
  infoGrid: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 4, minHeight: 48 },
  infoCol: { flex: 1, paddingHorizontal: 9 },
  infoHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  infoLabel: { fontSize: 8.5, color: MUTED },
  infoValue: { fontSize: 12, fontWeight: "700", color: INK, marginTop: 5 },
  infoValueSm: { fontSize: 10, fontWeight: "700", color: INK, marginTop: 6 },
  infoDivider: { width: 1, backgroundColor: "rgba(33,28,51,0.08)", marginVertical: 4 },
  pitchInner: { padding: 11 },
  pitchHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4, paddingTop: 2 },
  legend: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: MUTED },
  pitchWrap: { borderRadius: 12, overflow: "hidden", aspectRatio: 400 / 260, marginTop: spacing.sm },
  pitchFooter: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: spacing.sm, paddingHorizontal: 4, paddingBottom: 2 },
  pitchFooterText: { fontSize: 10.5, color: MUTED },
  pitchFooterSpots: { fontSize: 10.5, fontWeight: "600", color: colors.orange },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.md },
  ctaInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 19, paddingVertical: 9 },
  ctaPrice: { fontSize: 19, fontWeight: "800", color: INK },
  ctaPer: { fontSize: 10, color: MUTED, marginTop: 2 },
  ctaBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    width: 168, height: 44, borderRadius: 22, paddingLeft: 25, paddingRight: 7,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#AD91FF", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.26, shadowRadius: 24, elevation: 4,
  },
  ctaBtnText: { fontSize: 14.5, fontWeight: "600", color: "#6251E8" },
  ctaOrb: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  secureRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.lg },
  secureText: { fontSize: 13, color: "#807873" },
});
