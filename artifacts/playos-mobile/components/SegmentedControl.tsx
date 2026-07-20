import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radius, spacing } from "@/lib/theme";

/** Two-way pill toggle — used for Upcoming/Past, Messages/Groups, Venues/Matches. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.track}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable key={opt.value} onPress={() => onChange(opt.value)} style={[styles.pill, active && styles.pillActive]}>
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", backgroundColor: "#F2F2F7", borderRadius: radius.pill, padding: 3, alignSelf: "flex-start" },
  pill: { paddingVertical: 7, paddingHorizontal: spacing.lg, borderRadius: radius.pill },
  pillActive: { backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  label: { fontSize: 13, fontWeight: "600", color: colors.inkMuted },
  labelActive: { color: colors.ink },
});
