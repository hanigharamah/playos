import { useEffect } from "react";
import { Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Zap } from "lucide-react-native";
import { ErrorScreen } from "@/components/ErrorScreen";
import { Callout } from "@/components/Callout";
import { screen } from "@/lib/analytics";

/**
 * Offline (Figma 683:545). Deliberately distinct from Server 500 — here the
 * network is the problem, so retrying immediately usually won't help.
 *
 * The mock also shows a "waiting to send" queue (check-in, award votes with
 * timestamps). That's omitted: there's no offline mutation queue in the app
 * yet, and rendering a fake queue would promise durability we don't have.
 * Build the queue first, then this section can come back.
 */
export default function Offline() {
  const router = useRouter();

  useEffect(() => { screen("ErrorOffline"); }, []);

  return (
    <ErrorScreen
      onBack={() => router.back()}
      title="you're offline"
      heroIcon={<Zap size={34} color="#C96A00" strokeWidth={2.2} />}
      heroTint="rgba(201,106,0,0.12)"
      heroLine="no connection"
      callout={
        <Callout
          tone="warning"
          icon={<Text style={styles.glyph}>!</Text>}
          title="check your connection"
          body="we couldn't reach PlayOS. once you're back online, pull to refresh and everything picks up where it left off."
          style={{ marginTop: 20 }}
        />
      }
      primaryLabel="try again"
      onPrimary={() => router.back()}
      secondaryLabel="back to home"
      onSecondary={() => router.replace("/(tabs)")}
    />
  );
}

const styles = StyleSheet.create({
  glyph: { fontSize: 13, fontWeight: "700", color: "#C96A00" },
});
