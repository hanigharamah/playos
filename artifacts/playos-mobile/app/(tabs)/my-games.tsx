import { useEffect, useState } from "react";
import { View, Text, StyleSheet, SectionList, RefreshControl, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { format } from "date-fns";
import { useGetMyBookings, useCancelBooking, type MyBooking } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { colors, spacing, radius } from "@/lib/theme";
import { screen } from "@/lib/analytics";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  paid: { label: "Confirmed", color: colors.success },
  pending: { label: "Pending payment", color: colors.orange },
};

export default function MyGames() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useGetMyBookings();
  const cancelBooking = useCancelBooking();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => { screen("MyGames"); }, []);

  const sections = [
    { title: "Upcoming", data: data?.upcoming ?? [] },
    { title: "Past", data: data?.past ?? [] },
  ].filter((s) => s.data.length > 0);

  const handleCancel = (booking: MyBooking) => {
    Alert.alert(
      "Cancel booking?",
      "Refund depends on how close it is to kickoff.",
      [
        { text: "Keep spot", style: "cancel" },
        {
          text: "Cancel booking",
          style: "destructive",
          onPress: () => {
            setCancellingId(booking.id);
            cancelBooking.mutate(
              { bookingId: booking.id },
              {
                onSuccess: (res) => Alert.alert("Cancelled", res.message),
                onSettled: () => setCancellingId(null),
              },
            );
          },
        },
      ],
    );
  };

  return (
    <SectionList
      style={styles.wrap}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.orange} />}
      ListHeaderComponent={<Text style={styles.header}>My Games</Text>}
      ListEmptyComponent={
        !isLoading ? (
          <View style={styles.empty}>
            <HandwrittenHeader style={styles.emptyTitle}>coming up</HandwrittenHeader>
            <Text style={styles.emptyBody}>Your booked games will show up here.</Text>
          </View>
        ) : null
      }
      renderSectionHeader={({ section }) => <Text style={styles.sectionLabel}>{section.title}</Text>}
      renderItem={({ item }) => {
        const status = STATUS_LABEL[item.paymentStatus] ?? { label: item.paymentStatus, color: colors.inkMuted };
        return (
          <Pressable
            onPress={() => router.push(`/game/${item.gameId}`)}
            onLongPress={() => handleCancel(item)}
            style={styles.cardWrap}
          >
            <GlassCard>
              <View style={styles.row}>
                <Text style={styles.title} numberOfLines={1}>{item.game.title}</Text>
                <View style={[styles.statusPill, { backgroundColor: status.color + "1F" }]}>
                  <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {item.game.pitchName} · {format(new Date(item.game.kickoffTime), "d MMM, h:mm a")}
              </Text>
              <Text style={styles.team}>Team {item.team} · Slot {item.slotIndex + 1}</Text>
              {cancellingId === item.id && <Text style={styles.cancelling}>Cancelling…</Text>}
            </GlassCard>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep },
  content: { padding: spacing.lg, paddingTop: spacing.xxl * 1.5, paddingBottom: spacing.xxl * 2 },
  header: { fontSize: 28, fontWeight: "800", color: colors.inkNavy, marginBottom: spacing.lg },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: spacing.md },
  cardWrap: { marginBottom: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink, flex: 1, marginRight: spacing.sm },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  statusText: { fontSize: 11, fontWeight: "700" },
  meta: { fontSize: 13, color: colors.inkMuted, marginTop: 4 },
  team: { fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  cancelling: { fontSize: 12, color: colors.danger, marginTop: 6 },
  empty: { alignItems: "center", paddingVertical: spacing.xxl * 2 },
  emptyTitle: { fontSize: 32 },
  emptyBody: { color: colors.inkMuted, marginTop: spacing.sm },
});
