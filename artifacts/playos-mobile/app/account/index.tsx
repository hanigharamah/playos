import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Linking, Alert, Platform, AppState, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { ArrowLeft, User as UserIcon, Smartphone, CreditCard, Coins, Globe, FileText, Lock, Bell, Camera } from "lucide-react-native";
import * as Notifications from "expo-notifications";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import { useGetMe, useGetMyCredits, useSignedAvatarUrls, useUploadMyAvatar, useSetAvatarPreset } from "@/lib/api";
import { allAvatarPresets } from "@/lib/avatarPresets";
import { registerForPush } from "@/lib/notifications";
import { resetAnalytics, track, screen } from "@/lib/analytics";
import { colors, spacing } from "@/lib/theme";

// Exact palette from the Figma Settings screen (node 357:510)
const INK = "#1C1C1E";
const MUTED = "#6C6C70";

/** Canonical legal text lives on the web so it can't drift between surfaces. */
const TERMS_URL = "https://playos.sa/terms";
const PRIVACY_URL = "https://playos.sa/privacy";

/**
 * Mask the stored number without inventing its shape. The previous version
 * rendered every value as `+966 5• ••• ••XX`, so a landline or a non-Saudi
 * number was displayed as a Saudi mobile — a country code and leading digit
 * that were never in the data.
 */
function maskPhone(phone?: string | null) {
  const raw = phone?.trim();
  if (!raw) return "not set";
  if (raw.length <= 2) return raw;
  const tail = raw.slice(-2);
  const head = raw.startsWith("+") ? raw.slice(0, 4) : "";
  return `${head}${head ? " " : ""}${"•".repeat(Math.max(2, Math.min(8, raw.length - tail.length - head.length)))}${tail}`;
}

