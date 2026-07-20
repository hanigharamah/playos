import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { Bell, Globe, LogOut, FileText, ChevronRight } from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { registerForPush } from "@/lib/notifications";
import { resetAnalytics, track } from "@/lib/analytics";
import { GlassCard } from "@/components/GlassCard";
import { colors, spacing, radius } from "@/lib/theme";
import { screen } from "@/lib/analytics";

const LEGAL_LINKS = [
  { label: "Terms", url: "https://playos.sa/terms" },
  { label: "Privacy Policy", url: "https://playos.sa/privacy" },
  { label: "Refund Policy", url: "https://playos.sa/policies/refund" },
];

export default function Settings() {
  const { user, signOut } = useAuth();
  const { t, language, toggleLanguage } = useI18n();
  const router = useRouter();
  const [pushGranted, setPushGranted] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    screen("Settings");
    Notifications.getPermissionsAsync().then(({ status }) => setPushGranted(status === "granted"));
  }, []);

  const togglePush = async () => {
    if (pushGranted) {
      // iOS/Android don't let apps revoke their own notification permission —
      // send the player to system settings instead.
      Linking.openSettings();
      return;
    }
    if (!user?.id) return;
    setToggling(true);
    const result = await registerForPush(user.id);
    setPushGranted(result.status === "granted");
    track(result.status === "granted" ? "reminder_enabled" : "reminder_denied", { source: "settings", result: result.status });
    setToggling(false);
  };

  const handleSignOut = async () => {
    resetAnalytics();
    await signOut();
    router.replace("/(auth)/login");
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.header}>{t("settings.title")}</Text>
      <Text style={styles.subtitle}>{user?.email ?? "—"}</Text>

      <GlassCard style={styles.section} padding={0}>
        <Pressable style={styles.row} onPress={togglePush} disabled={toggling}>
          <Bell size={18} color={colors.orange} />
          <Text style={styles.rowLabel}>{t("settings.notifications")}</Text>
          {toggling ? (
            <ActivityIndicator size="small" color={colors.orange} />
          ) : (
            <Text style={styles.rowValue}>{pushGranted ? "On" : "Off"}</Text>
          )}
        </Pressable>

        <View style={styles.divider} />

        <Pressable style={styles.row} onPress={toggleLanguage}>
          <Globe size={18} color={colors.inkNavy} />
          <Text style={styles.rowLabel}>{t("settings.language")}</Text>
          <Text style={styles.rowValue}>{language === "en" ? "EN" : "AR"}</Text>
        </Pressable>
      </GlassCard>

      <GlassCard style={styles.section} padding={0}>
        {LEGAL_LINKS.map((link, i) => (
          <View key={link.url}>
            <Pressable style={styles.row} onPress={() => Linking.openURL(link.url)}>
              <FileText size={18} color={colors.inkMuted} />
              <Text style={styles.rowLabel}>{link.label}</Text>
              <ChevronRight size={16} color={colors.inkFaint} />
            </Pressable>
            {i < LEGAL_LINKS.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </GlassCard>

      <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
        <LogOut size={16} color={colors.danger} />
        <Text style={styles.signOutText}>{t("settings.signout")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep, padding: spacing.lg, paddingTop: spacing.xxl * 1.5 },
  header: { fontSize: 28, fontWeight: "800", color: colors.inkNavy },
  subtitle: { color: colors.inkMuted, marginTop: 4, marginBottom: spacing.xl },
  section: { marginBottom: spacing.lg, padding: 0, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink },
  rowValue: { fontSize: 14, color: colors.inkMuted },
  divider: { height: 1, backgroundColor: colors.hairline, marginLeft: spacing.lg + 18 + spacing.md },
  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: spacing.md, marginTop: spacing.md },
  signOutText: { color: colors.danger, fontWeight: "700" },
});
