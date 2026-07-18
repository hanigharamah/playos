import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { performCheckIn } from "@/lib/supabase-api";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, List } from "lucide-react";
import { format } from "date-fns";

interface Props {
  params: { pitchId: string };
}

type CheckInStatus =
  | { status: "checked_in"; gameId: string; title: string; team: number; pitchName: string; checkedInAt: string; minutesLate: number | null }
  | { status: "already_checked_in"; gameId: string; title: string; team: number; pitchName: string; checkedInAt: string }
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
      const data = await performCheckIn(pitchId, gameId);
      setResult(data);
    } catch {
      setError("Something went wrong — please try again");
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

  if (result.status === "checked_in" || result.status === "already_checked_in") {
    setLocation(`/flashcard/${result.gameId}`);
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground font-medium">You're in — loading your team…</p>
        </div>
      </div>
    );
  }

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
