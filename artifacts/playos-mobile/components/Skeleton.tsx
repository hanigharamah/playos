import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View, StyleSheet, ViewStyle } from "react-native";

/**
 * Loading skeletons (Figma "Loading · Home / Browse / Bookings skeleton",
 * nodes 698:518, 698:553, 698:595).
 *
 * The rule from the annotations: block geometry matches the real cards
 * exactly, so nothing jumps when data lands. Every number in this file is
 * lifted straight from the mocks — don't round them to a spacing scale.
 *
 * Two other annotation rules are honoured by the callers, not here:
 *  - show after 300ms, not immediately  -> useDelayedVisible()
 *  - if the request fails, replace with the server error screen, never leave
 *    the skeleton pulsing  -> each screen routes to /error/server on error
 */

/** Fill tones from the mocks. `b` is the lighter one used for pills/badges. */
const TONE_A = "rgba(232,224,216,0.9)";
const TONE_B = "rgba(240,230,220,0.9)";

/**
 * A skeleton is only worth showing if the wait is long enough to notice.
 * Under ~300ms it reads as a flash of noise, so hold it back.
 */
export function useDelayedVisible(active: boolean, delayMs = 300) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!active) { setVisible(false); return; }
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [active, delayMs]);
  return visible;
}

/** Shared pulse so every block on screen breathes in sync. */
function usePulse() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });
}

type BlockProps = {
  w: number | `${number}%`;
  h: number;
  r: number;
  tone?: "a" | "b";
  /**
   * Absolute offsets, used inside cards where the mock positions are exact.
   * `xr` anchors from the right instead — the mock's trailing pills all sit
   * 15px off the right edge, so they stay put on wider phones than the 390
   * the design was drawn at.
   */
  x?: number;
  xr?: number;
  y?: number;
  style?: ViewStyle;
};

export function SkelBlock({ w, h, r, tone = "a", x, xr, y, style }: BlockProps) {
  const opacity = usePulse();
  const positioned = x !== undefined || xr !== undefined || y !== undefined;
  return (
    <Animated.View
      style={[
        { width: w, height: h, borderRadius: r, backgroundColor: tone === "a" ? TONE_A : TONE_B, opacity },
        positioned && { position: "absolute", top: y ?? 0, ...(xr !== undefined ? { right: xr } : { left: x ?? 0 }) },
        style,
      ]}
    />
  );
}

/** The glass frame the real cards use — same fill, border, radius and shadow. */
export function SkelCard({ h, style, children }: { h: number; style?: ViewStyle; children?: React.ReactNode }) {
  return <View style={[styles.card, { height: h }, style]}>{children}</View>;
}

/* ── Home (698:518) ───────────────────────────────────────────────────── */

export function HomeSkeleton() {
  return (
    <View style={styles.body}>
      <SkelBlock w={150} h={14} r={7} style={{ marginLeft: 4 }} />

      {/* hero card — 350×196, mirrors the featured match card */}
      <SkelCard h={196} style={{ marginTop: 24 }}>
        <SkelBlock x={13} y={13} w={322} h={110} r={14} />
        <SkelBlock x={13} y={137} w={200} h={16} r={8} />
        <SkelBlock x={13} y={161} w={140} h={12} r={6} />
        <SkelBlock xr={15} y={135} w={90} h={36} r={18} tone="b" />
      </SkelCard>

      <SkelBlock w={120} h={12} r={6} style={{ marginTop: 24, marginLeft: 4 }} />

      {[0, 1].map((i) => (
        <SkelCard key={i} h={64} style={{ marginTop: i === 0 ? 12 : 16 }}>
          <SkelBlock x={11} y={11} w={40} h={40} r={10} />
          <SkelBlock x={65} y={13} w={180} h={14} r={7} />
          <SkelBlock x={65} y={35} w={120} h={11} r={5} />
          <SkelBlock xr={15} y={21} w={54} h={20} r={10} tone="b" />
        </SkelCard>
      ))}

      <SkelBlock w={140} h={12} r={6} style={{ marginTop: 28, marginLeft: 4 }} />

      <SkelCard h={92} style={{ marginTop: 24 }}>
        <SkelBlock x={15} y={17} w={90} h={26} r={8} />
        <SkelBlock x={15} y={53} w={220} h={12} r={6} />
      </SkelCard>
    </View>
  );
}

/* ── Browse (698:553) ─────────────────────────────────────────────────── */

/**
 * Search field and filter chips are drawn here as blocks, but the real screen
 * keeps its live chips mounted above this — per the annotation, they're client
 * state and stay tappable so a tap queues the query for when data lands.
 */
export function BrowseSkeleton({ withSearch = false }: { withSearch?: boolean }) {
  return (
    <View style={styles.body}>
      {withSearch && (
        <>
          <SkelBlock w="100%" h={50} r={16} tone="b" />
          <View style={styles.chipRow}>
            <SkelBlock w={74} h={32} r={16} tone="b" />
            <SkelBlock w={62} h={32} r={16} tone="b" style={{ marginLeft: 8 }} />
            <SkelBlock w={116} h={32} r={16} tone="b" style={{ marginLeft: 8 }} />
          </View>
        </>
      )}

      {[0, 1, 2, 3].map((i) => (
        <SkelCard key={i} h={80} style={{ marginTop: i === 0 ? (withSearch ? 20 : 0) : 14 }}>
          <SkelBlock x={11} y={11} w={56} h={56} r={12} />
          <SkelBlock x={81} y={13} w={190} h={16} r={8} />
          <SkelBlock x={81} y={37} w={130} h={12} r={6} />
          <SkelBlock x={81} y={57} w={90} h={12} r={6} />
          <SkelBlock xr={15} y={27} w={50} h={24} r={12} tone="b" />
        </SkelCard>
      ))}
    </View>
  );
}

/* ── Bookings (698:595) ───────────────────────────────────────────────── */

/**
 * Body only: the upcoming/past segmented control stays live above this,
 * because switching it changes which request is in flight.
 */
export function BookingsSkeleton() {
  return (
    <View style={styles.body}>
      <SkelBlock w={110} h={12} r={6} style={{ marginLeft: 4 }} />

      {[0, 1].map((i) => (
        <SkelCard key={`n${i}`} h={98} style={{ marginTop: i === 0 ? 24 : 14 }}>
          <SkelBlock x={13} y={13} w={64} h={64} r={14} />
          <SkelBlock x={91} y={15} w={180} h={16} r={8} />
          <SkelBlock x={91} y={39} w={120} h={12} r={6} />
          <SkelBlock x={91} y={61} w={80} h={20} r={10} tone="b" />
          <SkelBlock xr={15} y={59} w={50} h={20} r={10} tone="b" />
        </SkelCard>
      ))}

      <SkelBlock w={80} h={12} r={6} style={{ marginTop: 26, marginLeft: 4 }} />

      {[0, 1].map((i) => (
        <SkelCard key={`l${i}`} h={84} style={{ marginTop: i === 0 ? 24 : 14 }}>
          <SkelBlock x={13} y={13} w={56} h={56} r={12} />
          <SkelBlock x={83} y={15} w={160} h={14} r={7} />
          <SkelBlock x={83} y={37} w={110} h={12} r={6} />
          <SkelBlock x={83} y={57} w={90} h={12} r={6} />
        </SkelCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { alignSelf: "stretch" },
  chipRow: { flexDirection: "row", marginTop: 14 },
  card: {
    alignSelf: "stretch",
    maxWidth: 350,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
});
