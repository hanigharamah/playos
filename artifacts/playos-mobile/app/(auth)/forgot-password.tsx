import { useState } from "react";
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRequestPasswordReset } from "@/lib/api";
import { Btn3D } from "@/components/Btn3D";
import { WarmCanvas } from "@/components/WarmCanvas";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { colors, spacing, radius } from "@/lib/theme";

/**
 * Password recovery — the app had none at all. A player who mistypes their
 * password on match day had no way back in except texting the operator, who
 * at that moment is working the phone on T-10 no-shows.
 *
 * The confirmation is deliberately unconditional: it says "if that address
 * has an account" rather than confirming one exists, because a screen that
 * distinguishes the two tells anyone who asks which emails are registered.
 */
export default function ForgotPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reset = useRequestPasswordReset();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    reset.mutate(
      { email: email.trim() },
      {
        onSuccess: () => setSent(true),
        onError: (err: any) =>
          setError(err?.data?.error ?? "Couldn't send the email — please try again."),
      },
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <WarmCanvas base={colors.creamDeep} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.wrap, { paddingTop: insets.top + spacing.lg }]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityLabel="Back">
            <ArrowLeft size={20} color={colors.ink} strokeWidth={2} />
          </Pressable>

          <View style={styles.body}>
            <HandwrittenHeader style={styles.title}>
              {sent ? "check your email" : "forgot your password?"}
            </HandwrittenHeader>

            {sent ? (
              <>
                <Text style={styles.subtitle}>
                  If {email.trim()} has an account, a link to set a new password is on its way.
                </Text>
                <Btn3D label="Back to sign in" onPress={() => router.back()} style={styles.cta} />
              </>
            ) : (
              <>
                <Text style={styles.subtitle}>
                  Enter the email you signed up with and we'll send you a link to set a new one.
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={colors.inkFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                  returnKeyType="go"
                  onSubmitEditing={() => email.trim() && submit()}
                  value={email}
                  onChangeText={setEmail}
                />

                {error && <Text style={styles.error}>{error}</Text>}

                <Btn3D
                  label="Send reset link"
                  onPress={submit}
                  loading={reset.isPending}
                  disabled={!email.trim()}
                  style={styles.cta}
                />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  back: { height: 28, width: 28, justifyContent: "center" },
  body: { flex: 1, justifyContent: "center" },
  title: { fontSize: 34, textAlign: "center", marginBottom: spacing.sm },
  subtitle: { textAlign: "center", color: colors.inkMuted, marginBottom: spacing.xl, lineHeight: 20 },
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
  error: { color: colors.danger, fontSize: 13, textAlign: "center", marginTop: spacing.md },
  cta: { marginTop: spacing.xl },
});
