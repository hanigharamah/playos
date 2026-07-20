import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "@/lib/theme";

/**
 * SCAFFOLD PLACEHOLDER — full sign-in / sign-up screen to be built per
 * SPEC.md > "Screen: Auth". Wire against supabase.auth (email/password
 * + optional Apple/Google via expo-auth-session).
 */
export default function Login() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>PlayOS</Text>
      <Text style={styles.body}>Sign in / Sign up screen — to be built.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.creamDeep, padding: spacing.xl },
  title: { fontSize: 48, fontWeight: "800", color: colors.inkNavy, letterSpacing: -1 },
  body: { marginTop: spacing.md, color: colors.inkMuted },
});
