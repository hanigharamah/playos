import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSendWhatsAppCode, useVerifyWhatsAppCode } from "@/lib/api";
import { formatSaudiMobile } from "@/lib/phone";
import { identifyUser, track } from "@/lib/analytics";
import { Btn3D } from "@/components/Btn3D";
import { WarmCanvas } from "@/components/WarmCanvas";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { colors, spacing, radius } from "@/lib/theme";

const INK = "#1C1C1E";
const MUTED = "#6C6C70";

/** Supabase's phone OTP is 6 digits. */
const CODE_LENGTH = 6;
/** How long before "resend" becomes tappable. Supabase rate-limits below this anyway. */
const RESEND_SECONDS = 45;

/**
 * Sign in with WhatsApp — step 2, the code.
 *
 * Deliberately ONE input rather than six boxes. Six-box OTP fields are a
 * perennial source of paste bugs, backspace bugs and screen-reader confusion,
 * and WhatsApp codes get pasted far more often than SMS ones because the
 * message is one tap away in another app.
 */
export default function VerifyCode() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const verify = useVerifyWhatsAppCode();
  const resend = useSendWhatsAppCode();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const submitted = useRef(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const submit = (value?: string) => {
    const token = (value ?? code).trim();
    if (token.length !== CODE_LENGTH || !phone) return;
    setError(null);
    verify.mutate(
      { phone, token },
      {
        onSuccess: (user) => {
          identifyUser(user.id);
          track("player_logged_in", { method: "whatsapp" });
          // Through "/" so the one route that decides where a session opens —
          // onboarding, operator hub, or storefront — stays the only one.
          router.replace("/");
        },
        onError: (err: any) => {
          submitted.current = false;
          setError(err?.data?.error ?? "That code didn't work.");
        },
      },
    );
  };

  /**
   * Auto-submit on the sixth digit, but only once per code.
   *
   * Without the ref, a failed verification leaves six digits in the field and
   * every subsequent keystroke re-fires the mutation — which is both a bad
   * experience and a fast route into Supabase's rate limit.
   */
  const onChange = (t: string) => {
    const digits = t.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    setError(null);
    if (digits.length === CODE_LENGTH && !submitted.current) {
      submitted.current = true;
      submit(digits);
    }
    if (digits.length < CODE_LENGTH) submitted.current = false;
  };

  const doResend = () => {
    if (secondsLeft > 0 || !phone) return;
    setError(null);
    setCode("");
    submitted.current = false;
    resend.mutate(
      { phone },
      {
        onSuccess: () => { setSecondsLeft(RESEND_SECONDS); track("whatsapp_code_resent"); },
        onError: (err: any) => setError(err?.data?.error ?? "Couldn't resend the code."),
      },
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <WarmCanvas base="#FFF8F0" glows={[{ cx: 0.8, cy: 0.12, r: 0.9, color: "rgba(255,225,204,0.34)" }]} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <HandwrittenHeader style={styles.header}>enter the code</HandwrittenHeader>
          <Text style={styles.sub}>
            Sent on WhatsApp to {phone ? formatSaudiMobile(phone) : "your number"}.
          </Text>

          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={onChange}
            keyboardType="number-pad"
            // Lets iOS offer the code from the notification without leaving
            // the app. Works for WhatsApp-delivered codes too.
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            autoFocus
            maxLength={CODE_LENGTH}
            placeholder="••••••"
            placeholderTextColor="#CFC9C4"
            editable={!verify.isPending}
            accessibilityLabel="Verification code"
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.cta}>
            <Btn3D
              label="sign in"
              onPress={() => submit()}
              loading={verify.isPending}
              disabled={code.length !== CODE_LENGTH}
            />
          </View>

          <Pressable
            onPress={doResend}
            disabled={secondsLeft > 0 || resend.isPending}
            hitSlop={8}
            style={styles.resend}
          >
            <Text style={[styles.resendText, secondsLeft > 0 && styles.resendTextOff]}>
              {resend.isPending
                ? "sending…"
                : secondsLeft > 0
                  ? `resend in ${secondsLeft}s`
                  : "resend the code"}
            </Text>
          </Pressable>

          {/* A wrong number is the most likely reason a code never arrives, and
              it cannot be fixed from this screen. */}
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.alt}>
            <Text style={styles.altText}>use a different number</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 90, paddingBottom: 40 },
  header: { fontSize: 38, color: colors.orange },
  sub: { fontSize: 14.5, color: MUTED, marginTop: 6, marginBottom: 28, lineHeight: 21 },

  codeInput: {
    minHeight: 62, borderRadius: radius.md, paddingHorizontal: 18,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    fontSize: 30, fontWeight: "700", color: INK,
    letterSpacing: 12, textAlign: "center",
  },
  error: { fontSize: 13, color: "#BF2626", marginTop: 12, lineHeight: 19 },

  cta: { marginTop: 24 },
  resend: { marginTop: 18, alignSelf: "center", minHeight: 44, justifyContent: "center" },
  resendText: { fontSize: 14, fontWeight: "600", color: colors.orange },
  resendTextOff: { color: MUTED },

  alt: { marginTop: spacing.md, alignSelf: "center", minHeight: 44, justifyContent: "center" },
  altText: { fontSize: 13.5, color: MUTED },
});
