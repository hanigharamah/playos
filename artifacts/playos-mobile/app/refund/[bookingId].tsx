import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, Alert, useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { format, isSameDay } from "date-fns";
import { useGetMyBookings, useGetGame } from "@/lib/api";
import {
  useRefundChoice, useRefundWindow, useSubmitRefundChoice, refundScreenState, refundChoiceOpenedAt,
  REFUND_WINDOW_HOURS, TOKEN_EXPIRY_DAYS, type RefundChoice,
} from "@/lib/refunds";
import { DotWaveBackground } from "@/components/DotWaveBackground";
import { WarmCanvas } from "@/components/WarmCanvas";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { Btn3D } from "@/components/Btn3D";
import { BtnOutline } from "@/components/BtnOutline";
import { Callout } from "@/components/Callout";
import { getVenuePhoto } from "@/lib/placeholderPhotos";
import { screen } from "@/lib/analytics";

// Measured off the Figma frames (668:697 / 669:717), matching the Read Me
// palette section: ink #1C1C1E, secondary #6C6C70, tertiary #8A8091,
// danger #BF2626, confirm green #268033, brand orange #FF9F0A / #FA810B.
const INK = "#1C1C1E";
const MUTED = "#6C6C70";
const FAINT = "#8A8091";
const RED = "#BF2626";
const GREEN = "#268033";
const ORANGE = "#FF9F0A";

const GLOWS = [
  { cx: 0.8, cy: 0.15, r: 0.9, color: "rgba(255,225,204,0.35)" },
  { cx: 0.65, cy: 0.3, r: 0.6, color: "rgba(255,217,228,0.2)" },
];

