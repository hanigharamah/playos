import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, ArrowRight } from "lucide-react-native";
import { format, isSameDay } from "date-fns";
import { useGetGame, useGameRoster } from "@/lib/api";
import { serverNow } from "@/lib/serverTime";
import { AvatarStack } from "@/components/AvatarStack";
import { VenueArt } from "@/components/VenueArt";
import { colors, spacing, radius } from "@/lib/theme";
import { screen } from "@/lib/analytics";

function useCountdown(target: Date | null) {
  // `null` until the game loads. Previously the caller passed `new Date()` as a
  // placeholder, so the first render computed 0 remaining and the screen showed
  // "kickoff! your match has started" for a beat before snapping to the real
  // time. Keying the effect on the timestamp rather than the Date object also
  // stops the interval being rebuilt on every render.
  const targetMs = target ? target.getTime() : null;
  const [remaining, setRemaining] = useState(() =>
    targetMs === null ? null : targetMs - serverNow(),
  );

  useEffect(() => {
    if (targetMs === null) { setRemaining(null); return; }
    // Nothing below zero is displayed, so stop re-rendering once past kickoff
    // rather than ticking forever behind an unmounted timer. The handle is
    // held in a box because the first tick runs synchronously, before any
    // `const` declared after it would be initialised.
    const handle: { id: ReturnType<typeof setInterval> | null } = { id: null };
    const stop = () => { if (handle.id !== null) { clearInterval(handle.id); handle.id = null; } };

    const tick = () => {
      const next = targetMs - serverNow();
      setRemaining(next);
      if (next <= 0) stop();
    };

    tick();
    if (targetMs - serverNow() > 0) handle.id = setInterval(tick, 1000);
    return stop;
  }, [targetMs]);

  const clamped = Math.max(0, remaining ?? 0);
  return {
    hours: Math.floor(clamped / 3_600_000),
    minutes: Math.floor((clamped % 3_600_000) / 60_000),
    seconds: Math.floor((clamped % 60_000) / 1000),
    isPast: remaining !== null && remaining <= 0,
  };
}

/** Real live countdown to a real game's real kickoff_time — no simulated timer. */
export default function Countdown() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: game, isLoading } = useGetGame(id!);
  const { data: roster } = useGameRoster(id ?? null);

  useEffect(() => { screen("Countdown", { gameId: id }); }, [id]);

  const kickoff = game ? new Date(game.kickoffTime) : null;
  const { hours, minutes, seconds, isPast } = useCountdown(kickoff);

  if (isLoading || !game) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.orange} />
      </View>
    );
  }

  const teamSize = Math.floor(game.capacity / 2);
  const names = (roster?.entries ?? []).map((e) => e.name);

  return (
    <VenueArt name={game.pitchName} style={styles.wrap}>
      <LinearGradient colors={["rgba(18,20,28,0.35)", "rgba(18,20,28,0.9)"]} style={StyleSheet.absoluteFill} />
      <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
        <ArrowLeft size={20} color="#FFFFFF" />
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.headline}>{isPast ? "kickoff!" : "get ready!"}</Text>
        <Text style={styles.sub}>{isPast ? "your match has started" : "your match starts in"}</Text>

        {!isPast && (
          <View style={styles.timerRow}>
            <TimeBlock value={hours} label="HRS" />
            <Text style={styles.colon}>:</Text>
            <TimeBlock value={minutes} label="MINS" />
            <Text style={styles.colon}>:</Text>
            <TimeBlock value={seconds} label="SECS" />
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle} numberOfLines={1}>{game.pitchName}</Text>
          <Text style={styles.cardWhen}>
            {isSameDay(new Date(game.kickoffTime), new Date())
              ? "TONIGHT"
              : format(new Date(game.kickoffTime), "EEE").toUpperCase()}
            {"  •  "}{format(new Date(game.kickoffTime), "h:mm a")}
          </Text>
          {/* The mock's second half of this line is "Outdoor" — no surface
              column exists, so only the real format is shown. */}
          <Text style={styles.cardMeta}>{teamSize}v{teamSize}</Text>
          {names.length > 0 && (
            <View style={styles.avatarRow}>
              <AvatarStack names={names} max={4} size={28} />
            </View>
          )}
          <Pressable style={styles.detailsBtn} onPress={() => router.push(`/game/${id}`)}>
            <Text style={styles.detailsBtnText}>view match details</Text>
            <ArrowRight size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </VenueArt>
  );
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.timeBlock}>
      <Text style={styles.timeValue}>{String(value).padStart(2, "0")}</Text>
      <Text style={styles.timeLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.creamDeep },
  back: { position: "absolute", top: 56, left: spacing.lg, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  headline: { fontSize: 30, fontWeight: "800", color: "#FFFFFF" },
  sub: { fontSize: 14, color: "#99999E", marginTop: 4 },
  timerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xl },
  timeBlock: { alignItems: "center" },
  timeValue: { fontSize: 40, fontWeight: "800", color: "#FFFFFF", fontVariant: ["tabular-nums"] },
  timeLabel: { fontSize: 10, color: "#99999E", fontWeight: "700", letterSpacing: 1, marginTop: 2 },
  colon: { fontSize: 32, fontWeight: "700", color: "rgba(255,255,255,0.5)", marginBottom: 14 },
  card: { width: "100%", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.xxl, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  cardTitle: { fontSize: 20, fontWeight: "800", color: "#FFFFFF" },
  cardWhen: { fontSize: 12, fontWeight: "600", color: "#FD6A03", marginTop: 8 },
  cardMeta: { fontSize: 13, color: "#99999E", marginTop: 4 },
  avatarRow: { marginTop: spacing.md },
  detailsBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: radius.pill, paddingVertical: spacing.md, marginTop: spacing.lg },
  detailsBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
});
