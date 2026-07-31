import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking, ActivityIndicator, Share, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { format } from "date-fns";
import { Banknote, Smartphone, Check, MessageCircle, Bell, Share2 } from "lucide-react-native";
import { useGetSettings, useConfirmPaymentMethod, useGetGame } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { registerForPush } from "@/lib/notifications";
import { PillButton } from "@/components/PillButton";
import { GlassCard } from "@/components/GlassCard";
import { colors, gradients, spacing, radius } from "@/lib/theme";
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
          // The designed confirmation screen (Figma 369:568) exists and was
          // dead code — checkout used to render its own inline success view
          // and the real screen never showed. Route to it instead.
          router.replace({
            pathname: "/booking-confirmed/[bookingId]",
            params: { bookingId: bookingId!, gameId: gameId ?? "" },
          });
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
    const onShare = () => {
      if (!game) return;
      Share.share({ message: `I'm playing "${game.title}" on PlayOS`, url: `https://playos.sa/game/${gameId}` });
    };

    return (
      <ScrollView style={styles.confirmWrap} contentContainerStyle={styles.confirmContent}>
        <LinearGradient
          colors={[gradients.vivid[1], gradients.vivid[3]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.confirmIconGrad}
        >
          <Check size={30} color="#FFFFFF" strokeWidth={3} />
        </LinearGradient>
        <Text style={styles.allSet}>You're all set!</Text>
        <Text style={styles.allSetSub}>See you on the pitch.</Text>

        {game && (
          <GlassCard style={styles.summaryCard}>
            <Text style={styles.summaryTime}>{format(new Date(game.kickoffTime), "EEE, d MMM · h:mm a")}</Text>
            <Text style={styles.summaryTitle}>{game.title}</Text>
            <Text style={styles.summarySub}>{game.pitchName}</Text>
          </GlassCard>
        )}

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

        <Pressable style={styles.linkBtn} onPress={onShare}>
          <Share2 size={14} color={colors.inkMuted} />
          <Text style={styles.linkText}>Share with friends</Text>
        </Pressable>

        <PillButton label="Back to game" variant="outline" onPress={() => router.replace(gameId ? `/game/${gameId}` : "/(tabs)")} fullWidth />
      </ScrollView>
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
  confirmWrap: { flex: 1, backgroundColor: colors.creamDeep },
  confirmContent: { alignItems: "center", padding: spacing.xl, paddingTop: spacing.xxl * 1.5, gap: spacing.md },
  confirmIconGrad: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  allSet: { fontSize: 24, fontWeight: "800", color: colors.inkNavy, marginTop: spacing.sm },
  allSetSub: { fontSize: 14, color: colors.inkMuted },
  summaryCard: { width: "100%", maxWidth: 420, marginTop: spacing.sm },
  summaryTime: { fontSize: 11, fontWeight: "700", color: colors.orange, textTransform: "uppercase" },
  summaryTitle: { fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 2 },
  summarySub: { fontSize: 13, color: colors.inkMuted, marginTop: 2 },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: spacing.sm },
  linkText: { fontSize: 13, fontWeight: "600", color: colors.inkMuted },
  whatsappBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#25D366", width: "100%", paddingVertical: 12, borderRadius: radius.md },
  whatsappText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  reminderBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: colors.hairline, width: "100%", paddingVertical: 12, borderRadius: radius.md },
  reminderText: { color: colors.inkNavy, fontWeight: "600", fontSize: 14 },
  reminderDone: { color: colors.success, fontWeight: "600", fontSize: 13 },
  methodCard: { flexDirection: "row", alignItems: "center", width: "100%", borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  methodTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  methodSub: { fontSize: 13, color: colors.inkMuted, marginTop: 2 },
});
