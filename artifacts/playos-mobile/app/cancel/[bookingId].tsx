import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { format, isSameDay } from "date-fns";
import { ArrowLeft, Check, AlertTriangle } from "lucide-react-native";
import { useGetMyBookings, useCancelBooking, FREE_CANCEL_HOURS } from "@/lib/api";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { VenueArt } from "@/components/VenueArt";
import { useServerCountdown } from "@/lib/serverTime";
import { colors, spacing } from "@/lib/theme";
import { screen } from "@/lib/analytics";

// Exact palette from the Figma Cancellation Confirm screen (node 345:400)
const INK = "#1C1C1E";
const MUTED = "#6C6C70";
const GREEN = "#268033";
const RED = "#DB2626";

/** Free-cancellation cutoff — must stay in sync with the web policy page. */
// Cutoff lives in lib/api.ts so the screen and the mutation cannot drift.

/** Same shape as the refund screen's, so the two money screens read alike. */
function sar(amount: number): string {
  return `SAR ${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

export default function CancellationConfirm() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data } = useGetMyBookings();
  const cancelBooking = useCancelBooking();

  useEffect(() => { screen("CancellationConfirm", { bookingId }); }, [bookingId]);

  const booking =
    data?.upcoming?.find((b) => b.id === bookingId) ?? data?.past?.find((b) => b.id === bookingId);

  // Counts down to the free-cancellation cutoff on the SERVER clock, and must
  // be called above the early return — hooks cannot be conditional, so it
  // takes null until the booking lands. This replaces a one-shot sync that
  // decided eligibility at first render and never looked again: a player who
  // opened this screen at 26h02m and read for three minutes still saw the
  // green "free cancellation" banner, tapped, and was silently forfeited by
  // the mutation, which re-decides server-side. The screen promised a refund
  // and the server took the money.
  const kickoffMs = booking ? new Date(booking.game.kickoffTime).getTime() : null;
  const freeUntilMs = kickoffMs === null ? null : kickoffMs - FREE_CANCEL_HOURS * 3_600_000;
  const { remainingMs } = useServerCountdown(freeUntilMs);

  if (!booking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.orange} />
      </View>
    );
  }

  const kickoff = new Date(booking.game.kickoffTime);
  const teamSize = booking.game.capacity / 2;
  const isFree = remainingMs > 0;
  const freeUntil = new Date(freeUntilMs!);

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
          // This codebase throws { data: { error } }, not Error. Reading
          // `.message` meant the one failure the mutation bothers to explain —
          // "couldn't load this booking" — always fell through to the generic
          // line, so the player never saw the real reason.
          Alert.alert("Could not cancel", err?.data?.error ?? "Please try again."),
      },
    );
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
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
          <VenueArt name={booking.game.pitchName} style={styles.thumb} />
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
              {/* The amount is the fact this decision turns on, and it was
                  nowhere on the screen. It is already on the booking. */}
              You'll get {sar(booking.game.price)} back. Free cancellation is open until{" "}
              {format(freeUntil, "h:mm a")} on {format(freeUntil, "EEE, d MMM")}.
            </Text>
            {/* Payments are cash and STC Pay with a single operator, and the
                mutation only marks the booking refunded — no money moves by
                itself. "Your original payment method" promised a rail that
                does not exist and manufactured a support message. */}
            <Text style={styles.policyFoot}>the operator returns your money directly</Text>
          </View>
        ) : (
          <View style={[styles.policyCard, styles.policyWarn]}>
            <View style={[styles.policyIcon, { backgroundColor: "rgba(219,38,38,0.12)" }]}>
              <AlertTriangle size={15} color={RED} strokeWidth={2.5} />
            </View>
            <Text style={[styles.policyTitle, { color: RED }]}>no refund</Text>
            <Text style={styles.policyBody}>
              You're inside the {FREE_CANCEL_HOURS}h window, so you'll lose {sar(booking.game.price)}.
              Cancelling releases your spot so someone else can play.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Pinned actions. The destructive button sat on 34pt of hardcoded
          bottom, which on a home-indicator device puts it under the system
          swipe strip — the tap and the gesture competing on the one control
          that spends money. */}
      <View style={[styles.actions, { bottom: Math.max(insets.bottom, 12) + 12 }]}>
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
  // paddingTop comes from the safe-area inset at the call site: the fixed 32
  // was less than a Dynamic Island's inset, so the back button and the
  // "cancel booking?" header rendered partly under the island.
  content: { paddingHorizontal: 20, paddingBottom: 180 },

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
  policyFoot: { fontSize: 12, color: MUTED, marginTop: 8, fontStyle: "italic" },

  // `bottom` comes from the safe-area inset at the call site.
  actions: { position: "absolute", left: 20, right: 20, gap: 8 },
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
