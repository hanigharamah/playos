import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Share, Pressable, ImageBackground } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { format } from "date-fns";
import { ArrowLeft, Heart, Share2, MapPin, MessageCircle } from "lucide-react-native";
import { useGetGame, useBookSpot, useGetOrCreateGameChat } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PitchSVG } from "@/components/PitchSVG";
import { FillBar } from "@/components/FillBar";
import { GlassCard } from "@/components/GlassCard";
import { PillButton } from "@/components/PillButton";
import { colors, spacing, radius } from "@/lib/theme";
import { screen, track } from "@/lib/analytics";
import { getVenuePhoto } from "@/lib/placeholderPhotos";

function isWithinHours(isoTime: string, hours: number): boolean {
  const ms = new Date(isoTime).getTime() - Date.now();
  return ms > 0 && ms <= hours * 3_600_000;
}

/**
 * Game detail — dark hero header (mockup style) + real pitch-diagram booking
 * flow below (the mockup implies a one-tap "Join Match", but our data model
 * requires picking a specific team/slot — keeping the working mechanism,
 * restyling the surrounding chrome to match).
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

  const bookedCount = game.bookings.filter((b) => b.paymentStatus === "paid").length;
  const spotsLeft = game.capacity - bookedCount;
  const teamSize = game.capacity / 2;
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

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }}>
      <ImageBackground source={{ uri: getVenuePhoto(game.pitchName, game.pitchPhotoUrl) }} style={styles.hero}>
        <LinearGradient colors={["rgba(18,20,28,0.1)", "rgba(18,20,28,0.55)"]} style={StyleSheet.absoluteFill} />
        <View style={styles.heroTop}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
            <ArrowLeft size={18} color="#FFFFFF" />
          </Pressable>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Pressable style={styles.iconBtn} hitSlop={10} onPress={openChat} disabled={getOrCreateChat.isPending}>
              <MessageCircle size={18} color="#FFFFFF" />
            </Pressable>
            <Pressable style={styles.iconBtn} hitSlop={10}><Heart size={18} color="#FFFFFF" /></Pressable>
            <Pressable style={styles.iconBtn} hitSlop={10} onPress={onShare}><Share2 size={18} color="#FFFFFF" /></Pressable>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.content}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>{game.title}</Text>
          {spotsLeft > 0 && spotsLeft <= 3 && (
            <View style={styles.spotsBadge}><Text style={styles.spotsBadgeText}>{spotsLeft} left</Text></View>
          )}
        </View>
        <Text style={styles.meta}>{game.pitchName} · {format(new Date(game.kickoffTime), "d MMM, h:mm a")}</Text>

        {isWithinHours(game.kickoffTime, 3) && (
          <Pressable style={styles.getReadyBanner} onPress={() => router.push(`/countdown/${game.id}`)}>
            <Text style={styles.getReadyText}>⚡ Kickoff is coming up — get ready</Text>
            <Text style={styles.getReadyArrow}>→</Text>
          </Pressable>
        )}

        <View style={styles.chipsRow}>
          <View style={styles.chip}><Text style={styles.chipText}>{teamSize}v{teamSize}</Text></View>
          <View style={styles.chip}><Text style={styles.chipText}>Outdoor</Text></View>
          <View style={styles.chip}><Text style={styles.chipText}>SAR {game.price}</Text></View>
        </View>

        <GlassCard style={{ marginTop: spacing.lg }}>
          <FillBar booked={bookedCount} capacity={game.capacity} />
        </GlassCard>

        {game.locationText && (
          <GlassCard style={{ marginTop: spacing.md }}>
            <View style={styles.venueRow}>
              <MapPin size={16} color={colors.inkMuted} />
              <Text style={styles.venueText}>{game.locationText}</Text>
            </View>
          </GlassCard>
        )}

        <Text style={styles.sectionLabel}>Pick your spot</Text>
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

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.actions}>
          <PillButton
            label={selectedSlot ? `Book Slot ${selectedSlot.slot + 1} — SAR ${game.price}` : "Tap a slot to book"}
            onPress={confirmBooking}
            disabled={!selectedSlot || !gameOpen}
            loading={bookSpot.isPending}
            fullWidth
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.creamDeep },
  hero: { height: 220, paddingTop: 56, paddingHorizontal: spacing.lg },
  heroTop: { flexDirection: "row", justifyContent: "space-between" },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, marginTop: -radius.xl, backgroundColor: colors.creamDeep, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 22, fontWeight: "800", color: colors.inkNavy, flex: 1, marginRight: spacing.sm },
  spotsBadge: { backgroundColor: colors.pink + "1F", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  spotsBadgeText: { color: colors.pink, fontSize: 11, fontWeight: "700" },
  meta: { fontSize: 14, color: colors.inkMuted, marginTop: 4 },
  getReadyBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.orange + "1A", borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  getReadyText: { fontSize: 13, fontWeight: "700", color: colors.orange, flex: 1 },
  getReadyArrow: { fontSize: 16, fontWeight: "700", color: colors.orange },
  chipsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  chip: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.ink },
  venueRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  venueText: { fontSize: 13, color: colors.ink, flex: 1 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.xl, marginBottom: spacing.sm },
  pitchWrap: { borderRadius: radius.lg, overflow: "hidden", aspectRatio: 400 / 260 },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.md },
  actions: { marginTop: spacing.xl },
});
