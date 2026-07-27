import { useEffect } from "react";
import { Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { LogIn } from "lucide-react-native";
import { ErrorScreen } from "@/components/ErrorScreen";
import { Callout } from "@/components/Callout";
import { screen } from "@/lib/analytics";

/**
 * Session expired (Figma 684:520). Reassurance-first: the spot was never at
 * risk, we just need the player to sign in again.
 *
 * The mock also shows "you were in the middle of: checking out · 6v6 Arena
 * Riyadh" and promises to drop the player back there. That needs a stored
 * return-route (and the booking context) which doesn't exist yet, so it's
 * omitted rather than shown as a promise the app can't keep.
 */
export default function SessionExpired() {
  const router = useRouter();

  useEffect(() => { screen("ErrorSessionExpired"); }, []);

  return (
    <ErrorScreen
      title="you've been signed out"
      heroIcon={<LogIn size={32} color="#6C6C70" strokeWidth={2} />}
      heroTint="rgba(108,108,112,0.12)"
      heroLine="nothing is lost, we just need you again"
      callout={
        <Callout
          tone="neutral"
          icon={<Text style={styles.glyph}>i</Text>}
          title="why this happened"
          body="sessions end after 30 days, or when you sign in on another phone. your spot was never at risk."
          style={{ marginTop: 20 }}
        />
      }
      primaryLabel="sign in again"
      onPrimary={() => router.replace("/(auth)/login")}
      secondaryLabel="use a different number"
      onSecondary={() => router.replace("/(auth)/login")}
    />
  );
}

const styles = StyleSheet.create({
  glyph: { fontSize: 13, fontWeight: "700", color: "#6C6C70" },
});
