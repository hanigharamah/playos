import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import { format } from "date-fns";
import { DotWaveBackground } from "@/components/DotWaveBackground";
import { WarmCanvas } from "@/components/WarmCanvas";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { BtnOutline } from "@/components/BtnOutline";
import { Callout } from "@/components/Callout";

const INK = "#1C1C1E";
const MUTED = "#6C6C70";
const FAINT = "#ADADB2";
const GREEN = "#268033";

const GLOWS = [
  { cx: 0.8, cy: 0.15, r: 0.9, color: "rgba(255,225,204,0.35)" },
  { cx: 0.65, cy: 0.3, r: 0.6, color: "rgba(255,217,228,0.2)" },
];

/** Stale panels dim rather than blank — the last team sheet is still useful. */
const STALE_OPACITY = 0.6;

/** True while the device has no usable internet connection. */
export function useIsOffline(): boolean {
  return useConnectivity().offline;
}

/**
 * Connectivity, with the distinction between "known online" and "not yet
 * measured". NetInfo reports asynchronously, so a bare useState(false) reads
 * as online on the first render — which made the offline screen dismiss itself
 * on mount before it could ever be seen.
 */
export function useConnectivity(): { offline: boolean; known: boolean } {
  const [state, setState] = useState<{ offline: boolean; known: boolean }>({ offline: false, known: false });
  useEffect(() => {
    let alive = true;
    const apply = (s: { isConnected: boolean | null; isInternetReachable: boolean | null }) => {
      if (!alive) return;
      setState({ offline: s.isConnected === false || s.isInternetReachable === false, known: true });
    };
    void NetInfo.fetch().then(apply);
    const unsub = NetInfo.addEventListener(apply);
    return () => { alive = false; unsub(); };
  }, []);
  return state;
}

/** Slow pulse on the amber status dot so the banner reads as "working on it". */
function useDotPulse() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });
}

interface Props {
  pitchName: string;
  kickoffTime: string;
  /** From the live roster — whether this player's check-in already landed. */
  isCheckedIn: boolean;
  /** Failed chat sends waiting locally. Omit when the count is unknown. */
  queuedMessages?: number;
  onRetry: () => void;
}

/**
 * Match-day reconnecting (Figma 698:699).
 *
 * Two annotation rules drive the layout: the check-in confirmation is pinned
 * at the top because that's the only thing a player actually panics about,
 * and stale panels dim to 60% instead of blanking so the last known state
 * stays readable. Check-in is idempotent, so retrying is always safe.
 *
 * The mock shows "confirmed at 7:44 PM" and a "live score · paused" row.
 * Neither is rendered: the roster exposes `checkedIn` as a boolean with no
 * timestamp, and there is no live-score feature to pause. Both come back the
 * moment the data exists.
 */
export function ReconnectingState({ pitchName, kickoffTime, isCheckedIn, queuedMessages, onRetry }: Props) {
  const { width } = useWindowDimensions();
  const dotOpacity = useDotPulse();
  const insets = useSafeAreaInsets();
  const kickoff = new Date(kickoffTime);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 5 }]}>
      <WarmCanvas base="#FFF8F0" glows={GLOWS} />
      <DotWaveBackground width={width} height={600} />

      <View style={styles.banner}>
        <Animated.View style={[styles.dot, { opacity: dotOpacity }]} />
        <Text style={styles.bannerText}>reconnecting…</Text>
      </View>

      <HandwrittenHeader style={styles.title}>match day</HandwrittenHeader>
      <Text style={styles.subtitle}>{pitchName}  ·  kickoff {format(kickoff, "h:mm a")}</Text>

      {/* Pinned: the one thing worth panicking about, answered first. */}
      <View style={[styles.card, styles.stale]}>
        <Text style={styles.eyebrow}>YOU ARE</Text>
        <Text style={[styles.status, !isCheckedIn && styles.statusPending]}>
          {isCheckedIn ? "checked in ✓" : "not checked in yet"}
        </Text>
      </View>

      {isCheckedIn && (
        <Callout
          tone="confirm"
          icon={<Text style={styles.check}>✓</Text>}
          title="nothing you did is at risk"
          body="your check-in reached us before the signal dropped. teams and chat will catch up on their own."
          style={{ marginTop: 20 }}
        />
      )}

      <View style={[styles.card, styles.stale, { marginTop: 20 }]}>
        <View style={styles.syncRow}>
          <Text style={styles.syncLabel}>teams</Text>
          <Text style={styles.syncValue}>waiting for the server</Text>
        </View>
        {/* Only claim a chat state when we actually know the queue depth. */}
        {queuedMessages !== undefined && (
          <View style={styles.syncRow}>
            <Text style={styles.syncLabel}>chat</Text>
            <Text style={styles.syncValue}>
              {queuedMessages > 0
                ? `${queuedMessages} message${queuedMessages === 1 ? "" : "s"} queued`
                : "up to date"}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <BtnOutline label="retry now" tone="warning" onPress={onRetry} />
        <Text style={styles.footnote}>we retry on our own every few seconds</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // paddingTop comes from the safe-area inset at the call site; the fixed
  // value was smaller than the Dynamic Island's inset.
  wrap: { flex: 1, backgroundColor: "#FFF8F0", paddingHorizontal: 20 },

  banner: {
    flexDirection: "row", alignItems: "center", height: 44, borderRadius: 22, paddingHorizontal: 17,
    backgroundColor: "rgba(255,241,220,0.92)", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#C96A00" },
  bannerText: { fontSize: 14, fontWeight: "600", color: "#C96A00", marginLeft: 12 },

  title: { fontSize: 34, color: "#FF9F0A", marginTop: 22 },
  subtitle: { fontSize: 13, color: MUTED, marginTop: 6, marginLeft: 2 },

  card: {
    borderRadius: 20, marginTop: 20, paddingHorizontal: 19, paddingVertical: 17,
    backgroundColor: "rgba(255,255,255,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  stale: { opacity: STALE_OPACITY },

  eyebrow: { fontSize: 11, fontWeight: "600", color: MUTED, letterSpacing: 0.3 },
  status: { fontSize: 24, fontWeight: "700", color: GREEN, marginTop: 8 },
  statusPending: { color: MUTED },
  check: { fontSize: 13, fontWeight: "700", color: GREEN },

  syncRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  syncLabel: { fontSize: 14, fontWeight: "600", color: INK },
  syncValue: { fontSize: 13, color: FAINT },

  actions: { position: "absolute", left: 20, right: 20, bottom: 40 },
  footnote: { fontSize: 13, color: MUTED, textAlign: "center", marginTop: 18 },
});
