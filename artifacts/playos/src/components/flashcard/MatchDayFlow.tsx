import { useEffect, useState } from "react";
import { LiquidCard } from "@/components/flashcard/LiquidCard";
import { Users, Check, AlertCircle, Clock, Wifi, X } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  useGameRoster,
  useClaimSide,
  useStartMatch,
  performCheckIn,
  type ClaimSideResult,
} from "@/lib/supabase-api";

// ── Tint palette ─────────────────────────────────────────────────────────────
const TINT = {
  yellow: { color: "#F4B01E", ink: "#7A5200", soft: "rgba(244,176,30,0.18)", strong: "rgba(244,176,30,0.55)", glow: "rgba(244,176,30,0.5)", label: "Yellow" },
  purple: { color: "#7B4DFF", ink: "#3E2494", soft: "rgba(123,77,255,0.16)", strong: "rgba(123,77,255,0.5)", glow: "rgba(123,77,255,0.45)", label: "Purple" },
  green:  { color: "#34C759", ink: "#0E6B2E", soft: "rgba(52,199,89,0.18)", strong: "rgba(52,199,89,0.5)", glow: "rgba(52,199,89,0.45)", label: "Go" },
} as const;

type Team = "yellow" | "purple";
type Tint = keyof typeof TINT;

const tintVars = (t: Tint) =>
  ({ "--tint-ink": TINT[t].ink, "--tint-soft": TINT[t].soft, "--tint-strong": TINT[t].strong, "--tint-glow": TINT[t].glow } as React.CSSProperties);

function teamKey(team: 1 | 2 | null): Team {
  return team === 2 ? "purple" : "yellow";
}

