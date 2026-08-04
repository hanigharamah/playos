import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking, ScrollView, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useListGames } from "@/lib/api";
import { DotWaveBackground } from "@/components/DotWaveBackground";
import { WarmCanvas } from "@/components/WarmCanvas";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { Btn3D } from "@/components/Btn3D";
import { Callout } from "@/components/Callout";
import { GlassCard } from "@/components/GlassCard";
import { screen } from "@/lib/analytics";

const INK = "#1C1C1E";
const MUTED = "#6C6C70";

const GLOWS = [
  { cx: 0.8, cy: 0.15, r: 0.9, color: "rgba(255,225,204,0.35)" },
  { cx: 0.65, cy: 0.3, r: 0.6, color: "rgba(255,217,228,0.2)" },
];

/** Read by browse/play to scope results when there's no device location. */
export const AREA_KEY = "playos.manualArea";

/**
 * Location permission denied (Figma 696:620).
 *
 * Never blocks the app — per the annotation, distance sorting degrades to a
 * manual area picker and everything else works the same. The CTA opens OS
 * settings because the system dialog cannot be re-prompted once denied.
 *
 * The mock lists six named Riyadh districts (Al Olaya, Hittin, Qurtubah…).
 * Those are hardcoded design copy, not data — picking one that matches no
 * venue would return an empty list. The chips are therefore derived from the
 * areas real games are actually in, falling back to venue names when
 * `locationText` isn't set. Same layout, real options.
 */
export default function LocationPermission() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data: games } = useListGames();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => { screen("PermissionLocation"); }, []);

  const areas = useMemo(() => {
    const seen = new Set<string>();
    for (const g of games ?? []) {
      const label = g.locationText?.trim() || g.pitchName?.trim();
      if (label) seen.add(label);
    }
    return Array.from(seen).sort();
  }, [games]);

  useEffect(() => {
    if (!selected && areas.length > 0) setSelected(areas[0]);
  }, [areas, selected]);

  const confirm = async () => {
    if (!selected) return;
    await AsyncStorage.setItem(AREA_KEY, selected);
    router.replace({ pathname: "/browse", params: { area: selected } });
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 5 }]}>
      <WarmCanvas base="#FFF8F0" glows={GLOWS} />
      <DotWaveBackground width={width} height={600} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <HandwrittenHeader style={styles.title}>pick your area</HandwrittenHeader>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GlassCard variant="soft" round={22} padding={0}>
          <View style={styles.statusCard}>
            <View style={styles.halo}>
              <Text style={styles.haloGlyph}>◉</Text>
            </View>
            <Text style={styles.statusTitle}>location is off</Text>
            <Text style={styles.statusBody}>we cannot sort matches by distance without it</Text>
          </View>
        </GlassCard>

        <Callout
          tone="neutral"
          icon={<Text style={styles.disc}>●</Text>}
          title="that is completely fine"
          body="choose an area and everything works the same. you can turn location on later in settings."
          style={{ marginTop: 18 }}
        />

        {areas.length > 0 && (
          <>
            <Text style={styles.eyebrow}>RIYADH</Text>
            <View style={styles.grid}>
              {areas.map((area) => {
                const active = area === selected;
                return (
                  <Pressable
                    key={area}
                    onPress={() => setSelected(area)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                      {area}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <Btn3D
          label={selected ? `show me matches in ${selected.toLowerCase()}` : "show me matches"}
          disabled={!selected}
          onPress={confirm}
        />
        <Pressable onPress={() => Linking.openSettings()}>
          <Text style={styles.footnote}>turn location on in settings</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // paddingTop comes from the safe-area inset at the call site; the fixed
  // value was smaller than the Dynamic Island's inset.
  wrap: { flex: 1, backgroundColor: "#FFF8F0" },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20 },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
  },
  backGlyph: { fontSize: 20, fontWeight: "700", color: INK, lineHeight: 22 },
  title: { fontSize: 26, color: "#FA810B", marginLeft: 14, flex: 1 },

  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 180 },

  // Layout only — fill, stroke and shadows come from <GlassCard>.
  statusCard: { paddingVertical: 19, alignItems: "center" },
  halo: {
    width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(58,58,62,0.08)",
  },
  haloGlyph: { fontSize: 26, fontWeight: "700", color: "#3A3A3E" },
  statusTitle: { fontSize: 18, fontWeight: "600", color: INK, marginTop: 14 },
  statusBody: { fontSize: 13, color: MUTED, marginTop: 8, textAlign: "center" },

  disc: { fontSize: 13, fontWeight: "700", color: "#3A3A3E" },

  eyebrow: { fontSize: 11, fontWeight: "600", color: MUTED, letterSpacing: 0.3, marginTop: 30, marginLeft: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 12 },
  chip: {
    width: "48.5%", height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 10, marginBottom: 10,
    backgroundColor: "rgba(255,255,255,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  chipActive: { backgroundColor: "rgba(255,138,0,0.12)", borderWidth: 2, borderColor: "#FD6A03" },
  chipText: { fontSize: 14.5, color: INK },
  chipTextActive: { fontWeight: "600", color: "#C96A00" },

  actions: { position: "absolute", left: 20, right: 20, bottom: 40 },
  footnote: { fontSize: 13.5, color: MUTED, textAlign: "center", marginTop: 18 },
});
