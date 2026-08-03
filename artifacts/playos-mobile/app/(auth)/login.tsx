import { useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { useRouter, Link } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
import { useLogin } from "@/lib/api";
import { identifyUser, track } from "@/lib/analytics";
import { Btn3D } from "@/components/Btn3D";
import { WarmCanvas } from "@/components/WarmCanvas";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { colors, spacing, radius } from "@/lib/theme";

/**
 * Sign in. This and signup are the only screens every player passes through,
 * so they carry the app's own language — warm canvas, glass fields, the Btn3D
 * primary — rather than the stock white-box form they used to be.
 *
 * The autofill props are load-bearing, not polish: without textContentType iOS
 * never offers to save or fill the credential, which is how a player ends up
 * locked out with no saved password. Signup uses `newPassword` for the same
 * reason — it is what triggers the Strong Password sheet.
 */
export default function Login() {
  const router = useRouter();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const canSubmit = !!email.trim() && !!password;

  const submit = () => {
    setError(null);
    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: (user) => {
          identifyUser(user.id);
          track("player_logged_in");
          router.replace("/(tabs)");
        },
        onError: (err: any) => setError(err?.data?.error ?? "Invalid credentials"),
      },
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <WarmCanvas base={colors.creamDeep} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <HandwrittenHeader style={styles.title}>PlayOS</HandwrittenHeader>
          <Text style={styles.subtitle}>Sign in to book your next game</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.inkFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              value={email}
              onChangeText={setEmail}
            />

            <View>
              <TextInput
                ref={passwordRef}
                style={[styles.input, styles.inputWithAction]}
                placeholder="Password"
                placeholderTextColor={colors.inkFaint}
                secureTextEntry={!reveal}
                textContentType="password"
                autoComplete="password"
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

            <Pressable onPress={() => router.push("/(auth)/forgot-password")} hitSlop={8} style={styles.forgot}>
              <Text style={styles.forgotText}>forgot your password?</Text>
            </Pressable>

            {error && <Text style={styles.error}>{error}</Text>}

            <Btn3D label="Sign In" onPress={submit} loading={login.isPending} disabled={!canSubmit} />

            <Link href="/(auth)/signup" style={styles.link}>
              <Text style={styles.linkText}>New here? Create an account</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, padding: spacing.xl, justifyContent: "center" },
  title: { fontSize: 56, textAlign: "center", marginBottom: 4 },
  subtitle: { textAlign: "center", color: colors.inkMuted, marginBottom: spacing.xxl },
  form: { gap: spacing.md },
  input: {
    // Glass on the warm canvas, not a pure-white box with a cold iOS-grey
    // hairline — that read as a stock form template bolted onto the app.
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
  forgot: { alignSelf: "flex-end", paddingVertical: 2 },
  forgotText: { fontSize: 13, fontWeight: "600", color: colors.inkMuted },
  error: { color: colors.danger, fontSize: 13, textAlign: "center" },
  link: { marginTop: spacing.md, alignItems: "center" },
  linkText: { color: colors.orange, fontWeight: "600" },
});
