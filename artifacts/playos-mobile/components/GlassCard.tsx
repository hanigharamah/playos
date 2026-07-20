import { View, StyleSheet, type ViewProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius } from "@/lib/theme";

interface Props extends ViewProps {
  /** Inner content padding — defaults to 16. Pass 0 for edge-to-edge rows (e.g. settings lists). */
  padding?: number;
}

/**
 * Cream frosted-card surface — mirrors the web's `.card-ios` / cream-gradient
 * button surface (see ../playos/src/index.css .btn-pill-hero background).
 */
export function GlassCard({ style, children, padding = 16, ...rest }: Props) {
  return (
    <View style={[styles.shadowWrap, style]} {...rest}>
      <LinearGradient
        colors={[colors.cream, colors.creamDeep]}
        style={[styles.card, { padding }]}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: radius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: "hidden",
  },
});
