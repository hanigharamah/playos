import { Pressable, Text, View, StyleSheet } from "react-native";
import { colors, spacing } from "@/lib/theme";

/** Single radio-style row used on the Filters sheet (When/Time/Players groups). */
export function RadioRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.dot, selected && styles.dotActive]}>
        {selected && <View style={styles.dotInner} />}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 10 },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.hairline, alignItems: "center", justifyContent: "center" },
  dotActive: { borderColor: colors.pink },
  dotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.pink },
  label: { fontSize: 14, color: colors.ink, fontWeight: "500" },
});
