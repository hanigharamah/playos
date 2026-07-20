import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "@/lib/theme";

/**
 * SCAFFOLD PLACEHOLDER — game browse list per SPEC.md > "Screen: Games".
 * Uses the same Supabase query as the web app's Games page.
 */
export default function Games() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.h}>Browse Games</Text>
      <Text style={styles.b}>Grouped-by-day list — to be built.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep, padding: spacing.xl, paddingTop: spacing.xxl * 2 },
  h: { fontSize: 32, fontWeight: "800", color: colors.inkNavy },
  b: { marginTop: spacing.md, color: colors.inkMuted },
});
