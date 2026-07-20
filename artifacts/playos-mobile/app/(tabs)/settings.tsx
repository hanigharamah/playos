import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors, spacing, radius } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useRouter } from "expo-router";

/** SCAFFOLD PLACEHOLDER — see SPEC.md > "Screen: Settings". */
export default function Settings() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <Text style={styles.h}>Settings</Text>
      <Text style={styles.b}>Signed in as {user?.email ?? "—"}</Text>
      <Pressable
        onPress={async () => {
          await signOut();
          router.replace("/(auth)/login");
        }}
        style={styles.btn}
      >
        <Text style={styles.btnTxt}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep, padding: spacing.xl, paddingTop: spacing.xxl * 2 },
  h: { fontSize: 32, fontWeight: "800", color: colors.inkNavy },
  b: { marginTop: spacing.md, color: colors.inkMuted },
  btn: { marginTop: spacing.xl, backgroundColor: colors.inkNavy, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center" },
  btnTxt: { color: "#FFF", fontWeight: "700" },
});
