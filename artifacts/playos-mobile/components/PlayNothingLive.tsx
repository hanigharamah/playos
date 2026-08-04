import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { format, isSameDay, isTomorrow } from "date-fns";
import { CircleDot, Info } from "lucide-react-native";
import { EmptyCard, EmptyEyebrow } from "@/components/EmptyState";
import { Callout } from "@/components/Callout";
import { GlassCard } from "@/components/GlassCard";
import { BtnOutline } from "@/components/BtnOutline";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { VenueArt } from "@/components/VenueArt";
import { useGetMyBookings } from "@/lib/api";

const INK = "#1C1C1E";
const MUTED = "#6C6C70";
const AMBER = "#C96A00";

/** T-20: check-in, teams and chat all open 20 minutes before kickoff. */
const OPENS_BEFORE_MS = 20 * 60_000;

/** "22h 14m" / "14m" — how long until the match-day room unlocks. */
function opensIn(kickoffIso: string): string | null {
  const ms = new Date(kickoffIso).getTime() - OPENS_BEFORE_MS - Date.now();
  if (ms <= 0) return null;
  const mins = Math.floor(ms / 60_000);
  const h = Math.floor(mins / 60);
  return h > 0 ? `opens in ${h}h ${mins % 60}m` : `opens in ${mins}m`;
}

/**
 * Play tab with nothing live (Figma 697:506).
 *
 * Per the annotation this is the most likely screen in week one, so it must
 * carry a route out rather than a bare illustration — hence the next booked
 * match, the bookings button and the browse link.
 *
 * The mock's "YOUR NEXT MATCH" row shows 6v6 · venue · time, all of which
 * `MyBooking.game` really has. It shows no distance or rating, so nothing
 * had to be dropped here.
 */
export function PlayNothingLive() {
  const router = useRouter();
  const { data: bookings } = useGetMyBookings();

  // Soonest still-upcoming booking; that's the match this tab will wake for.
  const next = (bookings?.upcoming ?? [])
    .filter((b) => b.paymentStatus !== "refunded" && b.paymentStatus !== "forfeited")
    .sort((a, b) => +new Date(a.game.kickoffTime) - +new Date(b.game.kickoffTime))[0];

  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>nothing is live right now</Text>

      <EmptyCard
        icon={<CircleDot size={30} color="#3A3A3E" strokeWidth={1.8} />}
        title="this tab wakes up at T-20"
        body="check-in, teams and chat all open 20 minutes before kickoff"
      />

      {next && (
        <>
          <View style={styles.eyebrowWrap}><EmptyEyebrow>YOUR NEXT MATCH</EmptyEyebrow></View>
          <Pressable style={styles.nextPress} onPress={() => router.push(`/game/${next.gameId}`)}>
            <GlassCard variant="soft" round={20} padding={0}>
              <View style={styles.nextRow}>
                <VenueArt name={next.game.pitchName} style={styles.nextThumb} />
                <View style={styles.nextText}>
                  <Text style={styles.nextTitle} numberOfLines={1}>
                    {next.game.capacity / 2}v{next.game.capacity / 2}  ·  {next.game.pitchName}
                  </Text>
                  <Text style={styles.nextSub}>
                    {whenLabel(next.game.kickoffTime)}  ·  {format(new Date(next.game.kickoffTime), "h:mm a")}
                  </Text>
                  {/* Static at render — a live ticker here would re-render the whole
                      tab every second for a value measured in hours. */}
                  <Text style={styles.nextOpens}>{opensIn(next.game.kickoffTime) ?? "opening now"}</Text>
                </View>
              </View>
            </GlassCard>
          </Pressable>
        </>
      )}

      <Callout
        style={styles.callout}
        tone="neutral"
        icon={<Info size={13} color="#3A3A3E" strokeWidth={2.2} />}
        title="why nothing is here"
        body="play is your match-day room, not a list. everything else lives in bookings and browse."
      />

      <BtnOutline label="see my bookings" style={styles.cta} onPress={() => router.push("/(tabs)/my-games")} />

      <Pressable onPress={() => router.push("/browse")}>
        <HandwrittenHeader style={styles.browse}>browse tonight in riyadh  →</HandwrittenHeader>
      </Pressable>
    </View>
  );
}

function whenLabel(iso: string): string {
  const d = new Date(iso);
  if (isSameDay(d, new Date())) return "Tonight";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEE");
}

const styles = StyleSheet.create({
  // Clears whatever precedes it on the Play tab. Without this the lead line
  // sat flush against the bottom of the search field, since the field carries
  // no bottom margin (the sections below it bring their own top margin).
  wrap: { alignItems: "center", alignSelf: "stretch", marginTop: 24 },
  // 36 is the mock's text-top-to-card-top; as a margin it sits below the
  // ~19pt line box, so it needs to be that much smaller.
  lead: { alignSelf: "flex-start", fontSize: 15.5, fontWeight: "600", color: INK, marginBottom: 17 },

  eyebrowWrap: { alignSelf: "flex-start", marginTop: 26 },

  // The card's own width constraints now live on the Pressable wrapping it,
  // so the glass fills exactly the box the hand-rolled card used to.
  nextPress: { alignSelf: "stretch", maxWidth: 350, marginTop: 9 },
  nextRow: { flexDirection: "row", alignItems: "center", minHeight: 104, paddingHorizontal: 13 },
  nextThumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: "#CFD8C4" },
  nextText: { flex: 1, marginLeft: 14 },
  nextTitle: { fontSize: 16, fontWeight: "600", color: INK },
  nextSub: { fontSize: 13, color: MUTED, marginTop: 6 },
  nextOpens: { fontSize: 13, fontWeight: "600", color: AMBER, marginTop: 6 },

  callout: { alignSelf: "stretch", maxWidth: 350, marginTop: 22 },
  cta: { alignSelf: "stretch", maxWidth: 350, borderRadius: 18, marginTop: 42 },
  browse: { fontSize: 22, textAlign: "center", marginTop: 20 },
});
