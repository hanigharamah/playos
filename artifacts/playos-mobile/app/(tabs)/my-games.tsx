import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable, Alert, Image } from "react-native";
import { useRouter } from "expo-router";
import { format } from "date-fns";
import { AlertCircle } from "lucide-react-native";
import { useGetMyBookings, useCancelBooking, type MyBooking } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { SegmentedControl } from "@/components/SegmentedControl";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
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
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  useEffect(() => { screen("MyGames"); }, []);

  const list = (tab === "upcoming" ? data?.upcoming : data?.past) ?? [];

  const handleCancel = (booking: MyBooking) => {
    Alert.alert("Cancel booking?", "Refund depends on how close it is to kickoff.", [
      { text: "Keep spot", style: "cancel" },
      {
        text: "Cancel booking",
        style: "destructive",
        onPress: () => {
          setCancellingId(booking.id);
          cancelBooking.mutate(
            { bookingId: booking.id },
            { onSuccess: (res) => Alert.alert("Cancelled", res.message), onSettled: () => setCancellingId(null) },
          );
        },
      },
    ]);
  };

  return (
    <FlatList
      style={styles.wrap}
      contentContainerStyle={styles.content}
      data={list}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.orange} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.header}>Your bookings</Text>
          <SegmentedControl
            options={[{ value: "upcoming", label: "Upcoming" }, { value: "past", label: "Past" }]}
            value={tab}
            onChange={setTab}
          />
          {tab === "upcoming" && list.length > 0 && (
            <View style={styles.noticeCard}>
              <AlertCircle size={16} color={colors.orange} />
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>Can't make it?</Text>
                <Text style={styles.noticeBody}>Free cancellation up to 26 hours before kickoff.</Text>
              </View>
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        !isLoading ? (
          <View style={styles.empty}>
            <HandwrittenHeader style={styles.emptyTitle}>{tab === "upcoming" ? "coming up" : "nothing yet"}</HandwrittenHeader>
            <Text style={styles.emptyBody}>
              {tab === "upcoming" ? "Your booked games will show up here." : "Past games will show up here."}
            </Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => {
        const status = STATUS_LABEL[item.paymentStatus] ?? { label: item.paymentStatus, color: colors.inkMuted };
        return (
          <Pressable
            onPress={() => router.push(`/game/${item.gameId}`)}
            onLongPress={() => tab === "upcoming" && handleCancel(item)}
            style={styles.cardWrap}
          >
            <GlassCard padding={0} style={styles.bookingCard}>
              <Image source={{ uri: getVenuePhoto(item.game.pitchName, item.game.pitchPhotoUrl) }} style={styles.thumb} />
              <View style={styles.bookingBody}>
                <View style={styles.row}>
                  <Text style={styles.title} numberOfLines={1}>{item.game.title}</Text>
                  <View style={[styles.statusPill, { backgroundColor: status.color + "1F" }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
                <Text style={styles.meta}>{item.game.pitchName} · {format(new Date(item.game.kickoffTime), "d MMM, h:mm a")}</Text>
                <Text style={styles.team}>Team {item.team} · Slot {item.slotIndex + 1}</Text>
                {cancellingId === item.id && <Text style={styles.cancelling}>Cancelling…</Text>}
                {tab === "past" && (
                  <Pressable onPress={() => router.push(`/post-match/${item.gameId}`)}>
                    <Text style={styles.statsLink}>add your stats →</Text>
                  </Pressable>
                )}
              </View>
            </GlassCard>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep },
  content: { padding: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xxl * 2 },
  header: { fontSize: 28, fontWeight: "800", color: colors.orange, marginBottom: spacing.lg },
  statsLink: { fontSize: 12, fontWeight: "700", color: colors.orange, marginTop: spacing.sm },
  noticeCard: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.orange + "14", borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  noticeTitle: { fontSize: 13, fontWeight: "700", color: colors.ink },
  noticeBody: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  cardWrap: { marginBottom: spacing.md, marginTop: spacing.md },
  bookingCard: { flexDirection: "row", overflow: "hidden" },
  thumb: { width: 84, height: "100%", minHeight: 88 },
  bookingBody: { flex: 1, padding: spacing.md },
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
