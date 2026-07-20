import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Banknote, Smartphone, Check, MessageCircle, Bell } from "lucide-react-native";
import { useGetSettings, useConfirmPaymentMethod, useGetGame } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { registerForPush } from "@/lib/notifications";
import { PillButton } from "@/components/PillButton";
import { GlassCard } from "@/components/GlassCard";
import { colors, spacing, radius } from "@/lib/theme";
import { screen, track } from "@/lib/analytics";

type Method = "cash" | "stcpay";

/**
 * Cash / STC Pay checkout — mirrors ../playos/src/pages/payment/checkout.tsx.
 * No card processing anywhere in this flow, matching the web app and the
 * privacy policy's "we don't collect card numbers" claim.
 */
export default function Checkout() {
  const { bookingId, gameId } = useLocalSearchParams<{ bookingId: string; gameId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: settings } = useGetSettings();
  const { data: game } = useGetGame(gameId!);
  const confirmMethod = useConfirmPaymentMethod();

  const [done, setDone] = useState<Method | null>(null);
  const [pushState, setPushState] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => { screen("Checkout", { bookingId, gameId }); }, [bookingId, gameId]);

  const choose = (method: Method) => {
    confirmMethod.mutate(
      { bookingId: bookingId!, method },
      {
        onSuccess: () => {
          track("booking_confirmed", { method, fee: game?.price ?? null, gameId: gameId ?? null });
          setDone(method);
        },
      },
    );
  };

  const enableReminder = async () => {
    if (!user?.id) return;
    setPushState("loading");
    const result = await registerForPush(user.id);
    setPushState(result.status === "granted" ? "done" : "idle");
    track(result.status === "granted" ? "reminder_enabled" : "reminder_denied", { source: "checkout", result: result.status });
  };

  if (done) {
    return (
      <View style={styles.wrap}>
        <GlassCard style={styles.confirmCard}>
          <View style={styles.confirmIcon}>
            <Check size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.confirmTitle}>Spot reserved</Text>
          <Text style={styles.confirmBody}>
            {done === "cash"
              ? `Pay SAR ${game?.price ?? ""} in cash at the pitch. Your spot is confirmed on payment.`
              : `Send SAR ${game?.price ?? ""} via STC Pay. Your spot is confirmed once payment is received.`}
          </Text>

          {settings?.whatsappUrl && (
            <Pressable style={styles.whatsappBtn} onPress={() => Linking.openURL(settings.whatsappUrl)}>
              <MessageCircle size={16} color="#FFFFFF" />
              <Text style={styles.whatsappText}>Join the WhatsApp group</Text>
            </Pressable>
          )}

          {pushState !== "done" && (
            <Pressable style={styles.reminderBtn} onPress={enableReminder} disabled={pushState === "loading"}>
              {pushState === "loading" ? (
                <ActivityIndicator size="small" color={colors.orange} />
              ) : (
                <Bell size={16} color={colors.orange} />
              )}
              <Text style={styles.reminderText}>Get a reminder 20 min before kickoff</Text>
            </Pressable>
          )}
          {pushState === "done" && <Text style={styles.reminderDone}>Reminder enabled ✓</Text>}

          <PillButton label="Back to game" variant="outline" onPress={() => router.replace(`/game/${gameId}`)} fullWidth />
        </GlassCard>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <GlassCard style={styles.confirmCard}>
        <Text style={styles.confirmTitle}>Choose payment method</Text>
        <Text style={styles.confirmBody}>SAR {game?.price ?? "—"} for your spot</Text>

        <Pressable style={styles.methodCard} onPress={() => choose("cash")} disabled={confirmMethod.isPending}>
          <Banknote size={22} color={colors.inkNavy} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.methodTitle}>Cash at the pitch</Text>
            <Text style={styles.methodSub}>Pay when you arrive</Text>
          </View>
        </Pressable>

        <Pressable style={styles.methodCard} onPress={() => choose("stcpay")} disabled={confirmMethod.isPending}>
          <Smartphone size={22} color={colors.inkNavy} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.methodTitle}>STC Pay</Text>
            <Text style={styles.methodSub}>{settings?.stcpayNumber ?? "—"}</Text>
          </View>
        </Pressable>

        {confirmMethod.isPending && <ActivityIndicator color={colors.orange} style={{ marginTop: spacing.md }} />}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.creamDeep, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  confirmCard: { width: "100%", maxWidth: 420, alignItems: "center", padding: spacing.xl, gap: spacing.md },
  confirmIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.inkNavy, alignItems: "center", justifyContent: "center" },
  confirmTitle: { fontSize: 20, fontWeight: "800", color: colors.inkNavy, textAlign: "center" },
  confirmBody: { fontSize: 14, color: colors.inkMuted, textAlign: "center" },
  whatsappBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#25D366", width: "100%", paddingVertical: 12, borderRadius: radius.md },
  whatsappText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  reminderBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: colors.hairline, width: "100%", paddingVertical: 12, borderRadius: radius.md },
  reminderText: { color: colors.inkNavy, fontWeight: "600", fontSize: 14 },
  reminderDone: { color: colors.success, fontWeight: "600", fontSize: 13 },
  methodCard: { flexDirection: "row", alignItems: "center", width: "100%", borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  methodTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  methodSub: { fontSize: 13, color: colors.inkMuted, marginTop: 2 },
});
