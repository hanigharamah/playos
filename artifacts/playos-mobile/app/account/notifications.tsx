import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { DotWaveBackground } from "@/components/DotWaveBackground";
import { WarmCanvas } from "@/components/WarmCanvas";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { useNotificationPrefs, useSetNotificationPrefs, DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from "@/lib/api";
import { Callout } from "@/components/Callout";
import { colors } from "@/lib/theme";
import { screen } from "@/lib/analytics";

const INK = "#1C1C1E";
const MUTED = "#6C6C70";

const GLOWS = [
  { cx: 0.8, cy: 0.15, r: 0.9, color: "rgba(255,225,204,0.35)" },
  { cx: 0.65, cy: 0.3, r: 0.6, color: "rgba(255,217,228,0.2)" },
];

type PrefKey = keyof NotificationPrefs;

/**
 * Every switch maps to exactly one real message in the notification spine —
 * nothing here is decorative. Transactional messages (booking confirmations,
 * cancellations, refunds) are excluded from this list entirely rather than
 * shown disabled, per the annotation; the footnote explains why.
 */
const SECTIONS: { label: string; rows: { key: PrefKey; title: string; sub: string }[] }[] = [
  {
    label: "MATCHES",
    rows: [
      { key: "matchReminders", title: "match reminders", sub: "24 hours and 2 hours before kickoff" },
      { key: "teamsAndCheckIn", title: "teams and check-in", sub: "when teams are posted and check-in opens" },
    ],
  },
  {
    label: "SPOTS",
    rows: [
      { key: "spotOpened", title: "spot opened", sub: "when a spot frees on a match you watched" },
      { key: "headStart", title: "head start", sub: "your 60 second head start on a freed spot" },
    ],
  },
  {
    label: "CHAT",
    rows: [{ key: "matchChat", title: "match chat", sub: "only inside the live window, 20 min either side" }],
  },
  {
    label: "AFTER THE MATCH",
    rows: [{ key: "resultsAndAwards", title: "results and awards", sub: "score confirmed, votes open, XP added" }],
  },
  {
    label: "OTHER",
    rows: [{ key: "newsAndOffers", title: "news and offers", sub: "new venues, discounts, seasons" }],
  },
];

/**
 * Notification preferences (Figma 699:726). Writes immediately, no save button.
 *
 * Preferences persist to `notification_preferences` when that table exists and
 * fall back to the device otherwise. When they are device-only the screen says
 * so rather than implying an enforcement that isn't there — this matters
 * because the forfeit model assumes the player was told before he was
 * penalised, so an unenforceable preference is a fairness problem, not a
 * cosmetic one. See supabase/2026-07-notification-preferences.sql.
 */
export default function NotificationSettings() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data } = useNotificationPrefs();
  const setPrefs = useSetNotificationPrefs();
  // Local echo so a switch responds instantly rather than after a round trip.
  const [pending, setPending] = useState<Partial<NotificationPrefs>>({});

  useEffect(() => { screen("SettingsNotifications"); }, []);

  const prefs: NotificationPrefs = { ...DEFAULT_NOTIFICATION_PREFS, ...(data?.prefs ?? {}), ...pending };
  const serverBacked = data?.synced ?? false;

  const toggle = (key: PrefKey, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPending((p) => ({ ...p, [key]: value }));
    setPrefs.mutate(next, { onSettled: () => setPending({}) });
  };

  return (
    <View style={styles.wrap}>
      <WarmCanvas base="#FFF8F0" glows={GLOWS} />
      <DotWaveBackground width={width} height={600} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <HandwrittenHeader style={styles.title}>notifications</HandwrittenHeader>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {SECTIONS.map((section) => (
          <View key={section.label}>
            <Text style={styles.sectionLabel}>{section.label}</Text>
            {section.rows.map((row) => (
              <View key={row.key} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{row.title}</Text>
                  <Text style={styles.rowSub}>{row.sub}</Text>
                </View>
                <Switch
                  value={prefs[row.key]}
                  onValueChange={(v) => toggle(row.key, v)}
                  trackColor={{ false: "#E4E4E7", true: colors.orange }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ))}
          </View>
        ))}

        {!serverBacked && (
          <Callout
            tone="warning"
            icon={<Text style={styles.bang}>!</Text>}
            title="saved on this phone only"
            body="these choices aren't reaching our servers yet, so they don't stop a message being sent. we're fixing that."
            style={{ marginTop: 22 }}
          />
        )}

        <Text style={styles.footnote}>
          booking confirmations, cancellations and refunds always arrive. they are transactional and cannot be
          switched off.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0", paddingTop: 52 },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20 },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
  },
  backGlyph: { fontSize: 20, fontWeight: "700", color: INK, lineHeight: 22 },
  title: { fontSize: 26, color: "#FA810B", marginLeft: 14, flex: 1 },

  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 60 },
  sectionLabel: { fontSize: 11, fontWeight: "600", color: MUTED, letterSpacing: 0.3, marginTop: 22, marginLeft: 4 },

  row: {
    flexDirection: "row", alignItems: "center", height: 64, borderRadius: 16, marginTop: 10, paddingHorizontal: 17,
    backgroundColor: "rgba(255,255,255,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  rowText: { flex: 1, paddingRight: 12 },
  rowTitle: { fontSize: 14.5, fontWeight: "600", color: INK },
  rowSub: { fontSize: 11.5, color: MUTED, marginTop: 4 },

  bang: { fontSize: 13, fontWeight: "700", color: "#C96A00" },
  footnote: { fontSize: 12, color: MUTED, marginTop: 28, marginLeft: 4, lineHeight: 18 },
});
