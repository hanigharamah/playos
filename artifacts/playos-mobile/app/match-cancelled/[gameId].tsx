import { useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format, isSameDay } from "date-fns";
import { useGetGame, useGetMyBookings, useGameRoster } from "@/lib/api";
import {
  REFUND_WINDOW_HOURS, AUTO_CANCEL_MIN_CHECKED_IN, AUTO_CANCEL_FORMAT_CAPACITY,
} from "@/lib/refunds";
import { DotWaveBackground } from "@/components/DotWaveBackground";
import { WarmCanvas } from "@/components/WarmCanvas";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { Btn3D } from "@/components/Btn3D";
import { BtnOutline } from "@/components/BtnOutline";
import { Callout } from "@/components/Callout";
import { GlassCard } from "@/components/GlassCard";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import { screen } from "@/lib/analytics";

// Measured off Figma 696:556 (Read Me palette section).
const INK = "#1C1C1E";
const MUTED = "#6C6C70";
const GREEN = "#268033";
const ORANGE = "#FD6A03";

const GLOWS = [
  { cx: 0.8, cy: 0.15, r: 0.9, color: "rgba(255,225,204,0.35)" },
  { cx: 0.65, cy: 0.3, r: 0.6, color: "rgba(255,217,228,0.2)" },
];

function sar(amount: number): string {
  return `SAR ${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

/**
 * Match · Auto-cancelled — the player-facing notice (Figma 696:556).
 *
 * The system, not a person, called this off: fewer than 10 of 12 checked in at
 * T-10. The Dev Mode annotation is explicit that the copy must not imply a
 * human decision, so nothing here says "we decided" or names an operator.
 *
 * The mock's refund card reads as if cash were automatic and immediate. Under
 * the ratified July 2026 policy the player CHOOSES cash or a game token within
 * 48 hours, with cash as the automatic fallback — which is what the card and
 * the footnote say. The choice itself lives on /refund/[bookingId].
 */
export default function MatchAutoCancelled() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const { data: game, isLoading } = useGetGame(gameId ?? "", { enabled: !!gameId });
  const { data: bookings } = useGetMyBookings();
  const { data: roster } = useGameRoster(gameId ?? null);

  useEffect(() => { screen("MatchAutoCancelled", { gameId }); }, [gameId]);

  // The refund belongs to this player's booking, so the CTA needs it. A
  // settled booking drops out of useGetMyBookings, so this can legitimately be
  // absent — the CTA is disabled rather than pointing at a dead route.
  const booking =
    bookings?.upcoming?.find((b) => b.gameId === gameId) ?? bookings?.past?.find((b) => b.gameId === gameId);

  if (isLoading || !game) {
    return (
      <View style={styles.loading}>
        <WarmCanvas base="#FFF8F0" glows={GLOWS} />
        {isLoading ? <ActivityIndicator color={ORANGE} /> : <Text style={styles.gone}>this match is no longer available.</Text>}
      </View>
    );
  }

  const kickoff = new Date(game.kickoffTime);
  const teamSize = Math.round(game.capacity / 2);
  const isStandardFormat = game.capacity === AUTO_CANCEL_FORMAT_CAPACITY;

  return (
    <View style={styles.wrap}>
      <WarmCanvas base="#FFF8F0" glows={GLOWS} />
      <DotWaveBackground width={width} height={600} />

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 5 }]} showsVerticalScrollIndicator={false}>
        <HandwrittenHeader style={styles.title}>tonight is off</HandwrittenHeader>
        <Text style={styles.sub}>not enough players checked in</Text>

        <GlassCard variant="soft" round={18} padding={0} style={styles.matchCard}>
          <View style={styles.matchInner}>
            <Image source={{ uri: getVenuePhoto(game.pitchName, game.pitchPhotoUrl) }} style={styles.thumb} />
            <View style={styles.matchText}>
              <Text style={styles.matchTitle} numberOfLines={1}>
                {teamSize}v{teamSize} · {game.pitchName}
              </Text>
              <Text style={styles.matchSub}>
                {isSameDay(kickoff, new Date()) ? "Today" : format(kickoff, "EEE, d MMM")} · {format(kickoff, "h:mm a")}
              </Text>
              {/*
               * The mock's third line is "cancelled at 7:50 PM". games.cancelled_at
               * is written by the cancel_match RPC but is not exposed on
               * GameSummary/GameDetail, so the exact cancellation time cannot be
               * shown without inventing one — the line is omitted rather than
               * approximated from kickoff minus ten minutes.
               */}
            </View>
          </View>
        </GlassCard>

        {/*
         * Checked-in count is real (get_game_roster). Hidden entirely when the
         * roster has not loaded, rather than rendering "0 of 12" and telling
         * the player something untrue about why their match died.
         */}
        {roster && (
          <Callout
            tone="neutral"
            icon={<Text style={styles.dot}>●</Text>}
            title={`${roster.checkedInCount} of ${roster.capacity} checked in`}
            body={
              isStandardFormat
                ? `we need ${AUTO_CANCEL_MIN_CHECKED_IN} to play a fair ${teamSize}v${teamSize}. rather than put you on a half-empty pitch we called it 10 minutes before kickoff.`
                : // The 10-of-12 floor is only ratified for the 12-player format,
                  // so no minimum is claimed for other sizes.
                  "there were not enough players checked in to play a fair match, so we called it 10 minutes before kickoff."
            }
            style={{ marginTop: 25 }}
          />
        )}

        <Callout
          tone="confirm"
          icon={<Text style={styles.tick}>✓</Text>}
          title={`your ${sar(game.price)} is coming back`}
          body="playos cancelled this, so you choose: money back to your card, or a game token that keeps your streak alive."
          style={{ marginTop: 32 }}
        />

        <Btn3D
          label="choose my refund"
          disabled={!booking}
          onPress={() => booking && router.push(`/refund/${booking.id}`)}
          style={{ marginTop: 40 }}
        />
        <BtnOutline
          label="find another match tonight"
          tone="warning"
          onPress={() => router.push("/browse")}
          style={{ marginTop: 12 }}
        />

        <Text style={styles.footnote}>
          no choice in {REFUND_WINDOW_HOURS} hours and we refund your card automatically
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF8F0" },
  gone: { fontSize: 14, color: MUTED },
  // paddingTop comes from the safe-area inset at the call site; the fixed
  // value was smaller than the Dynamic Island's inset.
  content: { paddingHorizontal: 24, paddingBottom: 48 },

  title: { fontSize: 38, color: ORANGE, lineHeight: 48 },
  sub: { fontSize: 15.5, fontWeight: "600", color: INK, marginTop: 6 },

  // Geometry only — fill, stroke and shadows come from <GlassCard>.
  matchCard: { marginTop: 25 },
  matchInner: { flexDirection: "row", alignItems: "center", minHeight: 92, padding: 11 },
  thumb: { width: 68, height: 68, borderRadius: 14, backgroundColor: "#CFD8C4" },
  matchText: { flex: 1, marginLeft: 12 },
  matchTitle: { fontSize: 16, fontWeight: "600", color: INK },
  matchSub: { fontSize: 13, color: MUTED, marginTop: 5 },

  dot: { fontSize: 13, fontWeight: "700", color: "#3A3A3E" },
  tick: { fontSize: 13, fontWeight: "700", color: GREEN },

  footnote: { fontSize: 13, color: MUTED, textAlign: "center", marginTop: 20, lineHeight: 19 },
});
