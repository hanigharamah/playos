import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Users, Shield, Gauge, ArrowRight } from "lucide-react-native";
import { format } from "date-fns";
import { useRouter } from "expo-router";
import { useGameRoster } from "@/lib/api";
import { AvatarStack } from "./AvatarStack";
import { PillButton } from "./PillButton";
import { colors, radius, spacing } from "@/lib/theme";
import { VenueArt } from "@/components/VenueArt";
import type { GameSummary } from "@/lib/api";

/**
 * "hero" (Home featured card) — mockup style: no photo, a frosted glass
 * card floating over the decorative dot-wave page background, avatars and
 * a round icon CTA stacked below the badges. "compact" (Play's list) keeps
 * the photo-header treatment since it's shown against a plain list, not
 * the decorative hero background.
 */
export function MatchCard({
  game,
  onPress,
  variant = "hero",
}: {
  game: GameSummary;
  onPress: () => void;
  variant?: "hero" | "compact";
}) {
  const router = useRouter();
  const spotsLeft = game.capacity - game.bookedCount;
  const teamSize = game.capacity / 2;
  // Roster fetch is cheap (paid bookings only) and only runs for cards that
  // are actually mounted — acceptable at PlayOS's current game volume.
  const { data: roster } = useGameRoster(game.id);
  const names = (roster?.entries ?? []).map((e) => e.name);

  const dayLabel = format(new Date(game.kickoffTime), "EEE").toLowerCase() === format(new Date(), "EEE").toLowerCase()
    ? "TONIGHT"
    : format(new Date(game.kickoffTime), "EEE").toUpperCase();

  if (variant === "hero") {
    return (
      <Pressable onPress={onPress}>
        <View style={styles.heroShadow}>
          <LinearGradient
            colors={["#FFFFFF", "#FFF7F2", "#FFF1F6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            {spotsLeft > 0 && spotsLeft <= 3 && (
              <View style={styles.heroSpotsBadge}>
                <Text style={styles.heroSpotsBadgeText}>{spotsLeft} left</Text>
              </View>
            )}
            <Text style={styles.time}>{dayLabel} · {format(new Date(game.kickoffTime), "h:mm a")}</Text>
            <Text style={styles.title} numberOfLines={1}>{game.pitchName}</Text>

            <View style={styles.iconBadges}>
              <View style={styles.iconBadge}><Users size={14} color={colors.inkMuted} /><Text style={styles.iconBadgeText}>{teamSize}v{teamSize}</Text></View>
              <View style={styles.iconBadge}><Shield size={14} color={colors.inkMuted} /><Text style={styles.iconBadgeText}>Outdoor</Text></View>
              <View style={styles.iconBadge}><Gauge size={14} color={colors.inkMuted} /><Text style={styles.iconBadgeText}>Intermediate</Text></View>
            </View>

            {names.length > 0 && (
              <View style={styles.heroAvatarRow}>
                <AvatarStack names={names} max={4} size={34} />
              </View>
            )}

            <Pressable onPress={() => router.push(`/game/${game.id}`)} style={styles.heroCta} hitSlop={6}>
              <View style={styles.heroCtaIcon}>
                <ArrowRight size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.heroCtaLabel}>join match</Text>
            </Pressable>
          </LinearGradient>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <View style={styles.photoWrap}>
        <VenueArt name={game.pitchName} style={styles.photoCompact}>
          {spotsLeft > 0 && spotsLeft <= 3 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{spotsLeft} SPOT{spotsLeft === 1 ? "" : "S"} LEFT</Text>
            </View>
          )}
        </VenueArt>
      </View>

      <View style={styles.body}>
        <Text style={styles.time}>{dayLabel} · {format(new Date(game.kickoffTime), "h:mm a")}</Text>
        <Text style={styles.title} numberOfLines={1}>{game.pitchName}</Text>

        <View style={styles.ctaRow}>
          {names.length > 0 ? <AvatarStack names={names} /> : <View />}
          <PillButton
            label="join"
            onPress={() => router.push(`/game/${game.id}`)}
            size="sm"
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.hairline },
  photoWrap: { width: "100%" },
  photoCompact: { width: "100%", height: 100, justifyContent: "flex-start", alignItems: "flex-end", padding: spacing.md },
  photoImage: {},
  badge: { backgroundColor: colors.pink, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  body: { padding: spacing.md },
  time: { fontSize: 11, fontWeight: "700", color: colors.orange, letterSpacing: 0.3 },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink, marginTop: 2 },
  iconBadges: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm, flexWrap: "wrap" },
  iconBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBadgeText: { fontSize: 12, color: colors.inkMuted, fontWeight: "500" },
  ctaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md },

  // hero — white floating card with a faint warm sheen, big radius, soft shadow
  heroShadow: {
    borderRadius: 30,
    shadowColor: "#8A5A3A",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 10,
  },
  heroCard: {
    borderRadius: 30,
    padding: spacing.xl,
    overflow: "hidden",
  },
  heroSpotsBadge: { position: "absolute", top: spacing.lg, right: spacing.lg, backgroundColor: colors.pink + "1F", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  heroSpotsBadgeText: { color: colors.pink, fontSize: 11, fontWeight: "700" },
  heroAvatarRow: { marginTop: spacing.lg },
  heroCta: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xl },
  heroCtaIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.orange,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.orange, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  heroCtaLabel: { fontSize: 18, fontWeight: "800", color: colors.ink },
});
