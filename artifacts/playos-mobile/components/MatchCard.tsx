import { View, Text, Pressable, StyleSheet, ImageBackground } from "react-native";
import { Users, MapPin, Gauge } from "lucide-react-native";
import { format } from "date-fns";
import { useRouter } from "expo-router";
import { useGameRoster } from "@/lib/api";
import { AvatarStack } from "./AvatarStack";
import { PillButton } from "./PillButton";
import { colors, radius, spacing } from "@/lib/theme";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import type { GameSummary } from "@/lib/api";

/**
 * Photo-header card with a solid cream content body below — v3 mockup style
 * (photo + badges/avatars/CTA moved OFF the image into a plain content
 * section, replacing the earlier full-photo-overlay treatment). "hero"
 * variant is the Home featured card; "compact" is used in Play's list.
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
  const photo = getVenuePhoto(game.pitchName, game.pitchPhotoUrl);
  // Roster fetch is cheap (paid bookings only) and only runs for cards that
  // are actually mounted — acceptable at PlayOS's current game volume.
  const { data: roster } = useGameRoster(game.id);
  const names = (roster?.entries ?? []).map((e) => e.name);

  const dayLabel = format(new Date(game.kickoffTime), "EEE").toLowerCase() === format(new Date(), "EEE").toLowerCase()
    ? "TONIGHT"
    : format(new Date(game.kickoffTime), "EEE").toUpperCase();

  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <View style={styles.photoWrap}>
        <ImageBackground source={{ uri: photo }} style={[styles.photo, variant === "compact" && styles.photoCompact]} imageStyle={styles.photoImage}>
          {spotsLeft > 0 && spotsLeft <= 3 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{spotsLeft} SPOT{spotsLeft === 1 ? "" : "S"} LEFT</Text>
            </View>
          )}
        </ImageBackground>
      </View>

      <View style={styles.body}>
        <Text style={styles.time}>{dayLabel} · {format(new Date(game.kickoffTime), "h:mm a")}</Text>
        <Text style={styles.title} numberOfLines={1}>{game.pitchName}</Text>

        {variant === "hero" && (
          <View style={styles.iconBadges}>
            <View style={styles.iconBadge}><Users size={12} color={colors.inkMuted} /><Text style={styles.iconBadgeText}>{teamSize}v{teamSize}</Text></View>
            <View style={styles.iconBadge}><MapPin size={12} color={colors.inkMuted} /><Text style={styles.iconBadgeText}>Outdoor</Text></View>
            <View style={styles.iconBadge}><Gauge size={12} color={colors.inkMuted} /><Text style={styles.iconBadgeText}>Intermediate</Text></View>
          </View>
        )}

        <View style={styles.ctaRow}>
          {names.length > 0 ? <AvatarStack names={names} /> : <View />}
          <PillButton
            label={variant === "hero" ? "join match" : "join"}
            onPress={() => router.push(`/game/${game.id}`)}
            showArrow={variant === "hero"}
            size={variant === "hero" ? "md" : "sm"}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.hairline },
  photoWrap: { width: "100%" },
  photo: { width: "100%", height: 150, justifyContent: "flex-start", alignItems: "flex-end", padding: spacing.md },
  photoCompact: { height: 100 },
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
});
