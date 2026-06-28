import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useGetDashboardGames, useListPitches } from "@/lib/supabase-api";
import { useAuth } from "@/lib/auth";
import { isOperator } from "@/lib/config";
import { WeeklyCalendar } from "@/components/dashboard/WeeklyCalendar";
import { OperatorSettings } from "@/components/dashboard/OperatorSettings";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const { data, isLoading: gamesLoading } = useGetDashboardGames();
  const { data: pitches } = useListPitches();

  const [activePitch, setActivePitch] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Auto-select pitch when single pitch host
  useEffect(() => {
    if (pitches && pitches.length === 1 && activePitch === null) {
      setActivePitch(pitches[0].name);
    }
  }, [pitches]);

  useEffect(() => {
    if (!authLoading && !isOperator(user?.role)) {
      setLocation("/");
    }
  }, [authLoading, user]);

  if (authLoading || !isOperator(user?.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const allGames = [
    ...(data?.upcoming || []),
    ...(data?.past || []),
  ];

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 60px)" }}>
      {/* Dashboard / Payouts toggle navigation */}
      <div className="flex justify-center pt-4 pb-3 border-b bg-background flex-shrink-0">
        <div className="inline-flex items-center bg-muted rounded-xl p-1 gap-1">
          <span className="px-5 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 text-white shadow-sm">
            Dashboard
          </span>
          <Link
            href="/dashboard/payouts"
            className="px-5 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Payouts
          </Link>
          <button
            onClick={() => setShowSettings((s) => !s)}
            className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showSettings ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Settings
          </button>
        </div>
      </div>

      {/* Calendar — takes remaining height */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {showSettings ? (
          <OperatorSettings />
        ) : gamesLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Loading calendar...
          </div>
        ) : (
          <WeeklyCalendar
            games={allGames}
            activePitch={activePitch}
            pitches={pitches || []}
            onPitchChange={setActivePitch}
          />
        )}
      </div>
    </div>
  );
}
