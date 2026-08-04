import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { format, isSameDay } from "date-fns";
import { useListGames } from "@/lib/api";
import { ErrorScreen } from "@/components/ErrorScreen";
import { Callout } from "@/components/Callout";
import { GlassCard } from "@/components/GlassCard";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { VenueArt } from "@/components/VenueArt";
import { colors } from "@/lib/theme";

/**
 * "that match is gone" (Figma 686:586) — shown when a shared link points at a
 * game that was cancelled or has already kicked off. Offers tonight's real
 * alternatives so a dead link still converts.
 */
export function MatchGone() {
  const router = useRouter();
  const { data: games } = useListGames();
  const alternatives = (games ?? []).slice(0, 2);

  return (
    <ErrorScreen
      onBack={() => router.back()}
      title="that match is gone"
      heroIcon={<Text style={styles.glyph}>?</Text>}
      heroTint="rgba(108,108,112,0.12)"
      heroLine="this link no longer works"
      callout={
        <Callout
          tone="neutral"
          icon={<Text style={styles.discGlyph}>i</Text>}
          title="it was cancelled, or it already kicked off"
          body="shared links stay alive after the match does. nothing went wrong with your app."
          style={{ marginTop: 20 }}
        />
      }
      primaryLabel="browse tonight's matches"
      onPrimary={() => router.replace("/browse")}
    >
      {alternatives.length > 0 && (
        <View style={styles.altBlock}>
          <HandwrittenHeader style={styles.altLabel}>happening tonight instead</HandwrittenHeader>
          {alternatives.map((g) => {
            const kickoff = new Date(g.kickoffTime);
            const teamSize = g.capacity / 2;
            const spots = g.capacity - g.bookedCount;
            return (
              <Pressable key={g.id} onPress={() => router.replace(`/game/${g.id}`)}>
                <GlassCard variant="soft" round={18} padding={0} style={styles.altCard}>
                  <View style={styles.altRow}>
                    <VenueArt name={g.pitchName} style={styles.altThumb} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.altTitle}>{teamSize}v{teamSize}  ·  {g.pitchName}</Text>
                      <Text style={styles.altSub}>
                        {isSameDay(kickoff, new Date()) ? format(kickoff, "h:mm a") : format(kickoff, "EEE · h:mm a")}
                        {"  ·  "}{spots} {spots === 1 ? "spot" : "spots"}
                      </Text>
                    </View>
                    <Text style={styles.altPrice}>SAR {g.price}</Text>
                  </View>
                </GlassCard>
              </Pressable>
            );
          })}
        </View>
      )}
    </ErrorScreen>
  );
}

const styles = StyleSheet.create({
  glyph: { fontSize: 34, fontWeight: "700", color: "#6C6C70" },
  discGlyph: { fontSize: 13, fontWeight: "700", color: "#6C6C70" },

  altBlock: { marginTop: 24 },
  altLabel: { fontSize: 22, color: "#FD6A03", marginBottom: 10, marginLeft: 4 },
  altThumb: { width: 48, height: 48, borderRadius: 12 },
  altCard: { marginBottom: 12 },
  // minHeight, not the fixed 68 it was: the row holds two lines of text.
  altRow: { flexDirection: "row", alignItems: "center", minHeight: 68, padding: 9 },
  altTitle: { fontSize: 15, fontWeight: "700", color: "#1C1C1E" },
  altSub: { fontSize: 13, color: "#6C6C70", marginTop: 5 },
  altPrice: { fontSize: 14, fontWeight: "600", color: "#1C1C1E" },
});
