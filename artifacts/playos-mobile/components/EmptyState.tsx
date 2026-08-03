import { View, Text, StyleSheet } from "react-native";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { BtnOutline } from "@/components/BtnOutline";
import { GlassCard } from "@/components/GlassCard";
import { spacing } from "@/lib/theme";

interface Props {
  /** Icon rendered inside the peach halo (lucide icon at ~34px). */
  icon: React.ReactNode;
  /** Script headline, e.g. "no games booked yet". */
  title: string;
  /** One-line explanation under the headline. */
  body: string;
  /** Optional primary action, rendered as the app's glass CTA. */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Shared empty-state layout — exact port of the Figma empty screens
 * (Bookings-Empty 353:400, Chats-Empty 353:471, Activity-Empty 353:546):
 * peach halo badge, script headline, muted body — with the mock's lavender
 * gradient CTA deliberately replaced by glass, see the note at the call site.
 */
export function EmptyState({ icon, title, body, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.halo}>{icon}</View>
      <HandwrittenHeader style={styles.title}>{title}</HandwrittenHeader>
      <Text style={styles.body}>{body}</Text>
      {/*
       * Glass, not the mock's pink-to-lavender gradient. That CTA was the only
       * thing in the app in that colour family — 20pt purple text on pink over
       * cream, under a magenta glow — and it appears on the empty Bookings,
       * Activity and Chats screens, so it read as a different app's button.
       * BtnOutline in the accent tone puts it in the same liquid glass as
       * every other surface, with warm amber text carrying the action.
       */}
      {actionLabel && onAction && (
        <BtnOutline label={actionLabel} tone="accent" onPress={onAction} style={styles.cta} />
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
 * with a peach halo and a primary CTA. These newer screens put the message
 * in a card so real content can sit underneath it.
 */
export function EmptyCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <GlassCard variant="soft" round={22} padding={0} style={styles.card}>
      <View style={styles.cardInner}>
        <View style={styles.disc}>{icon}</View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardBody}>{body}</Text>
      </View>
    </GlassCard>
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
  // Geometry and shadow come from BtnOutline; only the spacing above is ours.
  cta: { marginTop: 34, alignSelf: "stretch" },

  // Width constraints stay on the outer glass; the box the content fills sits
  // on the inner view. Fill, stroke and shadows come from <GlassCard>.
  card: { alignSelf: "stretch", maxWidth: 350 },
  cardInner: {
    // minHeight + real bottom padding, not a fixed 148. The mock's card holds
    // a one-line body; a two-line body stacks to ~157 and spilled out of the
    // bottom edge, which is what "overlapping text and boxes" looked like.
    minHeight: 148, paddingBottom: 19, alignItems: "center",
  },
  disc: {
    width: 64, height: 64, borderRadius: 32, marginTop: 19, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(240,232,224,0.9)",
  },
  cardTitle: { fontSize: 18, fontWeight: "600", color: "#1C1C1E", textAlign: "center", marginTop: 14, paddingHorizontal: 20 },
  cardBody: { fontSize: 13, color: "#6C6C70", textAlign: "center", marginTop: 6, paddingHorizontal: 20 },

  eyebrow: { fontSize: 11, fontWeight: "600", color: "#6C6C70", letterSpacing: 0.3, marginLeft: 4 },
});
