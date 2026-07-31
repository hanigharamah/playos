import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { spacing } from "@/lib/theme";

interface Props {
  /** Icon rendered inside the peach halo (lucide icon at ~34px). */
  icon: React.ReactNode;
  /** Script headline, e.g. "no games booked yet". */
  title: string;
  /** One-line explanation under the headline. */
  body: string;
  /** Optional lavender gradient CTA. */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Shared empty-state layout — exact port of the Figma empty screens
 * (Bookings-Empty 353:400, Chats-Empty 353:471, Activity-Empty 353:546):
 * peach halo badge, script headline, muted body, lavender gradient CTA.
 */
export function EmptyState({ icon, title, body, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.halo}>{icon}</View>
      <HandwrittenHeader style={styles.title}>{title}</HandwrittenHeader>
      <Text style={styles.body}>{body}</Text>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, width: "100%" }]}>
          <LinearGradient
            colors={["rgba(251,193,244,0.95)", "rgba(224,201,252,0.95)", "rgba(198,197,252,0.95)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>{actionLabel}</Text>
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );
}

/**
 * The 350×148 glass card that heads the launch-backlog empty states
 * (Figma 697:511 / 697:554 / 697:595 — byte-identical in all three): pale
 * 64px disc, 18px semibold headline, 13px muted line under it.
 *
 * Distinct from <EmptyState /> above, which is the older full-page layout
 * with a peach halo and a lavender CTA. These newer screens put the message
 * in a card so real content can sit underneath it.
 */
export function EmptyCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.disc}>{icon}</View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
    </View>
  );
}

/** Section eyebrow — 11px semibold muted caps, used above the real content. */
export function EmptyEyebrow({ children }: { children: string }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingTop: 90, paddingHorizontal: 4 },
  halo: {
    width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,214,181,0.45)",
    shadowColor: "#E5924D", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 4,
  },
  title: { fontSize: 20, marginTop: 26, textAlign: "center" },
  body: { fontSize: 14, color: "#6C6C70", textAlign: "center", marginTop: 12, paddingHorizontal: spacing.lg },
  cta: {
    height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", marginTop: 34,
    shadowColor: "#D973D9", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 30, elevation: 6,
  },
  ctaText: { fontSize: 20, fontWeight: "700", color: "#6630F7" },

  card: {
    alignSelf: "stretch", maxWidth: 350, height: 148, borderRadius: 22, alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  disc: {
    width: 64, height: 64, borderRadius: 32, marginTop: 19, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(240,232,224,0.9)",
  },
  cardTitle: { fontSize: 18, fontWeight: "600", color: "#1C1C1E", textAlign: "center", marginTop: 14, paddingHorizontal: 20 },
  cardBody: { fontSize: 13, color: "#6C6C70", textAlign: "center", marginTop: 6, paddingHorizontal: 20 },

  eyebrow: { fontSize: 11, fontWeight: "600", color: "#6C6C70", letterSpacing: 0.3, marginLeft: 4 },
});
