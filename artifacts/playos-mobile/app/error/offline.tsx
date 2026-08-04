import { useEffect } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { DotWaveBackground } from "@/components/DotWaveBackground";
import { WarmCanvas } from "@/components/WarmCanvas";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { useConnectivity } from "@/components/ReconnectingState";
import { screen } from "@/lib/analytics";

const GLOWS = [
  { cx: 0.8, cy: 0.15, r: 0.9, color: "rgba(255,225,204,0.35)" },
  { cx: 0.65, cy: 0.3, r: 0.6, color: "rgba(255,217,228,0.2)" },
];

/**
 * Offline (Figma 683:545).
 *
 * A bare takeover: dot wave, a script headline and one line of body. The
 * annotation is explicit — "no retry button and no cached state: it clears
 * itself the moment connectivity returns" — so this screen has no buttons and
 * no back affordance, and dismisses itself when the connection comes back.
 *
 * It was previously built on the shared ErrorScreen with a hero card, a
 * callout, a retry button and a secondary button, none of which are in the
 * mock, and its copy promised the opposite of what the mock says.
 */
export default function Offline() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { offline, known } = useConnectivity();

  useEffect(() => { screen("ErrorOffline"); }, []);

  // Clears itself when connectivity returns, exactly as the annotation
  // requires — but only once NetInfo has actually reported. Acting on the
  // pre-measurement default dismissed the screen before it could be seen.
  useEffect(() => {
    if (known && !offline) router.back();
  }, [known, offline, router]);

  return (
    <View style={styles.wrap}>
      <WarmCanvas base="#FFF8F0" glows={GLOWS} />
      <DotWaveBackground width={width} height={600} />

      <View style={styles.centre}>
        <HandwrittenHeader style={styles.title}>you're offline.</HandwrittenHeader>
        <Text style={styles.body}>
          check your connection. nothing was saved, so you'll start again from the beginning.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0" },
  centre: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  title: { fontSize: 36, color: "#FD6A03", textAlign: "center" },
  body: { fontSize: 13.5, color: "#6C6C70", textAlign: "center", marginTop: 21, width: 260, lineHeight: 19 },
});
