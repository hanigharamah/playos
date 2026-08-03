import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { format } from "date-fns";
import * as Haptics from "expo-haptics";
import { Check, MessageCircle, X } from "lucide-react-native";
import {
  useGameRoster, useGetGame, useGetMyBookings, useCheckIn, useClaimSide, useStartMatch,
  useGetOrCreateGameChat, useConversationMessages, MIN_PLAYERS_TO_START, type RosterEntry,
} from "@/lib/api";
import { WarmCanvas } from "@/components/WarmCanvas";
import { GlassCard } from "@/components/GlassCard";
import { HandwrittenHeader } from "@/components/HandwrittenHeader";
import { Btn3D } from "@/components/Btn3D";
import { BtnOutline } from "@/components/BtnOutline";
import { Avatar } from "@/components/Avatar";
import { ReconnectingState, useIsOffline } from "@/components/ReconnectingState";
import { useAuth } from "@/lib/auth";
import { useServerCountdown } from "@/lib/serverTime";
import { colors } from "@/lib/theme";
import { screen, track } from "@/lib/analytics";

/**
 * Match-day flashcards — one screen, seven states (Figma 387:632 / 388:478 /
 * 394:478 / 394:507 / 387:649 / 390:478 / 388:496). Reached from the T-20 push
 * deep link (`/match/:id`), from the match-day bar, and from
 * `app/check-in/[gameId].tsx`, which redirects here the instant the window
 * opens. It is one flow driven by `derivePhase`, not seven routes.
 *
 * Ratified rules this screen implements (see FIGMA-MAP.md "Match day"):
 *  - Check-in is a TAP BOUND TO THE CLOCK. No QR, no geofence, and the button
 *    is never disabled on location or on a client-side clock check. The T-20
 *    window lives inside the `check_in` RPC; we only surface its answer.
 *  - No auto-anything. Nothing on this screen starts, cancels or advances the
 *    match on a timer — the web flow's auto-start effect is deliberately not
 *    ported. A human holds the button.
 *  - Squad size is parametric: everything reads `roster.capacity`.
 */

const FAINT = "#ADADB2";
const MUTED = "#6C6C70";

/**
 * Team 1 is "Orange" and team 2 "Purple" throughout the flashcards — the
 * earlier "Yellow" label came from the web app and is not what these frames
 * say. Values lifted from 387:649 / 388:496.
 */
const TEAM = {
  1: {
    label: "Orange",
    color: "#F28C26",
    ink: "#7A4B00",
    tile: "rgba(255,178,89,0.28)",
    panel: "rgba(255,178,89,0.12)",
    chip: "#FF9F0A",
  },
  2: {
    label: "Purple",
    color: "#8C66EB",
    ink: "#3E2494",
    tile: "rgba(153,115,242,0.16)",
    panel: "rgba(153,115,242,0.12)",
    chip: "#7B4DFF",
  },
} as const;

/** How long the start button must be held. */
const HOLD_MS = 1600;

/** The window opens 20 minutes before kickoff — used for COPY ONLY. */
const CHECK_IN_WINDOW_MS = 20 * 60_000;

type Phase =
  | "loading"
  | "no_booking"
  | "check_in"
  | "pick_side"
  | "waiting"
  | "hold"
  | "starting"
  | "coin_flip"
  | "teams";