function Avatar({ name, team }: { name: string; team?: Team }) {
  return (
    <span className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
      style={{ background: team ? TINT[team].color : "#0A84FF" }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

type Phase = "loading" | "no_booking" | "outside_window" | "arrival" | "pulse" | "choose" | "waiting" | "reveal" | "tactical";

const EXIT_MS = 340;

function useGameInfo(gameId: string | null) {
  return useQuery({
    queryKey: ["game-info", gameId],
    enabled: !!gameId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("games")
        .select("id, title, pitch_name, kickoff_time, capacity, kickoff_team, teams_locked_at, status")
        .eq("id", gameId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

function useMyBooking(gameId: string | null, userId: string | undefined) {
  return useQuery({
    queryKey: ["my-booking", gameId, userId],
    enabled: !!gameId && !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, team, checked_in, checked_in_at, payment_status")
        .eq("game_id", gameId!)
        .eq("user_id", userId!)
        .in("payment_status", ["paid", "pending"])
        .single();
      return data ?? null;
    },
  });
}

function derivePhase(
  game: any | null | undefined,
  myBooking: any | null | undefined,
  roster: { teamsLockedAt: string | null } | undefined,
  myPickedTeam: 1 | 2 | null,
): Phase {
  if (!game || myBooking === undefined) return "loading";
  if (!myBooking) return "no_booking";

  const now = new Date();
  const kickoff = new Date(game.kickoff_time);
  const checkInOpens = new Date(kickoff.getTime() - 15 * 60 * 1000);

  if (!myBooking.checked_in && now < checkInOpens) return "outside_window";
  if (!myBooking.checked_in) return "arrival";

  const locked = game.teams_locked_at ?? roster?.teamsLockedAt;
  if (locked) return "reveal";

  const myTeam = myPickedTeam ?? myBooking.team;
  if (myTeam) return "waiting";

  return "choose";
}

export interface MatchDayFlowProps {
  gameId: string;
  onClose: () => void;
}

export function MatchDayFlow({ gameId, onClose }: MatchDayFlowProps) {
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>("loading");
  const [shown, setShown] = useState<Phase>("loading");
  const [exiting, setExiting] = useState(false);

  const [myPickedTeam, setMyPickedTeam] = useState<1 | 2 | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [showTactical, setShowTactical] = useState(false);

  const { data: game } = useGameInfo(gameId);
  const { data: myBooking, refetch: refetchMyBooking } = useMyBooking(gameId, user?.id);
  const roster = useGameRoster(gameId);
  const claimSide = useClaimSide();
  const startMatch = useStartMatch();

  useEffect(() => {
    const derived = derivePhase(game, myBooking, roster.data, myPickedTeam);
    if (derived === phase) return;
    setPhase(derived);
  }, [game, myBooking, roster.data, myPickedTeam]);

  // Auto-start when both sides fill naturally
  useEffect(() => {
    if (!gameId || !roster.data || roster.data.teamsLockedAt) return;
    const { yellowCount, purpleCount, capacity } = roster.data;
    const half = Math.floor(capacity / 2);
    if (yellowCount >= half && purpleCount >= half) {
      startMatch.mutate({ gameId }, {
        onSuccess: () => { refetchMyBooking(); roster.refetch?.(); },
      });
    }
  }, [roster.data?.yellowCount, roster.data?.purpleCount, roster.data?.teamsLockedAt]);

  useEffect(() => {
    if (shown !== "reveal" || showTactical) return;
    const t = setTimeout(() => setShowTactical(true), 3000);
    return () => clearTimeout(t);
  }, [shown]);

  useEffect(() => {
    if (phase === shown) return undefined;
    setExiting(true);
    const t = setTimeout(() => { setShown(phase); setExiting(false); }, EXIT_MS);
    return () => clearTimeout(t);
  }, [phase, shown]);

  async function handleCheckIn() {
    if (!game) return;
    setCheckingIn(true);
    setCheckInError(null);
    try {
      const { data: pitchRow } = await supabase
        .from("pitches").select("id").eq("name", game.pitch_name).single();
      const result = await performCheckIn(pitchRow?.id ?? game.pitch_name, gameId);
      if (result.status === "checked_in" || result.status === "already_checked_in") {
        await refetchMyBooking();
      } else if (result.status === "outside_window") {
        setCheckInError(`Check-in opens at ${format(new Date(result.opensAt), "h:mm a")}`);
      } else {
        setCheckInError("No booking found for this game");
      }
    } catch {
      setCheckInError("Something went wrong — try again");
    } finally {
      setCheckingIn(false);
    }
  }

  async function handlePickSide(team: 1 | 2) {
    setClaimError(null);
    setMyPickedTeam(team);
    const result = await claimSide.mutateAsync({ gameId, team }).catch(() => "error" as ClaimSideResult | "error");
    if (result === "full") {
      setMyPickedTeam(null);
      setClaimError(`${team === 1 ? "Yellow" : "Purple"} is full — pick the other side`);
    } else if (result === "not_checked_in") {
      setMyPickedTeam(null);
      setClaimError("You need to check in first");
    } else if (result === "ok" || result === "already_picked") {
      await refetchMyBooking();
    }
  }

  async function handleStartAnyway() {
    await startMatch.mutateAsync({ gameId }).catch(() => null);
    if (navigator.vibrate) navigator.vibrate(30);
    refetchMyBooking();
    roster.refetch?.();
  }

  const rData = roster.data;
  const myTeamNum: 1 | 2 | null = myPickedTeam ?? (myBooking?.team as 1 | 2 | null) ?? null;
  const myTeamKey: Team = teamKey(myTeamNum);
  const kickoffWinner: Team = teamKey(game?.kickoff_team as 1 | 2 | null);
  const capacity = game?.capacity ?? 12;
  const half = Math.floor(capacity / 2);
  const checkedInCount = rData?.checkedInCount ?? 0;
  const yellowCount = rData?.yellowCount ?? 0;
  const purpleCount = rData?.purpleCount ?? 0;
  const checkedInNames = (rData?.entries ?? []).filter((e) => e.checkedIn).map((e) => e.name);
  const yellowRoster = (rData?.entries ?? []).filter((e) => e.team === 1);
  const purpleRoster = (rData?.entries ?? []).filter((e) => e.team === 2);
  const kickoff = game ? new Date(game.kickoff_time) : null;

  function getRoster(t: Team) {
    return t === "yellow" ? yellowRoster : purpleRoster;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white/95 backdrop-blur-sm">
      <button
        onClick={onClose}
        aria-label="Close"
        className="fixed top-4 right-4 z-[60] h-9 w-9 rounded-full bg-white shadow-md flex items-center justify-center text-[#6C6C70]"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-1">
        <h1 className="text-2xl font-bold" style={{ color: "#1D3557" }}>{game?.title ?? "…"}</h1>
        {kickoff && (
          <p className="text-sm text-[#6C6C70]">
            {format(kickoff, "EEEE, d MMMM · h:mm a")} · {game?.pitch_name}
          </p>
        )}
        {roster.isError && (
          <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
            <Wifi className="h-3 w-3" /> Reconnecting…
          </p>
        )}
      </div>

      {(shown === "loading") && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground font-medium">Loading your game…</p>
          </div>
        </div>
      )}

      {shown === "no_booking" && (
        <div className="flex items-center justify-center py-16 px-4">
          <div className="text-center space-y-4 max-w-sm">
            <AlertCircle className="w-14 h-14 text-muted-foreground mx-auto" />
            <h1 className="text-2xl font-bold">No booking found</h1>
            <p className="text-muted-foreground text-sm">You don't have a confirmed booking for {game?.title ?? "this game"}.</p>
          </div>
        </div>
      )}

      {shown === "outside_window" && (
        <div className="flex items-center justify-center py-16 px-4">
          <div className="text-center space-y-4 max-w-sm">
            <Clock className="w-14 h-14 text-amber-500 mx-auto" />
            <h1 className="text-2xl font-bold">Not yet</h1>
            <p className="text-muted-foreground">
              Check-in for <strong>{game?.title}</strong> opens{" "}
              {kickoff ? <>at <strong>{format(new Date(kickoff.getTime() - 15 * 60 * 1000), "h:mm a")}</strong></> : "15 min before kickoff"}.
            </p>
          </div>
        </div>
      )}

      {shown === "arrival" && (
        <LiquidCard exiting={exiting}>
          <p className="text-[11px] uppercase tracking-widest text-[#AEAEB2] font-semibold">Check-in · now open</p>
          <h2 className="text-2xl font-extrabold mt-1" style={{ color: "#1D3557" }}>{game?.title}</h2>
          <p className="text-sm text-[#6C6C70]">{game?.pitch_name}{kickoff ? ` · kickoff ${format(kickoff, "h:mm a")}` : ""}</p>
          <p className="font-hand text-xl mt-5" style={{ color: "#FF9F0A" }}>you made it 👋</p>
          {checkInError && <p className="text-xs text-red-500 mt-2">{checkInError}</p>}
          <button
            className="lg-tint-btn w-full py-3.5 mt-2 text-base flex items-center justify-center gap-2 disabled:opacity-60"
            style={tintVars("green")}
            onClick={handleCheckIn}
            disabled={checkingIn}
          >
            {checkingIn
              ? <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : <Check className="h-5 w-5" />}
            I'm Here
          </button>
        </LiquidCard>
      )}

      {shown === "pulse" && (
        <LiquidCard exiting={exiting}>
          <div className="text-center">
            <div className="relative mx-auto h-20 w-20 mb-2">
              <span className="absolute inset-0 rounded-full animate-ping" style={{ background: "rgba(10,132,255,0.18)" }} />
              <span className="absolute inset-3 rounded-full animate-ping" style={{ background: "rgba(10,132,255,0.22)", animationDelay: "0.4s" }} />
              <span className="absolute inset-6 rounded-full" style={{ background: "#0A84FF" }} />
            </div>
            <p className="text-4xl font-extrabold tabular-nums" style={{ color: "#1D3557" }}>
              {checkedInCount} <span className="text-xl text-[#AEAEB2]">/ {capacity}</span>
            </p>
            <p className="text-sm text-[#6C6C70]">checked in</p>
            <p className="font-hand text-lg mt-1" style={{ color: "#FF9F0A" }}>warming up…</p>
            <div className="flex flex-wrap justify-center gap-1.5 mt-4">
              {checkedInNames.map((n, i) => <Avatar key={`${n}${i}`} name={n} />)}
            </div>
          </div>
        </LiquidCard>
      )}

      {shown === "choose" && (
        <LiquidCard exiting={exiting}>
          <p className="font-hand text-2xl text-center leading-none" style={{ color: "#FF9F0A" }}>pick your side</p>
          <p className="text-xs text-center text-[#AEAEB2] mt-1 mb-4">
            {myTeamNum ? "Locked in — waiting for the rest…" : "First come, first served"}
          </p>
          {claimError && <p className="text-xs text-red-500 text-center mb-3">{claimError}</p>}
          <div className="grid grid-cols-2 gap-3">
            {([1, 2] as const).map((t) => {
              const tk: Team = t === 1 ? "yellow" : "purple";
              const n = t === 1 ? yellowCount : purpleCount;
              const full = n >= half;
              const mine = !!myTeamNum && myTeamNum === t;
              const loading = claimSide.isPending && myPickedTeam === t;
              return (
                <button
                  key={t}
                  disabled={full || !!myTeamNum || claimSide.isPending}
                  onClick={() => handlePickSide(t)}
                  className="lg-tint-btn py-4 px-3 flex flex-col items-center gap-1.5 disabled:cursor-not-allowed"
                  style={{ ...tintVars(tk), outline: mine ? `2px solid ${TINT[tk].color}` : undefined }}
                >
                  {loading
                    ? <span className="h-9 w-9 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    : <span className="h-9 w-9 rounded-full" style={{ background: TINT[tk].color }} />}
                  <span className="text-sm font-bold">{TINT[tk].label}</span>
                  <span className="text-lg font-extrabold tabular-nums">{n}/{half}</span>
                  <span className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.5)" }}>
                    <span className="block h-full rounded-full transition-all duration-500"
                      style={{ width: `${(n / half) * 100}%`, background: TINT[tk].color }} />
                  </span>
                  <span className="text-[10px] font-semibold">
                    {mine ? "You're in" : full ? "Full" : `${half - n} left`}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap justify-center gap-1 mt-4">
            {Array.from({ length: yellowCount }).map((_, i) => (
              <span key={`y${i}`} className="h-2 w-2 rounded-full" style={{ background: TINT.yellow.color }} />
            ))}
            {Array.from({ length: purpleCount }).map((_, i) => (
              <span key={`p${i}`} className="h-2 w-2 rounded-full" style={{ background: TINT.purple.color }} />
            ))}
          </div>
        </LiquidCard>
      )}

      {shown === "waiting" && (
        <WaitingCard
          exiting={exiting}
          kickoff={kickoff}
          checkedInCount={checkedInCount}
          capacity={capacity}
          onStartAnyway={handleStartAnyway}
          starting={startMatch.isPending}
        />
      )}

      {shown === "reveal" && !showTactical && (
        <LiquidCard exiting={exiting} onBackdrop={() => setShowTactical(true)}>
          <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ background: TINT[myTeamKey].soft, color: TINT[myTeamKey].ink }}>
            <span className="h-2 w-2 rounded-full" style={{ background: TINT[myTeamKey].color }} />
            Team {TINT[myTeamKey].label}
          </div>
          <p className="font-hand text-2xl mt-3 leading-none" style={{ color: "#FF9F0A" }}>you're in</p>
          <h2 className="text-4xl font-extrabold tracking-tight mt-1" style={{ color: "#1D3557" }}>{user?.name ?? "Player"}</h2>
          <div className="lg-tint-btn mt-5 flex items-center gap-2 px-4 py-3" style={tintVars(myTeamKey)}>
            <Users className="h-4 w-4 shrink-0" style={{ color: TINT[myTeamKey].color }} />
            <span className="text-sm font-semibold">Find your team</span>
          </div>
          <button className="lg-tint-btn w-full py-3 mt-3 text-sm" style={tintVars(myTeamKey)} onClick={() => setShowTactical(true)}>
            View both teams
          </button>
        </LiquidCard>
      )}

      {shown === "reveal" && showTactical && (
        <LiquidCard exiting={exiting} maxWidth={460}>
          <p className="text-center font-hand text-2xl -mt-1 mb-3" style={{ color: "#1D3557" }}>teams are set</p>
          <div className="grid grid-cols-2 gap-3">
            {([1, 2] as const).map((t) => {
              const tk: Team = t === 1 ? "yellow" : "purple";
              const members = getRoster(tk);
              const isKickoff = game?.kickoff_team === t;
              return (
                <div key={t} className="rounded-2xl p-3" style={{ background: TINT[tk].soft }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: TINT[tk].color }} />
                    <span className="text-sm font-bold" style={{ color: TINT[tk].ink }}>{TINT[tk].label}</span>
                    {isKickoff && (
                      <span className="ml-auto text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                        style={{ background: TINT[tk].color, color: "#fff" }}>Kicks off</span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {members.length === 0 && <p className="text-xs text-[#AEAEB2]">No players yet</p>}
                    {members.map((entry) => (
                      <div key={entry.bookingId} className="flex items-center gap-2">
                        <Avatar name={entry.name} team={tk} />
                        <span className="text-sm font-medium truncate" style={{ color: "#1D3557" }}>{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <button className="lg-tint-btn w-full py-3 mt-4 text-sm" style={tintVars("green")} onClick={onClose}>
            Done
          </button>
        </LiquidCard>
      )}
    </div>
  );
}

/* ── Waiting card: countdown → hold-to-start at kickoff ──────────────────── */

function WaitingCard({
  exiting, kickoff, checkedInCount, capacity, onStartAnyway, starting,
}: {
  exiting: boolean;
  kickoff: Date | null;
  checkedInCount: number;
  capacity: number;
  onStartAnyway: () => void;
  starting: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [holdProgress, setHoldProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const kickoffReached = kickoff ? now >= kickoff.getTime() : false;
  const secondsLeft = kickoff ? Math.max(0, Math.floor((kickoff.getTime() - now) / 1000)) : 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  useEffect(() => {
    if (!holding) return undefined;
    let raf: number;
    const step = () => {
      setHoldProgress((p) => {
        const next = Math.min(1, p + 0.02);
        if (next >= 1) {
          setCompleted(true);
          onStartAnyway();
          return 1;
        }
        raf = requestAnimationFrame(step);
        return next;
      });
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [holding]);

  function endHold() {
    if (completed) return;
    setHolding(false);
    setHoldProgress(0);
  }

  return (
    <LiquidCard exiting={exiting}>
      <p className="font-hand text-2xl text-center leading-none" style={{ color: "#FF9F0A" }}>you're in</p>
      <p className="text-xs text-center text-[#AEAEB2] mt-1 mb-5">Waiting for everyone to pick sides…</p>
      <p className="text-center text-sm text-[#6C6C70] tabular-nums mb-5">{checkedInCount} / {capacity} checked in</p>

      {!kickoffReached && (
        <div className="text-center">
          <p className="text-xs text-[#AEAEB2] mb-1">Kicks off in</p>
          <p className="text-[34px] font-extrabold tabular-nums leading-none" style={{ color: "#1D3557" }}>{mm}:{ss}</p>
        </div>
      )}

      {kickoffReached && (
        <div className="flex flex-col items-center gap-2.5 mt-2">
          <button
            onPointerDown={(e) => { e.preventDefault(); if (!starting && !completed) setHolding(true); }}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            disabled={starting}
            aria-label="Hold to start the match anyway"
            className="relative w-[200px] h-14 rounded-full text-white text-base font-semibold overflow-hidden select-none disabled:opacity-70"
            style={{
              background: completed ? "#34C759" : "#FF9F0A",
              touchAction: "none",
              animation: "matchday-hold-in 0.5s cubic-bezier(.2,1.3,.4,1)",
              boxShadow: completed ? "none" : "0 0 0 0 rgba(255,159,10,0.5)",
            }}
          >
            <span
              className="absolute inset-0"
              style={{ width: `${holdProgress * 100}%`, background: "rgba(255,255,255,0.28)", transition: holding ? "none" : "width 0.2s" }}
            />
            <span className="relative z-10">
              {completed ? "Starting ✓" : holding ? "Keep holding…" : "Hold to start"}
            </span>
          </button>
          <p className="text-[11px] text-[#AEAEB2]">Any checked-in player can start once it's time</p>
        </div>
      )}

      <style>{`
        @keyframes matchday-hold-in {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          button[aria-label="Hold to start the match anyway"] { animation: none !important; }
        }
      `}</style>
    </LiquidCard>
  );
}
