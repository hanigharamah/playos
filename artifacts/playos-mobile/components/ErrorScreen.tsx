import { View, Text, StyleSheet, ScrollView, Pressable, Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { ArrowLeft } from "lucide-react-native";
import { DotWaveBackground } from "@/components/DotWaveBackground";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { Btn3D } from "@/components/Btn3D";
import { BtnOutline } from "@/components/BtnOutline";
import { spacing } from "@/lib/theme";

interface Props {
  /** Script headline, e.g. "something broke on our end". */
  title: string;
  /**
   * Hero card. Optional: Session expired (684:520) has no hero card in its
   * mock — the reassurance line sits directly on the page instead, see
   * `subline`. Pass all three or none.
   */
  heroIcon?: React.ReactNode;
  heroTint?: string;
  heroLine?: string;
  /** Reassurance line rendered on the page rather than inside a hero card. */
  subline?: string;
  /** Title size — 26 alongside a back button, 38 when the title owns the row. */
  titleSize?: number;
  /** Tone-mapped callout under the hero card. */
  callout?: React.ReactNode;
  /** Anything extra between the callout and the buttons. */
  children?: React.ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryLoading?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Plain centred text link, where the mock has no outline button. */
  textLinkLabel?: string;
  onTextLink?: () => void;
  /** Monospace-ish reference chip, e.g. "PL-500 · 21:04 · tap to copy". */
  reference?: string;
  onReferencePress?: () => void;
  footnote?: string;
  onBack?: () => void;
}

/**
 * Shared layout for the error / dead-end screens on the Figma
 * "⚠️ Edge, Errors & Ops" page (Server 500 684:494 is the reference build).
 *
 * Follows the design-system annotations: dot wave at 0.75 opacity, a single
 * glass container style, one primary btn-3d, stacked btn-outline secondary.
 * The status bar is intentionally not drawn — the OS renders it.
 */
export function ErrorScreen({
  title, heroIcon, heroTint, heroLine, subline, titleSize, callout, children,
  primaryLabel, onPrimary, primaryLoading,
  secondaryLabel, onSecondary, textLinkLabel, onTextLink,
  reference, onReferencePress, footnote, onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  return (
    <View style={styles.wrap}>
      <DotWaveBackground width={width} height={600} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 5 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {onBack && (
            // 42px visual, 44px minimum tap target via hitSlop.
            <Pressable onPress={onBack} hitSlop={8}>
              <BlurView intensity={Platform.OS === "ios" ? 20 : 0} tint="light" style={styles.backBtn}>
                <ArrowLeft size={20} color="#1C1C1E" strokeWidth={2} />
              </BlurView>
            </Pressable>
          )}
          <HandwrittenHeader style={[styles.title, titleSize ? { fontSize: titleSize } : null]}>{title}</HandwrittenHeader>
        </View>

        {heroIcon && heroLine && (
          <View style={styles.heroCard}>
            <View style={[styles.heroDisc, { backgroundColor: heroTint }]}>{heroIcon}</View>
            <Text style={styles.heroLine}>{heroLine}</Text>
          </View>
        )}

        {subline && <Text style={styles.subline}>{subline}</Text>}

        {callout}
        {children}

        <View style={styles.actions}>
          {primaryLabel && (
            <Btn3D label={primaryLabel} onPress={onPrimary} loading={primaryLoading} />
          )}
          {secondaryLabel && <BtnOutline label={secondaryLabel} onPress={onSecondary} />}
          {textLinkLabel && (
            <Pressable onPress={onTextLink} hitSlop={10}>
              <Text style={styles.textLink}>{textLinkLabel}</Text>
            </Pressable>
          )}
        </View>

        {reference && (
          <Pressable style={styles.reference} onPress={onReferencePress}>
            <Text style={styles.referenceText}>{reference}</Text>
          </Pressable>
        )}
        {footnote && <Text style={styles.footnote}>{footnote}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0" },
  // paddingTop comes from the safe-area inset at the call site; the fixed
  // value was smaller than the Dynamic Island's inset.
  content: { paddingHorizontal: 20, paddingBottom: spacing.xxl },

  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
  },
  title: { fontSize: 26, flex: 1 },

  heroCard: {
    height: 140, borderRadius: 24, marginTop: 26,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 3,
  },
  heroDisc: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  heroLine: { fontSize: 16, fontWeight: "600", color: "#1C1C1E", marginTop: 12 },

  actions: { marginTop: 64, gap: 12 },

  reference: {
    height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", marginTop: 20,
    backgroundColor: "rgba(242,242,244,0.6)",
  },
  referenceText: { fontSize: 12, color: "#858091" },
  subline: { fontSize: 15, fontWeight: "600", color: "#1C1C1E", marginTop: 22, marginLeft: 4 },
  textLink: { fontSize: 13.5, color: "#6C6C70", textAlign: "center", marginTop: 8 },
  footnote: { fontSize: 12.5, color: "#6C6C70", textAlign: "center", marginTop: 20 },
});
