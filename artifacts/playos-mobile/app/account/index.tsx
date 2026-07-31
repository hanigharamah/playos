import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Linking, Alert, Platform, AppState } from "react-native";
import { useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { ArrowLeft, User as UserIcon, Smartphone, CreditCard, Coins, Globe, FileText, Lock, Bell } from "lucide-react-native";
import * as Notifications from "expo-notifications";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useGetMe, useGetMyCredits } from "@/lib/api";
import { registerForPush } from "@/lib/notifications";
import { resetAnalytics, track, screen } from "@/lib/analytics";
import { colors, spacing } from "@/lib/theme";

// Exact palette from the Figma Settings screen (node 357:510)
const INK = "#1C1C1E";
const MUTED = "#6C6C70";

/** Canonical legal text lives on the web so it can't drift between surfaces. */
const TERMS_URL = "https://playos.sa/terms";
const PRIVACY_URL = "https://playos.sa/privacy";

/**
 * Mask the stored number without inventing its shape. The previous version
 * rendered every value as `+966 5• ••• ••XX`, so a landline or a non-Saudi
 * number was displayed as a Saudi mobile — a country code and leading digit
 * that were never in the data.
 */
function maskPhone(phone?: string | null) {
  const raw = phone?.trim();
  if (!raw) return "not set";
  if (raw.length <= 2) return raw;
  const tail = raw.slice(-2);
  const head = raw.startsWith("+") ? raw.slice(0, 4) : "";
  return `${head}${head ? " " : ""}${"•".repeat(Math.max(2, Math.min(8, raw.length - tail.length - head.length)))}${tail}`;
}

export default function Settings() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { language, toggleLanguage } = useI18n();
  const { data: me } = useGetMe();
  const { data: credits = 0 } = useGetMyCredits();
  const [pushGranted, setPushGranted] = useState(false);

  useEffect(() => {
    screen("Settings");
    const read = () => Notifications.getPermissionsAsync().then(({ status }) => setPushGranted(status === "granted"));
    read();
    // The switch sends the user to iOS Settings to change this, so re-read it
    // when they come back — otherwise it keeps showing the old value.
    const sub = AppState.addEventListener("change", (state) => { if (state === "active") read(); });
    return () => sub.remove();
  }, []);

  const togglePush = async (next: boolean) => {
    if (!next || pushGranted) {
      // The OS owns this switch once granted — send them to system settings.
      Linking.openSettings();
      return;
    }
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

  const Row = ({
    icon, label, value, onPress,
  }: { icon: React.ReactNode; label: string; value?: string; onPress?: () => void }) => (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={styles.rowLabel}>{label}</Text>
      {!!value && <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <BlurView intensity={Platform.OS === "ios" ? 20 : 0} tint="light" style={styles.backBtn}>
            <ArrowLeft size={20} color={INK} strokeWidth={2} />
          </BlurView>
        </Pressable>
        <Text style={styles.title}>settings</Text>
      </View>

      <Text style={styles.section}>ACCOUNT</Text>
      <Row icon={<UserIcon size={22} color={INK} strokeWidth={1.8} />} label="personal info" value={me?.name ?? "—"} />
      <Row icon={<Smartphone size={22} color={INK} strokeWidth={1.8} />} label="phone number" value={maskPhone(me?.phone)} />

      <Text style={styles.section}>PAYMENT</Text>
      {/* No saved-card storage exists yet — showing the real state, not a mock card. */}
      <Row icon={<CreditCard size={22} color={INK} strokeWidth={1.8} />} label="payment methods" value="not set up" />
      <Row
        icon={<Coins size={22} color={INK} strokeWidth={1.8} />}
        label="wallet"
        value={`${credits} ${credits === 1 ? "token" : "tokens"}`}
      />

      <Text style={styles.section}>PREFERENCES</Text>
      <Row
        icon={<Globe size={22} color={INK} strokeWidth={1.8} />}
        label="language"
        value={language === "ar" ? "العربية" : "English"}
        onPress={toggleLanguage}
      />
      <View style={styles.notifRow}>
        <Text style={styles.rowLabel}>push notifications</Text>
        <Switch
          value={pushGranted}
          onValueChange={togglePush}
          trackColor={{ false: "#E2DED8", true: "#FF8A00" }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#E2DED8"
        />
      </View>
      {/* Per-message preferences (Figma 699:726) — only reachable once the
          OS-level permission is actually granted. */}
      {pushGranted && (
        <Row
          icon={<Bell size={22} color={INK} strokeWidth={1.8} />}
          label="what we notify you about"
          onPress={() => router.push("/account/notifications")}
        />
      )}

      <Text style={styles.section}>LEGAL</Text>
      <Row
        icon={<FileText size={22} color={INK} strokeWidth={1.8} />}
        label="terms of service"
        onPress={() => Linking.openURL(TERMS_URL)}
      />
      <Row
        icon={<Lock size={22} color={INK} strokeWidth={1.8} />}
        label="privacy policy"
        onPress={() => Linking.openURL(PRIVACY_URL)}
      />

      <Pressable style={styles.signOut} onPress={handleSignOut}>
        <Text style={styles.signOutText}>sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const rowSurface = {
  backgroundColor: "rgba(255,255,255,0.55)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.85)",
  shadowColor: "#8C5926",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.14,
  shadowRadius: 18,
  elevation: 3,
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0" },
  content: { paddingHorizontal: 20, paddingTop: spacing.xxl, paddingBottom: spacing.xxl * 2 },

  header: { flexDirection: "row", alignItems: "center", gap: 28 },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
  },
  title: { fontSize: 20, fontWeight: "600", color: INK },

  section: { fontSize: 12, fontWeight: "600", color: MUTED, marginTop: spacing.xl, marginBottom: 10, marginLeft: 4 },

  row: { ...rowSurface, flexDirection: "row", alignItems: "center", height: 54, borderRadius: 16, paddingHorizontal: 11, marginBottom: 8 },
  rowIcon: { width: 22, alignItems: "center" },
  rowLabel: { flex: 1, fontSize: 15, color: INK, marginLeft: 12 },
  rowValue: { fontSize: 13, color: MUTED, maxWidth: 140, marginRight: 8 },
  chevron: { fontSize: 16, color: MUTED },

  notifRow: {
    ...rowSurface,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    height: 54, borderRadius: 16, paddingHorizontal: 19,
    backgroundColor: "rgba(255,255,255,0.5)",
    shadowOpacity: 0.1, shadowRadius: 10,
  },

  signOut: {
    height: 50, alignItems: "center", justifyContent: "center", borderRadius: 16,
    backgroundColor: "#FFFFFF", marginTop: spacing.xxl,
  },
  signOutText: { fontSize: 15, fontWeight: "600", color: "#BF2626" },
});