function sar(amount: number): string {
  return `SAR ${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

/**
 * Refund after a PlayOS/venue cancellation.
 *
 * One route, two states, because they are the same booking at two points on
 * the same server-stamped 48-hour clock:
 *   • "choosing" → Figma "Refund 1 · Match cancelled" (668:697)
 *   • "settled"  → Figma "Refund 2 · Auto-refunded after 48h" (669:717)
 *
 * Policy, ratified July 2026 and mirrored in lib/refunds.ts: the player picks
 * cash or a game token, the streak survives either way, no XP either way, 48
 * hours to decide, then automatic CASH. Tokens last 30 days.
 *
 * The Dev Mode annotation on 668:697 is explicit that this screen must never
 * block the money — so a failure to load the refund row degrades to the choice
 * screen with the automatic cash fallback still spelled out, and never to an
 * error page.
 */
export default function RefundScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const { data: bookings, isLoading: bookingsLoading } = useGetMyBookings();
  const { data: refund, isLoading: refundLoading } = useRefundChoice(bookingId ?? null);

  const booking =
    bookings?.upcoming?.find((b) => b.id === bookingId) ?? bookings?.past?.find((b) => b.id === bookingId);

  // Once a refund settles the booking flips to payment_status 'refunded', and
  // useGetMyBookings filters those out — so on the settled screen the booking
  // is usually gone and the game has to be read directly.
  const gameId = booking?.gameId ?? refund?.row?.gameId ?? null;
  const { data: game } = useGetGame(gameId ?? "", { enabled: !!gameId && !booking });

  const window = useRefundWindow(refund?.row?.decideBy);
  const state = refundScreenState({ row: refund?.row ?? null, expired: window.expired });

  useEffect(() => { screen("Refund", { bookingId, state }); }, [bookingId, state]);

  const match = booking
    ? {
        pitchName: booking.game.pitchName,
        photoUrl: booking.game.pitchPhotoUrl,
        kickoffTime: booking.game.kickoffTime,
        capacity: booking.game.capacity,
        price: booking.game.price,
        status: booking.game.status,
      }
    : game
      ? {
          pitchName: game.pitchName,
          photoUrl: game.pitchPhotoUrl,
          kickoffTime: game.kickoffTime,
          capacity: game.capacity,
          price: game.price,
          status: game.status,
        }
      : null;

  if (!match) {
    if (bookingsLoading || refundLoading) {
      return (
        <View style={styles.loading}>
          <WarmCanvas base="#FFF8F0" glows={GLOWS} />
          <ActivityIndicator color={ORANGE} />
        </View>
      );
    }
    return (
      <View style={styles.wrap}>
        <WarmCanvas base="#FFF8F0" glows={GLOWS} />
        <DotWaveBackground width={width} height={600} />
        <View style={styles.content}>
          <Header title="match cancelled" onBack={() => router.back()} />
          <Callout
            tone="neutral"
            title="we could not load this booking"
            body="Your refund is not affected — a PlayOS cancellation always refunds the cash automatically if you do nothing. Try again, or check my games."
            style={{ marginTop: 24 }}
          />
          <BtnOutline label="my games" onPress={() => router.replace("/(tabs)/my-games")} style={{ marginTop: 20 }} />
        </View>
      </View>
    );
  }

  const kickoff = new Date(match.kickoffTime);
  const teamSize = Math.round(match.capacity / 2);
  // refund_choices.amount is the authoritative figure once the row exists;
  // the game price is the same number and is what we have until then.
  const amount = refund?.row?.amount ?? match.price;

  const matchCard = (
    <View style={styles.matchCard}>
      <Image source={{ uri: getVenuePhoto(match.pitchName, match.photoUrl) }} style={styles.thumb} />
      <View style={styles.matchText}>
        <Text style={styles.matchTitle} numberOfLines={1}>
          {teamSize}v{teamSize} · {match.pitchName}
        </Text>
        <Text style={styles.matchSub}>
          {isSameDay(kickoff, new Date()) ? "Today" : format(kickoff, "EEE, d MMM")} · {format(kickoff, "h:mm a")}
        </Text>
        {/*
         * The mock reads "cancelled by the venue". games.cancelled_reason is
         * written by the cancel_match RPC but is not exposed on GameSummary /
         * MyBooking, so who cancelled and why cannot be shown without guessing.
         * The neutral fact — that it is cancelled — is all that is stated.
         */}
        {match.status === "cancelled" && <Text style={styles.matchCancelled}>cancelled</Text>}
      </View>
    </View>
  );

  return state === "settled" ? (
    <Settled
      router={router}
      width={width}
      matchCard={matchCard}
      amount={amount}
      choice={refund?.row?.choice ?? null}
      decideBy={refund?.row?.decideBy ?? null}
      settledAt={refund?.row?.settledAt ?? null}
      openedAtMs={refund?.row ? refundChoiceOpenedAt(refund.row) : null}
    />
  ) : (
    <Choosing
      router={router}
      width={width}
      matchCard={matchCard}
      amount={amount}
      bookingId={bookingId!}
    />
  );
}

// ─── Refund 1 · Match cancelled (668:697) ───────────────────────────────

function Choosing({
  router, width, matchCard, amount, bookingId,
}: {
  router: ReturnType<typeof useRouter>;
  width: number;
  matchCard: React.ReactNode;
  amount: number;
  bookingId: string;
}) {
  /*
   * Deliberately starts with NOTHING selected, where the mock ships with the
   * token pre-selected and the CTA reading "confirm · take the token". The
   * ratified policy is that a player is never defaulted into a token, and a
   * pre-ticked token that a mis-tap confirms is exactly that default. Cash is
   * what happens if they never touch this screen, so an unselected start is
   * also the honest depiction of where they currently stand.
   */
  const [choice, setChoice] = useState<RefundChoice | null>(null);
  const submit = useSubmitRefundChoice();

  const confirm = () => {
    if (!choice) return;
    submit.mutate(
      { bookingId, choice },
      {
        onError: (err: unknown) =>
          Alert.alert(
            "We could not save that yet",
            err instanceof Error ? err.message : "Please try again.",
          ),
      },
    );
  };

  return (
    <View style={styles.wrap}>
      <WarmCanvas base="#FFF8F0" glows={GLOWS} />
      <DotWaveBackground width={width} height={600} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Header title="match cancelled" onBack={() => router.back()} />
        <Text style={styles.lede}>not your fault, so nothing here can cost you.</Text>

        {matchCard}

        <Text style={styles.eyebrow}>pick one</Text>

        <OptionCard
          selected={choice === "token"}
          onPress={() => setChoice("token")}
          glyph="🎟"
          title="take a game token"
          /* 30 days, not the 60 the mock still says — see TOKEN_EXPIRY_DAYS. */
          subtitle={`1 token, good on any match, expires in ${TOKEN_EXPIRY_DAYS} days`}
          noteTone="good"
          /*
           * The mock names the streak length ("your 6 week streak keeps
           * going"). There is no weekly streak in the schema — get_my_activity
           * returns current_streak_days, a day streak — so printing a week
           * count would be inventing one. The promise is stated without it.
           */
          noteTitle="your streak keeps going"
          noteBody="counts as if you played this week"
        />

        <OptionCard
          selected={choice === "cash"}
          onPress={() => setChoice("cash")}
          glyph="💳"
          title="get my money back"
          /* No saved-card store, so the mock's card digits are omitted. */
          subtitle={`${sar(amount)} back to the card you paid with, 3 to 5 days`}
          noteTone="neutral"
          /*
           * The mock's cash card reads "your streak pauses this week / not
           * broken, not advanced". The ratified policy is that the streak is
           * PRESERVED either way — a cancelled match counts as a played week
           * regardless of which refund is taken — so the mock copy would tell
           * the player something false and is corrected here.
           */
          noteTitle="your streak keeps going too"
          noteBody="a cancelled match counts as a played week either way"
        />

        <Text style={styles.footnote}>no XP either way, because no game was played.</Text>

        <Callout
          tone="warning"
          icon={<Text style={styles.warnGlyph}>⏱</Text>}
          title={`decide within ${REFUND_WINDOW_HOURS} hours`}
          body="After that we refund the cash automatically. We never default you into a token."
          style={{ marginTop: 13 }}
        />

        {/*
         * No live countdown. The deadline lives on refund_choices.decide_by,
         * which does not exist until the migration lands — a ticking clock with
         * nothing behind it would be a made-up promise about money.
         */}

        <Btn3D
          label={
            choice === "token" ? "confirm · take the token"
              : choice === "cash" ? "confirm · get my money back"
                : "confirm"
          }
          disabled={!choice}
          loading={submit.isPending}
          onPress={confirm}
          style={{ marginTop: 28 }}
        />
      </ScrollView>
    </View>
  );
}

// ─── Refund 2 · Auto-refunded after 48h (669:717) ───────────────────────

function Settled({
  router, width, matchCard, amount, choice, decideBy, settledAt, openedAtMs,
}: {
  router: ReturnType<typeof useRouter>;
  width: number;
  matchCard: React.ReactNode;
  amount: number;
  choice: RefundChoice | null;
  decideBy: string | null;
  settledAt: string | null;
  openedAtMs: number | null;
}) {
  const auto = choice === null;

  return (
    <View style={styles.wrap}>
      <WarmCanvas base="#FFF8F0" glows={GLOWS} />
      <DotWaveBackground width={width} height={600} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Header title="refunded" onBack={() => router.back()} />
        <Text style={styles.lede}>
          {auto
            ? `the ${REFUND_WINDOW_HOURS} hour window closed, so we sent the cash.`
            : "you asked for the cash, so we sent it."}
        </Text>

        {matchCard}

        <Callout
          tone="confirm"
          icon={<Text style={styles.okGlyph}>✓</Text>}
          title={`${sar(amount)} refunded`}
          /* Card digits omitted — there is no saved-payment-method store. */
          body="Back to the card you paid with. Most banks show it within 3 to 5 working days. Nothing else is needed from you."
          style={{ marginTop: 20 }}
        />

        {/*
         * "what happened" timeline. The mock opens with a "venue cancelled the
         * match" row; games.cancelled_at is written by cancel_match but is not
         * exposed on GameSummary, and there is no record of when the player was
         * notified, so that row is dropped rather than back-dated by guesswork.
         * The three rows below are all real: the window opened when the refund
         * row was created (decide_by minus 48h), it closed at decide_by, and
         * the money moved at settled_at.
         */}
        {openedAtMs !== null && decideBy && (
          <View style={styles.timeline}>
            <Text style={styles.timelineTitle}>what happened</Text>
            <TimelineRow at={openedAtMs} text="you were told, choice opened" />
            <TimelineRow
              at={Date.parse(decideBy)}
              text={auto ? `${REFUND_WINDOW_HOURS}h passed, no choice made` : "you chose the cash"}
              muted
            />
            <TimelineRow
              at={settledAt ? Date.parse(settledAt) : null}
              text={auto ? "cash refund sent automatically" : "cash refund sent"}
              tone={GREEN}
              last
            />
          </View>
        )}

        <Text style={styles.footnote}>
          the token option is gone for this match. cash is always the fallback, never the other way round.
        </Text>

        <Btn3D label="find another match" onPress={() => router.push("/browse")} style={{ marginTop: 28 }} />
        <Pressable onPress={() => router.replace("/(tabs)")} hitSlop={10}>
          <Text style={styles.homeLink}>back to home</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn}>
        <Text style={styles.backGlyph}>‹</Text>
      </Pressable>
      <HandwrittenHeader style={styles.title}>{title}</HandwrittenHeader>
    </View>
  );
}

function OptionCard({
  selected, onPress, glyph, title, subtitle, noteTone, noteTitle, noteBody,
}: {
  selected: boolean;
  onPress: () => void;
  glyph: string;
  title: string;
  subtitle: string;
  noteTone: "good" | "neutral";
  noteTitle: string;
  noteBody: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.option,
        selected ? styles.optionOn : styles.optionOff,
        pressed && { opacity: 0.92 },
      ]}
    >
      <View style={styles.optionHead}>
        <View style={styles.optionDisc}>
          <Text style={styles.optionGlyph}>{glyph}</Text>
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>{title}</Text>
          <Text style={styles.optionSub}>{subtitle}</Text>
        </View>
        <View style={[styles.radio, selected && styles.radioOn]}>
          {selected && <Text style={styles.radioTick}>✓</Text>}
        </View>
      </View>
      <View style={[styles.note, noteTone === "good" ? styles.noteGood : styles.noteNeutral]}>
        <Text style={[styles.noteTitle, noteTone === "good" && { color: GREEN }]}>{noteTitle}</Text>
        <Text style={styles.noteBody}>{noteBody}</Text>
      </View>
    </Pressable>
  );
}

function TimelineRow({
  at, text, tone, muted, last,
}: {
  at: number | null;
  text: string;
  tone?: string;
  muted?: boolean;
  last?: boolean;
}) {
  return (
    <View style={styles.tlRow}>
      <View style={styles.tlRail}>
        <View style={[styles.tlDot, tone ? { backgroundColor: tone } : null]} />
        {!last && <View style={styles.tlLine} />}
      </View>
      <Text style={styles.tlTime}>{at !== null && Number.isFinite(at) ? format(new Date(at), "EEE HH:mm") : "—"}</Text>
      <Text style={[styles.tlText, muted && { color: FAINT }, tone ? { color: tone } : null]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF8F0" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF8F0" },
  content: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 48 },

  header: { flexDirection: "row", alignItems: "center" },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
  },
  backGlyph: { fontSize: 20, fontWeight: "700", color: INK, lineHeight: 22 },
  title: { fontSize: 26, color: "#FA810B", marginLeft: 14, flex: 1 },
  lede: { fontSize: 14, color: MUTED, marginTop: 12 },

  matchCard: {
    flexDirection: "row", alignItems: "center", minHeight: 92, borderRadius: 18, padding: 11, marginTop: 17,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  thumb: { width: 68, height: 68, borderRadius: 14, backgroundColor: "#CFD8C4" },
  matchText: { flex: 1, marginLeft: 12 },
  matchTitle: { fontSize: 16, fontWeight: "600", color: INK },
  matchSub: { fontSize: 13, color: MUTED, marginTop: 5 },
  matchCancelled: { fontSize: 13, fontWeight: "600", color: RED, marginTop: 4 },

  eyebrow: { fontSize: 13, fontWeight: "600", color: FAINT, marginTop: 18 },

  option: { borderRadius: 20, padding: 18, marginTop: 10 },
  optionOn: { borderWidth: 2, borderColor: ORANGE, backgroundColor: "rgba(255,255,255,0.75)" },
  optionOff: { borderWidth: 2, borderColor: "rgba(255,255,255,0.85)", backgroundColor: "rgba(255,255,255,0.55)" },
  optionHead: { flexDirection: "row", alignItems: "flex-start" },
  optionDisc: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,236,214,0.9)",
  },
  optionGlyph: { fontSize: 16, color: INK },
  optionText: { flex: 1, marginLeft: 12 },
  optionTitle: { fontSize: 16, fontWeight: "700", color: INK },
  optionSub: { fontSize: 12.5, color: MUTED, marginTop: 5 },
  radio: {
    width: 24, height: 24, borderRadius: 12, marginLeft: 8,
    borderWidth: 1.5, borderColor: "#D8D2CA", alignItems: "center", justifyContent: "center",
  },
  radioOn: { backgroundColor: ORANGE, borderColor: ORANGE },
  radioTick: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },

  note: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12 },
  noteGood: { backgroundColor: "rgba(224,242,224,0.6)" },
  noteNeutral: { backgroundColor: "rgba(240,236,230,0.8)" },
  noteTitle: { fontSize: 13, fontWeight: "600", color: MUTED },
  noteBody: { fontSize: 11.5, color: FAINT, marginTop: 4 },

  footnote: { fontSize: 12.5, color: FAINT, marginTop: 16, lineHeight: 18 },
  warnGlyph: { fontSize: 13, fontWeight: "700", color: "#C96A00" },
  okGlyph: { fontSize: 13, fontWeight: "700", color: GREEN },

  timeline: {
    borderRadius: 24, padding: 19, marginTop: 20,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#000000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  timelineTitle: { fontSize: 15, fontWeight: "700", color: INK },
  tlRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 14 },
  tlRail: { width: 7, alignItems: "center" },
  tlDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#D8D2CA", marginTop: 5 },
  tlLine: { width: 1, flex: 1, minHeight: 14, backgroundColor: "#E8E2DA", marginTop: 3 },
  tlTime: { width: 72, marginLeft: 11, fontSize: 11.5, color: FAINT },
  tlText: { flex: 1, fontSize: 12.5, color: INK },

  homeLink: { fontSize: 13.5, color: MUTED, textAlign: "center", marginTop: 18 },
});
