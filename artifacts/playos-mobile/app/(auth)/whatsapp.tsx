import { useState } from "react";
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { useRouter, Link } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import { useSendWhatsAppCode } from "@/lib/api";
import { isValidSaudiMobile, normalizeSaudiMobile } from "@/lib/phone";
import { track } from "@/lib/analytics";
import { Btn3D } from "@/components/Btn3D";
import { WarmCanvas } from "@/components/WarmCanvas";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { colors, spacing, radius } from "@/lib/theme";

const INK = "#1C1C1E";
const MUTED = "#6C6C70";

/**
 * Sign in with WhatsApp — step 1, the number.
 *
 * Supabase generates and verifies the code; Twilio only delivers it. See
 * useSendWhatsAppCode for why that split is the whole point.
 *
 * The number is validated BEFORE sending. A malformed number would otherwise
 * spend a Twilio message, fail at the provider, and show the player an error
 * about a number they cannot see was wrong — the field is where they can fix
 * it, so that is where it is checked.
 */
export default function WhatsAppSignIn() {
  const router = useRouter();
  const send = useSendWhatsAppCode();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = isValidSaudiMobile(phone);

  const submit = () => {
    setError(null);
    send.mutate(
      { phone },
      {
        onSuccess: ({ phone: e164 }) => {
          track("whatsapp_code_sent");
          router.push({ pathname: "/(auth)/verify", params: { phone: e164 } });
        },
        onError: (err: any) => setError(err?.data?.error ?? "Couldn't send the code."),
      },
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <WarmCanvas base="#FFF8F0" glows={[{ cx: 0.8, cy: 0.12, r: 0.9, color: "rgba(255,225,204,0.34)" }]} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <HandwrittenHeader style={styles.header}>sign in</HandwrittenHeader>
          <Text style={styles.sub}>
            We'll send a code to your WhatsApp. No password to remember.
          </Text>

          <Text style={styles.label}>mobile number</Text>
          <View style={styles.field}>
            <Text style={styles.prefix}>+966</Text>
            <TextInput
              style={styles.input}
              placeholder="5X XXX XXXX"
              placeholderTextColor="#A8A5A2"
              value={phone}
              onChangeText={(t) => { setPhone(t); setError(null); }}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              autoFocus
              returnKeyType="send"
              onSubmitEditing={() => canSubmit && submit()}
              // Arabic keyboards produce Arabic-Indic digits by default, and
              // lib/phone.ts folds them — so a player typing ٠٥٣ is accepted
              // rather than told their own number is invalid.
              maxLength={20}
            />
          </View>

          {/* Confirms what we are about to send to, canonicalised. Typing a
              local 05... and being shown +966 5... is how a player catches a
              wrong digit before spending a code on it. */}
          {canSubmit && (
            <Text style={styles.echo}>code goes to {normalizeSaudiMobile(phone)}</Text>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.cta}>
            <Btn3D
              label="send code on WhatsApp"
              onPress={submit}
              loading={send.isPending}
              disabled={!canSubmit}
            />
          </View>

          <View style={styles.note}>
            <MessageCircle size={14} color={MUTED} strokeWidth={1.8} />
            <Text style={styles.noteText}>
              The code arrives on the WhatsApp account for this number.
            </Text>
          </View>

          {/* Email sign-in stays. Existing players have passwords, WhatsApp
              delivery can be down, and a sign-in screen with exactly one route
              in is a screen that can lock everyone out. */}
          <Link href="/(auth)/login" asChild>
            <Pressable hitSlop={8} style={styles.alt}>
              <Text style={styles.altText}>use email and password instead</Text>
            </Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 90, paddingBottom: 40 },
  header: { fontSize: 38, color: colors.orange },
  sub: { fontSize: 14.5, color: MUTED, marginTop: 6, marginBottom: 28, lineHeight: 21 },

  label: { fontSize: 12.5, fontWeight: "600", color: MUTED, marginBottom: 8 },
  field: {
    flexDirection: "row", alignItems: "center", gap: 8,
    minHeight: 52, paddingHorizontal: 14, borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
  },
  prefix: { fontSize: 16, fontWeight: "600", color: MUTED },
  input: { flex: 1, fontSize: 16, color: INK, paddingVertical: 12 },
  echo: { fontSize: 12.5, color: MUTED, marginTop: 8 },
  error: { fontSize: 13, color: "#BF2626", marginTop: 12, lineHeight: 19 },

  cta: { marginTop: 26 },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 18 },
  noteText: { flex: 1, fontSize: 12.5, color: MUTED, lineHeight: 18 },

  alt: { marginTop: spacing.xl, alignSelf: "center", minHeight: 44, justifyContent: "center" },
  altText: { fontSize: 14, fontWeight: "600", color: colors.orange },
});
