import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Share, Pressable, Image, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { format, isSameDay } from "date-fns";
import { ArrowLeft, Heart, Share2, MessageCircle, Users, Clock, MapPin, Calendar, Grid3x3, Banknote, ShieldCheck, Lock } from "lucide-react-native";
import { useGetGame, useBookSpot, useGetOrCreateGameChat } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PitchSVG } from "@/components/PitchSVG";
import { GlassCard } from "@/components/GlassCard";
import { WarmCanvas } from "@/components/WarmCanvas";
import { AvatarStack } from "@/components/AvatarStack";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { colors, gradients, spacing, radius } from "@/lib/theme";
import { screen, track } from "@/lib/analytics";
import { getVenuePhoto } from "@/lib/placeholderPhotos";

function isWithinHours(isoTime: string, hours: number): boolean {
  const ms = new Date(isoTime).getTime() - Date.now();
  return ms > 0 && ms <= hours * 3_600_000;
}

/**
 * Game detail — Figma glass booking page (node 1:4 in FIGMA-MAP.md): warm
 * canvas with the venue photo bleeding in top-right, glass nav, script accent
 * over a big title, spots card with avatars, venue card with map tile, info
 * grid, and the interactive pitch picker feeding the gradient join CTA.
 */
export default function GameDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: game, isLoading } = useGetGame(id!);
  const bookSpot = useBookSpot();
  const getOrCreateChat = useGetOrCreateGameChat();
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

  const openChat = () => {
    if (!user) return router.push("/(auth)/login");
    getOrCreateChat.mutate(
      { gameId: game.id },
      {
        onSuccess: (conversationId) => router.push(`/chat/${conversationId}`),
        onError: (err: any) => setError(err?.data?.error ?? "Book a spot before joining the chat"),
      },
    );
  };

  const openMaps = () => {
    const q = encodeURIComponent(game.locationText || game.pitchName);
    Linking.openURL(`https://maps.apple.com/?q=${q}`);
  };

  return (
    <View style={styles.wrap}>
      <WarmCanvas />
      {/* Venue photo bleeding in from the top-right, blended into the canvas */}
      <View style={styles.skyline} pointerEvents="none">
        <Image source={{ uri: getVenuePhoto(game.pitchName, game.pitchPhotoUrl) }} style={styles.skylineImg} />
        <LinearGradient colors={[colors.canvas, "transparent"]} start={{ x: 0, y: 0.5 }} end={{ x: 0.7, y: 0.5 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={["transparent", colors.canvas]} start={{ x: 0.5, y: 0.25 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Glass nav */}
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} style={styles.navCircle} hitSlop={10}>
            <ArrowLeft size={19} color={colors.inkDeep} />
          </Pressable>
          <View style={styles.navRight}>
            <Pressable onPress={openChat} style={styles.navCircle} hitSlop={10} disabled={getOrCreateChat.isPending}>
              <MessageCircle size={18} color={colors.inkDeep} />
            </Pressable>
            <Pressable onPress={onShare} hitSlop={10}>
              <LinearGradient colors={gradients.sharePill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sharePill}>
                <Share2 size={16} color={colors.inkDeep} />
                <Text style={styles.sharePillText}>Share</Text>
              </LinearGradient>
            </Pressable>
            <Pressable style={styles.navCircle} hitSlop={10}>
              <Heart size={18} color={colors.inkDeep} />
            </Pressable>
          </View>
        </View>

        {/* Title block */}
        <HandwrittenHeader style={styles.scriptDate}>
          {tonight ? "tonight" : format(kickoff, "EEEE").toLowerCase()}
        </HandwrittenHeader>
        <Text style={styles.title}>{game.title}</Text>
        <View style={styles.metaRow}>
          <Users size={16} color={colors.purpleSoft} />
          <Text style={styles.metaText}>{teamSize}v{teamSize}</Text>
          <Clock size={16} color={colors.purpleSoft} style={styles.metaGap} />
          <Text style={styles.metaText}>90 mins</Text>
          <MapPin size={16} color={colors.purpleSoft} style={styles.metaGap} />
          <Text style={styles.metaText} numberOfLines={1}>{game.pitchName}</Text>
        </View>

        {isWithinHours(game.kickoffTime, 3) && (
          <Pressable style={styles.getReadyBanner} onPress={() => router.push(`/countdown/${game.id}`)}>
            <Text style={styles.getReadyText}>⚡ Kickoff is coming up — get ready</Text>
            <Text style={styles.getReadyText}>→</Text>
          </Pressable>
        )}

        {/* Spots card */}
        <GlassCard style={styles.blockGap} padding={16}>
          <View style={styles.spotsRow}>
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
              size={40}
            />
          </View>
        </GlassCard>

        {/* About + rule pills */}
        <Text style={styles.sectionTitle}>about the match</Text>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutBody}>Competitive game.{"\n"}Good vibes and great players.</Text>
          <View style={styles.pillsCol}>
            <View style={styles.rulePill}>
              <ShieldCheck size={14} color={colors.inkDeep} />
              <Text style={styles.rulePillText}>Fair play</Text>
            </View>
            <View style={styles.rulePill}>
              <Users size={14} color={colors.inkDeep} />
              <Text style={styles.rulePillText}>No slide tackles</Text>
            </View>
          </View>
        </View>

        {/* Venue card */}
        <GlassCard style={styles.blockGap} padding={16}>
          <Text style={styles.cardLabel}>venue</Text>
          <View style={styles.venueRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.venueNameRow}>
                <MapPin size={17} color={colors.orange} />
                <Text style={styles.venueName}>{game.pitchName}</Text>
              </View>
              {!!game.locationText && <Text style={styles.venueAddr}>{game.locationText}</Text>}
            </View>
            <Pressable onPress={openMaps} style={styles.mapTile}>
              <View style={[styles.mapLine, { top: 18, transform: [{ rotate: "-18deg" }] }]} />
              <View style={[styles.mapLine, { top: 44, transform: [{ rotate: "-18deg" }] }]} />
              <View style={[styles.mapLine, { top: 70, transform: [{ rotate: "-18deg" }] }]} />
              <View style={[styles.mapLineV, { left: 24, transform: [{ rotate: "-18deg" }] }]} />
              <View style={[styles.mapLineV, { left: 58, transform: [{ rotate: "-18deg" }] }]} />
              <View style={styles.mapPin}>
                <MapPin size={20} color="#FFFFFF" fill={colors.orange} />
              </View>
            </Pressable>
          </View>
        </GlassCard>

        {/* Info grid */}
        <GlassCard style={styles.blockGap} padding={0}>
          <View style={styles.infoGrid}>
            <View style={styles.infoCol}>
              <View style={styles.infoHead}>
                <Calendar size={13} color={colors.orange} />
                <Text style={styles.infoLabel}>Date</Text>
              </View>
              <Text style={styles.infoValue}>{format(kickoff, "d MMM yyyy")}</Text>
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
                <Banknote size={13} color="#ED5C87" />
                <Text style={styles.infoLabel}>Price</Text>
              </View>
              <Text style={styles.infoValue}>SAR {game.price}</Text>
            </View>
          </View>
        </GlassCard>

        {/* Choose your spot */}
        <GlassCard style={styles.blockGap} padding={16}>
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
            <Users size={14} color={colors.faintLavender} />
            <Text style={styles.pitchFooterText}>Minimum {minPlayers} players to start</Text>
            {spotsLeft > 0 && <Text style={styles.pitchFooterSpots}>· {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left</Text>}
          </View>
        </GlassCard>

        {error && <Text style={styles.error}>{error}</Text>}

        {/* CTA */}
        <GlassCard style={styles.blockGap} padding={14}>
          <View style={styles.ctaRow}>
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
                colors={gradients.cta}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.ctaBtn, (!selectedSlot || !gameOpen) && { opacity: 0.5 }]}
              >
                {bookSpot.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.ctaBtnText}>{selectedSlot ? "join match" : "pick a spot"}</Text>
                    <View style={styles.ctaArrow}>
                      <ArrowLeft size={15} color={colors.inkDeep} style={{ transform: [{ rotate: "180deg" }] }} />
                    </View>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </GlassCard>

        <View style={styles.secureRow}>
          <Lock size={12} color={colors.faintLavender} />
          <Text style={styles.secureText}>Secure booking</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  skyline: { position: "absolute", top: 0, right: 0, width: 300, height: 240 },
  skylineImg: { width: "100%", height: "100%", opacity: 0.9 },
  content: { paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.xxl },
  nav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  navRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  navCircle: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.glassStroke,
    shadowColor: colors.warmShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 3,
  },
  sharePill: {
    flexDirection: "row", alignItems: "center", gap: 6, height: 42, paddingHorizontal: 16,
    borderRadius: 21, borderWidth: 1, borderColor: colors.glassStroke,
  },
  sharePillText: { fontSize: 14.5, fontWeight: "600", color: colors.inkDeep },
  scriptDate: { fontSize: 23, marginTop: spacing.xl },
  title: { fontSize: 32, fontWeight: "800", color: colors.inkDeep, marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md },
  metaGap: { marginLeft: spacing.md },
  metaText: { fontSize: 14, fontWeight: "600", color: colors.inkDeep, flexShrink: 1 },
  getReadyBanner: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.orange + "1A", borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.lg,
  },
  getReadyText: { fontSize: 13, fontWeight: "700", color: colors.orange },
  blockGap: { marginTop: spacing.lg },
  spotsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  spotsLine: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  spotsNumber: { fontSize: 30, fontWeight: "800", color: colors.orange },
  spotsLabel: { fontSize: 17, fontWeight: "700", color: colors.inkDeep },
  spotsSub: { fontSize: 12, color: colors.mutedLavender, marginTop: 4 },
  sectionTitle: { fontSize: 15.5, fontWeight: "700", color: colors.inkDeep, marginTop: spacing.xl },
  aboutRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm, gap: spacing.md },
  aboutBody: { fontSize: 13, color: colors.mutedLavender, lineHeight: 20, flex: 1 },
  pillsCol: { gap: spacing.sm, alignItems: "flex-end" },
  rulePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.glassStroke,
    paddingHorizontal: 12, height: 32, borderRadius: 16,
    shadowColor: colors.warmShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2,
  },
  rulePillText: { fontSize: 11.5, fontWeight: "600", color: colors.inkDeep },
  cardLabel: { fontSize: 14, fontWeight: "700", color: colors.inkDeep },
  venueRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  venueNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  venueName: { fontSize: 15, fontWeight: "700", color: colors.inkDeep },
  venueAddr: { fontSize: 12.5, color: colors.mutedLavender, marginTop: 6, marginLeft: 23 },
  mapTile: {
    width: 132, height: 100, borderRadius: radius.lg, backgroundColor: "#F8EFE6",
    overflow: "hidden", alignItems: "center", justifyContent: "center",
  },
  mapLine: { position: "absolute", left: -20, width: 200, height: 2, backgroundColor: "rgba(255,255,255,0.95)" },
  mapLineV: { position: "absolute", top: -20, width: 2, height: 160, backgroundColor: "rgba(255,255,255,0.95)" },
  mapPin: { alignItems: "center", justifyContent: "center" },
  infoGrid: { flexDirection: "row", paddingVertical: 12, paddingHorizontal: 4 },
  infoCol: { flex: 1, paddingHorizontal: 8 },
  infoHead: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoLabel: { fontSize: 9.5, color: colors.mutedLavender },
  infoValue: { fontSize: 12.5, fontWeight: "700", color: colors.inkDeep, marginTop: 6 },
  infoDivider: { width: 1, backgroundColor: "rgba(33,28,51,0.08)", marginVertical: 2 },
  pitchHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  legend: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 4.5 },
  legendText: { fontSize: 11, color: colors.mutedLavender },
  pitchWrap: { borderRadius: radius.md, overflow: "hidden", aspectRatio: 400 / 260, marginTop: spacing.md },
  pitchFooter: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md },
  pitchFooterText: { fontSize: 11.5, color: colors.mutedLavender },
  pitchFooterSpots: { fontSize: 11.5, fontWeight: "700", color: colors.orange },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.md },
  ctaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ctaPrice: { fontSize: 21, fontWeight: "800", color: colors.inkDeep },
  ctaPer: { fontSize: 11, color: colors.mutedLavender, marginTop: 2 },
  ctaBtn: {
    flexDirection: "row", alignItems: "center", gap: 10, height: 48,
    paddingLeft: 22, paddingRight: 8, borderRadius: 24, minWidth: 170, justifyContent: "center",
    shadowColor: "#B78CC0", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 4,
  },
  ctaBtnText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  ctaArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.95)", alignItems: "center", justifyContent: "center" },
  secureRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: spacing.lg },
  secureText: { fontSize: 11, color: colors.faintLavender },
});