export default function Settings() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { language, toggleLanguage } = useI18n();
  const { data: me } = useGetMe();
  const { data: credits = 0 } = useGetMyCredits();
  const [pushGranted, setPushGranted] = useState(false);
  // me.avatarUrl is a private-bucket object path, not something <Image> can
  // fetch — it has to be signed before it can be shown.
  const { data: avatarUrls } = useSignedAvatarUrls([me?.avatarUrl]);
  const uploadAvatar = useUploadMyAvatar();
  const setPreset = useSetAvatarPreset();
  const myAvatarUri = me?.avatarUrl ? avatarUrls?.[me.avatarUrl] : undefined;

  useEffect(() => {
    screen("Settings");
    const read = () => Notifications.getPermissionsAsync().then(({ status }) => setPushGranted(status === "granted"));
    read();
    // The switch sends the user to iOS Settings to change this, so re-read it
    // when they come back — otherwise it keeps showing the old value.
    const sub = AppState.addEventListener("change", (state) => { if (state === "active") read(); });
    return () => sub.remove();
  }, []);

  const togglePush = async (next: boolean) => {
    if (!next || pushGranted) {
      // The OS owns this switch once granted — send them to system settings.
      Linking.openSettings();
      return;
    }
    if (!me?.id) return;
    const result = await registerForPush(me.id);
    setPushGranted(result.status === "granted");
    track(result.status === "granted" ? "reminder_enabled" : "reminder_denied", {
      source: "settings",
      result: result.status,
    });
  };

  /**
   * Pick a square photo and upload it.
   *
   * allowsEditing + aspect [1,1] hands the crop to the OS, which gives an
   * actual square rather than a rectangle the avatar disc quietly centre-crops
   * — the player sees what everyone else will see. quality 0.7 keeps a typical
   * iPhone photo in the low hundreds of KB, well under the bucket's 5 MB cap,
   * on a disc that renders at 26pt on the promo card.
   */
  const pickAvatar = async () => {
    if (uploadAvatar.isPending) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      // Once iOS has been told no, asking again is a no-op — the only route
      // back is Settings, so say that instead of silently doing nothing.
      Alert.alert(
        "Photo access is off",
        perm.canAskAgain
          ? "PlayOS needs access to your photos to set a profile photo."
          : "Turn on photo access for PlayOS in Settings to set a profile photo.",
        perm.canAskAgain
          ? [{ text: "OK" }]
          : [{ text: "Cancel", style: "cancel" }, { text: "Open Settings", onPress: () => Linking.openSettings() }],
      );
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (picked.canceled) return;
    const asset = picked.assets?.[0];
    if (!asset?.uri) return;

    try {
      await uploadAvatar.mutateAsync({ uri: asset.uri, mimeType: asset.mimeType });
      track("avatar_updated", { source: "settings" });
    } catch (err) {
      // The upload runs before the column is written, so a failure here has
      // left the old photo in place — nothing to roll back, and offering the
      // retry is the whole recovery path.
      const message = (err as { data?: { error?: string } })?.data?.error;
      track("avatar_update_failed", { source: "settings", reason: message ?? "unknown" });
      Alert.alert(
        "Photo not saved",
        message ? `${message}` : "Something went wrong uploading your photo. Check your connection and try again.",
        [{ text: "Cancel", style: "cancel" }, { text: "Try again", onPress: pickAvatar }],
      );
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign out?", "You'll need to sign in again to book matches.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          resetAnalytics();
          await signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const Row = ({
    icon, label, value, onPress,
  }: { icon: React.ReactNode; label: string; value?: string; onPress?: () => void }) => (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={styles.rowLabel}>{label}</Text>
      {!!value && <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <BlurView intensity={Platform.OS === "ios" ? 20 : 0} tint="light" style={styles.backBtn}>
            <ArrowLeft size={20} color={INK} strokeWidth={2} />
          </BlurView>
        </Pressable>
        <Text style={styles.title}>settings</Text>
      </View>

      {/* The photo, and the only place to set one. <Avatar> falls back to the
          gradient initial whenever uri is undefined — no photo yet, or a
          signed URL that could not be minted — so this disc is never empty. */}
      <Pressable style={styles.avatarBlock} onPress={pickAvatar} disabled={uploadAvatar.isPending}>
        <View>
          <Avatar name={me?.name ?? "?"} uri={myAvatarUri} preset={me?.avatarPreset} size={84} />
          {uploadAvatar.isPending ? (
            // Indeterminate on purpose. supabase-js uploads over fetch, which
            // reports no progress events, and a cropped avatar is a sub-second
            // transfer — a percentage here would be invented, not measured.
            <View style={styles.avatarBusy}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : (
            <View style={styles.avatarBadge}>
              <Camera size={14} color="#FFFFFF" strokeWidth={2} />
            </View>
          )}
        </View>
        <Text style={styles.avatarHint}>
          {uploadAvatar.isPending ? "uploading…" : me?.avatarUrl ? "change photo" : "add a photo"}
        </Text>
      </Pressable>

      {/* The cartoon row. Listed BELOW the photo because a photo outranks it,
          but it is the option that actually gets used on day one: a photo
          needs an upload nobody has done yet, and initials give ~35 players
          about nine distinguishable discs. One tap, one column write, no
          permission prompt. Hidden once a photo exists, since the photo wins
          and offering a choice that changes nothing is a dead control. */}
      {!me?.avatarUrl && (
        <View style={styles.presetBlock}>
          <Text style={styles.presetLabel}>or pick a character</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetRow}
          >
            {allAvatarPresets(52).map(({ id }) => {
              const chosen = me?.avatarPreset === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setPreset.mutate({ preset: chosen ? null : id })}
                  disabled={setPreset.isPending}
                  style={[styles.presetPick, chosen && styles.presetPickOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: chosen }}
                  accessibilityLabel={`Character ${id}${chosen ? ", selected" : ""}`}
                >
                  <Avatar name="?" preset={id} size={52} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <Text style={styles.section}>ACCOUNT</Text>
      <Row icon={<UserIcon size={22} color={INK} strokeWidth={1.8} />} label="personal info" value={me?.name ?? "—"} />
      <Row icon={<Smartphone size={22} color={INK} strokeWidth={1.8} />} label="phone number" value={maskPhone(me?.phone)} />

      <Text style={styles.section}>PAYMENT</Text>
      {/* No saved-card storage exists yet — showing the real state, not a mock card. */}
      <Row icon={<CreditCard size={22} color={INK} strokeWidth={1.8} />} label="payment methods" value="not set up" />
      <Row
        icon={<Coins size={22} color={INK} strokeWidth={1.8} />}
        label="wallet"
        value={`${credits} ${credits === 1 ? "token" : "tokens"}`}
      />

      <Text style={styles.section}>PREFERENCES</Text>
      <Row
        icon={<Globe size={22} color={INK} strokeWidth={1.8} />}
        label="language"
        value={language === "ar" ? "العربية" : "English"}
        onPress={toggleLanguage}
      />
      <View style={styles.notifRow}>
        <Text style={styles.rowLabel}>push notifications</Text>
        <Switch
          value={pushGranted}
          onValueChange={togglePush}
          trackColor={{ false: "#E2DED8", true: "#FF8A00" }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#E2DED8"
        />
      </View>
      {/* Per-message preferences (Figma 699:726) — only reachable once the
          OS-level permission is actually granted. */}
      {pushGranted && (
        <Row
          icon={<Bell size={22} color={INK} strokeWidth={1.8} />}
          label="what we notify you about"
          onPress={() => router.push("/account/notifications")}
        />
      )}

      <Text style={styles.section}>LEGAL</Text>
      <Row
        icon={<FileText size={22} color={INK} strokeWidth={1.8} />}
        label="terms of service"
        onPress={() => Linking.openURL(TERMS_URL)}
      />
      <Row
        icon={<Lock size={22} color={INK} strokeWidth={1.8} />}
        label="privacy policy"
        onPress={() => Linking.openURL(PRIVACY_URL)}
      />

      <Pressable style={styles.signOut} onPress={handleSignOut}>
        <Text style={styles.signOutText}>sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const rowSurface = {
  backgroundColor: "rgba(255,255,255,0.55)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.85)",
  shadowColor: "#8C5926",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.14,
  shadowRadius: 18,
  elevation: 3,
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0" },
  content: { paddingHorizontal: 20, paddingTop: spacing.xxl, paddingBottom: spacing.xxl * 2 },

  header: { flexDirection: "row", alignItems: "center", gap: 28 },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
  },
  title: { fontSize: 20, fontWeight: "600", color: INK },

  section: { fontSize: 12, fontWeight: "600", color: MUTED, marginTop: spacing.xl, marginBottom: 10, marginLeft: 4 },

  avatarBlock: { alignItems: "center", marginTop: spacing.xl, gap: 10 },
  // Sits on the disc's lower-right, the conventional "editable" affordance.
  avatarBadge: {
    position: "absolute", right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#FF8A00", borderWidth: 2, borderColor: "#FFF8F0",
  },
  // Covers the whole disc rather than sitting beside it, so it reads as "this
  // photo is being replaced" and doubles as the disabled state.
  avatarBusy: {
    ...StyleSheet.absoluteFillObject, borderRadius: 42,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(28,28,30,0.45)",
  },
  presetBlock: { marginTop: 18 },
  presetLabel: { fontSize: 12, fontWeight: "600", color: MUTED, marginLeft: 20, marginBottom: 10 },
  presetRow: { gap: 10, paddingHorizontal: 20, paddingVertical: 4 },
  // Tapping the chosen one clears it, so the ring has to be unmistakable.
  presetPick: { borderRadius: 28, padding: 2, borderWidth: 2, borderColor: "transparent" },
  presetPickOn: { borderColor: colors.orange },
  avatarHint: { fontSize: 13, fontWeight: "600", color: "#C96A00" },

  row: { ...rowSurface, flexDirection: "row", alignItems: "center", height: 54, borderRadius: 16, paddingHorizontal: 11, marginBottom: 8 },
  rowIcon: { width: 22, alignItems: "center" },
  rowLabel: { flex: 1, fontSize: 15, color: INK, marginLeft: 12 },
  rowValue: { fontSize: 13, color: MUTED, maxWidth: 140, marginRight: 8 },
  chevron: { fontSize: 16, color: MUTED },

  notifRow: {
    ...rowSurface,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    height: 54, borderRadius: 16, paddingHorizontal: 19,
    backgroundColor: "rgba(255,255,255,0.5)",
    shadowOpacity: 0.1, shadowRadius: 10,
  },

  signOut: {
    height: 50, alignItems: "center", justifyContent: "center", borderRadius: 16,
    backgroundColor: "#FFFFFF", marginTop: spacing.xxl,
  },
  signOutText: { fontSize: 15, fontWeight: "600", color: "#BF2626" },
});
