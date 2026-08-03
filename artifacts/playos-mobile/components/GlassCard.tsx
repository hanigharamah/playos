import { View, StyleSheet, Platform, type ViewProps } from "react-native";
import { BlurView } from "expo-blur";
import { colors, radius } from "@/lib/theme";

interface Props extends ViewProps {
  /** Inner content padding — defaults to 16. Pass 0 for edge-to-edge rows (e.g. settings lists). */
  padding?: number;
  /** Corner radius — defaults to radius.xl (24) per the Figma glass spec. */
  round?: number;
  /**
   * "solid" (default): white 78% + backdrop blur — nav chrome, CTA bars.
   * "soft": white 42%, no blur — content cards sitting on the warm canvas
   * (the Figma booking page uses this for spots/venue/info/pitch cards).
   */
  variant?: "solid" | "soft";
}

/**
 * Figma-redesign glass surface: translucent white over a background blur,
 * hairline white stroke, warm (never black) drop shadow. Matches the card
 * treatment used across the booking flow and flashcards in the design file.
 */
export function GlassCard({ style, children, padding = 16, round = radius.xl, variant = "solid", ...rest }: Props) {
  if (variant === "soft") {
    return (
      <View style={[styles.shadowWrap, { borderRadius: round }, style]} {...rest}>
        {/* No elevation on `soft`: its fill is 42%, and Android draws the
            elevation shadow THROUGH a translucent background, which would
            bloom grey inside the card. Deliberately iOS-only until the fill
            is opaque enough to carry it. */}
        <View style={[styles.card, styles.soft, { borderRadius: round, padding }]}>{children}</View>
      </View>
    );
  }
  return (
    <View style={[styles.shadowWrap, { borderRadius: round }, style]} {...rest}>
      <BlurView
        intensity={Platform.OS === "ios" ? 28 : 0}
        tint="light"
        style={[styles.card, styles.cardElevated, { borderRadius: round, padding }]}
      >
        {children}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    // Figma booking page card shadow: 0 6 16 rgba(153,115,89,0.12)
    shadowColor: "#997359",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    // NO elevation here. Android derives its shadow from the view's background
    // outline, and this wrap is deliberately transparent — so `elevation` on it
    // drew nothing, and every glass card in the app was a flat white rectangle
    // on Android while floating correctly on iOS. The iOS shadow props stay:
    // they work fine on a transparent view.
    backgroundColor: "transparent",
  },
  card: {
    backgroundColor: colors.glassFill,
    borderWidth: 1,
    borderColor: colors.glassStroke,
    overflow: "hidden",
  },
  /** Android's shadow, on the layer that actually has a fill to cast it. */
  cardElevated: { elevation: 4 },
  soft: {
    backgroundColor: "rgba(255,255,255,0.42)",
  },
});
