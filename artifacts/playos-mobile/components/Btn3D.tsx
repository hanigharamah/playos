import { Text, Pressable, StyleSheet, View, ActivityIndicator, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface Props {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

/**
 * Primary CTA — the "btn-3d" pattern, per the Figma design-system annotation:
 * 350×56, radius 28, fixed 4-stop orange gradient (never a flat colour),
 * Inter Bold 15 white lowercase centred. Pressed: scale 0.98 + softer shadow.
 * Disabled: 40% opacity, shadows off. One primary CTA per screen.
 *
 * This exists so screens stop hand-rolling the gradient — the dev notes
 * flagged 8 duplicated copies as the top componentization priority.
 */
export function Btn3D({ label, onPress, loading, disabled, style }: Props) {
  const off = disabled || loading;
  return (
    <Pressable onPress={onPress} disabled={off} style={({ pressed }) => [
      style,
      pressed && !off && { transform: [{ scale: 0.98 }] },
    ]}>
      <LinearGradient
        colors={["#FFDEA0", "#FEC15F", "#FDAA5F", "#EB6923"]}
        locations={[0, 0.35, 0.65, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.btn, off && styles.disabled]}
      >
        <View style={styles.sheen} />
        {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.label}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", overflow: "hidden",
    shadowColor: "#EB6924", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 6,
  },
  disabled: { opacity: 0.4, shadowOpacity: 0, elevation: 0 },
  sheen: {
    position: "absolute", top: 4, left: 28, width: 98, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  label: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
});
