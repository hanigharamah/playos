import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { Search, Info } from "lucide-react-native";
import { EmptyCard, EmptyEyebrow } from "@/components/EmptyState";
import { Callout } from "@/components/Callout";
import { BtnOutline } from "@/components/BtnOutline";
import { Btn3D } from "@/components/Btn3D";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import type { GameSummary } from "@/lib/api";

const INK = "#1C1C1E";
const MUTED = "#6C6C70";

/**
 * Browse empty states (Figma 697:540 "Venues, no results" and 697:585
 * "Matches, no results").
 *
 * Both mocks are built around a filter model that does not exist yet. They
 * show removable chips for `indoor`, `under SAR 100`, `5-a-side`, `tonight`,
 * `6v6`, `under SAR 40`, a "DROP ONE FILTER" list that costs each filter, and
 * a "clear my filters" button. Browse only has a free-text query — `pitches`
 * has no indoor/outdoor or surface column and there is no price or kickoff
 * filter — so the chips, the drop-one-filter rows and the per-filter counts
 * are all omitted rather than faked. The query itself plays the chips' role:
 * it's what excluded everything, and clearing it is the one-tap reset the
 * annotation asks for.
 *
 * Two more mock elements are dropped for the same reason:
 *  - venue rows read "4.2 km · indoor · SAR 90". No device location, no venue
 *    coordinates, no indoor flag — same call browse.tsx already makes for the
 *    star rating. Rows show games-open and the cheapest real price instead.
 *  - the matches mock's "alert me when one appears" CTA needs a saved-search
 *    alert and push delivery. Neither exists (see FIGMA-MAP: "System · Push
 *    notifications" is blocked), so the primary CTA is the one action that
 *    actually works — clearing the search.
 */

/** Cheapest open game at a venue, and how many are open. */
type Venue = { name: string; photo: string | null; count: number; from: number };

function summarise(games: GameSummary[]): Venue[] {
  const map = new Map<string, Venue>();
  for (const g of games) {
    const v = map.get(g.pitchName);
    if (v) {
      v.count += 1;
      v.from = Math.min(v.from, g.price);
      v.photo = v.photo ?? g.pitchPhotoUrl;
    } else {
      map.set(g.pitchName, { name: g.pitchName, photo: g.pitchPhotoUrl, count: 1, from: g.price });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

interface Props {
  /** The search text that produced no results ("" when the feed is genuinely empty). */
  query: string;
  /** Every open game, unfiltered — what we offer instead. */
  allGames: GameSummary[];
  onClearSearch: () => void;
}

/* ── Venues, no results (697:540) ─────────────────────────────────────── */

export function VenuesEmpty({ query, allGames, onClearSearch }: Props) {
  const router = useRouter();
  const q = query.trim();
  const others = summarise(allGames).slice(0, 2);

  return (
    <View style={styles.wrap}>
      <EmptyCard
        icon={<Search size={28} color="#3A3A3E" strokeWidth={2} />}
        title={q ? `no venues matching “${q}”` : "no venues open right now"}
        body={
          q
            ? "nothing in riyadh matches that search"
            : "every venue is between games — new slots open through the day"
        }
      />

      <Callout
        style={styles.callout}
        tone="neutral"
        icon={<Info size={13} color="#3A3A3E" strokeWidth={2.2} />}
        title="we are still filling riyadh in"
        body="venues get added district by district. if yours is not here yet, that is not the same as it being empty."
      />

      {others.length > 0 && (
        <>
          {/* Mock says "CLOSEST TO <area>" — we cannot rank by distance, so
              these are the busiest venues instead and the label says so. */}
          <View style={styles.eyebrowWrap}><EmptyEyebrow>WHERE GAMES ARE OPEN</EmptyEyebrow></View>
          {others.map((v) => (
            <Pressable key={v.name} style={styles.venueRow} onPress={() => router.push("/browse")}>
              <Image source={{ uri: getVenuePhoto(v.name, v.photo) }} style={styles.venueThumb} />
              <View style={styles.venueText}>
                <Text style={styles.venueName} numberOfLines={1}>{v.name}</Text>
                <Text style={styles.venueSub}>
                  {v.count} {v.count === 1 ? "game" : "games"} open  ·  from SAR {v.from}
                </Text>
              </View>
            </Pressable>
          ))}
        </>
      )}

      {q ? (
        <BtnOutline label="clear my search" tone="warning" style={styles.cta} onPress={onClearSearch} />
      ) : (
        <BtnOutline label="see my bookings" style={styles.cta} onPress={() => router.push("/(tabs)/my-games")} />
      )}
    </View>
  );
}

/* ── Matches, no results (697:585) ────────────────────────────────────── */

export function MatchesEmpty({ query, allGames, onClearSearch }: Props) {
  const router = useRouter();
  const q = query.trim();
  const total = allGames.length;

  return (
    <View style={styles.wrap}>
      <EmptyCard
        icon={<Search size={28} color="#3A3A3E" strokeWidth={2} />}
        title={q ? "nothing matches that" : "no matches open right now"}
        body={
          q && total > 0
            ? `there ${total === 1 ? "is" : "are"} ${total} ${total === 1 ? "match" : "matches"} open, none matching “${q}”`
            : "new matches get posted through the day — check back later"
        }
      />

      <Callout
        style={styles.callout}
        tone="neutral"
        icon={<Info size={13} color="#3A3A3E" strokeWidth={2.2} />}
        title="try a wider search"
        body="search by venue or area rather than a full match name — most matches are titled by the pitch they are on."
      />

      {q ? (
        <Btn3D label="show all matches" style={styles.primary} onPress={onClearSearch} />
      ) : (
        <BtnOutline label="see my bookings" style={styles.cta} onPress={() => router.push("/(tabs)/my-games")} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", alignSelf: "stretch", paddingTop: 12 },

  callout: { alignSelf: "stretch", maxWidth: 350, marginTop: 22 },
  eyebrowWrap: { alignSelf: "flex-start", marginTop: 26 },

  venueRow: {
    flexDirection: "row", alignItems: "center", alignSelf: "stretch", maxWidth: 350,
    height: 64, borderRadius: 16, paddingHorizontal: 11, marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  venueThumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: "#CFD8C4" },
  venueText: { flex: 1, marginLeft: 12 },
  venueName: { fontSize: 15, fontWeight: "600", color: INK },
  venueSub: { fontSize: 12.5, color: MUTED, marginTop: 5 },

  cta: { alignSelf: "stretch", maxWidth: 350, marginTop: 42 },
  primary: { alignSelf: "stretch", maxWidth: 350, marginTop: 42 },
});
