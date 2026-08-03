import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { format, isSameDay } from "date-fns";
import { CalendarDays } from "lucide-react-native";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { EmptyState } from "@/components/EmptyState";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import type { GameSummary } from "@/lib/api";

const INK = "#1C1C1E";
const MUTED = "#6C6C70";

/**
 * Home with nothing booked (Figma 684:570).
 *
 * Per the annotation this is a real screen, not an empty-state afterthought —
 * it's what most players see most of the time. So it must still surface the
 * next few open games; a home with only a button is a dead end.
 *
 * The mock shows "2.4 km away" on the hero. There's no device-location wiring
 * and no venue coordinates, so distance is omitted rather than faked. Add it
 * back once locations exist — the slot is the meta line.
 */
export function HomeNothingBooked({ games }: { games: GameSummary[] }) {
  const router = useRouter();

  const [next, ...rest] = games;
  // The header says "also tonight", so only same-day games belong under it.
  // It previously took the next two by kickoff regardless of date and showed
  // time only, so a Saturday game read "8:00 PM" under a "tonight" heading.
  const alsoTonight = rest.filter((g) => isSameDay(new Date(g.kickoffTime), new Date())).slice(0, 2);

  if (!next) {
    return (
      <EmptyState
        icon={<CalendarDays size={38} color="#C2703A" strokeWidth={1.8} />}
        title="nothing on tonight"
        body="no games are open right now. check back later, or browse everything in riyadh."
        actionLabel="browse venues"
        onAction={() => router.push("/browse")}
      />
    );
  }

  const kickoff = new Date(next.kickoffTime);
  const spots = next.capacity - next.bookedCount;
  const teamSize = next.capacity / 2;

  return (
    <View>
      <Text style={styles.nothing}>nothing booked yet</Text>
      <Text style={styles.eyebrow}>NEXT ONE NEAR YOU</Text>

      {/* Hero — the one game we're actively recommending */}
      <Pressable style={styles.hero} onPress={() => router.push(`/game/${next.id}`)}>
        <View>
          <Image source={{ uri: getVenuePhoto(next.pitchName, next.pitchPhotoUrl) }} style={styles.heroPhoto} />
          {spots > 0 && (
            <View style={styles.spotsBadge}>
              <Text style={styles.spotsText}>{spots} {spots === 1 ? "spot" : "spots"} left</Text>
            </View>
          )}
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

        <LinearGradient
          colors={["#FFDEA0", "#FEC15F", "#FDAA5F", "#EB6923"]}
          locations={[0, 0.35, 0.65, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.heroCta}
        >
          <Text style={styles.heroCtaText}>join this one</Text>
        </LinearGradient>
      </Pressable>

      {alsoTonight.length > 0 && (
        <>
          <HandwrittenHeader style={styles.alsoLabel}>also tonight</HandwrittenHeader>
          {alsoTonight.map((g) => {
            const k = new Date(g.kickoffTime);
            const s = g.capacity - g.bookedCount;
            const ts = g.capacity / 2;
            return (
              <Pressable key={g.id} style={styles.row} onPress={() => router.push(`/game/${g.id}`)}>
                <Image source={{ uri: getVenuePhoto(g.pitchName, g.pitchPhotoUrl) }} style={styles.rowThumb} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{ts}v{ts}  ·  {g.pitchName}</Text>
                  <Text style={styles.rowSub}>
                    {format(k, "h:mm a")}  ·  {s} {s === 1 ? "spot" : "spots"}
                  </Text>
                </View>
                <Text style={styles.rowPrice}>SAR {g.price}</Text>
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
  nothing: { fontSize: 15, fontWeight: "600", color: INK, marginTop: 8 },
  eyebrow: { fontSize: 11, fontWeight: "600", color: MUTED, marginTop: 26, letterSpacing: 0.3 },

  hero: {
    borderRadius: 24, marginTop: 12, padding: 19,
    backgroundColor: "rgba(255,255,255,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  heroPhoto: { height: 110, borderRadius: 16, backgroundColor: "#CFD8C4" },
  spotsBadge: {
    position: "absolute", left: 12, top: 12, height: 26, borderRadius: 13,
    paddingHorizontal: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(28,28,30,0.55)",
  },
  spotsText: { fontSize: 11, fontWeight: "600", color: "#FFFFFF" },

  heroRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  heroTextCol: { flex: 1 },
  heroTitle: { fontSize: 17, fontWeight: "600", color: INK },
  heroSub: { fontSize: 13, color: MUTED, marginTop: 6 },
  heroPrice: { fontSize: 18, fontWeight: "700", color: INK, marginLeft: 12 },

  heroCta: {
    height: 44, borderRadius: 22, marginTop: 16, alignItems: "center", justifyContent: "center",
    shadowColor: "#EB6923", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 6,
  },
  heroCtaText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },

  alsoLabel: { fontSize: 22, color: "#FF9F0A", marginTop: 28, marginBottom: 12 },

  row: {
    flexDirection: "row", alignItems: "center", height: 68, borderRadius: 18, padding: 9, marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  rowThumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#CFD8C4" },
  rowText: { flex: 1, marginLeft: 12 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: INK },
  rowSub: { fontSize: 12.5, color: MUTED, marginTop: 5 },
  rowPrice: { fontSize: 14, fontWeight: "600", color: INK, marginLeft: 8 },

  browseAll: { fontSize: 22, color: "#FF9F0A", textAlign: "center", marginTop: 18 },
});