export default function MatchDay() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: roster, isLoading: rosterLoading, refetch } = useGameRoster(id ?? null);
  const { data: game } = useGetGame(id ?? "");
  const { data: myBookings, isLoading: bookingsLoading } = useGetMyBookings();
  const isOffline = useIsOffline();

  const checkIn = useCheckIn();
  const claimSide = useClaimSide();
  const startMatch = useStartMatch();
  const gameChat = useGetOrCreateGameChat();
  const { user } = useAuth();

  const [pendingTeam, setPendingTeam] = useState<1 | 2 | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Resolved once per visit; null until the RPC answers. */
  const [conversationId, setConversationId] = useState<string | null>(null);
  /** The RPC is missing from the database — hide the panel rather than nag. */
  const [chatOff, setChatOff] = useState(false);
  const chatAsked = useRef(false);

  const { data: messages } = useConversationMessages(conversationId);
  const recent = (messages ?? []).slice(-3);

  // The RPC creates the conversation on first open and returns the existing one
  // after that, so the chat starts existing the moment someone asks for it.
  // Declared after `notice` because it writes to it.
  const openChat = () => {
    if (!id) return;
    // Already resolved by the panel's fetch in the common case.
    if (conversationId) { router.push(`/chat/${conversationId}`); return; }
    gameChat.mutate(
      { gameId: id },
      {
        onSuccess: (conversationId) => router.push(`/chat/${conversationId}`),
        // The RPC is defined in supabase/2026-07-mobile-design-support.sql but
        // is NOT applied to the database — probed 2026-08-03, PGRST202. Until
        // it is, this button is reachable, so it must fail in the player's
        // language rather than showing them a Postgres error string.
        onError: (err: any) => {
          const msg: string = err?.data?.error ?? "";
          setNotice(
            /Could not find the function|PGRST202|schema cache/i.test(msg)
              ? "Group chat isn't switched on yet."
              : msg || "Couldn't open the group chat — try again.",
          );
        },
      },
    );
  };
  /** 3 → 2 → 1 → 0 after our own start succeeds. Null = not counting. */
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sawCoinFlip, setSawCoinFlip] = useState(false);

  // Ticks once a second on the SERVER clock so the check-in eyebrow can say
  // "now open" / "opens at 7:40 PM". Never used to enable or disable the
  // button — that decision belongs to the RPC.
  const kickoffMs = game ? new Date(game.kickoffTime).getTime() : null;
  const { remainingMs: msToKickoff, synced } = useServerCountdown(kickoffMs);

  useEffect(() => {
    screen("MatchDay", { gameId: id });
    track("matchday_flashcard_started", { gameId: id });
  }, [id]);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // RosterEntry carries no user id, so "me" is found by matching my own
  // booking id. Past as well as upcoming: useGetMyBookings moves a booking to
  // `past` the moment kickoff passes, and this screen lives past kickoff.
  // Reading `upcoming` alone told every player "not checked in" from kickoff on.
  const myBooking = [...(myBookings?.upcoming ?? []), ...(myBookings?.past ?? [])]
    .find((b) => b.gameId === id);
  const myEntry = myBooking ? roster?.entries.find((e) => e.bookingId === myBooking.id) : undefined;

  // The roster is realtime and authoritative; the booking row is the fallback
  // for the beat before the roster query lands.
  const iAmCheckedIn = myEntry?.checkedIn ?? myBooking?.checkedIn ?? false;
  // Only the roster types `team` as 1 | 2 | null. MyBooking.team is a plain
  // number (0 = unassigned in the bookings table), so it is not read here.
  const myTeam: 1 | 2 | null = myEntry?.team ?? null;

  const capacity = roster?.capacity ?? game?.capacity ?? 0;
  const half = Math.floor(capacity / 2);
  const checkedInCount = roster?.checkedInCount ?? 0;
  const locked = !!roster?.teamsLockedAt;
  const kickoffTeam = roster?.kickoffTeam ?? null;

  const phase = derivePhase({
    loading: rosterLoading || bookingsLoading || !roster,
    hasBooking: !!myBooking,
    iAmCheckedIn,
    myTeam,
    locked,
    kickoffTeam,
    sawCoinFlip,
    countdown,
    checkedInCount,
  });

  // The chat's window is the room's window: it opens with check-in at T-20 and
  // soft-closes at T+20 (FIGMA-MAP.md:86). Inside it the conversation is
  // fetched without being asked for, so messages are already on screen.
  const inChatWindow = ["check_in", "pick_side", "waiting", "hold", "teams"].includes(phase);

  useEffect(() => {
    if (!inChatWindow || !id || chatAsked.current) return;
    chatAsked.current = true;
    gameChat.mutate(
      { gameId: id },
      {
        onSuccess: setConversationId,
        // A player with no booking is rejected by the RPC, and the RPC itself
        // may not be applied yet — either way the panel just stays away.
        onError: () => setChatOff(true),
      },
    );
    // gameChat is a stable mutation observer; the ref guards against re-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inChatWindow, id]);

  const doCheckIn = () => {
    if (!id) return;
    setNotice(null);
    checkIn.mutate({ gameId: id }, {
      onSuccess: (result) => {
        if (result === "ok" || result === "already_checked_in") {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          track("matchday_checked_in", { gameId: id });
          return;
        }
        setNotice(
          result === "too_early" ? "Check-in opens 20 minutes before kickoff."
            : result === "too_late" ? "Check-in closed at kickoff — find the operator."
              : result === "no_booking" ? "You don't have a spot in this match."
                : "Couldn't check you in — try again.",
        );
      },
      // The check_in RPC ships in supabase/2026-08-match-day.sql.
      onError: () => setNotice("Check-in isn't available on this server yet."),
    });
  };

  const doClaim = () => {
    if (!id || !pendingTeam) return;
    const team = pendingTeam;
    setNotice(null);
    claimSide.mutate({ gameId: id, team }, {
      onSuccess: (result) => {
        if (result === "ok" || result === "already_picked") {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          track("matchday_side_claimed", { gameId: id, team });
          return;
        }
        setPendingTeam(null);
        setNotice(
          result === "full" ? `${TEAM[team].label} just filled up — pick the other side.`
            : "Tap I'm Here first, then pick your side.",
        );
      },
      onError: () => setNotice("Couldn't join that side — try again."),
    });
  };

  const doStart = () => {
    if (!id) return;
    setNotice(null);
    startMatch.mutate({ gameId: id }, {
      onSuccess: (result) => {
        if (result === "ok" || result === "already_locked") {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          track("matchday_started", { gameId: id });
          setCountdown(3);
          return;
        }
        setNotice(
          result === "too_few"
            ? `At least ${MIN_PLAYERS_TO_START} players need to be checked in.`
            : "Couldn't start the match — try again.",
        );
      },
      onError: () => setNotice("Couldn't start the match — try again."),
    });
  };

  // Connection lost on match day (Figma 698:699). Ahead of the spinner: the
  // player needs to know their check-in survived, not watch it load.
  if (isOffline) {
    return (
      <ReconnectingState
        pitchName={game?.pitchName ?? "your match"}
        kickoffTime={game?.kickoffTime ?? new Date().toISOString()}
        isCheckedIn={iAmCheckedIn}
        onRetry={() => void refetch()}
      />
    );
  }

  const kickoff = game ? new Date(game.kickoffTime) : null;
  const kickoffLabel = kickoff ? format(kickoff, "h:mm a") : "";

  let checkInEyebrow = "CHECK-IN";
  if (synced && kickoff) {
    if (msToKickoff <= 0) checkInEyebrow = "CHECK-IN · CLOSED AT KICKOFF";
    else if (msToKickoff <= CHECK_IN_WINDOW_MS) checkInEyebrow = "CHECK-IN · NOW OPEN";
    else checkInEyebrow = `CHECK-IN · OPENS ${format(new Date(kickoff.getTime() - CHECK_IN_WINDOW_MS), "h:mm a").toUpperCase()}`;
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 5 }]}>
      <WarmCanvas />

      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>{game?.pitchName ?? "…"}</Text>
          {kickoff && (
            <Text style={styles.headerSub}>{format(kickoff, "EEEE, d MMMM")} · {kickoffLabel}</Text>
          )}
        </View>
        {/* The group chat's only real entry point. It is alive for the same
            window this room is, so it is reached from here rather than from a
            permanent tab. The RPC rejects anyone without a booking, and the
            phases below are the ones inside that window. */}
        {inChatWindow && !chatOff && (
          <Pressable
            onPress={openChat}
            disabled={gameChat.isPending}
            hitSlop={10}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Open group chat"
          >
            <MessageCircle size={15} color={MUTED} strokeWidth={2.2} />
          </Pressable>
        )}
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.close} accessibilityLabel="Close">
          <X size={14} color={MUTED} strokeWidth={2.5} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {phase === "loading" && (
          <View style={styles.loading}><ActivityIndicator color={colors.orange} /></View>
        )}

        {phase === "no_booking" && (
          // Not one of the seven frames, but reachable: the deep link is a URL
          // and nothing stops a player without a spot opening it.
          <GlassCard style={styles.card} round={28} padding={23}>
            <Text style={styles.eyebrow}>MATCH DAY</Text>
            <Text style={styles.cardTitle}>No spot in this match</Text>
            <Text style={styles.cardSub}>You don't have a booking for this game.</Text>
            <BtnOutline label="Back to the match" onPress={() => router.replace(`/game/${id}`)} style={{ marginTop: 20 }} />
          </GlassCard>
        )}

        {phase === "check_in" && (
          <GlassCard style={styles.card} round={28} padding={23}>
            <Text style={styles.eyebrow}>{checkInEyebrow}</Text>
            <Text style={styles.cardTitle}>{game?.pitchName ?? ""}</Text>
            <Text style={styles.cardSub}>
              {game?.locationText ? `${game.locationText} · ` : ""}kickoff {kickoffLabel}
            </Text>
            <HandwrittenHeader style={styles.script22}>you made it 👋</HandwrittenHeader>
            {notice && <Text style={styles.notice}>{notice}</Text>}
            <Btn3D
              label="✓   I'm Here"
              onPress={doCheckIn}
              loading={checkIn.isPending}
              style={styles.checkInBtn}
            />
            {/* The full fee is already spent by kickoff — say so rather than
                let the button read as optional. */}
            <Text style={styles.footnote}>
              missing check-in costs the full fee and releases your spot to a sub
            </Text>
          </GlassCard>
        )}

        {phase === "pick_side" && (
          <GlassCard style={styles.card} round={28} padding={23}>
            <HandwrittenHeader style={styles.script26}>pick your side</HandwrittenHeader>
            <Text style={styles.subtle}>tap a team to join</Text>
            {notice && <Text style={styles.notice}>{notice}</Text>}

            <View style={styles.tiles}>
              {([1, 2] as const).map((t) => (
                <TeamTile
                  key={t}
                  team={t}
                  count={t === 1 ? (roster?.yellowCount ?? 0) : (roster?.purpleCount ?? 0)}
                  half={half}
                  selected={pendingTeam === t}
                  onPress={() => setPendingTeam(t)}
                />
              ))}
            </View>

            <SideDots
              capacity={capacity}
              orange={roster?.yellowCount ?? 0}
              purple={roster?.purpleCount ?? 0}
            />
            <Text style={styles.dotsCaption}>{checkedInCount} of {capacity} checked in</Text>

            <Btn3D
              label={pendingTeam ? `join ${TEAM[pendingTeam].label.toLowerCase()}` : "pick a team"}
              onPress={doClaim}
              disabled={!pendingTeam}
              loading={claimSide.isPending}
              style={styles.joinBtn}
            />
          </GlassCard>
        )}

        {phase === "waiting" && (
          <GlassCard style={styles.card} round={28} padding={23}>
            <PulseRings />
            <Text style={styles.bigCount}>{checkedInCount} / {capacity}</Text>
            <Text style={styles.centerSub}>checked in</Text>
            <HandwrittenHeader style={styles.script19}>warming up…</HandwrittenHeader>
            <CheckedInRow entries={roster?.entries ?? []} capacity={capacity} />
            <Text style={styles.footnote}>waiting for everyone to tap I'm Here</Text>
          </GlassCard>
        )}

        {phase === "hold" && (
          <GlassCard style={styles.card} round={28} padding={23}>
            <HandwrittenHeader style={styles.script24}>
              {checkedInCount >= capacity ? "everyone's here!" : "ready when you are"}
            </HandwrittenHeader>
            <Text style={styles.subtle}>hold to start the match</Text>
            {notice && <Text style={styles.notice}>{notice}</Text>}

            <HoldButton onComplete={doStart} busy={startMatch.isPending} />

            <Text style={styles.holdCount}>{checkedInCount} / {capacity} checked in</Text>
            <HoldDots capacity={capacity} filled={checkedInCount} />
            <Text style={styles.footnote}>releasing resets your hold</Text>
            {/* The frame reads "match starts when all 12 are holding". There is
                no shared holding state in the schema — no column, no RPC, no
                presence channel — so the collective hold is not claimed here.
                Starting is one player's call, which is also the ratified rule
                ("the operator controls the match, no auto-anything"). */}
            <Text style={styles.footnote}>any checked-in player can start the match</Text>
          </GlassCard>
        )}

        {phase === "starting" && (
          <GlassCard style={styles.card} round={28} padding={23}>
            <HandwrittenHeader style={styles.script24}>starting in</HandwrittenHeader>
            <View style={styles.countRow}>
              <LinearGradient
                colors={["#FFC26B", "#FA8C1A"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.countDisc}
              >
                <Text style={styles.countNum}>{countdown}</Text>
              </LinearGradient>
              <Text style={[styles.ghostNum, styles.ghost2]}>{Math.max(0, (countdown ?? 1) - 1)}</Text>
              <Text style={[styles.ghostNum, styles.ghost1]}>{Math.max(0, (countdown ?? 2) - 2)}</Text>
            </View>
            <Text style={styles.centerSub}>get to your positions!</Text>
            <View style={styles.lockedRow}>
              <Check size={13} color="#0E6B2E" strokeWidth={3} />
              <Text style={styles.lockedText}>{checkedInCount} checked in — teams locked</Text>
            </View>
          </GlassCard>
        )}

        {phase === "coin_flip" && kickoffTeam !== null && (
          <Pressable onPress={() => setSawCoinFlip(true)}>
            <GlassCard style={styles.card} round={28} padding={23}>
              <HandwrittenHeader style={styles.script26}>coin flip</HandwrittenHeader>
              <Text style={styles.subtle}>who kicks off?</Text>
              <Coin />
              <View style={[styles.resultPill, { backgroundColor: "rgba(255,222,194,0.9)" }]}>
                <View style={[styles.resultDot, { backgroundColor: TEAM[kickoffTeam].color }]} />
                <Text style={[styles.resultText, { color: TEAM[kickoffTeam].ink }]}>
                  {TEAM[kickoffTeam].label} kicks off!
                </Text>
              </View>
              <Text style={styles.footnote}>tap anywhere to continue</Text>
            </GlassCard>
          </Pressable>
        )}

        {phase === "teams" && (
          <GlassCard style={styles.card} round={28} padding={23}>
            <HandwrittenHeader style={styles.teamsTitle}>teams are set</HandwrittenHeader>
            <View style={styles.panels}>
              {([1, 2] as const).map((t) => (
                <TeamPanel
                  key={t}
                  team={t}
                  members={(roster?.entries ?? []).filter((e) => e.team === t)}
                  kicksOff={kickoffTeam === t}
                  meBookingId={myBooking?.id}
                />
              ))}
            </View>
            <BtnOutline label="Done" onPress={() => router.replace(`/game/${id}`)} style={{ marginTop: 17 }} />
            {kickoffTeam !== null && (
              <Text style={styles.footnote}>
                kickoff decided by coin flip · {TEAM[kickoffTeam].label} starts
              </Text>
            )}
          </GlassCard>
        )}

        {/* Group chat, inline. It opens with the check-in window and closes
            20 minutes after kickoff, so inside that window it shows itself
            rather than waiting to be found — the messages are the point, not
            the entry point. Tapping opens the full thread. */}
        {inChatWindow && !chatOff && (
          <Pressable
            onPress={() => conversationId && router.push(`/chat/${conversationId}`)}
            disabled={!conversationId}
          >
            <GlassCard style={styles.chatCard} round={28} padding={19}>
              <View style={styles.chatHead}>
                <MessageCircle size={15} color={colors.orange} strokeWidth={2.2} />
                <Text style={styles.chatTitle}>squad chat</Text>
                <Text style={styles.chatOpen}>open until 20 min after kickoff</Text>
              </View>

              {recent.length === 0 ? (
                <Text style={styles.chatEmpty}>
                  {conversationId ? "No messages yet — say something." : "Opening…"}
                </Text>
              ) : (
                recent.map((m) => (
                  // messages carry sender_id but no name, and RosterEntry has
                  // no user id to join on — so a sender is "you" or nothing.
                  // The full thread does the same, with avatars.
                  <Text key={m.id} style={styles.chatLine} numberOfLines={2}>
                    {m.senderId === user?.id && <Text style={styles.chatWho}>you  </Text>}
                    {m.body}
                  </Text>
                ))
              )}
            </GlassCard>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

/* ── phase model ───────────────────────────────────────────────────────────
 * One linear path, derived from server state on every render — no phase is
 * stored, so realtime roster updates move every player's screen together.
 *
 *   check_in → pick_side → waiting → hold → (starting) → coin_flip → teams
 *
 * `starting` and `coin_flip` are the only two with a local component: the
 * 3-2-1 belongs to whoever pressed start, and `sawCoinFlip` stops the reveal
 * repeating after it has been dismissed. Everything else is a pure function
 * of the roster, so leaving and reopening the screen restores the same card.
 */
function derivePhase(s: {
  loading: boolean;
  hasBooking: boolean;
  iAmCheckedIn: boolean;
  myTeam: 1 | 2 | null;
  locked: boolean;
  kickoffTeam: 1 | 2 | null;
  sawCoinFlip: boolean;
  countdown: number | null;
  checkedInCount: number;
}): Phase {
  if (s.loading) return "loading";
  if (!s.hasBooking) return "no_booking";
  if (s.countdown !== null && s.countdown > 0) return "starting";
  if (s.locked) {
    // No kickoff team on the row means the flip has not been stored yet;
    // showing a coin with no result would be inventing one.
    if (s.kickoffTeam !== null && !s.sawCoinFlip) return "coin_flip";
    return "teams";
  }
  if (!s.iAmCheckedIn) return "check_in";
  if (s.myTeam === null) return "pick_side";
  // start_match rejects anything below MIN_PLAYERS_TO_START, so the hold
  // button only appears once it would actually succeed.
  if (s.checkedInCount >= MIN_PLAYERS_TO_START) return "hold";
  return "waiting";
}

/* ── pick your side (387:649) ─────────────────────────────────────────────── */

function TeamTile({ team, count, half, selected, onPress }: {
  team: 1 | 2; count: number; half: number; selected: boolean; onPress: () => void;
}) {
  const t = TEAM[team];
  const full = half > 0 && count >= half;
  const left = Math.max(0, half - count);
  return (
    <Pressable
      onPress={onPress}
      disabled={full}
      style={[
        styles.tile,
        { backgroundColor: t.tile },
        selected ? { borderWidth: 2.5, borderColor: t.color } : { borderWidth: 1, borderColor: "rgba(255,255,255,0.85)" },
        full && !selected && { opacity: 0.55 },
      ]}
    >
      <View style={[styles.tileDisc, { backgroundColor: t.color }]} />
      <Text style={[styles.tileLabel, { color: t.ink }]}>{t.label}</Text>
      <Text style={[styles.tileCount, { color: t.ink }]}>{count}/{half}</Text>
      <View style={styles.tileBar}>
        <View style={[styles.tileBarFill, {
          backgroundColor: t.color,
          width: half > 0 ? `${Math.min(100, (count / half) * 100)}%` : "0%",
        }]} />
      </View>
      <Text style={[styles.tileLeft, { color: t.ink }]}>{full ? "full" : `${left} left`}</Text>
      {selected && (
        <View style={[styles.tileBadge, { backgroundColor: t.color }]}>
          <Check size={14} color="#FFFFFF" strokeWidth={3} />
        </View>
      )}
    </Pressable>
  );
}

/** One dot per squad place: picked sides tinted, the rest still open. */
function SideDots({ capacity, orange, purple }: { capacity: number; orange: number; purple: number }) {
  const dots: string[] = [];
  for (let i = 0; i < orange; i++) dots.push(TEAM[1].color);
  for (let i = 0; i < purple; i++) dots.push(TEAM[2].color);
  while (dots.length < capacity) dots.push("rgba(173,173,178,0.35)");
  return (
    <View style={styles.dotsRow}>
      {dots.map((c, i) => <View key={i} style={[styles.dot8, { backgroundColor: c }]} />)}
    </View>
  );
}

/* ── waiting (388:478) ─────────────────────────────────────────────────────── */

function PulseRings() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulseRing, { transform: [{ scale }], opacity }]} />
      <View style={styles.pulseInner} />
    </View>
  );
}

