import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Image, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { format, isSameDay, subHours } from "date-fns";
import { useGetSettings, useConfirmPaymentMethod, useGetGame, FREE_CANCEL_HOURS } from "@/lib/api";
import { DotWaveBackground } from "@/components/DotWaveBackground";
import { WarmCanvas } from "@/components/WarmCanvas";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { Btn3D } from "@/components/Btn3D";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import { screen, track } from "@/lib/analytics";

type Method = "cash" | "stcpay";

const INK = "#1C1C1E";
const MUTED = "#6C6C70";
const ORANGE = "#FA810B";

const GLOWS = [
  { cx: 0.8, cy: 0.15, r: 0.9, color: "rgba(255,225,204,0.35)" },
  { cx: 0.65, cy: 0.3, r: 0.6, color: "rgba(255,217,228,0.2)" },
];

/**
 * Checkout (Figma 345:364).
 *
 * The mock lists mada / Apple Pay / Google Pay / Card. None of those exist —
 * there is no payment gateway and no saved-card store, and the privacy policy
 * says we don't collect card numbers. The ratified single-operator methods are
 * cash at the pitch and STC Pay, so the mock's LAYOUT is followed exactly (one
 * shared card, hairline dividers, a radio on the selected row, a trailing
 * badge) while the rows themselves are the two real methods.
 *
 * The mock's "use a token for this spot" toggle (368:603) is omitted: there is
 * no token ledger, so it could only ever read "0 tokens available".
 *
 * One behavioural fix, not a fidelity one: this screen used to commit the
 * booking the instant a method row was tapped — a one-tap irreversible charge
 * with no confirm step. Selecting now only selects; the CTA commits, which is
 * what the mock always showed.
 */
