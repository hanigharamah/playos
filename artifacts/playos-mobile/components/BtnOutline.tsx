import { Text, View, Pressable, StyleSheet, Platform, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

/** Colour carries the meaning, per the Figma annotation. */
export type OutlineTone = "neutral" | "destructive" | "warning" | "accent";

const TONE_COLOR: Record<OutlineTone, string> = {
  neutral: "#1C1C1E",
  destructive: "#BF2626",
  warning: "#C96A00",
  /** For a glass button that is the screen's action rather than its escape. */
  accent: "#C96A00",
};

interface Props {
  label: string;
  onPress?: () => void;
  tone?: OutlineTone;
  disabled?: boolean;
  style?: ViewStyle;
}

/**
 * Secondary button — the "btn-outline" pattern: 350×56, radius 18, glass over
 * the page background, Inter SemiBold 15. Never place two side by side.
 *
 * Given the same liquid treatment as GlassCard and the two bars, so every
 * glass surface in the app is visibly one material: a backdrop blur, a
 * top-lit gradient rather than a flat alpha, a specular rim along the top
 * edge, and two shadows — a tight contact one and a wide ambient one.
 * Pressing brightens the fill and drops the lift, so the button reads as
 * being pushed into the surface.
 */
export function BtnOutline({ label, onPress, tone = "neutral", disabled, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.ambient,
        pressed && !disabled && styles.ambientPressed,
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      {({ pressed }) => (
        <View style={styles.contact}>
          <BlurView intensity={Platform.OS === "ios" ? 32 : 0} tint="light" style={styles.btn}>
            {/* 1. BODY — vertical, not diagonal. A pane lit from above is
                   brightest at the top and darkest just before the bottom
                   edge, where light has travelled furthest through it. */}
            <LinearGradient
              colors={
                pressed
                  ? ["rgba(255,255,255,0.92)", "rgba(255,255,255,0.44)", "rgba(255,240,228,0.30)"]
                  : ["rgba(255,255,255,0.86)", "rgba(255,255,255,0.26)", "rgba(255,238,224,0.14)"]
              }
              locations={[0, 0.52, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            {/* 2. SPECULAR SWEEP — the bright band across the upper third that
                   a curved surface throws. This is the single strongest cue
                   that the thing is glass rather than tinted plastic, and it
                   costs no backdrop, which is the point: the blur behind this
                   button has nothing to bend. */}
            <LinearGradient
              colors={["rgba(255,255,255,0.95)", "rgba(255,255,255,0.35)", "rgba(255,255,255,0)"]}
              locations={[0, 0.45, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.sweep}
              pointerEvents="none"
            />

            {/* 3. INNER FLOOR — a dark line hugging the bottom inside edge.
                   Light entering the top exits refracted at the bottom, so a
                   real pane is darkest there. Without this the button reads
                   flat no matter how bright the top is. */}
            <LinearGradient
              colors={["rgba(140,89,38,0)", "rgba(140,89,38,0.18)"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.floor}
              pointerEvents="none"
            />

            {/* 4. EDGE — bright along the top, fading down the sides, and a
                   warm dark line at the very bottom. That top-light /
                   bottom-dark pair IS the thickness. */}
            <View style={styles.rim} pointerEvents="none" />
            <View style={styles.rimBottom} pointerEvents="none" />

            <Text style={[styles.label, { color: TONE_COLOR[tone] }]}>{label}</Text>
          </BlurView>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Wide ambient shadow. No elevation on either wrapper — Android derives its
  // shadow from a background outline and both of these are transparent.
  ambient: {
    borderRadius: 18,
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.14, shadowRadius: 24,
  },
  /** Pressed: the lift collapses, so it settles into the page. */
  ambientPressed: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  contact: {
    borderRadius: 18,
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 5,
  },
  btn: {
    height: 56, borderRadius: 18, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.38)",
    borderWidth: 0,
    elevation: 3,
  },
  // The bright band sits in the upper third and stops — a sweep, not a wash.
  sweep: { position: "absolute", left: 1, right: 1, top: 1, height: 22, borderTopLeftRadius: 17, borderTopRightRadius: 17 },
  // The dark floor is the bottom quarter only.
  floor: { position: "absolute", left: 1, right: 1, bottom: 1, height: 16, borderBottomLeftRadius: 17, borderBottomRightRadius: 17 },
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18, borderWidth: 1.2, borderColor: "transparent",
    borderTopColor: "rgba(255,255,255,1)",
    borderLeftColor: "rgba(255,255,255,0.55)",
    borderRightColor: "rgba(255,255,255,0.55)",
  },
  // Separate view: one border cannot be bright on top and dark on the bottom.
  rimBottom: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18, borderWidth: 1.2, borderColor: "transparent",
    borderBottomColor: "rgba(140,89,38,0.22)",
  },
  label: { fontSize: 15, fontWeight: "600" },
});
