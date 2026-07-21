import { View, Text, StyleSheet } from "react-native";
import { Avatar } from "./Avatar";
import { colors } from "@/lib/theme";

/** Overlapping avatar row + "+N" overflow badge, from the mockup's match cards. */
export function AvatarStack({ names, max = 3, size = 26 }: { names: string[]; max?: number; size?: number }) {
  const shown = names.slice(0, max);
  const overflow = names.length - shown.length;

  return (
    <View style={styles.row}>
      {shown.map((name, i) => (
        <View key={i} style={[styles.item, { marginLeft: i === 0 ? 0 : -size * 0.35, zIndex: shown.length - i }]}>
          <Avatar name={name} size={size} />
        </View>
      ))}
      {overflow > 0 && (
        <View style={[styles.item, styles.overflow, { width: size, height: size, borderRadius: size / 2, marginLeft: -size * 0.35 }]}>
          <Text style={[styles.overflowText, { fontSize: size * 0.36 }]}>+{overflow}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  item: { borderWidth: 2, borderColor: "#FFFFFF", borderRadius: 999 },
  overflow: { backgroundColor: colors.inkFaint, alignItems: "center", justifyContent: "center" },
  overflowText: { color: "#FFFFFF", fontWeight: "700" },
});