/**
 * The frame shows player photos; the schema has none (get_game_roster returns
 * a name only), so these are the shared initial avatars. Open places render as
 * dashed outlines, exactly as the frame does for the players still to arrive.
 */
function CheckedInRow({ entries, capacity }: { entries: RosterEntry[]; capacity: number }) {
  const checked = entries.filter((e) => e.checkedIn);
  const empty = Math.max(0, capacity - checked.length);
  return (
    <View style={styles.avatarRow}>
      {checked.map((e) => (
        <View key={e.bookingId} style={styles.avatarSlot}>
          <Avatar name={e.name} size={26} />
        </View>
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <View key={`empty-${i}`} style={[styles.avatarSlot, styles.emptySlot]} />
      ))}
    </View>
  );
}

/* ── hold to start (394:478) ──────────────────────────────────────────────── */

function HoldButton({ onComplete, busy }: { onComplete: () => void; busy: boolean }) {
  const fill = useRef(new Animated.Value(0)).current;
  const done = useRef(false);
  const [holding, setHolding] = useState(false);

  const begin = () => {
    if (busy || done.current) return;
    setHolding(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(fill, { toValue: 1, duration: HOLD_MS, useNativeDriver: false })
      .start(({ finished }) => {
        if (!finished) return;
        done.current = true;
        setHolding(false);
        onComplete();
      });
  };

  const end = () => {
    if (done.current) return;
    setHolding(false);
    fill.stopAnimation();
    Animated.timing(fill, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  };

  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <Pressable
      onPressIn={begin}
      onPressOut={end}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Hold to start the match"
      style={[styles.holdBtn, busy && { opacity: 0.7 }]}
    >
      <Animated.View style={[styles.holdFill, { width }]} />
      <Text style={styles.holdLabel}>
        {busy ? "starting…" : holding ? "Keep holding…" : "Hold to start"}
      </Text>
    </Pressable>
  );
}

function HoldDots({ capacity, filled }: { capacity: number; filled: number }) {
  return (
    <View style={styles.holdDotsRow}>
      {Array.from({ length: capacity }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot14,
            i < filled
              ? { backgroundColor: colors.orange }
              : { borderWidth: 1.5, borderColor: "rgba(173,173,178,0.5)" },
          ]}
        />
      ))}
    </View>
  );
}

