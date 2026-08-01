import { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Linking, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { format, isSameDay } from "date-fns";
import { ArrowLeft, Check, Calendar } from "lucide-react-native";
import { useGetGame } from "@/lib/api";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import { colors, spacing } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { registerForPush } from "@/lib/notifications";
import { shouldPromptForNotifications } from "@/app/permission/notifications";
import { screen, track } from "@/lib/analytics";

// Exact palette from the Figma Booking Confirmed screen (node 369:568)
const INK = "#1C1C1E";
const MUTED = "#6C6C70";
const ACCENT = "#FA810B";

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
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.replace("/(tabs)/my-games")} hitSlop={12} style={styles.back}>
        <ArrowLeft size={20} color={INK} strokeWidth={2} />
      </Pressable>

      {/* Success badge with halo rings + sparks */}
      <View style={styles.badgeArea}>
        {SPARKS.map((s, i) => (
          <View
            key={i}
            style={[
              styles.spark,
              { left: s.x, top: s.y, width: s.s, height: s.s, borderRadius: s.s / 2, opacity: s.o },
            ]}
          />
        ))}
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
        <View style={styles.matchCard}>
          <Image source={{ uri: getVenuePhoto(game.pitchName, game.pitchPhotoUrl) }} style={styles.thumb} />
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
      )}

      {/* Add to calendar (Figma 369:595) */}
      <Pressable style={styles.calendarRow} onPress={addToCalendar}>
        <Calendar size={20} color={ACCENT} strokeWidth={2} />
        <Text style={styles.calendarLabel}>add to calendar</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      {/* 3D CTA (Figma 373:516) */}
      <Pressable onPress={() => router.replace("/(tabs)/my-games")} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
        <LinearGradient
          colors={["#FFDEA0", "#FEC15F", "#FDAA5F", "#EB6923"]}
          locations={[0, 0.35, 0.65, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.cta}
        >
          <View style={styles.ctaSheen} />
          <Text style={styles.ctaText}>view my booking</Text>
        </LinearGradient>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0" },
  content: { paddingHorizontal: 20, paddingTop: spacing.xxl, paddingBottom: spacing.xxl * 2 },

  back: { height: 42, width: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 },

  badgeArea: { height: 210, alignItems: "center", justifyContent: "center", marginTop: 4 },
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

  matchCard: {
    flexDirection: "row", alignItems: "center", height: 92, borderRadius: 18, padding: 11, marginTop: 34,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 3,
  },
  thumb: { width: 68, height: 68, borderRadius: 14 },
  matchText: { flex: 1, marginLeft: 12 },
  matchTitle: { fontSize: 16, fontWeight: "600", color: INK },
  matchSub: { fontSize: 13, color: MUTED, marginTop: 6 },
  matchSpots: { fontSize: 13, fontWeight: "600", color: ACCENT, marginTop: 6 },

  calendarRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    height: 56, borderRadius: 16, paddingHorizontal: 19, marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 3,
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
