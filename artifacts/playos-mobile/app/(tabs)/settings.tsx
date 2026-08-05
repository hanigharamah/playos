import { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Linking, ScrollView, Image, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BAR_INSET, useMatchDayBar } from "@/components/MatchDayBar";
import { CreditCard, Bell, HelpCircle, User as UserIcon, Wallet } from "lucide-react-native";
import * as Notifications from "expo-notifications";
import { useAuth } from "@/lib/auth";
import { useGetMe, useGetMyStats, useGetMyCredits } from "@/lib/api";
import { resetAnalytics, track, screen } from "@/lib/analytics";
import { registerForPush } from "@/lib/notifications";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { WarmCanvas } from "@/components/WarmCanvas";
import { GlassCard } from "@/components/GlassCard";
import { useScrollToTop } from "@/lib/scrollToTop";
import { colors, spacing } from "@/lib/theme";

// Exact palette from the Figma Profile screen (node 1:7)
const INK = "#1C1C1E";
const MUTED = "#6C6C70";

const GLOWS = [
  { cx: 0.8, cy: 0.15, r: 0.9, color: "rgba(255,225,204,0.35)" },
  { cx: 0.65, cy: 0.3, r: 0.6, color: "rgba(255,217,228,0.2)" },
];

export default function Profile() {
  const { signOut } = useAuth();
  const { data: me } = useGetMe();
  const { data: stats } = useGetMyStats();
  const { data: credits = 0 } = useGetMyCredits();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop("settings", scrollRef);

  // Content drops by the bar's height while it is showing (Figma 834:470).
  const barInset = useMatchDayBar() ? BAR_INSET : 0;
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
    // Granting the OS permission and choosing per-message preferences are
    // different jobs. Sending an ungranted player to the preferences screen
    // left them with no way to turn push on at all.
    {
      icon: <Bell size={22} color={INK} strokeWidth={1.8} />,
      label: "notifications",
      onPress: () => (pushGranted ? router.push("/account/notifications") : void togglePush()),
    },
    { icon: <HelpCircle size={22} color={INK} strokeWidth={1.8} />, label: "help & support", onPress: () => Linking.openURL("https://playos.sa/about") },
  ];

  return (
    <View style={{ flex: 1 }}>
      <WarmCanvas base="#FFF8F0" glows={GLOWS} />
      <ScrollView ref={scrollRef} style={styles.wrap} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 + barInset }]} showsVerticalScrollIndicator={false}>
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
      <GlassCard variant="soft" round={20} padding={0} style={styles.statCard}>
        <View style={styles.statRow}>
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
      </GlassCard>

      {/* Menu rows (Figma 70:243) */}
      {menu.map((m) => (
        <Pressable key={m.label} onPress={m.onPress}>
          <GlassCard variant="soft" round={16} padding={0} style={styles.menuCard}>
            <View style={styles.menuRow}>
              <View style={styles.menuIcon}>{m.icon}</View>
              <Text style={styles.menuLabel}>{m.label}</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </GlassCard>
        </Pressable>
      ))}

      {/* Wallet (Figma 355:475) */}
      <Pressable onPress={() => router.push("/account")}>
        <GlassCard variant="soft" round={18} padding={0} style={styles.walletCard}>
          <View style={styles.walletRow}>
            <View style={styles.walletIcon}>
              <Wallet size={22} color="#B45309" strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.walletLabel}>wallet</Text>
              <Text style={styles.walletValue}>{credits} {credits === 1 ? "token" : "tokens"}</Text>
              <Text style={styles.walletHint}>redeemable on any match spot</Text>
            </View>
            <Text style={styles.walletChevron}>›</Text>
          </View>
        </GlassCard>
      </Pressable>

      <Pressable style={styles.signOut} onPress={handleSignOut}>
        <Text style={styles.signOutText}>sign out</Text>
      </Pressable>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent: this ScrollView sits above <WarmCanvas />, which is
  // absoluteFill, so an opaque cream here hid the peach glow completely.
  wrap: { flex: 1, backgroundColor: "transparent" },
    // paddingTop is applied at the call site from the safe-area inset: the
  // fixed value here was smaller than the Dynamic Island's inset, so the first
  // element rendered underneath it.
  content: { paddingHorizontal: 20, paddingBottom: 130 },

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

  // Geometry only — fill, stroke and shadows come from <GlassCard>. The row
  // layout sits on the inner view the children lay out in, and the fixed
  // heights became minHeights so the labels can grow with Dynamic Type.
  statCard: { marginTop: spacing.xl },
  statRow: { flexDirection: "row", alignItems: "center", minHeight: 70 },
  statBlock: { flex: 1, paddingLeft: 27 },
  statNumber: { fontSize: 22, fontWeight: "700", color: INK },
  statLabel: { fontSize: 11, color: MUTED, marginTop: 0 },
  statDivider: { width: 1, height: 40, backgroundColor: "#EADFD4" },

  menuCard: { marginTop: 10 },
  menuRow: { flexDirection: "row", alignItems: "center", minHeight: 54, paddingHorizontal: 11 },
  menuIcon: { width: 22, alignItems: "center" },
  menuLabel: { flex: 1, fontSize: 15, color: INK, marginLeft: 12 },
  chevron: { fontSize: 16, color: MUTED },

  walletCard: { marginTop: 14 },
  walletRow: { flexDirection: "row", alignItems: "center", minHeight: 100, paddingHorizontal: 15 },
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
