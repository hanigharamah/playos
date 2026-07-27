import { View, Text, StyleSheet, type ViewStyle } from "react-native";

/**
 * Tone map, verbatim from the Figma annotation:
 *   red = a blocker · amber = a warning the user can override ·
 *   green = a confirmation · grey = neutral context ·
 *   blue = an open product question and MUST NOT SHIP.
 */
export type CalloutTone = "blocker" | "warning" | "confirm" | "neutral";

const TONE: Record<CalloutTone, { bg: string; accent: string; disc: string }> = {
  blocker: { bg: "rgba(253,228,228,0.7)", accent: "#BF2626", disc: "rgba(191,38,38,0.15)" },
  warning: { bg: "rgba(255,238,214,0.7)", accent: "#C96A00", disc: "rgba(201,106,0,0.15)" },
  confirm: { bg: "rgba(224,242,224,0.7)", accent: "#268033", disc: "rgba(38,128,51,0.15)" },
  neutral: { bg: "rgba(242,242,244,0.6)", accent: "#6C6C70", disc: "rgba(108,108,112,0.15)" },
};

interface Props {
  tone?: CalloutTone;
  /** Glyph rendered in the 24px tinted disc. */
  icon?: React.ReactNode;
  title?: string;
  body?: string;
  style?: ViewStyle;
}

/**
 * Callout block — 350 wide, radius 18, hugs its content so copy length is
 * free. 24px icon disc tinted 15% of the accent. Title Inter SemiBold 15.5
 * in the accent colour, body Inter Regular 13 in #6C6C70.
 */
export function Callout({ tone = "neutral", icon, title, body, style }: Props) {
  const t = TONE[tone];
  return (
    <View style={[styles.wrap, { backgroundColor: t.bg }, style]}>
      {(icon || title) && (
        <View style={styles.head}>
          {icon && <View style={[styles.disc, { backgroundColor: t.disc }]}>{icon}</View>}
          {title && <Text style={[styles.title, { color: t.accent }]}>{title}</Text>}
        </View>
      )}
      {body && <Text style={styles.body}>{body}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 18, paddingHorizontal: 19, paddingVertical: 19 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  disc: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15.5, fontWeight: "600", flex: 1 },
  body: { fontSize: 13, color: "#6C6C70", lineHeight: 19, marginTop: 10 },
});
