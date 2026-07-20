import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Bell, Check } from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import { registerForPush } from "@/lib/notifications";
import { track } from "@/lib/analytics";
import { PillButton } from "@/components/PillButton";
import { colors, spacing, radius } from "@/lib/theme";

/**
 * Full-screen (not a sheet — we own the app now) post-signup onboarding.
 * Mirrors ../playos/src/components/FullExperienceSheet.tsx, but native push
 * means there's no iOS Add-to-Home-Screen branch to show — the whole reason
 * we're building this app is to skip that step entirely.
 */
export default function Onboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    track("reminder_onboarding_shown", { source: "signup", platform: "native" });
  }, []);

  const enable = async () => {
    if (!user?.id) return router.replace("/(tabs)");
    setState("loading");
    const result = await registerForPush(user.id);
    if (result.status === "granted") {
      setState("done");
      track("reminder_enabled", { source: "signup" });
      setTimeout(() => router.replace("/(tabs)"), 900);
    } else {
      setState("idle");
      track("reminder_denied", { source: "signup", result: result.status });
      router.replace("/(tabs)");
    }
  };

  const skip = () => {
    track("reminder_onboarding_dismissed", { source: "signup" });
    router.replace("/(tabs)");
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Bell size={40} color={colors.orange} />
      </View>
      <Text style={styles.title}>Never miss kickoff</Text>
      <Text style={styles.subtitle}>We'll remind you 20 minutes before every game you book.</Text>

      <View style={styles.actions}>
        {state === "done" ? (
          <View style={styles.doneRow}>
            <Check size={18} color={colors.success} />
            <Text style={styles.doneText}>Reminders are on</Text>
          </View>
        ) : (
          <>
            <PillButton label="Turn on reminders" onPress={enable} loading={state === "loading"} fullWidth />
            <PillButton label="Maybe later" variant="outline" onPress={skip} fullWidth />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  iconWrap: {
    width: 88, height: 88, borderRadius: radius.xl, backgroundColor: colors.inkNavy,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.xl,
  },
  title: { fontSize: 26, fontWeight: "800", color: colors.inkNavy, textAlign: "center" },
  subtitle: { fontSize: 15, color: colors.inkMuted, textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.xxl, maxWidth: 280 },
  actions: { width: "100%", gap: spacing.md },
  doneRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md },
  doneText: { color: colors.success, fontWeight: "700", fontSize: 15 },
});
