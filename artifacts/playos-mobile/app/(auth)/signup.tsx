import { useState } from "react";
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter, Link } from "expo-router";
import { useSignUp } from "@/lib/api";
import { identifyUser, track } from "@/lib/analytics";
import { PillButton } from "@/components/PillButton";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { colors, spacing, radius } from "@/lib/theme";

export default function Signup() {
  const router = useRouter();
  const signUp = useSignUp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim() && email.trim() && phone.trim() && password.length >= 6;

  const submit = () => {
    setError(null);
    signUp.mutate(
      { name: name.trim(), email: email.trim(), phone: phone.trim(), password },
      {
        onSuccess: (user) => {
          identifyUser(user.id);
          track("player_signed_up");
          // Onboarding first — this is the single moment every new player
          // passes through, where we ask about match reminders (SPEC.md §5).
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <HandwrittenHeader style={styles.title}>Join PlayOS</HandwrittenHeader>
        <Text style={styles.subtitle}>Find and book games near you</Text>

        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Name" placeholderTextColor={colors.inkFaint} value={name} onChangeText={setName} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone (e.g. 05xxxxxxxx)"
            placeholderTextColor={colors.inkFaint}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.inkFaint}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <PillButton label="Create Account" onPress={submit} loading={signUp.isPending} disabled={!canSubmit} fullWidth />

          <Link href="/(auth)/login" style={styles.link}>
            <Text style={styles.linkText}>Already have an account? Sign in</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, backgroundColor: colors.creamDeep, padding: spacing.xl, justifyContent: "center" },
  title: { fontSize: 48, textAlign: "center", marginBottom: 4 },
  subtitle: { textAlign: "center", color: colors.inkMuted, marginBottom: spacing.xxl },
  form: { gap: spacing.md },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.ink,
  },
  error: { color: colors.danger, fontSize: 13, textAlign: "center" },
  link: { marginTop: spacing.md, alignItems: "center" },
  linkText: { color: colors.orange, fontWeight: "600" },
});
