import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetDashboardGames, useListPitches } from "@/lib/supabase-api";
import { useAuth } from "@/lib/auth";
import { isOperator } from "@/lib/config";
import { WeeklyCalendar } from "@/components/dashboard/WeeklyCalendar";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const { data, isLoading: gamesLoading } = useGetDashboardGames();
  const { data: pitches } = useListPitches();

  const [activePitch, setActivePitch] = useState<string | null>(null);

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
      {/* Calendar — a glass box floating on the cream, takes the full height */}
      <div className="flex-1 min-h-0 px-3 md:px-5 pt-4 pb-4">
        {gamesLoading ? (
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
