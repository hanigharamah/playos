import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, Platform, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { format, isSameDay } from "date-fns";
import { ArrowLeft, Check, AlertTriangle } from "lucide-react-native";
import { useGetMyBookings, useCancelBooking, FREE_CANCEL_HOURS } from "@/lib/api";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import { serverNow, syncServerTime } from "@/lib/serverTime";
import { colors, spacing } from "@/lib/theme";
import { screen } from "@/lib/analytics";

// Exact palette from the Figma Cancellation Confirm screen (node 345:400)
const INK = "#1C1C1E";
const MUTED = "#6C6C70";
const GREEN = "#268033";
const RED = "#DB2626";

/** Free-cancellation cutoff — must stay in sync with the web policy page. */
// Cutoff lives in lib/api.ts so the screen and the mutation cannot drift.

export default function CancellationConfirm() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const { data } = useGetMyBookings();
  const cancelBooking = useCancelBooking();

  const [clockTick, setClockTick] = useState(0);

  useEffect(() => { screen("CancellationConfirm", { bookingId }); }, [bookingId]);

  // Sync before deciding eligibility: serverNow() returns raw device time until
  // an offset lands, so a wound-back clock would show the green "full refund"
  // banner that the mutation then refuses. Must sit above the early return
  // below — hooks cannot be called conditionally.
  useEffect(() => { void syncServerTime().then(() => setClockTick((n) => n + 1)); }, []);

  const booking =
    data?.upcoming?.find((b) => b.id === bookingId) ?? data?.past?.find((b) => b.id === bookingId);

  if (!booking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.orange} />
      </View>
    );
  }

  const kickoff = new Date(booking.game.kickoffTime);
  const teamSize = booking.game.capacity / 2;

  // clockTick is not read: bumping it re-renders, and serverNow() is re-read
  // on that render with the offset applied.
  const hoursUntil = (kickoff.getTime() - serverNow()) / 3_600_000;
  const isFree = hoursUntil > FREE_CANCEL_HOURS;

  const confirmCancel = () => {
    cancelBooking.mutate(
      { bookingId: booking.id },
      {
        onSuccess: (res) => {
          Alert.alert("Booking cancelled", res.message, [
            { text: "OK", onPress: () => router.replace("/(tabs)/my-games") },
          ]);
        },
        onError: (err: any) =>
          Alert.alert("Could not cancel", err?.message ?? "Please try again."),
      },
    );
  };

  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <BlurView intensity={Platform.OS === "ios" ? 20 : 0} tint="light" style={styles.backBtn}>
              <ArrowLeft size={20} color={INK} strokeWidth={2} />
            </BlurView>
          </Pressable>
          <HandwrittenHeader style={styles.title}>cancel booking?</HandwrittenHeader>
        </View>

        {/* Match summary (Figma 368:678) */}
        <View style={styles.matchCard}>
          <Image
            source={{ uri: getVenuePhoto(booking.game.pitchName, booking.game.pitchPhotoUrl) }}
            style={styles.thumb}
          />
          <View style={styles.matchText}>
            <Text style={styles.matchTitle} numberOfLines={1}>
              {teamSize}v{teamSize} · {booking.game.pitchName}
            </Text>
            <Text style={styles.matchSub}>
              {isSameDay(kickoff, new Date()) ? "Today" : format(kickoff, "EEE, d MMM")} · {format(kickoff, "h:mm a")}
            </Text>
          </View>
        </View>

        {/*
         * Refund state (Figma 368:682). NOTE: the Figma copy reads "you'll get
         * 1 token back, redeemable on any match, no cash charge" — that
         * predates the flat 26h policy. The agreed rule is >26h = full cash
         * refund, <=26h = no refund. Copy below follows the policy, not the
         * mock, so users are never told the wrong thing.
         */}
        {isFree ? (
          <View style={[styles.policyCard, styles.policyFree]}>
            <View style={[styles.policyIcon, { backgroundColor: "rgba(38,128,51,0.15)" }]}>
              <Check size={15} color={GREEN} strokeWidth={3} />
            </View>
            <Text style={[styles.policyTitle, { color: GREEN }]}>free cancellation</Text>
            <Text style={styles.policyBody}>
              You're more than {FREE_CANCEL_HOURS}h from kickoff — you'll get a full refund to your
              original payment method.
            </Text>
          </View>
        ) : (
          <View style={[styles.policyCard, styles.policyWarn]}>
            <View style={[styles.policyIcon, { backgroundColor: "rgba(219,38,38,0.12)" }]}>
              <AlertTriangle size={15} color={RED} strokeWidth={2.5} />
            </View>
            <Text style={[styles.policyTitle, { color: RED }]}>no refund</Text>
            <Text style={styles.policyBody}>
              You're inside the {FREE_CANCEL_HOURS}h window. Cancelling releases your spot so someone
              else can play, but you won't be refunded.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Pinned actions */}
      <View style={styles.actions}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
          <LinearGradient
            colors={["#FFDEA0", "#FEC15F", "#FDAA5F", "#EB6923"]}
            locations={[0, 0.35, 0.65, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.keepBtn}
          >
            <View style={styles.keepSheen} />
            <Text style={styles.keepText}>keep my spot</Text>
          </LinearGradient>
        </Pressable>

        <Pressable style={styles.cancelBtn} onPress={confirmCancel} disabled={cancelBooking.isPending}>
          {cancelBooking.isPending ? (
            <ActivityIndicator color={RED} size="small" />
          ) : (
            <Text style={styles.cancelText}>cancel booking</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF8F0" },
  content: { paddingHorizontal: 20, paddingTop: spacing.xxl, paddingBottom: 180 },

  header: { flexDirection: "row", alignItems: "center", gap: 26 },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
  },
  title: { fontSize: 24, color: "#FA810B" },

  matchCard: {
    flexDirection: "row", alignItems: "center", minHeight: 92, borderRadius: 18, padding: 11, marginTop: 26,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 3,
  },
  thumb: { width: 68, height: 68, borderRadius: 14 },
  matchText: { flex: 1, marginLeft: 12 },
  matchTitle: { fontSize: 16, fontWeight: "600", color: INK },
  matchSub: { fontSize: 13, color: MUTED, marginTop: 6 },

  policyCard: {
    borderRadius: 18, padding: 19, marginTop: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 3,
  },
  policyFree: { backgroundColor: "rgba(224,242,224,0.5)" },
  policyWarn: { backgroundColor: "rgba(253,228,228,0.5)" },
  policyIcon: {
    position: "absolute", top: 19, left: 19,
    width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center",
  },
  policyTitle: { fontSize: 16, fontWeight: "600", marginLeft: 34 },
  policyBody: { fontSize: 13, color: MUTED, marginTop: 12, lineHeight: 19 },

  actions: {
    position: "absolute", left: 20, right: 20, bottom: 34, gap: 8,
  },
  keepBtn: {
    height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", overflow: "hidden",
    shadowColor: "#994D0D", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 6,
  },
  keepSheen: {
    position: "absolute", top: 4, left: 28, width: 98, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  keepText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },

  cancelBtn: {
    height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 3,
  },
  cancelText: { fontSize: 15, fontWeight: "600", color: RED },
});
