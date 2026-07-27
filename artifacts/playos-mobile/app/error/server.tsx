import { useEffect, useState } from "react";
import { Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { format } from "date-fns";
import { Check } from "lucide-react-native";
import { ErrorScreen } from "@/components/ErrorScreen";
import { Callout } from "@/components/Callout";
import { screen } from "@/lib/analytics";

/**
 * Server 500 (Figma 684:494). Entry: any 5xx or request timeout that isn't a
 * payment. Distinct from Offline on purpose — the player did nothing wrong
 * and an immediate retry may work. Per the annotation: never auto-retry more
 * than twice, then park here.
 */
export default function ServerError() {
  const router = useRouter();
  const { requestId } = useLocalSearchParams<{ requestId?: string }>();
  // The request id is the only thing that makes a support ticket actionable.
  const [ref] = useState(() => requestId ?? "PL-500");
  const [stamp] = useState(() => format(new Date(), "HH:mm"));

  useEffect(() => { screen("ErrorServer", { requestId: ref }); }, [ref]);

  return (
    <ErrorScreen
      onBack={() => router.back()}
      title="something broke on our end"
      heroIcon={<Text style={styles.bang}>!</Text>}
      heroTint="rgba(191,38,38,0.12)"
      heroLine="that's on us, not you"
      callout={
        <Callout
          tone="confirm"
          icon={<Check size={13} color="#268033" strokeWidth={3} />}
          title="nothing you did was lost"
          body="your booking, your check-in and your payment are all safe. we just couldn't load this screen."
          style={{ marginTop: 20 }}
        />
      }
      primaryLabel="try again"
      onPrimary={() => router.back()}
      secondaryLabel="back to home"
      onSecondary={() => router.replace("/(tabs)")}
      // TODO: make this tap-to-copy once expo-clipboard is added.
      reference={`${ref}  ·  ${stamp}`}
      footnote="if it keeps happening, message us on whatsapp"
    />
  );
}

const styles = StyleSheet.create({
  bang: { fontSize: 34, fontWeight: "700", color: "#BF2626" },
});
