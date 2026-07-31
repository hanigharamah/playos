import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { DotWaveBackground } from "@/components/DotWaveBackground";
import { WarmCanvas } from "@/components/WarmCanvas";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { Btn3D } from "@/components/Btn3D";
import { BtnOutline } from "@/components/BtnOutline";
import { Callout } from "@/components/Callout";
import { useAuth } from "@/lib/auth";
import { registerForPush } from "@/lib/notifications";
import { screen } from "@/lib/analytics";

const INK = "#1C1C1E";
const MUTED = "#6C6C70";
const RED = "#BF2626";

const GLOWS = [
  { cx: 0.8, cy: 0.15, r: 0.9, color: "rgba(255,225,204,0.35)" },
  { cx: 0.65, cy: 0.3, r: 0.6, color: "rgba(255,217,228,0.2)" },
];

/** Per the annotation: must not reappear more than twice. */
const SEEN_KEY = "playos.permission.notifications.seen";
const MAX_PROMPTS = 2;

/** Concrete losses, not an abstract permission ask. */
const MISSES = [
  { title: "your booking is confirmed", sub: "right after you pay" },
  { title: "check-in opens", sub: "20 min before kickoff" },
  { title: "a spot opened up", sub: "the head start you signed up for" },
  { title: "this match is cancelled", sub: "sometimes 2 hours before" },
];

/**
 * Notifications off (Figma 696:656).
 *
 * Shown once after the first booking if push isn't granted, and again from
 * notification settings. Dismissible, capped at two appearances — see
 * shouldPromptForNotifications() below, which callers must check first.
 */
export default function NotificationsPermission() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    screen("PermissionNotifications");
    void bumpPromptCount();
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      if (existing === "denied") {
        // iOS only shows the system sheet once. After that the only route
        // back is Settings, so send them there rather than no-opping.
        await Linking.openSettings();
        // Don't leave "you will miss these" sitting there for the user to
        // come back to with permission already granted.
        router.back();
        return;
      }
      if (user) await registerForPush(user.id);
      else await Notifications.requestPermissionsAsync();
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <WarmCanvas base="#FFF8F0" glows={GLOWS} />
      <DotWaveBackground width={width} height={600} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <HandwrittenHeader style={styles.title}>you will miss these</HandwrittenHeader>
      </View>

      <View style={styles.listCard}>
        <Text style={styles.eyebrow}>WITH NOTIFICATIONS OFF YOU DO NOT GET</Text>
        {MISSES.map((m) => (
          <View key={m.title} style={styles.missRow}>
            <Text style={styles.cross}>✕</Text>
            <View style={styles.missText}>
              <Text style={styles.missTitle}>{m.title}</Text>
              <Text style={styles.missSub}>{m.sub}</Text>
            </View>
          </View>
        ))}
      </View>

      <Callout
        tone="blocker"
        icon={<Text style={styles.bang}>!</Text>}
        title="the cancellation one is the problem"
        body="if we call a match off and you never see it, you drive to the pitch for nothing. that is the whole reason to ask."
        style={{ marginTop: 20 }}
      />

      <View style={styles.actions}>
        <Btn3D label="turn notifications on" loading={busy} onPress={enable} />
        <BtnOutline label="not now" tone="neutral" onPress={() => router.back()} style={{ marginTop: 12 }} />
        <Text style={styles.footnote}>you can change this any time in settings</Text>
      </View>
    </View>
  );
}

/**
 * Call before routing here. Returns false once permission is granted, or once
 * the player has already been asked twice.
 */
export async function shouldPromptForNotifications(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return false;
  const raw = await AsyncStorage.getItem(SEEN_KEY);
  return Number(raw ?? 0) < MAX_PROMPTS;
}

async function bumpPromptCount() {
  const raw = await AsyncStorage.getItem(SEEN_KEY);
  await AsyncStorage.setItem(SEEN_KEY, String(Number(raw ?? 0) + 1));
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0", paddingHorizontal: 20, paddingTop: 52 },

  header: { flexDirection: "row", alignItems: "center" },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
  },
  backGlyph: { fontSize: 20, fontWeight: "700", color: INK, lineHeight: 22 },
  title: { fontSize: 26, color: "#FA810B", marginLeft: 14, flex: 1 },

  listCard: {
    borderRadius: 20, marginTop: 22, paddingHorizontal: 19, paddingTop: 17, paddingBottom: 8,
    backgroundColor: "rgba(255,255,255,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  eyebrow: { fontSize: 11, fontWeight: "600", color: MUTED, letterSpacing: 0.3 },
  missRow: { flexDirection: "row", marginTop: 14 },
  cross: { fontSize: 12, fontWeight: "700", color: RED, width: 24, marginTop: 2 },
  missText: { flex: 1 },
  missTitle: { fontSize: 14.5, fontWeight: "600", color: INK },
  missSub: { fontSize: 12, color: MUTED, marginTop: 4 },

  bang: { fontSize: 13, fontWeight: "700", color: RED },

  actions: { position: "absolute", left: 20, right: 20, bottom: 40 },
  footnote: { fontSize: 13.5, color: MUTED, textAlign: "center", marginTop: 18 },
});
