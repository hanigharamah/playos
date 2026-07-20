import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "@/lib/theme";

/** SCAFFOLD PLACEHOLDER — see SPEC.md > "Screen: My Games". */
export default function MyGames() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.h}>My Games</Text>
      <Text style={styles.b}>Upcoming & past bookings — to be built.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep, padding: spacing.xl, paddingTop: spacing.xxl * 2 },
  h: { fontSize: 32, fontWeight: "800", color: colors.inkNavy },
  b: { marginTop: spacing.md, color: colors.inkMuted },
});
