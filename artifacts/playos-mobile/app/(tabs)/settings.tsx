import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking, ScrollView, Image, Alert } from "react-native";
import { useRouter } from "expo-router";
import { CreditCard, Bell, HelpCircle, User as UserIcon, Wallet } from "lucide-react-native";
import * as Notifications from "expo-notifications";
import { useAuth } from "@/lib/auth";
import { useGetMe, useGetMyStats, useGetMyCredits } from "@/lib/api";
import { resetAnalytics, track, screen } from "@/lib/analytics";
import { registerForPush } from "@/lib/notifications";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { colors, spacing } from "@/lib/theme";

// Exact palette from the Figma Profile screen (node 1:7)
const INK = "#1C1C1E";
const MUTED = "#6C6C70";

export default function Profile() {
  const { signOut } = useAuth();
  const { data: me } = useGetMe();
  const { data: stats } = useGetMyStats();
  const { data: credits = 0 } = useGetMyCredits();
  const router = useRouter();
  const [pushGranted, setPushGranted] = useState<boolean | null>(null);

  useEffect(() => {
    screen("Profile");
    Notifications.getPermissionsAsync().then(({ status }) => setPushGranted(status === "granted"));
  }, []);

  const togglePush = async () => {
    if (pushGranted) return Linking.openSettings();
    if (!me?.id) return;
    const result = await registerForPush(me.id);
    setPushGranted(result.status === "granted");
    track(result.status === "granted" ? "reminder_enabled" : "reminder_denied", {
      source: "settings",
      result: result.status,
    });
  };

  const handleSignOut = () => {
    Alert.alert("Sign out?", "You'll need to sign in again to book matches.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          resetAnalytics();
          await signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const initial = (me?.name ?? "?").charAt(0).toUpperCase();

  const menu = [
    { icon: <UserIcon size={22} color={INK} strokeWidth={1.8} />, label: "personal info", onPress: () => router.push("/account") },
    { icon: <CreditCard size={22} color={INK} strokeWidth={1.8} />, label: "payment methods", onPress: () => router.push("/account") },
    { icon: <Bell size={22} color={INK} strokeWidth={1.8} />, label: "notifications", onPress: () => router.push("/account/notifications") },
    { icon: <HelpCircle size={22} color={INK} strokeWidth={1.8} />, label: "help & support", onPress: () => Linking.openURL("https://playos.sa/about") },
  ];

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Dot vortex corner art (Figma 253:398) */}
      <Image source={require("../../assets/dotvortex.png")} style={styles.vortex} resizeMode="cover" />

      <HandwrittenHeader style={styles.header}>profile</HandwrittenHeader>

      {/* Avatar + name */}
      <View style={styles.avatarBlock}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
        <Text style={styles.name}>{me?.name ?? "—"}</Text>
        <Text style={styles.viewProfile}>view profile</Text>
      </View>

      {/* Stats (Figma 7:18) */}
      <View style={styles.statCard}>
        <View style={styles.statBlock}>
          <Text style={styles.statNumber}>{stats?.gamesPlayed ?? 0}</Text>
          <Text style={styles.statLabel}>matches</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={styles.statNumber}>{stats?.gamesWon ?? 0}</Text>
          <Text style={styles.statLabel}>won</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={styles.statNumber}>{Math.round(stats?.winRate ?? 0)}%</Text>
          <Text style={styles.statLabel}>win rate</Text>
        </View>
      </View>

      {/* Menu rows (Figma 70:243) */}
      {menu.map((m) => (
        <Pressable key={m.label} style={styles.menuRow} onPress={m.onPress}>
          <View style={styles.menuIcon}>{m.icon}</View>
          <Text style={styles.menuLabel}>{m.label}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}

      {/* Wallet (Figma 355:475) */}
      <Pressable style={styles.walletCard} onPress={() => router.push("/account")}>
        <View style={styles.walletIcon}>
          <Wallet size={22} color="#B45309" strokeWidth={1.8} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.walletLabel}>wallet</Text>
          <Text style={styles.walletValue}>{credits} {credits === 1 ? "token" : "tokens"}</Text>
          <Text style={styles.walletHint}>redeemable on any match spot</Text>
        </View>
        <Text style={styles.walletChevron}>›</Text>
      </Pressable>

      <Pressable style={styles.signOut} onPress={handleSignOut}>
        <Text style={styles.signOutText}>sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0" },
  content: { paddingHorizontal: 20, paddingTop: spacing.xxl + 20, paddingBottom: 130 },

  vortex: { position: "absolute", top: -25, right: -25, width: 320, height: 273, opacity: 0.9 },

  header: { fontSize: 34 },

  avatarBlock: { alignItems: "center", marginTop: spacing.xl },
  avatarCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.orange,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.orange, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 5,
  },
  avatarInitial: { fontSize: 28, fontWeight: "700", color: "#FFFFFF" },
  name: { fontSize: 18, fontWeight: "700", color: INK, marginTop: 12 },
  viewProfile: { fontSize: 13, color: MUTED, marginTop: 4 },

  statCard: {
    flexDirection: "row", alignItems: "center", height: 70, borderRadius: 20, marginTop: spacing.xl,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 20, elevation: 3,
  },
  statBlock: { flex: 1, paddingLeft: 27 },
  statNumber: { fontSize: 22, fontWeight: "700", color: INK },
  statLabel: { fontSize: 11, color: MUTED, marginTop: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: "#E6E6E6" },

  menuRow: {
    flexDirection: "row", alignItems: "center", height: 54, borderRadius: 16, paddingHorizontal: 11,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    marginTop: 10,
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 18, elevation: 3,
  },
  menuIcon: { width: 22, alignItems: "center" },
  menuLabel: { flex: 1, fontSize: 15, color: INK, marginLeft: 12 },
  chevron: { fontSize: 16, color: MUTED },

  walletCard: {
    flexDirection: "row", alignItems: "center", height: 100, borderRadius: 18, paddingHorizontal: 15,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    marginTop: 14,
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 18, elevation: 3,
  },
  walletIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: "#FFE9CC",
    alignItems: "center", justifyContent: "center", marginRight: 14,
  },
  walletLabel: { fontSize: 12, color: MUTED },
  walletValue: { fontSize: 24, fontWeight: "700", color: INK, marginTop: 2 },
  walletHint: { fontSize: 12, color: "#FF8A00", marginTop: 4 },
  walletChevron: { fontSize: 20, fontWeight: "700", color: MUTED },

  signOut: { alignItems: "center", marginTop: spacing.xl },
  signOutText: { fontSize: 14, fontWeight: "600", color: colors.danger },
});
