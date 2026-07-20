import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/lib/theme";

/** Occupancy bar — direct port of the web's FillBar in game/[id].tsx. */
export function FillBar({ booked, capacity }: { booked: number; capacity: number }) {
  const pct = capacity > 0 ? booked / capacity : 0;
  const barColor = pct >= 1 ? colors.danger : pct >= 0.8 ? colors.orange : "#0A84FF";

  return (
    <View>
      <View style={styles.row}>
        <Text style={styles.label}>BOOKED</Text>
        <Text style={styles.count}>{booked} / {capacity}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, pct * 100)}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  label: { fontSize: 10, fontWeight: "700", color: colors.inkFaint, letterSpacing: 1 },
  count: { fontSize: 14, fontWeight: "700", color: colors.ink },
  track: { width: "100%", height: 4, borderRadius: 2, backgroundColor: colors.hairline, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2 },
});