export default function Checkout() {
  const { bookingId, gameId } = useLocalSearchParams<{ bookingId: string; gameId: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data: settings } = useGetSettings();
  const { data: game } = useGetGame(gameId!);
  const confirmMethod = useConfirmPaymentMethod();

  const [method, setMethod] = useState<Method | null>(null);

  useEffect(() => { screen("Checkout", { bookingId, gameId }); }, [bookingId, gameId]);

  const kickoff = game ? new Date(game.kickoffTime) : null;
  const freeUntil = kickoff ? subHours(kickoff, FREE_CANCEL_HOURS) : null;
  const spotsLeft = game ? game.capacity - game.bookedCount : null;

  const pay = () => {
    if (!method || !bookingId) return;
    confirmMethod.mutate(
      { bookingId, method },
      {
        onSuccess: () => {
          track("booking_confirmed", { method, fee: game?.price ?? null, gameId: gameId ?? null });
          router.replace({
            pathname: "/booking-confirmed/[bookingId]",
            params: { bookingId, gameId: gameId ?? "" },
          });
        },
      },
    );
  };

  const METHODS: { key: Method; label: string; badge: string }[] = [
    { key: "cash", label: "cash at the pitch", badge: "Cash" },
    { key: "stcpay", label: "STC Pay", badge: "STC" },
  ];

  return (
    <View style={styles.wrap}>
      <WarmCanvas base="#FFF8F0" glows={GLOWS} />
      <DotWaveBackground width={width} height={600} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <HandwrittenHeader style={styles.title}>checkout</HandwrittenHeader>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* What the player is paying for — absent from this screen entirely
            before now, so they confirmed a charge with nothing to check it
            against. */}
        {game && (
          <View style={styles.matchCard}>
            <Image source={{ uri: getVenuePhoto(game.pitchName, game.pitchPhotoUrl) }} style={styles.thumb} />
            <View style={styles.matchText}>
              <Text style={styles.matchTitle} numberOfLines={1}>
                {Math.floor(game.capacity / 2)}v{Math.floor(game.capacity / 2)} · {game.pitchName}
              </Text>
              <Text style={styles.matchSub}>
                {kickoff && isSameDay(kickoff, new Date()) ? "Today" : kickoff ? format(kickoff, "EEE") : ""}
                {kickoff ? ` · ${format(kickoff, "h:mm a")}` : ""}
              </Text>
              {/* The mock also shows "· 2.3 km away". No location data exists. */}
              {spotsLeft !== null && spotsLeft > 0 && (
                <Text style={styles.matchSpots}>{spotsLeft} {spotsLeft === 1 ? "spot" : "spots"}</Text>
              )}
            </View>
          </View>
        )}

        <Text style={styles.payWith}>pay with</Text>

        <View style={styles.methodsCard}>
          {METHODS.map((m, i) => {
            const selected = method === m.key;
            return (
              <View key={m.key}>
                {i > 0 && <View style={styles.divider} />}
                <Pressable
                  style={styles.methodRow}
                  onPress={() => setMethod(m.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View style={styles.methodText}>
                    <Text style={styles.methodLabel}>{m.label}</Text>
                    {m.key === "stcpay" && settings?.stcpayNumber && (
                      <Text style={styles.methodSub}>{settings.stcpayNumber}</Text>
                    )}
                  </View>

                  {selected ? (
                    <View style={styles.radioOn}><Text style={styles.radioTick}>✓</Text></View>
                  ) : (
                    <View style={styles.badge}><Text style={styles.badgeText}>{m.badge}</Text></View>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Computed from kickoff per the dev note, not a fixed string. */}
        {freeUntil && (
          <Text style={styles.policy}>
            Free cancellation until {isSameDay(freeUntil, new Date()) ? "today" : format(freeUntil, "EEE")}{" "}
            {format(freeUntil, "h:mm a")}{"\n"}({FREE_CANCEL_HOURS}h before kickoff)
          </Text>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <Btn3D
          label={game ? `🔒  pay SAR ${game.price}` : "🔒  pay"}
          disabled={!method}
          loading={confirmMethod.isPending}
          onPress={pay}
        />
      </View>
    </View>
  );
}

const card = {
  backgroundColor: "rgba(255,255,255,0.55)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.85)",
  shadowColor: "#8C5926",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.12,
  shadowRadius: 16,
  elevation: 3,
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0", paddingTop: 52 },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20 },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
  },
  backGlyph: { fontSize: 20, fontWeight: "700", color: INK, lineHeight: 22 },
  title: { fontSize: 24, color: ORANGE, marginLeft: 26 },

  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 140 },

  matchCard: { ...card, flexDirection: "row", height: 92, borderRadius: 18, padding: 11 },
  thumb: { width: 68, height: 68, borderRadius: 14, backgroundColor: "#CFD8C4" },
  matchText: { flex: 1, marginLeft: 12, paddingTop: 4 },
  matchTitle: { fontSize: 16, fontWeight: "600", color: INK },
  matchSub: { fontSize: 13, color: MUTED, marginTop: 8 },
  matchSpots: { fontSize: 13, fontWeight: "600", color: ORANGE, marginTop: 6 },

  payWith: { fontSize: 13, color: MUTED, marginTop: 28, marginBottom: 10 },

  methodsCard: { ...card, borderRadius: 18, overflow: "hidden" },
  divider: { height: 1, backgroundColor: "#E6E6E6", marginHorizontal: 15 },
  methodRow: { flexDirection: "row", alignItems: "center", minHeight: 52, paddingHorizontal: 19, paddingVertical: 14 },
  methodText: { flex: 1 },
  methodLabel: { fontSize: 15, fontWeight: "600", color: INK },
  methodSub: { fontSize: 13, color: MUTED, marginTop: 4 },

  radioOn: { width: 22, height: 22, borderRadius: 11, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center" },
  radioTick: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  badge: {
    height: 24, minWidth: 40, borderRadius: 6, paddingHorizontal: 8, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
  },
  badgeText: { fontSize: 11, fontWeight: "600", color: INK },

  policy: { fontSize: 13, color: MUTED, marginTop: 26, lineHeight: 19 },

  actions: { position: "absolute", left: 20, right: 20, bottom: 40 },
});
