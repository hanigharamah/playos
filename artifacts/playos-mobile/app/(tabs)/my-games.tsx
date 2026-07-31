import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { format, isSameDay } from "date-fns";
import { CalendarDays } from "lucide-react-native";
import { useGetMyBookings, type MyBooking } from "@/lib/api";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { EmptyState } from "@/components/EmptyState";
import { BookingsSkeleton, useDelayedVisible } from "@/components/Skeleton";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import { colors, spacing } from "@/lib/theme";
import { screen } from "@/lib/analytics";

// Exact palette from the Figma Bookings screen (node 1:5)
const INK = "#1C1C1E";
const MUTED = "#6C6C70";

export default function MyGames() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useGetMyBookings();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  useEffect(() => { screen("MyGames"); }, []);

  // Held back 300ms (Figma 698:595). The segmented control above stays live
  // throughout — it's client state, and switching it changes the query.
  const showSkeleton = useDelayedVisible(isLoading && !data);

  useEffect(() => { if (isError) router.replace("/error/server"); }, [isError, router]);

  const list = (tab === "upcoming" ? data?.upcoming : data?.past) ?? [];
  const soonest = data?.upcoming?.[0];

  /** Routes to the designed confirmation screen (Figma 345:400). */
  const handleCancel = (booking: MyBooking) => router.push(`/cancel/${booking.id}`);

  return (
    <FlatList
      style={styles.wrap}
      contentContainerStyle={styles.content}
      data={list}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.orange} />}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View>
          <HandwrittenHeader style={styles.header}>my games</HandwrittenHeader>

          {/* Segmented control (Figma 5:4) */}
          <View style={styles.segment}>
            <Pressable
              style={[styles.segmentHalf, tab === "upcoming" && styles.segmentActive]}
              onPress={() => setTab("upcoming")}
            >
              <Text style={[styles.segmentText, tab === "upcoming" && styles.segmentTextActive]}>upcoming</Text>
            </Pressable>
            <Pressable
              style={[styles.segmentHalf, tab === "past" && styles.segmentActive]}
              onPress={() => setTab("past")}
            >
              <Text style={[styles.segmentText, tab === "past" && styles.segmentTextActive]}>past</Text>
            </Pressable>
          </View>
          <View style={[styles.underline, tab === "past" && styles.underlinePast]} />
        </View>
      }
      ListEmptyComponent={
        showSkeleton ? (
          <BookingsSkeleton />
        ) : !isLoading ? (
          <EmptyState
            icon={<CalendarDays size={38} color="#C2703A" strokeWidth={1.8} />}
            title={tab === "upcoming" ? "no games booked yet" : "no past games yet"}
            body={
              tab === "upcoming"
                ? "when you join a match, it'll show up here."
                : "matches you've played will show up here."
            }
            actionLabel={tab === "upcoming" ? "browse matches" : undefined}
            onAction={tab === "upcoming" ? () => router.push("/browse") : undefined}
          />
        ) : null
      }
      renderItem={({ item }) => {
        const kickoff = new Date(item.game.kickoffTime);
        const teamSize = item.game.capacity / 2;
        const tonight = isSameDay(kickoff, new Date());
        return (
          <Pressable
            style={styles.row}
            onPress={() => router.push(`/game/${item.gameId}`)}
            onLongPress={() => handleCancel(item)}
          >
            <Image
              source={{ uri: getVenuePhoto(item.game.pitchName, item.game.pitchPhotoUrl) }}
              style={styles.thumb}
            />
            <View style={styles.rowText}>
              <Text style={styles.rowMeta}>
                {tonight ? "TONIGHT" : format(kickoff, "EEE, d MMM").toUpperCase()} • {format(kickoff, "h:mm a")}
              </Text>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.game.title}</Text>
              <Text style={styles.rowSub}>{teamSize}v{teamSize}</Text>
            </View>
          </Pressable>
        );
      }}
      ListFooterComponent={
        tab === "upcoming" && soonest ? (
          <Pressable onPress={() => handleCancel(soonest)}>
            <LinearGradient
              colors={["rgba(255,227,191,0.85)", "rgba(255,209,158,0.85)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nudge}
            >
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>!</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nudgeTitle}>can't make it?</Text>
                <Text style={styles.nudgeBody}>Cancel or reschedule up to 26 hours{"\n"}before match time.</Text>
              </View>
              <Text style={styles.nudgeChevron}>›</Text>
            </LinearGradient>
          </Pressable>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0" },
  content: { paddingHorizontal: 19, paddingTop: spacing.xxl + 20, paddingBottom: 130 },

  header: { fontSize: 28, marginBottom: spacing.xl },

  segment: {
    flexDirection: "row", height: 44, borderRadius: 22, padding: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.75)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 2,
  },
  segmentHalf: { flex: 1, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  segmentActive: {
    backgroundColor: "rgba(255,255,255,0.4)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.75)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 2,
  },
  segmentText: { fontSize: 14, color: MUTED },
  segmentTextActive: { fontWeight: "600", color: INK },
  underline: { width: 70, height: 2, backgroundColor: colors.orange, marginTop: 27, marginBottom: 34 },
  underlinePast: { marginLeft: 179 },

  row: {
    flexDirection: "row", alignItems: "center", height: 104, borderRadius: 18, padding: 13,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    marginBottom: 16,
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.14, shadowRadius: 20, elevation: 4,
  },
  thumb: { width: 76, height: 76, borderRadius: 16 },
  rowText: { flex: 1, marginLeft: 16 },
  rowMeta: { fontSize: 11, fontWeight: "600", color: colors.orange },
  rowTitle: { fontSize: 18, fontWeight: "700", color: INK, marginTop: 5 },
  rowSub: { fontSize: 13, color: MUTED, marginTop: 6 },

  nudge: {
    flexDirection: "row", alignItems: "center", gap: 14,
    height: 96, borderRadius: 16, paddingHorizontal: 14, marginTop: 4,
    borderWidth: 1.5, borderColor: "rgba(255,158,51,0.9)",
    shadowColor: "#D9730D", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 4,
  },
  alertBadge: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.orange,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#D9730D", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 3,
  },
  alertBadgeText: { fontSize: 22, fontWeight: "700", color: "#FFFFFF" },
  nudgeTitle: { fontSize: 16, fontWeight: "600", color: "#BF5205" },
  nudgeBody: { fontSize: 13, color: MUTED, marginTop: 6, lineHeight: 17 },
  nudgeChevron: { fontSize: 18, fontWeight: "700", color: MUTED },

});
