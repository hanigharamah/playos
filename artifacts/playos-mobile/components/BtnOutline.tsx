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
            <LinearGradient
              colors={
                pressed
                  ? ["rgba(255,255,255,0.75)", "rgba(255,255,255,0.3)", "rgba(255,246,236,0.35)"]
                  : ["rgba(255,255,255,0.6)", "rgba(255,255,255,0.12)", "rgba(255,246,236,0.2)"]
              }
              locations={[0, 0.55, 1]}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.85, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.rim} pointerEvents="none" />
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
    backgroundColor: "rgba(255,255,255,0.5)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    elevation: 3,
  },
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18, borderWidth: 1, borderColor: "transparent",
    borderTopColor: "rgba(255,255,255,0.95)",
    borderLeftColor: "rgba(255,255,255,0.5)",
    borderRightColor: "rgba(255,255,255,0.5)",
  },
  label: { fontSize: 15, fontWeight: "600" },
});
