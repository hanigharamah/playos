import { useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable, Linking } from "react-native";
import { useRouter, Link } from "expo-router";
import { Check, Eye, EyeOff } from "lucide-react-native";
import { useSignUp } from "@/lib/api";
import { identifyUser, track } from "@/lib/analytics";
import { Btn3D } from "@/components/Btn3D";
import { WarmCanvas } from "@/components/WarmCanvas";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { colors, spacing, radius } from "@/lib/theme";

const TERMS_URL = "https://playos.sa/terms";
const PRIVACY_URL = "https://playos.sa/privacy";

/** Enforced by the form; stated on screen so a greyed-out button is explicable. */
const MIN_PASSWORD = 6;

export default function Signup() {
  const router = useRouter();
  const signUp = useSignUp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // The money rules a player is agreeing to — cancel within 26h keeps the fee,
  // a missed check-in costs all of it — live in the Terms. Consent is taken
  // here rather than discovered the first time one of them bites.
  const canSubmit =
    !!name.trim() && !!email.trim() && !!phone.trim() && password.length >= MIN_PASSWORD && agreed;

  const submit = () => {
    setError(null);
    signUp.mutate(
      { name: name.trim(), email: email.trim(), phone: phone.trim(), password },
      {
        onSuccess: (user) => {
          identifyUser(user.id);
          track("player_signed_up");
          // Push permission is asked at first payment, not at install: a
          // player who has paid has a reason to want the check-in message,
          // and the opt-in rate at signup is not one we can build a forfeit
          // policy on. See app/checkout/[bookingId].tsx.
          router.replace("/(tabs)");
        },
        onError: (err: any) => setError(err?.data?.error ?? "Signup failed"),
      },
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <WarmCanvas base={colors.creamDeep} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <HandwrittenHeader style={styles.title}>Join PlayOS</HandwrittenHeader>
          <Text style={styles.subtitle}>Find and book games near you</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor={colors.inkFaint}
              textContentType="name"
              autoComplete="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              ref={emailRef}
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.inkFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              ref={phoneRef}
              style={styles.input}
              placeholder="Phone (e.g. 05xxxxxxxx)"
              placeholderTextColor={colors.inkFaint}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              value={phone}
              onChangeText={setPhone}
            />

            <View>
              <TextInput
                ref={passwordRef}
                style={[styles.input, styles.inputWithAction]}
                placeholder="Password"
                placeholderTextColor={colors.inkFaint}
                secureTextEntry={!reveal}
                // `newPassword` is what makes iOS offer to generate and save
                // one. Without it every player invents their own and forgets it.
                textContentType="newPassword"
                autoComplete="new-password"
                returnKeyType="go"
                onSubmitEditing={() => canSubmit && submit()}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable
                onPress={() => setReveal((v) => !v)}
                hitSlop={12}
                style={styles.reveal}
                accessibilityRole="button"
                accessibilityLabel={reveal ? "Hide password" : "Show password"}
              >
                {reveal
                  ? <EyeOff size={19} color={colors.inkMuted} strokeWidth={1.8} />
                  : <Eye size={19} color={colors.inkMuted} strokeWidth={1.8} />}
              </Pressable>
            </View>
            {/* Stated up front, not revealed by failure: the rule was enforced
                silently, so a 5-character password just greyed the button out
                with nothing on screen explaining why. */}
            <Text style={styles.hint}>at least {MIN_PASSWORD} characters</Text>

            <Pressable
              onPress={() => setAgreed((v) => !v)}
              style={styles.consent}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
            >
              <View style={[styles.box, agreed && styles.boxOn]}>
                {agreed && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <Text style={styles.consentText}>
                I agree to the{" "}
                {/* Real links, not label text — opened in the browser so an
                    in-progress signup is not lost behind them. */}
                <Text style={styles.consentLink} onPress={() => Linking.openURL(TERMS_URL)}>
                  Terms of Service
                </Text>
                {" "}and{" "}
                <Text style={styles.consentLink} onPress={() => Linking.openURL(PRIVACY_URL)}>
                  Privacy Policy
                </Text>
              </Text>
            </Pressable>

            {error && <Text style={styles.error}>{error}</Text>}

            <Btn3D label="Create Account" onPress={submit} loading={signUp.isPending} disabled={!canSubmit} />

            <Link href="/(auth)/login" style={styles.link}>
              <Text style={styles.linkText}>Already have an account? Sign in</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, padding: spacing.xl, justifyContent: "center" },
  title: { fontSize: 48, textAlign: "center", marginBottom: 4 },
  subtitle: { textAlign: "center", color: colors.inkMuted, marginBottom: spacing.xxl },
  form: { gap: spacing.md },
  input: {
    backgroundColor: colors.glassFill,
    borderWidth: 1,
    borderColor: colors.glassStroke,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.ink,
    shadowColor: colors.warmShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  inputWithAction: { paddingRight: 48 },
  reveal: { position: "absolute", right: 0, top: 0, bottom: 0, width: 46, alignItems: "center", justifyContent: "center" },
  hint: { fontSize: 12, color: colors.inkMuted, marginTop: -spacing.xs, marginLeft: 4 },

  // The whole row is the target, not the 20pt box.
  consent: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 6 },
  box: {
    width: 22, height: 22, borderRadius: 7, marginTop: 1,
    borderWidth: 1.5, borderColor: colors.inkFaint,
    alignItems: "center", justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  consentText: { flex: 1, fontSize: 13, color: colors.inkMuted, lineHeight: 19 },
  consentLink: { color: colors.orange, fontWeight: "600" },

  error: { color: colors.danger, fontSize: 13, textAlign: "center" },
  link: { marginTop: spacing.md, alignItems: "center" },
  linkText: { color: colors.orange, fontWeight: "600" },
});
