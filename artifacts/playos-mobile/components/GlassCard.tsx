import { View, StyleSheet, Platform, type ViewProps } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius } from "@/lib/theme";

interface Props extends ViewProps {
  /** Inner content padding — defaults to 16. Pass 0 for edge-to-edge rows (e.g. settings lists). */
  padding?: number;
  /** Corner radius — defaults to radius.xl (24) per the Figma glass spec. */
  round?: number;
  /**
   * "solid" (default): heavier fill and blur — nav chrome, CTA bars.
   * "soft": thinner fill and a LIGHTER blur — content cards sitting on the
   * warm canvas. Lighter than solid, never zero: soft used to have no blur at
   * all, which made every card converted to it keep the gradient and the rim
   * but none of the actual glass, so the conversions were invisible.
   *
   * KNOWN GAP: soft carries no Android elevation, because Android draws the
   * elevation shadow THROUGH a translucent background and a 26% fill would
   * bloom grey inside the card. Soft cards therefore have no drop shadow on
   * Android — needs testing on a real device to decide which is worse.
   */
  variant?: "solid" | "soft";
}

/**
 * Glass surface — translucent white over a backdrop blur, warm (never black)
 * shadow, hairline stroke.
 *
 * Three things make it read as glass with volume rather than a flat white
 * rectangle, and all three are what real glass does under a light source:
 *
 *  1. A GRADIENT fill, not a flat one. Light comes from above, so the top of
 *     the pane is brighter than the bottom. A single flat alpha is the main
 *     reason a translucent card reads as paper.
 *  2. A SPECULAR RIM along the top edge — the bright line where a curved glass
 *     edge catches the light. This is the single strongest depth cue; without
 *     it the card has no thickness.
 *  3. LAYERED shadows. One shadow is a sticker; real objects cast a tight
 *     contact shadow directly beneath them AND a wide soft ambient one. React
 *     Native allows one shadow per view, so the two live on nested wrappers.
 *
 * The blur is deliberately stronger than the flat spec: the whole point of a
 * liquid surface is that what is behind it bends and moves as you scroll.
 */

/** Top-lit fill: bright at the top edge, falling away toward the bottom. */
const SOLID_SHEEN = ["rgba(255,255,255,0.55)", "rgba(255,255,255,0.10)", "rgba(255,246,236,0.16)"] as const;
const SOFT_SHEEN = ["rgba(255,255,255,0.40)", "rgba(255,255,255,0.06)", "rgba(255,246,236,0.12)"] as const;

export function GlassCard({ style, children, padding = 16, round = radius.xl, variant = "solid", ...rest }: Props) {
  const soft = variant === "soft";

  return (
    // Wide ambient shadow — the object's presence in the room.
    <View style={[styles.ambient, { borderRadius: round }, style]} {...rest}>
      {/* Tight contact shadow — where the object meets the surface. */}
      <View style={[styles.contact, { borderRadius: round }]}>
        <BlurView
          // BOTH variants blur on iOS. `soft` used to be blur-free, which meant
          // every card converted to it kept the gradient and the rim but none
          // of the actual glass — the backdrop never bent, so the conversions
          // were invisible. Soft blurs lighter than solid, not zero.
          // Android is a no-op either way; the gradient carries it there.
          intensity={Platform.OS !== "ios" ? 0 : soft ? 22 : 40}
          tint="light"
          style={[
            styles.card,
            soft ? styles.softFill : styles.solidFill,
            // Elevation only on the opaque-enough variant: Android draws its
            // shadow THROUGH a translucent background, so 42% would bloom grey
            // inside the card.
            !soft && styles.cardElevated,
            { borderRadius: round },
          ]}
        >
          <LinearGradient
            colors={soft ? SOFT_SHEEN : SOLID_SHEEN}
            locations={[0, 0.55, 1]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* The specular rim. Sits inside the clip so it follows the radius. */}
          <View style={[styles.rim, { borderRadius: round }]} pointerEvents="none" />
          {/* Padding lives here, not on the BlurView: absolutely-positioned
              children align to the PADDING edge in Yoga, so the sheen and rim
              would have been inset by it. */}
          <View style={{ padding }}>{children}</View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ambient: {
    // Warm, wide and low-opacity — the light in this app is never neutral.
    shadowColor: "#8C5926",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    // NO elevation on either wrapper. Android derives its shadow from the
    // view's background outline, and both are deliberately transparent, so
    // elevation here draws nothing at all.
    backgroundColor: "transparent",
  },
  contact: {
    shadowColor: "#8C5926",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    backgroundColor: "transparent",
  },
  card: {
    borderWidth: 1,
    borderColor: colors.glassStroke,
    overflow: "hidden",
  },
  solidFill: { backgroundColor: "rgba(255,255,255,0.52)" },
  softFill: { backgroundColor: "rgba(255,255,255,0.26)" },
  /** Android's shadow, on the layer that actually has a fill to cast it. */
  cardElevated: { elevation: 4 },
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "transparent",
    // Bright along the top, faint down the sides, nothing at the bottom —
    // a curved edge catching light from above.
    borderTopColor: "rgba(255,255,255,0.95)",
    borderLeftColor: "rgba(255,255,255,0.5)",
    borderRightColor: "rgba(255,255,255,0.5)",
  },
});
