import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { getPath } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Clock, List } from "lucide-react";
import { format } from "date-fns";

interface Props {
  params: { pitchId: string };
}

type CheckInStatus =
  | { status: "checked_in"; title: string; team: number; pitchName: string; checkedInAt: string; minutesLate: number | null }
  | { status: "already_checked_in"; title: string; team: number; pitchName: string; checkedInAt: string }
  | { status: "multiple_matches"; matches: { bookingId: string; gameId: string; title: string; kickoffTime: string; team: number; pitchName: string }[] }
  | { status: "no_match"; pitchName: string | null }
  | { status: "outside_window"; opensAt: string; title: string; pitchName: string };

export default function CheckIn({ params }: Props) {
  const { pitchId } = params;
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [result, setResult] = useState<CheckInStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setLocation(`/auth?returnUrl=${encodeURIComponent(`/checkin/${pitchId}`)}`);
      return;
    }
    doCheckIn();
  }, [loading, user]);

  async function doCheckIn(gameId?: string) {
    setChecking(true);
    setError(null);
    try {
      const url = gameId
        ? `${base}/api/checkin/${pitchId}/game/${gameId}`
        : `${base}/api/checkin/${pitchId}`;
      const resp = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        setError(body?.error || "Something went wrong");
        return;
      }
      const data = await resp.json();
      setResult(data);
    } catch {
      setError("Network error — please try again");
    } finally {
      setChecking(false);
    }
  }

  if (loading || (checking && !result)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground font-medium">Checking you in…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-sm">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold">Error</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => doCheckIn()} className="w-full">Try Again</Button>
        </div>
      </div>
    );
  }

  if (!result) return null;

  // ─── CHECKED IN ───────────────────────────────────────────────
  if (result.status === "checked_in") {
    const t = new Date(result.checkedInAt);
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50 dark:bg-green-950 px-4">
        <div className="text-center space-y-5 max-w-sm w-full">
          <div className="relative mx-auto w-24 h-24">
            <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/40 animate-[scale-in_0.35s_ease-out]">
              <CheckCircle className="w-14 h-14 text-white stroke-[1.5]" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-green-700 dark:text-green-300 tracking-tight">
              You're checked in!
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">{format(t, "h:mm a")}</p>
          </div>
          <div className="bg-white dark:bg-green-900/40 rounded-2xl shadow-sm border border-green-200 dark:border-green-800 p-5 space-y-2 text-left">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Game</span>
              <span className="font-semibold text-sm text-right max-w-[60%] truncate">{result.title}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pitch</span>
              <span className="font-semibold text-sm">{result.pitchName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Team</span>
              <span className="font-bold text-base text-green-600 dark:text-green-400">Team {result.team}</span>
            </div>
          </div>
          {result.minutesLate !== null && result.minutesLate > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Checked in {result.minutesLate} minute{result.minutesLate !== 1 ? "s" : ""} after kickoff
            </p>
          )}
          <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>
            Back to home
          </Button>
        </div>
      </div>
    );
  }

  // ─── ALREADY CHECKED IN ───────────────────────────────────────
  if (result.status === "already_checked_in") {
    const t = new Date(result.checkedInAt);
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50 dark:bg-green-950 px-4">
        <div className="text-center space-y-5 max-w-sm w-full">
          <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/40 mx-auto">
            <CheckCircle className="w-14 h-14 text-white stroke-[1.5]" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-green-700 dark:text-green-300">Already checked in ✓</h1>
            <p className="text-muted-foreground text-sm mt-1">at {format(t, "h:mm a")}</p>
          </div>
          <div className="bg-white dark:bg-green-900/40 rounded-2xl border border-green-200 dark:border-green-800 p-5 space-y-2 text-left">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Game</span><span className="font-semibold text-sm">{result.title}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Pitch</span><span className="font-semibold text-sm">{result.pitchName}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Team</span><span className="font-bold text-green-600">Team {result.team}</span></div>
          </div>
          <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>Back to home</Button>
        </div>
      </div>
    );
  }

  // ─── MULTIPLE MATCHES ─────────────────────────────────────────
  if (result.status === "multiple_matches") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-sm w-full space-y-5">
          <div className="text-center">
            <List className="w-12 h-12 text-blue-600 mx-auto mb-3" />
            <h1 className="text-2xl font-bold">Which game?</h1>
            <p className="text-muted-foreground text-sm mt-1">You have bookings for multiple games. Pick the one you're playing now.</p>
          </div>
          <div className="space-y-3">
            {result.matches.map((m) => (
              <button
                key={m.bookingId}
                onClick={() => doCheckIn(m.gameId)}
                className="w-full text-left bg-card border rounded-xl p-4 hover:bg-accent transition-colors"
              >
                <div className="font-semibold">{m.title}</div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {format(new Date(m.kickoffTime), "h:mm a")} · Team {m.team}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── OUTSIDE WINDOW ───────────────────────────────────────────
  if (result.status === "outside_window") {
    const opensAt = new Date(result.opensAt);
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-sm">
          <Clock className="w-16 h-16 text-amber-500 mx-auto" />
          <h1 className="text-2xl font-bold">Not yet</h1>
          <p className="text-muted-foreground">
            Check-in for <strong>{result.title}</strong> at <strong>{result.pitchName}</strong> opens at{" "}
            <strong>{format(opensAt, "h:mm a")}</strong>.
          </p>
          <p className="text-sm text-muted-foreground">Come back 15 minutes before kickoff.</p>
          <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>Back to home</Button>
        </div>
      </div>
    );
  }

  // ─── NO MATCH ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-4 max-w-sm">
        <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto" />
        <h1 className="text-2xl font-bold">No game found</h1>
        <p className="text-muted-foreground">
          {result.pitchName
            ? `No active game for you at ${result.pitchName} right now.`
            : "No active game found at this pitch right now."}
        </p>
        <div className="text-sm text-muted-foreground space-y-1 text-left bg-muted/50 rounded-xl p-4">
          <p>Possible reasons:</p>
          <ul className="list-disc list-inside space-y-0.5 mt-1">
            <li>Your game hasn't started yet</li>
            <li>You don't have a confirmed booking here</li>
            <li>The game has already ended</li>
          </ul>
        </div>
        <Button className="w-full" onClick={() => setLocation("/games")}>Browse Games</Button>
        <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>Back to home</Button>
      </div>
    </div>
  );
}
