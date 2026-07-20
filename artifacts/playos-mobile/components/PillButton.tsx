import { Pressable, Text, StyleSheet, ActivityIndicator, type PressableProps } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, radius, spacing } from "@/lib/theme";

interface Props extends Omit<PressableProps, "style"> {
  label: string;
  variant?: "primary" | "secondary" | "destructive" | "outline";
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANTS = {
  primary: { bg: colors.orange, fg: "#FFFFFF" },
  secondary: { bg: colors.inkNavy, fg: "#FFFFFF" },
  destructive: { bg: colors.danger, fg: "#FFFFFF" },
  outline: { bg: "transparent", fg: colors.inkNavy },
} as const;

/** Primary tappable pill — matches the web's .btn-pill family. */
export function PillButton({ label, variant = "primary", loading, fullWidth, onPress, disabled, ...rest }: Props) {
  const v = VARIANTS[variant];
  return (
    <Pressable
      onPress={(e) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.bg, opacity: pressed ? 0.85 : disabled ? 0.5 : 1 },
        variant === "outline" && styles.outlineBorder,
        fullWidth && { alignSelf: "stretch" },
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : <Text style={[styles.label, { color: v.fg }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  outlineBorder: { borderWidth: 1.5, borderColor: colors.hairline },
  label: { fontSize: 16, fontWeight: "700" },
});
