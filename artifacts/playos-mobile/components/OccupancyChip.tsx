import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/lib/theme";

/**
 * 6-state occupancy machine — exact port of ../playos/src/components/GameCard.tsx.
 * Evaluated top-down, first match wins, so labels mean the same thing at any
 * capacity (not tied to a raw percentage that shifts with team size).
 */
const ACCENT = {
  peach: colors.peach,
  coral: colors.coral,
  pink: colors.pink,
  purple: colors.purple,
  deepPurple: colors.deepPurple,
  gray: colors.inkFaint,
} as const;

type AccentKey = keyof typeof ACCENT;

function getOccupancyState(booked: number, capacity: number): { label: string; accent: AccentKey } {
  const left = capacity - booked;
  const pct = capacity > 0 ? booked / capacity : 0;

  if (left <= 0) return { label: "Full", accent: "gray" };
  if (left === 1) return { label: "Last spot", accent: "deepPurple" };
  if (left <= 3) return { label: "Almost full", accent: "purple" };
  if (pct >= 0.5) return { label: "Building up", accent: "pink" };
  if (pct >= 0.25) return { label: "Players joining", accent: "coral" };
  return { label: "Spots open", accent: "peach" };
}

export function OccupancyChip({ booked, capacity }: { booked: number; capacity: number }) {
  const isFull = capacity - booked <= 0;
  const { label, accent } = getOccupancyState(booked, capacity);
  const color = ACCENT[accent];

  return (
    <View style={[styles.chip, { backgroundColor: color + "1F" }]}>
      <View style={[styles.dot, { backgroundColor: isFull ? colors.inkFaint : color }]} />
      <Text style={[styles.label, { color: isFull ? colors.inkMuted : color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
});
