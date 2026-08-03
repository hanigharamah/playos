import { Text, Pressable, StyleSheet, type ViewStyle } from "react-native";

/** Colour carries the meaning, per the Figma annotation. */
export type OutlineTone = "neutral" | "destructive" | "warning";

const TONE_COLOR: Record<OutlineTone, string> = {
  neutral: "#1C1C1E",
  destructive: "#BF2626",
  warning: "#C96A00",
};

interface Props {
  label: string;
  onPress?: () => void;
  tone?: OutlineTone;
  disabled?: boolean;
  style?: ViewStyle;
}

/**
 * Secondary button — the "btn-outline" pattern, per the Figma design-system
 * annotation: 350×56, radius 18, white 55% over the page background, 1px
 * white 85% stroke, Inter SemiBold 15. Pressed fills to white 75%.
 * Never place two side by side — stack them.
 */
export function BtnOutline({ label, onPress, tone = "neutral", disabled, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        pressed && !disabled && styles.pressed,
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Text style={[styles.label, { color: TONE_COLOR[tone] }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  pressed: { backgroundColor: "rgba(255,255,255,0.75)" },
  label: { fontSize: 15, fontWeight: "600" },
});
