import { useEffect } from "react";
import { View, Text, StyleSheet, Linking, Platform, BackHandler, useWindowDimensions } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { DotWaveBackground } from "@/components/DotWaveBackground";
import { WarmCanvas } from "@/components/WarmCanvas";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { Btn3D } from "@/components/Btn3D";
import { Callout } from "@/components/Callout";
import { screen } from "@/lib/analytics";

const INK = "#1C1C1E";
const MUTED = "#6C6C70";

const GLOWS = [
  { cx: 0.8, cy: 0.15, r: 0.9, color: "rgba(255,225,204,0.35)" },
  { cx: 0.65, cy: 0.3, r: 0.6, color: "rgba(255,217,228,0.2)" },
];

/**
 * Force update (Figma 696:690).
 *
 * Fully blocking per the annotation: no dismiss, no back. Reserved for a
 * breaking API change or a payment security fix, never a feature release.
 *
 * The screen is complete, but nothing routes here yet: the trigger needs a
 * minimum-supported-version value from the API, which doesn't exist. Until
 * that ships, `required` comes from the route param. Wire the gate in the
 * root layout once the API returns a minimum.
 */
export default function UpdateRequired() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { required } = useLocalSearchParams<{ required?: string }>();

  const have = Application.nativeApplicationVersion ?? "unknown";

  useEffect(() => { screen("SystemUpdateRequired", { have, required: required ?? null }); }, [have, required]);

  // Blocking means blocking — swallow the Android hardware back button.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  const openStore = () => {
    const configured = Constants.expoConfig?.extra?.storeUrl as string | undefined;
    if (configured) { void Linking.openURL(configured); return; }
    // Fallback: Play Store can be derived from the package id; iOS needs an
    // App Store id we don't have, so set expo.extra.storeUrl before release.
    const pkg = Application.applicationId;
    if (Platform.OS === "android" && pkg) void Linking.openURL(`market://details?id=${pkg}`);
    else void Linking.openURL("https://playos.app");
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 5 }]}>
      <WarmCanvas base="#FFF8F0" glows={GLOWS} />
      <DotWaveBackground width={width} height={600} />

      <HandwrittenHeader style={styles.title}>time to update</HandwrittenHeader>
      <Text style={styles.sub}>this version cannot book any more</Text>

      <View style={styles.versionCard}>
        <View>
          <Text style={styles.versionLabel}>YOU HAVE</Text>
          <Text style={styles.versionOld}>{have}</Text>
        </View>
        <Text style={styles.arrow}>→</Text>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.versionLabel}>CURRENT</Text>
          <Text style={styles.versionNew}>{required ?? "—"}</Text>
        </View>
      </View>

      <Callout
        tone="neutral"
        icon={<Text style={styles.disc}>●</Text>}
        title="why we are forcing this"
        body="payment and check-in changed. an old app can still show you matches, but it cannot take money or check you in safely."
        style={{ marginTop: 20 }}
      />

      <Callout
        tone="confirm"
        icon={<Text style={styles.check}>✓</Text>}
        title="your bookings are safe"
        body="anything you already paid for is on your account and will be there after the update."
        style={{ marginTop: 14 }}
      />

      <View style={styles.actions}>
        <Btn3D label="update playos" onPress={openStore} />
        <Text style={styles.footnote}>takes about 20 seconds</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // paddingTop comes from the safe-area inset at the call site; the fixed
  // value was smaller than the Dynamic Island's inset.
  wrap: { flex: 1, backgroundColor: "#FFF8F0", paddingHorizontal: 20 },

  title: { fontSize: 38, color: "#FF9F0A" },
  sub: { fontSize: 15.5, fontWeight: "600", color: INK, marginTop: 10 },

  versionCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    height: 110, borderRadius: 20, marginTop: 28, paddingHorizontal: 23,
    backgroundColor: "rgba(255,255,255,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  versionLabel: { fontSize: 10.5, fontWeight: "600", color: MUTED, letterSpacing: 0.3 },
  versionOld: { fontSize: 24, fontWeight: "700", color: "#ADADB2", marginTop: 6 },
  versionNew: { fontSize: 24, fontWeight: "700", color: INK, marginTop: 6 },
  arrow: { fontSize: 20, fontWeight: "700", color: "#C96A00" },

  disc: { fontSize: 13, fontWeight: "700", color: "#3A3A3E" },
  check: { fontSize: 13, fontWeight: "700", color: "#268033" },

  actions: { position: "absolute", left: 20, right: 20, bottom: 40 },
  footnote: { fontSize: 13.5, color: MUTED, textAlign: "center", marginTop: 18 },
});
