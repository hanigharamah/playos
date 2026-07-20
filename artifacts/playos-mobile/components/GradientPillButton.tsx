import { Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { gradients, radius, spacing } from "@/lib/theme";

/** The orange→pink→purple "Join Match" pill from the mockup. */
export function GradientPillButton({
  label,
  onPress,
  loading,
  showArrow = true,
  fullWidth,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  showArrow?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={loading}
      style={fullWidth ? { alignSelf: "stretch" } : undefined}
    >
      <LinearGradient
        colors={[gradients.vivid[0], gradients.vivid[2], gradients.vivid[3]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.wrap, { opacity: loading ? 0.7 : 1 }]}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Text style={styles.label}>{label}</Text>
            {showArrow && <ArrowRight size={18} color="#FFFFFF" />}
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    minHeight: 52,
  },
  label: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