/* ── coin flip (390:478) ──────────────────────────────────────────────────── */

/**
 * The coin is drawn, not exported: the frame's gold disc is a stack of two
 * gradient circles and an emblem, which is cheaper in RN than shipping an
 * asset. (Only the dot wave is a mandated image asset.) The flip itself is
 * server-side and stored once — this only reveals `games.kickoff_team`.
 */
function Coin() {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(spin, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }).start();
  }, [spin]);
  const scale = spin.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <Animated.View style={[styles.coinWrap, { transform: [{ scale }] }]}>
      <LinearGradient
        colors={["#F7C25B", "#D9902A"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.coinOuter}
      >
        <LinearGradient
          colors={["#FFD98A", "#E5A63C"]}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={styles.coinInner}
        >
          <Text style={styles.coinGlyph}>★</Text>
        </LinearGradient>
      </LinearGradient>
      <View style={styles.coinSheen} />
    </Animated.View>
  );
}

/* ── teams (388:496) ──────────────────────────────────────────────────────── */

function TeamPanel({ team, members, kicksOff, meBookingId }: {
  team: 1 | 2; members: RosterEntry[]; kicksOff: boolean; meBookingId?: string;
}) {
  const t = TEAM[team];
  return (
    <View style={[styles.panel, { backgroundColor: t.panel }]}>
      <View style={styles.panelHead}>
        <View style={[styles.dot11, { backgroundColor: t.color }]} />
        <Text style={[styles.panelLabel, { color: t.ink }]}>{t.label}</Text>
        {kicksOff && (
          <View style={[styles.kicksOff, { backgroundColor: t.chip }]}>
            <Text style={styles.kicksOffText}>KICKS OFF</Text>
          </View>
        )}
      </View>
      {members.length === 0 && <Text style={styles.panelEmpty}>nobody yet</Text>}
      {members.map((m) => (
        <View key={m.bookingId} style={styles.panelRow}>
          <Avatar name={m.name} size={30} />
          <Text style={styles.panelName} numberOfLines={1}>
            {m.bookingId === meBookingId ? "You" : m.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Top padding is the safe-area inset, never a fixed 52 — that sits under
  // the Dynamic Island.
  screen: { flex: 1, backgroundColor: colors.canvas },
  loading: { paddingVertical: 80, alignItems: "center" },

  header: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 24, paddingTop: 34 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: colors.inkNavy },
  headerSub: { fontSize: 12, color: MUTED, marginTop: 6 },
  close: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: "#997359", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 8, elevation: 3,
  },

  scroll: { paddingHorizontal: 30, paddingTop: 60, flexGrow: 1, justifyContent: "center" },
  // minHeight, never height — copy length is free and must not overflow.
  card: { minHeight: 300 },

  // minHeight, not height: the preview grows with two-line messages.
  chatCard: { minHeight: 96, marginTop: 14 },
  chatHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  chatTitle: { fontSize: 13, fontWeight: "700", color: colors.ink },
  chatOpen: { flex: 1, fontSize: 10.5, color: FAINT, textAlign: "right" },
  chatEmpty: { fontSize: 13, color: MUTED, marginTop: 12 },
  chatLine: { fontSize: 13, color: colors.ink, marginTop: 10, lineHeight: 18 },
  chatWho: { fontWeight: "700", color: MUTED },

  eyebrow: { fontSize: 10, fontWeight: "600", color: FAINT, letterSpacing: 0.4 },
  cardTitle: { fontSize: 24, fontWeight: "700", color: colors.inkNavy, marginTop: 8 },
  cardSub: { fontSize: 13, color: MUTED, marginTop: 10 },
  script22: { fontSize: 22, marginTop: 26 },
  script24: { fontSize: 24, textAlign: "center", marginTop: 2 },
  script26: { fontSize: 26, textAlign: "center", marginTop: 2 },
  script19: { fontSize: 19, textAlign: "center", marginTop: 8 },
  checkInBtn: { marginTop: 30 },
  notice: { fontSize: 12, color: colors.danger, marginTop: 12, textAlign: "center" },
  footnote: { fontSize: 10.5, color: FAINT, textAlign: "center", marginTop: 12 },
  subtle: { fontSize: 11.5, color: FAINT, textAlign: "center", marginTop: 6 },
  centerSub: { fontSize: 13, color: MUTED, textAlign: "center", marginTop: 6 },

  // pick your side
  tiles: { flexDirection: "row", gap: 14, marginTop: 22 },
  tile: { flex: 1, minHeight: 170, borderRadius: 22, alignItems: "center", paddingTop: 15, paddingHorizontal: 13 },
  tileDisc: { width: 34, height: 34, borderRadius: 17 },
  tileLabel: { fontSize: 13, fontWeight: "700", marginTop: 8 },
  tileCount: { fontSize: 19, fontWeight: "700", marginTop: 3, fontVariant: ["tabular-nums"] },
  tileBar: { height: 6, borderRadius: 3, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.6)", marginTop: 16, overflow: "hidden" },
  tileBarFill: { height: 6, borderRadius: 3 },
  tileLeft: { fontSize: 10, fontWeight: "600", marginTop: 12 },
  tileBadge: {
    position: "absolute", top: -13, right: -8, width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.9)",
  },
  dotsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 26 },
  dot8: { width: 8, height: 8, borderRadius: 4 },
  dotsCaption: { fontSize: 11, color: MUTED, textAlign: "center", marginTop: 14 },
  joinBtn: { marginTop: 24 },

  // waiting
  pulseWrap: { width: 96, height: 96, alignSelf: "center", alignItems: "center", justifyContent: "center", marginTop: 2 },
  pulseRing: { position: "absolute", width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: "rgba(242,140,38,0.5)" },
  pulseInner: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(242,140,38,0.55)" },
  bigCount: { fontSize: 34, fontWeight: "700", color: colors.inkNavy, textAlign: "center", marginTop: 16, fontVariant: ["tabular-nums"] },
  avatarRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 3, marginTop: 22 },
  avatarSlot: { width: 26, height: 26, borderRadius: 13, overflow: "hidden" },
  emptySlot: { borderWidth: 1, borderColor: "rgba(173,173,178,0.45)", borderStyle: "dashed" },

  // hold to start
  holdBtn: {
    height: 60, borderRadius: 30, marginTop: 24, alignSelf: "center", width: "84%",
    backgroundColor: colors.orange, alignItems: "center", justifyContent: "center", overflow: "hidden",
    shadowColor: "#FF9F0A", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 22, elevation: 6,
  },
  holdFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "rgba(255,255,255,0.28)" },
  holdLabel: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  holdCount: { fontSize: 12, fontWeight: "600", color: colors.inkNavy, textAlign: "center", marginTop: 26, fontVariant: ["tabular-nums"] },
  holdDotsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 4.5, marginTop: 14 },
  dot14: { width: 14, height: 14, borderRadius: 7 },

  // starting
  countRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 18 },
  countDisc: { width: 140, height: 140, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  countNum: { fontSize: 84, fontWeight: "700", color: "#FFFFFF", fontVariant: ["tabular-nums"] },
  ghostNum: { fontWeight: "700", color: colors.inkNavy, marginLeft: 12 },
  ghost2: { fontSize: 30, opacity: 0.35 },
  ghost1: { fontSize: 24, opacity: 0.18 },
  lockedRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 26 },
  lockedText: { fontSize: 11, fontWeight: "600", color: "#0E6B2E" },

  // coin flip
  coinWrap: { width: 140, height: 140, alignSelf: "center", alignItems: "center", justifyContent: "center", marginTop: 18 },
  coinOuter: {
    width: 116, height: 116, borderRadius: 58, alignItems: "center", justifyContent: "center",
    shadowColor: "#997359", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 18, elevation: 6,
  },
  coinInner: { width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center" },
  coinGlyph: { fontSize: 34, color: "#8A5A15" },
  coinSheen: {
    position: "absolute", top: 22, left: 26, width: 38, height: 20, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.45)", transform: [{ rotate: "30deg" }],
  },
  resultPill: {
    flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "center",
    minHeight: 42, borderRadius: 21, paddingHorizontal: 17, marginTop: 24,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.8)",
  },
  resultDot: { width: 12, height: 12, borderRadius: 6 },
  resultText: { fontSize: 14, fontWeight: "700" },

  // teams
  teamsTitle: { fontSize: 24, color: colors.inkNavy, textAlign: "center", marginTop: 2 },
  panels: { flexDirection: "row", gap: 10, marginTop: 20 },
  panel: {
    flex: 1, minHeight: 290, borderRadius: 20, padding: 13,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.8)",
  },
  panelHead: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 20 },
  dot11: { width: 11, height: 11, borderRadius: 5.5 },
  panelLabel: { fontSize: 13, fontWeight: "700" },
  kicksOff: { marginLeft: "auto", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  kicksOffText: { fontSize: 7.5, fontWeight: "700", color: "#FFFFFF" },
  panelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  panelName: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.inkNavy },
  panelEmpty: { fontSize: 12, color: FAINT, marginTop: 12 },
});
