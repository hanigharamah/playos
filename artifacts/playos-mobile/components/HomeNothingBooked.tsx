import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { format, isSameDay } from "date-fns";
import { CalendarDays } from "lucide-react-native";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import { useGameLineup, lineupSentence, gameFillLabel, type GameSummary } from "@/lib/api";

const INK = "#1C1C1E";
const MUTED = "#6C6C70";

/**
 * Home's storefront (Figma 684:570) — now the DEFAULT, not an empty state.
 *
 * It used to render only when upcoming.length === 0, so the moment a player
 * booked one match Home stopped showing them a single bookable game. That one
 * condition was the revenue bug: every comparable marketplace — Playtomic,
 * OpenTable, ClassPass — leads with what you can book, and demotes what you
 * already booked. Match-day state lives on the mini-bar, which follows the
 * player across every tab, so Home does not need to repeat it.
 *
 * Games arrive pre-ranked by rankOpenGames: fill descending, today first,
 * falling back to the rest of the week when today is empty.
 *
 * The mock shows "2.4 km away" on the hero. There's no device-location wiring
 * and no venue coordinates, so distance is omitted rather than faked.
 */
export function HomeNothingBooked({
  games,
  isToday = true,
}: {
  games: GameSummary[];
  isToday?: boolean;
}) {
  const router = useRouter();

  const [next, ...rest] = games;
  const { data: lineup } = useGameLineup(next?.id ?? null);
  // The header says "also tonight", so only same-day games belong under it.
  // It previously took the next two by kickoff regardless of date and showed
  // time only, so a Saturday game read "8:00 PM" under a "tonight" heading.
  // Already ranked and already filtered to the right day by rankOpenGames —
  // filtering again here would drop the week-fallback games entirely.
  const alsoTonight = rest.slice(0, 2);

  if (!next) {
    return (
      <EmptyState
        icon={<CalendarDays size={38} color="#C2703A" strokeWidth={1.8} />}
        title="nothing open right now"
        body="every match is full or finished. check back later, or browse everything in riyadh."
        actionLabel="browse venues"
        onAction={() => router.push("/browse")}
      />
    );
  }

  const kickoff = new Date(next.kickoffTime);
  const fill = gameFillLabel(next);
  const teamSize = next.capacity / 2;

  return (
    <View>
      <Text style={styles.eyebrow}>{isToday ? "TONIGHT IN RIYADH" : "COMING UP THIS WEEK"}</Text>

      {/* Hero — the one game we're actively recommending */}
      <Pressable onPress={() => router.push(`/game/${next.id}`)}>
        <GlassCard variant="soft" round={24} padding={19} style={styles.hero}>
          <View>
            <Image source={{ uri: getVenuePhoto(next.pitchName, next.pitchPhotoUrl) }} style={styles.heroPhoto} />
            {/* "needs 6 more" below the viable threshold, not "6 spots left".
                A game that cannot start yet is a different offer, and saying
                so is what stops someone booking a match that gets cancelled. */}
            <View style={[styles.spotsBadge, fill.atRisk && styles.spotsBadgeAtRisk]}>
              <Text style={styles.spotsText}>{fill.text}</Text>
            </View>
          </View>

          <View style={styles.heroRow}>
            <View style={styles.heroTextCol}>
              <Text style={styles.heroTitle} numberOfLines={1}>{teamSize}v{teamSize}  ·  {next.pitchName}</Text>
              <Text style={styles.heroSub}>
                {isSameDay(kickoff, new Date()) ? "Tonight" : format(kickoff, "EEE")}  ·  {format(kickoff, "h:mm a")}
              </Text>
            </View>
            <Text style={styles.heroPrice}>SAR {next.price}</Text>
          </View>

          {/* Who is already in. Names convert far better than a headcount in a
              community this size, and a bare count can actively backfire —
              people read a number and assume they will not be missed. Silent
              until 2026-08-game-lineup.sql is applied, so the card keeps its
              spots badge and simply says less. */}
          {/* Initials, not photos. There is no avatar column and no storage
              bucket, so real images do not exist yet — and at launch nobody
              would have uploaded one, so photo discs would render 35 empty
              grey circles. An initial from a real first name is recognisable
              in a group this size and degrades to something meaningful. When
              photos land, these same discs show them and nothing else moves. */}
          {lineup && lineup.names.length > 0 && (
            <View style={styles.lineupRow}>
              <View style={styles.avatarStack}>
                {lineup.names.slice(0, 3).map((n, i) => (
                  <View key={`${n}-${i}`} style={[styles.avatarRing, { marginLeft: i === 0 ? 0 : -9 }]}>
                    <Avatar name={n} size={26} />
                  </View>
                ))}
                {lineup.total > lineup.names.length && (
                  <View style={[styles.avatarRing, styles.avatarMore, { marginLeft: -9 }]}>
                    <Text style={styles.avatarMoreText}>+{lineup.total - lineup.names.length}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.lineup} numberOfLines={1}>
                {lineupSentence(lineup.names, lineup.total)}
              </Text>
            </View>
          )}

          <LinearGradient
            colors={["#FFDEA0", "#FEC15F", "#FDAA5F", "#EB6923"]}
            locations={[0, 0.35, 0.65, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.heroCta}
          >
            <Text style={styles.heroCtaText}>join this one</Text>
          </LinearGradient>
        </GlassCard>
      </Pressable>

      {alsoTonight.length > 0 && (
        <>
          <HandwrittenHeader style={styles.alsoLabel}>{isToday ? "also tonight" : "also this week"}</HandwrittenHeader>
          {alsoTonight.map((g) => {
            const k = new Date(g.kickoffTime);
            const s = g.capacity - g.bookedCount;
            const ts = g.capacity / 2;
            return (
              <Pressable key={g.id} onPress={() => router.push(`/game/${g.id}`)}>
                <GlassCard variant="soft" round={18} padding={0} style={styles.rowCard}>
                  <View style={styles.row}>
                    <Image source={{ uri: getVenuePhoto(g.pitchName, g.pitchPhotoUrl) }} style={styles.rowThumb} />
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{ts}v{ts}  ·  {g.pitchName}</Text>
                      <Text style={styles.rowSub}>
                        {format(k, "h:mm a")}  ·  {s} {s === 1 ? "spot" : "spots"}
                      </Text>
                    </View>
                    <Text style={styles.rowPrice}>SAR {g.price}</Text>
                  </View>
                </GlassCard>
              </Pressable>
            );
          })}
        </>
      )}

      <Pressable onPress={() => router.push("/browse")}>
        <HandwrittenHeader style={styles.browseAll}>browse everything in riyadh  →</HandwrittenHeader>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 11, fontWeight: "600", color: MUTED, marginTop: 26, letterSpacing: 0.3 },

  // Geometry only — fill, stroke and shadows come from <GlassCard>.
  hero: { marginTop: 12 },
  heroPhoto: { height: 110, borderRadius: 16, backgroundColor: "#CFD8C4" },
  spotsBadge: {
    position: "absolute", left: 12, top: 12, height: 26, borderRadius: 13,
    paddingHorizontal: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(28,28,30,0.55)",
  },
  spotsBadgeAtRisk: { backgroundColor: "rgba(191,38,38,0.72)" },
  spotsText: { fontSize: 11, fontWeight: "600", color: "#FFFFFF" },

  heroRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  heroTextCol: { flex: 1 },
  heroTitle: { fontSize: 17, fontWeight: "600", color: INK },
  heroSub: { fontSize: 13, color: MUTED, marginTop: 6 },
  lineupRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 12 },
  avatarStack: { flexDirection: "row", alignItems: "center" },
  avatarRing: { borderWidth: 1.5, borderColor: "#FFFFFF", borderRadius: 15 },
  avatarMore: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center", justifyContent: "center",
  },
  avatarMoreText: { fontSize: 11, fontWeight: "700", color: "#C96A00" },
  lineup: { flex: 1, fontSize: 13, fontWeight: "600", color: "#1F7A2C" },
  heroPrice: { fontSize: 18, fontWeight: "700", color: INK, marginLeft: 12 },

  heroCta: {
    height: 44, borderRadius: 22, marginTop: 16, alignItems: "center", justifyContent: "center",
    shadowColor: "#EB6923", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 6,
  },
  heroCtaText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },

  alsoLabel: { fontSize: 22, color: "#FF9F0A", marginTop: 28, marginBottom: 12 },

  rowCard: { marginBottom: 12 },
  // minHeight, not the fixed 68 it was: the row holds two lines of text.
  row: { flexDirection: "row", alignItems: "center", minHeight: 68, padding: 9 },
  rowThumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#CFD8C4" },
  rowText: { flex: 1, marginLeft: 12 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: INK },
  rowSub: { fontSize: 12.5, color: MUTED, marginTop: 5 },
  rowPrice: { fontSize: 14, fontWeight: "600", color: INK, marginLeft: 8 },

  browseAll: { fontSize: 22, color: "#FF9F0A", textAlign: "center", marginTop: 18 },
});
