import { View, Text, Pressable, StyleSheet, ImageBackground } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { format } from "date-fns";
import { colors, radius, spacing } from "@/lib/theme";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import type { GameSummary } from "@/lib/api";

/**
 * Photo-backed featured match card from the mockup. Uses the venue's real
 * photo_url if set, else a deterministic generic pitch photo (see
 * lib/placeholderPhotos.ts) — no venue photos exist yet in most rows, per
 * supabase/2026-07-mobile-design-support.sql.
 */
export function MatchCard({ game, onPress }: { game: GameSummary; onPress: () => void }) {
  const spotsLeft = game.capacity - game.bookedCount;
  const teamSize = game.capacity / 2;
  const photo = getVenuePhoto(game.pitchName, game.pitchPhotoUrl);

  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <ImageBackground source={{ uri: photo }} style={styles.card} imageStyle={styles.image}>
        <LinearGradient colors={["rgba(18,20,28,0.15)", "rgba(18,20,28,0.85)"]} style={StyleSheet.absoluteFill} />
        {spotsLeft > 0 && spotsLeft <= 3 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{spotsLeft} SPOT{spotsLeft === 1 ? "" : "S"} LEFT</Text>
          </View>
        )}
        <View style={styles.content}>
          <Text style={styles.time}>{format(new Date(game.kickoffTime), "EEE, h:mm a").toUpperCase()}</Text>
          <Text style={styles.title} numberOfLines={1}>{game.pitchName}</Text>
          <View style={styles.chips}>
            <View style={styles.chip}><Text style={styles.chipText}>{teamSize}v{teamSize}</Text></View>
            <View style={styles.chip}><Text style={styles.chipText}>Outdoor</Text></View>
          </View>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: "hidden" },
  card: { minHeight: 200, padding: spacing.lg, justifyContent: "space-between" },
  image: { borderRadius: radius.lg },
  badge: { position: "absolute", top: spacing.md, right: spacing.md, backgroundColor: colors.pink, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  content: { marginTop: "auto" },
  time: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
  title: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  chips: { flexDirection: "row", gap: 8, marginTop: spacing.sm },
  chip: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  chipText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },
});
