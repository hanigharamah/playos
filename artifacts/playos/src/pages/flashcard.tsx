import { useEffect, useState, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { LiquidCard } from "@/components/flashcard/LiquidCard";
import { Users, Check, AlertCircle, Clock, Wifi } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  useGameRoster,
  useClaimSide,
  useLockTeams,
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

// ── Phase type ────────────────────────────────────────────────────────────────
type Phase = "loading" | "no_booking" | "outside_window" | "arrival" | "pulse" | "choose" | "coinflip" | "reveal" | "tactical";

const EXIT_MS = 340;

// ── Game info query ───────────────────────────────────────────────────────────
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

// ── My booking in this game ───────────────────────────────────────────────────
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

// ── Derive which phase to show based on live DB state ────────────────────────
function derivePhase(
  game: any | null | undefined,
  myBooking: any | null | undefined,
  roster: { teamsLockedAt: string | null; yellowCount: number; purpleCount: number; capacity: number } | undefined,
  myPickedTeam: 1 | 2 | null,
): Phase {
  if (!game || myBooking === undefined) return "loading";
  if (!myBooking) return "no_booking";

  const now = new Date();
  const kickoff = new Date(game.kickoff_time);
  const checkInOpens = new Date(kickoff.getTime() - 15 * 60 * 1000);

  if (!myBooking.checked_in && now < checkInOpens) return "outside_window";
  if (!myBooking.checked_in) return "arrival";

  // Checked in — determine how far along the game flow is
  const locked = game.teams_locked_at ?? roster?.teamsLockedAt;
  if (locked) {
    // Teams are locked; if user is in tactical view keep them there
    return "reveal";
  }

  // Teams not locked yet
  const myTeam = myPickedTeam ?? myBooking.team;
  if (myTeam) return "coinflip"; // picked, waiting for others

  return "choose";
}

export default function Flashcard({ params }: { params?: { gameId?: string } }) {
  const searchStr = useSearch();
  const searchParams = new URLSearchParams(searchStr);
  const gameIdFromQuery = searchParams.get("gameId");
  const gameId = params?.gameId ?? gameIdFromQuery;

  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Phase state — target vs rendered (for flip transition)
  const [phase, setPhase] = useState<Phase>("loading");
  const [shown, setShown] = useState<Phase>("loading");
  const [exiting, setExiting] = useState(false);

  // My local pick (before DB confirms — optimistic)
  const [myPickedTeam, setMyPickedTeam] = useState<1 | 2 | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [showTactical, setShowTactical] = useState(false);

  const { data: game } = useGameInfo(gameId ?? null);
  const { data: myBooking, refetch: refetchMyBooking } = useMyBooking(gameId ?? null, user?.id);
  const roster = useGameRoster(gameId ?? null);
  const claimSide = useClaimSide();
  const lockTeams = useLockTeams();

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation(`/auth?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [authLoading, user, setLocation]);

  // Derive and advance phase from live data
  useEffect(() => {
    const derived = derivePhase(game, myBooking, roster.data, myPickedTeam);
    if (derived === phase) return;
    setPhase(derived);
  }, [game, myBooking, roster.data, myPickedTeam]);

  // Auto-lock when both sides full
  useEffect(() => {
    if (!gameId || !roster.data || roster.data.teamsLockedAt) return;
    const { yellowCount, purpleCount, capacity } = roster.data;
    const half = Math.floor(capacity / 2);
    if (yellowCount >= half && purpleCount >= half) {
      lockTeams.mutate({ gameId }, {
        onSuccess: () => {
          refetchMyBooking();
          roster.refetch?.();
        },
      });
    }
  }, [roster.data?.yellowCount, roster.data?.purpleCount, roster.data?.teamsLockedAt]);

  // Advance to tactical after reveal auto-shows for 3s
  useEffect(() => {
    if (shown !== "reveal" || showTactical) return;
    const t = setTimeout(() => setShowTactical(true), 3000);
    return () => clearTimeout(t);
  }, [shown]);

  // Card flip transition
  useEffect(() => {
    if (phase === shown) return undefined;
    setExiting(true);
    const t = setTimeout(() => { setShown(phase); setExiting(false); }, EXIT_MS);
    return () => clearTimeout(t);
  }, [phase, shown]);

  // Coin-flip display: once teams are locked, animate then show tactical
  const [flipDone, setFlipDone] = useState(false);
  useEffect(() => {
    if (shown !== "coinflip") return undefined;
    setFlipDone(false);
    const land = setTimeout(() => setFlipDone(true), 2250);
    const next = setTimeout(() => setPhase("reveal"), 4200);
    return () => { clearTimeout(land); clearTimeout(next); };
  }, [shown]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handleCheckIn() {
    if (!game) return;
    setCheckingIn(true);
    setCheckInError(null);
    try {
      // Find the pitch id from the game's pitch_name
      const { data: pitchRow } = await supabase
        .from("pitches")
        .select("id")
        .eq("name", game.pitch_name)
        .single();

      const result = await performCheckIn(pitchRow?.id ?? game.pitch_name, gameId ?? undefined);

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
    if (!gameId) return;
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

  // ── Derived display values ───────────────────────────────────────────────────
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

  function getRoster(t: Team) {
    return t === "yellow" ? yellowRoster : purpleRoster;
  }

  const kickoff = game ? new Date(game.kickoff_time) : null;

  // ── No gameId — show the old prototype demo link ─────────────────────────────
  if (!gameId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-bold">No game specified</h1>
          <p className="text-sm text-muted-foreground">Scan a QR code or open a match-day link to check in.</p>
        </div>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (shown === "loading" || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground font-medium">Loading your game…</p>
        </div>
      </div>
    );
  }

  // ── No booking ─────────────────────────────────────────────────────────────
  if (shown === "no_booking") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <AlertCircle className="w-14 h-14 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">No booking found</h1>
          <p className="text-muted-foreground text-sm">You don't have a confirmed booking for {game?.title ?? "this game"}.</p>
          <button className="glass glass-btn px-4 py-2 text-sm" onClick={() => setLocation("/games")}>Browse Games</button>
        </div>
      </div>
    );
  }

  // ── Outside window ─────────────────────────────────────────────────────────
  if (shown === "outside_window") {
    const opensAt = kickoff ? new Date(kickoff.getTime() - 15 * 60 * 1000) : null;
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <Clock className="w-14 h-14 text-amber-500 mx-auto" />
          <h1 className="text-2xl font-bold">Not yet</h1>
          <p className="text-muted-foreground">
            Check-in for <strong>{game?.title}</strong> opens{" "}
            {opensAt ? <>at <strong>{format(opensAt, "h:mm a")}</strong></> : "15 min before kickoff"}.
          </p>
          <p className="text-xs text-muted-foreground">Come back closer to kickoff</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
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

      {/* ── ARRIVAL ── */}
      {shown === "arrival" && (
        <LiquidCard exiting={exiting}>
          <p className="text-[11px] uppercase tracking-widest text-[#AEAEB2] font-semibold">Check-in · now open</p>
          <h2 className="text-2xl font-extrabold mt-1" style={{ color: "#1D3557" }}>{game?.title}</h2>
          <p className="text-sm text-[#6C6C70]">{game?.pitch_name}{kickoff ? ` · kickoff ${format(kickoff, "h:mm a")}` : ""}</p>
          <p className="font-hand text-xl mt-5" style={{ color: "#FF9F0A" }}>you made it 👋</p>
          {checkInError && (
            <p className="text-xs text-red-500 mt-2">{checkInError}</p>
          )}
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

      {/* ── PULSE ── */}
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

      {/* ── CHOOSE ── */}
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

      {/* ── COINFLIP ── */}
      {shown === "coinflip" && (
        <LiquidCard exiting={exiting}>
          <p className="font-hand text-2xl text-center leading-none mb-1" style={{ color: "#FF9F0A" }}>coin toss</p>
          <p className="text-xs text-center text-[#AEAEB2] mb-5">Deciding who kicks off</p>
          <div className="coin-scene">
            <div className={`coin ${kickoffWinner === "purple" ? "coin--purple" : ""}`}>
              <div className="coin__face text-2xl" style={{ background: `radial-gradient(circle at 35% 30%, #FFDD7A, ${TINT.yellow.color})` }}>Y</div>
              <div className="coin__face coin__face--back text-2xl" style={{ background: `radial-gradient(circle at 35% 30%, #A98BFF, ${TINT.purple.color})` }}>P</div>
            </div>
          </div>
          {!rData?.teamsLockedAt && (
            <p className="text-center text-xs text-[#AEAEB2] mt-4">
              Waiting for all {capacity} players to pick sides…<br />
              <span className="tabular-nums">{yellowCount + purpleCount} / {capacity} picked</span>
            </p>
          )}
          <p className="text-center text-sm font-bold mt-3 transition-opacity duration-300"
            style={{ color: flipDone && rData?.teamsLockedAt ? TINT[kickoffWinner].ink : "#AEAEB2", opacity: flipDone && rData?.teamsLockedAt ? 1 : 0.4 }}>
            {flipDone && rData?.teamsLockedAt ? `${TINT[kickoffWinner].label} kicks off` : "flipping…"}
          </p>
        </LiquidCard>
      )}

      {/* ── REVEAL ── */}
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

      {/* ── TACTICAL ── */}
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
                    {members.length === 0 && (
                      <p className="text-xs text-[#AEAEB2]">No players yet</p>
                    )}
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
        </LiquidCard>
      )}
    </div>
  );
}
