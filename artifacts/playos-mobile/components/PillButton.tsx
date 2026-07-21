import { Pressable, Text, StyleSheet, ActivityIndicator, type PressableProps } from "react-native";
import { ArrowRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { colors, radius, spacing } from "@/lib/theme";

interface Props extends Omit<PressableProps, "style"> {
  label: string;
  variant?: "primary" | "secondary" | "destructive" | "outline";
  loading?: boolean;
  fullWidth?: boolean;
  showArrow?: boolean;
  /** "md" = full CTA (checkout, game detail); "sm" = compact inline pill (card "join" buttons). */
  size?: "md" | "sm";
}

const VARIANTS = {
  primary: { bg: colors.orange, fg: "#FFFFFF" },
  secondary: { bg: colors.inkNavy, fg: "#FFFFFF" },
  destructive: { bg: colors.danger, fg: "#FFFFFF" },
  outline: { bg: "transparent", fg: colors.inkNavy },
} as const;

/** Primary tappable pill — matches the web's .btn-pill family. */
export function PillButton({
  label, variant = "primary", loading, fullWidth, showArrow, size = "md", onPress, disabled, ...rest
}: Props) {
  const v = VARIANTS[variant];
  const isSmall = size === "sm";
  return (
    <Pressable
      onPress={(e) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isSmall && styles.baseSmall,
        { backgroundColor: v.bg, opacity: pressed ? 0.85 : disabled ? 0.5 : 1 },
        variant === "outline" && styles.outlineBorder,
        fullWidth && { alignSelf: "stretch" },
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          <Text style={[styles.label, isSmall && styles.labelSmall, { color: v.fg }]}>{label}</Text>
          {showArrow && <ArrowRight size={isSmall ? 14 : 18} color={v.fg} />}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.pill,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    minHeight: 52,
  },
  baseSmall: {
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    minHeight: 36,
    gap: 4,
  },
  outlineBorder: { borderWidth: 1.5, borderColor: colors.hairline },
  label: { fontSize: 16, fontWeight: "700" },
  labelSmall: { fontSize: 13, fontWeight: "700" },
});
