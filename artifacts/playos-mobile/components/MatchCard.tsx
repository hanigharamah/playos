import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { format } from "date-fns";
import { colors, radius, spacing } from "@/lib/theme";
import type { GameSummary } from "@/lib/api";

/**
 * Dark "night pitch" featured card from the mockup. No venue photos exist in
 * Supabase (checked: pitches table has no image field), so this uses a dark
 * navy→black gradient in place of a photo — same mood, honest about what
 * data is real.
 */
export function MatchCard({ game, onPress }: { game: GameSummary; onPress: () => void }) {
  const spotsLeft = game.capacity - game.bookedCount;
  const teamSize = game.capacity / 2;

  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <LinearGradient colors={["#2A3142", "#12141C"]} style={styles.card}>
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
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: "hidden" },
  card: { minHeight: 180, padding: spacing.lg, justifyContent: "space-between" },
  badge: { position: "absolute", top: spacing.md, right: spacing.md, backgroundColor: colors.pink, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  content: { marginTop: "auto" },
  time: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
  title: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  chips: { flexDirection: "row", gap: 8, marginTop: spacing.sm },
  chip: { backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  chipText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },
});
