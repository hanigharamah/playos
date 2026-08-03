import { View, Text, Image, StyleSheet } from "react-native";
import { colors, gradients } from "@/lib/theme";
import { LinearGradient } from "expo-linear-gradient";

/** Gradient-initial avatar (mockup's "H" circle) or a real photo if provided. */
export function Avatar({ name, uri, size = 44 }: { name: string; uri?: string; size?: number }) {
  const initial = name.trim()[0]?.toUpperCase() ?? "?";
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <LinearGradient
      // `vivid` is the WEB app's price/occupancy palette. Its coral end put a
      // white initial at ~2.7:1 — under even the large-text floor — and made
      // avatars the loudest thing on a soft cream-and-lavender screen. `cta` is
      // the redesign's own peach→lavender, and deep ink on it lands near 10:1.
      // Matters most in the ops at-risk list, where the operator is scanning
      // names by eye at T-10.
      colors={gradients.cta}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.txt, { fontSize: size * 0.4 }]}>{initial}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  txt: { color: colors.inkDeep, fontWeight: "700" },
});
