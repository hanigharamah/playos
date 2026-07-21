import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, CreditCard, Bell, HelpCircle, User as UserIcon, LogOut, Settings as SettingsIcon } from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import { useGetMe, useGetMyStats } from "@/lib/api";
import { resetAnalytics, track } from "@/lib/analytics";
import { registerForPush } from "@/lib/notifications";
import * as Notifications from "expo-notifications";
import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/GlassCard";
import { colors, spacing, radius } from "@/lib/theme";
import { screen } from "@/lib/analytics";

const LEGAL_LINKS = [
  { label: "Terms", url: "https://playos.sa/terms" },
  { label: "Privacy Policy", url: "https://playos.sa/privacy" },
  { label: "Refund Policy", url: "https://playos.sa/policies/refund" },
];

export default function Profile() {
  const { signOut } = useAuth();
  const { data: me } = useGetMe();
  const { data: stats } = useGetMyStats();
  const router = useRouter();
  const [pushGranted, setPushGranted] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    screen("Profile");
    Notifications.getPermissionsAsync().then(({ status }) => setPushGranted(status === "granted"));
  }, []);

  const togglePush = async () => {
    if (pushGranted) return Linking.openSettings();
    if (!me?.id) return;
    setToggling(true);
    const result = await registerForPush(me.id);
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
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Profile</Text>

      <View style={styles.profileRow}>
        <Avatar name={me?.name ?? "?"} size={56} />
        <View style={{ marginLeft: spacing.md }}>
          <Text style={styles.name}>{me?.name ?? "—"}</Text>
          <Text style={styles.email}>{me?.email ?? "—"}</Text>
        </View>
      </View>

      <GlassCard style={styles.statCard}>
        <View style={styles.statBlock}>
          <Text style={styles.statNumber}>{stats?.gamesPlayed ?? 0}</Text>
          <Text style={styles.statLabel}>Matches</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={styles.statNumber}>{stats?.gamesWon ?? 0}</Text>
          <Text style={styles.statLabel}>Won</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={styles.statNumber}>{stats?.winRate ?? 0}%</Text>
          <Text style={styles.statLabel}>Win rate</Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.section} padding={0}>
        <Pressable style={styles.row} onPress={togglePush} disabled={toggling}>
          <Bell size={18} color={colors.orange} />
          <Text style={styles.rowLabel}>Match reminders</Text>
          <Text style={styles.rowValue}>{toggling ? "…" : pushGranted ? "On" : "Off"}</Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.row}>
          <UserIcon size={18} color={colors.inkMuted} />
          <Text style={styles.rowLabel}>Personal info</Text>
          <ChevronRight size={16} color={colors.inkFaint} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.row}>
          <CreditCard size={18} color={colors.inkMuted} />
          <Text style={styles.rowLabel}>Payment methods</Text>
          <ChevronRight size={16} color={colors.inkFaint} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.row}>
          <HelpCircle size={18} color={colors.inkMuted} />
          <Text style={styles.rowLabel}>Help & Support</Text>
          <ChevronRight size={16} color={colors.inkFaint} />
        </Pressable>
      </GlassCard>

      <GlassCard style={styles.section} padding={0}>
        {LEGAL_LINKS.map((link, i) => (
          <View key={link.url}>
            <Pressable style={styles.row} onPress={() => Linking.openURL(link.url)}>
              <SettingsIcon size={18} color={colors.inkMuted} />
              <Text style={styles.rowLabel}>{link.label}</Text>
              <ChevronRight size={16} color={colors.inkFaint} />
            </Pressable>
            {i < LEGAL_LINKS.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </GlassCard>

      <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
        <LogOut size={16} color={colors.danger} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep },
  content: { padding: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xxl * 2 },
  header: { fontSize: 28, fontWeight: "800", color: colors.orange, marginBottom: spacing.lg },
  profileRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  name: { fontSize: 18, fontWeight: "700", color: colors.ink },
  email: { fontSize: 13, color: colors.inkMuted, marginTop: 2 },
  statCard: { flexDirection: "row", marginBottom: spacing.lg },
  statBlock: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, backgroundColor: colors.hairline },
  statNumber: { fontSize: 22, fontWeight: "800", color: colors.pink },
  statLabel: { fontSize: 11, color: colors.inkMuted, marginTop: 2 },
  section: { marginBottom: spacing.lg, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink },
  rowValue: { fontSize: 14, color: colors.inkMuted },
  divider: { height: 1, backgroundColor: colors.hairline, marginLeft: spacing.lg + 18 + spacing.md },
  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: spacing.md, marginTop: spacing.md },
  signOutText: { color: colors.danger, fontWeight: "700" },
});
