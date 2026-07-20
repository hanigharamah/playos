import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Share } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { format } from "date-fns";
import { useGetGame, useBookSpot } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PitchSVG } from "@/components/PitchSVG";
import { FillBar } from "@/components/FillBar";
import { GlassCard } from "@/components/GlassCard";
import { PillButton } from "@/components/PillButton";
import { colors, spacing, radius } from "@/lib/theme";
import { screen, track } from "@/lib/analytics";

/** Game detail — hero + pitch + booking. Mirrors ../playos/src/pages/game/[id].tsx. */
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

  const bookedCount = game.bookings.filter((b) => b.paymentStatus === "paid").length;
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

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{game.title}</Text>
      <Text style={styles.meta}>
        {game.pitchName} · {format(new Date(game.kickoffTime), "d MMM, h:mm a")}
      </Text>

      <GlassCard style={{ marginTop: spacing.lg }}>
        <FillBar booked={bookedCount} capacity={game.capacity} />
      </GlassCard>

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
        <PillButton label="Share" variant="outline" onPress={onShare} fullWidth />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep },
  content: { padding: spacing.lg, paddingTop: spacing.xxl * 1.5, paddingBottom: spacing.xxl * 2 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.creamDeep },
  title: { fontSize: 24, fontWeight: "800", color: colors.inkNavy },
  meta: { fontSize: 14, color: colors.inkMuted, marginTop: 4 },
  pitchWrap: { marginTop: spacing.lg, borderRadius: radius.lg, overflow: "hidden", aspectRatio: 400 / 260 },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.md },
  actions: { marginTop: spacing.xl, gap: spacing.md },
});
