import { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { format, isSameDay } from "date-fns";
import { ArrowLeft, Check, Calendar } from "lucide-react-native";
import { useGetGame } from "@/lib/api";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { WarmCanvas } from "@/components/WarmCanvas";
import { Btn3D } from "@/components/Btn3D";
import { GlassCard } from "@/components/GlassCard";
import { VenueArt } from "@/components/VenueArt";
import { colors, spacing } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { registerForPush } from "@/lib/notifications";
import { shouldPromptForNotifications } from "@/app/permission/notifications";
import { screen, track } from "@/lib/analytics";

// Exact palette from the Figma Booking Confirmed screen (node 369:568)
const INK = "#1C1C1E";
const MUTED = "#6C6C70";
const ACCENT = "#FA810B";

const GLOWS = [
  { cx: 0.8, cy: 0.15, r: 0.9, color: "rgba(255,225,204,0.35)" },
  { cx: 0.65, cy: 0.3, r: 0.6, color: "rgba(255,217,228,0.2)" },
];

/** Confetti dots scattered behind the success badge (Figma 369:574–583). */
const SPARKS: { x: number; y: number; s: number; o: number }[] = [
  { x: 60, y: 100, s: 4, o: 0.35 },
  { x: 80, y: 35, s: 5, o: 0.5 },
  { x: 135, y: 5, s: 4, o: 0.3 },
  { x: 250, y: 2, s: 4, o: 0.3 },
  { x: 303, y: 32, s: 6, o: 0.5 },
  { x: 325, y: 95, s: 5, o: 0.45 },
  { x: 105, y: 150, s: 4, o: 0.3 },
  { x: 290, y: 145, s: 5, o: 0.4 },
  { x: 165, y: 185, s: 4, o: 0.3 },
  { x: 225, y: 182, s: 5, o: 0.4 },
];

export default function BookingConfirmed() {
  const { bookingId, gameId } = useLocalSearchParams<{ bookingId: string; gameId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: game } = useGetGame(gameId!, { enabled: !!gameId });

  useEffect(() => { screen("BookingConfirmed", { bookingId, gameId }); }, [bookingId, gameId]);

  // Push is asked here, right after the first payment, rather than at install.
  // A player who has just paid has a concrete reason to want the check-in
  // message, and the signup-time opt-in rate is not one a forfeit policy can
  // rest on. Capped at two appearances by shouldPromptForNotifications().
  const { user } = useAuth();
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!user?.id) return;
      if (!(await shouldPromptForNotifications())) return;
      if (cancelled) return;
      const result = await registerForPush(user.id);
      track(result.status === "granted" ? "reminder_enabled" : "reminder_denied", {
        source: "first_payment",
        result: result.status,
      });
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const kickoff = game ? new Date(game.kickoffTime) : null;
  const teamSize = game ? game.capacity / 2 : 0;
  const spotsLeft = game ? game.capacity - game.bookedCount : 0;

  const addToCalendar = () => {
    if (!game || !kickoff) return;
    // expo-calendar isn't installed; hand off to the OS via a Google Calendar
    // template URL, which opens the native calendar app on both platforms.
    const start = format(kickoff, "yyyyMMdd'T'HHmmss");
    const end = format(new Date(kickoff.getTime() + (game.durationMinutes ?? 90) * 60000), "yyyyMMdd'T'HHmmss");
    const url =
      `https://calendar.google.com/calendar/render?action=TEMPLATE` +
      `&text=${encodeURIComponent(game.title)}` +
      `&dates=${start}/${end}` +
      `&location=${encodeURIComponent(game.locationText || game.pitchName)}`;
    Linking.openURL(url);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* The halo rings behind the badge are 6% and 10% orange — on dead cream
          they nearly vanish, which made the one celebratory screen in the app
          the dullest-looking one. It was also the only screen in the booking
          flow without the glow: checkout, check-in and refund all have it. */}
      <WarmCanvas base="#FFF8F0" glows={GLOWS} />
      <ScrollView
        style={styles.wrap}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
      >
      <Pressable onPress={() => router.replace("/(tabs)/my-games")} hitSlop={12} style={styles.back}>
        <ArrowLeft size={20} color={INK} strokeWidth={2} />
      </Pressable>

      {/* Success badge with halo rings + sparks */}
      <View style={styles.badgeArea}>
        {/* The spark coordinates are absolute pixels tuned to the 390pt frame,
            so measured from the screen edge they drifted left of the centred
            badge on a wider phone. Holding them in a fixed 350-wide centred
            field keeps the drawn scatter exactly as designed and centres it on
            any width — scaling the coordinates would stretch the spread. */}
        <View style={styles.sparkField} pointerEvents="none">
          {SPARKS.map((s, i) => (
            <View
              key={i}
              style={[
                styles.spark,
                { left: s.x, top: s.y, width: s.s, height: s.s, borderRadius: s.s / 2, opacity: s.o },
              ]}
            />
          ))}
        </View>
        <View style={styles.haloOuter}>
          <View style={styles.haloInner}>
            <View style={styles.badge}>
              <Check size={44} color={ACCENT} strokeWidth={3.5} />
            </View>
          </View>
        </View>
      </View>

      <HandwrittenHeader style={styles.title}>you're all set!</HandwrittenHeader>
      <Text style={styles.subtitle}>Your spot is confirmed. See you on the pitch!</Text>

      {/* Match summary (Figma 369:589) */}
      {game && kickoff && (
        <GlassCard variant="soft" round={18} padding={0} style={styles.matchCard}>
          <View style={styles.matchInner}>
            <VenueArt name={game.pitchName} style={styles.thumb} />
            <View style={styles.matchText}>
              <Text style={styles.matchTitle} numberOfLines={1}>{teamSize}v{teamSize} · {game.pitchName}</Text>
              <Text style={styles.matchSub}>
                {isSameDay(kickoff, new Date()) ? "Today" : format(kickoff, "EEE, d MMM")} · {format(kickoff, "h:mm a")}
              </Text>
              <Text style={styles.matchSpots}>
                {spotsLeft > 0 ? `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} left` : "match full"}
              </Text>
            </View>
          </View>
        </GlassCard>
      )}

      {/* Add to calendar (Figma 369:595). Gated on `game` like the card above:
          addToCalendar returns early without it, so before the query resolved
          this row was fully drawn, fully tappable, and did nothing. */}
      {game && (
        <Pressable onPress={addToCalendar}>
          {({ pressed }) => (
            <GlassCard variant="soft" round={16} padding={0} style={styles.calendarCard}>
              {/* The press highlight lives on the inner row, above the sheen —
                  the glass fill itself is on the clipped layer below. */}
              <View style={[styles.calendarRow, pressed && { backgroundColor: "rgba(255,255,255,0.75)" }]}>
                <Calendar size={20} color={ACCENT} strokeWidth={2} />
                <Text style={styles.calendarLabel}>add to calendar</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </GlassCard>
          )}
        </Pressable>
      )}

      {/* Figma 373:516. Was a hand-rolled copy of Btn3D — identical gradient,
          sheen and geometry, but with a #994D0D shadow where the primitive
          uses #EB6924. A dark brown drop shadow reads as smudged next to the
          warm glow every other CTA in the app throws. */}
      <Btn3D
        label="view my booking"
        onPress={() => router.replace("/(tabs)/my-games")}
        style={{ marginTop: 20 }}
      />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent, not cream: this ScrollView is a SIBLING above <WarmCanvas />,
  // which is absoluteFill, so an opaque background here paints the glow out
  // entirely. The cream comes from the canvas's own Fill.
  wrap: { flex: 1, backgroundColor: "transparent" },
  // paddingTop comes from the safe-area inset at the call site: the fixed
  // 32 is less than a Dynamic Island inset, so the back button rendered with
  // its upper third under the island.
  content: { paddingHorizontal: 20, paddingBottom: spacing.xxl * 2 },

  back: { height: 42, width: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 },

  badgeArea: { height: 210, alignItems: "center", justifyContent: "center", marginTop: 4 },
  // 350 is the frame width the SPARKS coordinates were drawn against
  // (390pt device less the screen's 20pt gutters).
  sparkField: { position: "absolute", top: 0, bottom: 0, width: 350, alignSelf: "center" },
  spark: { position: "absolute", backgroundColor: ACCENT },
  haloOuter: {
    width: 180, height: 180, borderRadius: 90, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(250,129,11,0.06)",
  },
  haloInner: {
    width: 123, height: 123, borderRadius: 62, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(250,129,11,0.10)",
  },
  badge: {
    width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 22, elevation: 5,
  },

  title: { fontSize: 28, textAlign: "center", color: ACCENT, marginTop: 14 },
  subtitle: { fontSize: 14, color: MUTED, textAlign: "center", marginTop: 14, paddingHorizontal: spacing.xl },

  // Geometry only — the fill, stroke and shadows come from <GlassCard>. The
  // row layout sits on the inner view because GlassCard's padding wrapper is
  // the parent its children actually lay out in.
  matchCard: { marginTop: 34 },
  matchInner: { flexDirection: "row", alignItems: "center", minHeight: 92, padding: 11 },
  thumb: { width: 68, height: 68, borderRadius: 14 },
  matchText: { flex: 1, marginLeft: 12 },
  matchTitle: { fontSize: 16, fontWeight: "600", color: INK },
  matchSub: { fontSize: 13, color: MUTED, marginTop: 6 },
  // #FA810B at 13pt over the glass fill measures ~2.3:1 — below the 4.5:1 body
  // floor and below even the 3:1 large-text one. This is the scarcity line the
  // player reads to decide whether to pull a friend in, and it was the faintest
  // text on the card despite being the loudest colour. #C96A00 is already the
  // system's warning accent. The 28pt Caveat header keeps the bright orange —
  // that is the ratified script accent, and it is large.
  matchSpots: { fontSize: 14, fontWeight: "700", color: "#C96A00", marginTop: 6 },

  calendarCard: { marginTop: 14 },
  // minHeight, not the height it was: the label wraps at larger Dynamic Type.
  calendarRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    minHeight: 56, paddingHorizontal: 19,
  },
  calendarLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: INK },
  chevron: { fontSize: 22, fontWeight: "700", color: MUTED },

  cta: {
    height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginTop: 20, overflow: "hidden",
    shadowColor: "#994D0D", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 6,
  },
  ctaSheen: {
    position: "absolute", top: 4, left: 28, width: 98, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  ctaText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
});
