import { useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { useListGames } from "@/lib/supabase-api";
import { format } from "date-fns";
import { GamesMap } from "@/components/GamesMap";
import { GameCard } from "@/components/GameCard";

export default function Games() {
  const { t, language } = useI18n();
  const { data: games, isLoading } = useListGames();
  const getPath = (path: string) => (language === "ar" ? `/ar${path}` : path);

  // Refs for smooth-scroll to a pitch's nearest upcoming game, from the map
  const pitchRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handlePitchClick = (pitchName: string) => {
    const el = pitchRefs.current[pitchName];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Group games by day (Sunday, Monday, ...). The query already orders by
  // kickoff_time ascending, so this preserves true chronological order —
  // day sections naturally appear Sun → Sat as the dates roll forward.
  const dayGroups: { dayKey: string; label: string; games: NonNullable<typeof games> }[] = [];
  if (games) {
    for (const game of games) {
      const dayKey = format(new Date(game.kickoffTime), "yyyy-MM-dd");
      let group = dayGroups.find((g) => g.dayKey === dayKey);
      if (!group) {
        group = { dayKey, label: format(new Date(game.kickoffTime), "EEEE, d MMM"), games: [] };
        dayGroups.push(group);
      }
      group.games.push(game);
    }
  }

  // First card for each pitch, so the map's pitch click can still scroll to it.
  const firstPitchCardRef = (pitchName: string) => (el: HTMLDivElement | null) => {
    if (el && !pitchRefs.current[pitchName]) {
      pitchRefs.current[pitchName] = el;
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        <h1
          className="text-2xl font-extrabold mb-5"
          style={{ color: "#1D3557", letterSpacing: "-0.02em" }}
        >
          {language === "ar" ? "تصفح المباريات" : "Browse Games"}
        </h1>

        {/* ── Map ── */}
        <div className="mb-6">
          <GamesMap
            games={(games ?? []).map((g) => ({
              id: g.id,
              pitchName: g.pitchName,
              locationText: g.locationText,
              latitude: g.latitude ?? undefined,
              longitude: g.longitude ?? undefined,
              status: g.status,
            }))}
            onPitchClick={handlePitchClick}
          />
        </div>

        {/* ── Games List ── */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-ios p-4 animate-pulse space-y-3">
                <div className="h-4 bg-[#E5E5EA] rounded w-3/4" />
                <div className="h-3 bg-[#E5E5EA] rounded w-1/2" />
                <div className="h-10 bg-[#E5E5EA] rounded-xl w-full mt-2" />
              </div>
            ))}
          </div>
        ) : dayGroups.length > 0 ? (
          <div className="space-y-8">
            {dayGroups.map((group) => (
              <div key={group.dayKey} className="scroll-mt-20">
                {/* Day section header */}
                <h2
                  className="text-sm font-bold mb-3"
                  style={{ color: "#1D3557" }}
                >
                  {group.label}
                </h2>

                {/* Game cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.games.map((game) => (
                    <div key={game.id} ref={firstPitchCardRef(game.pitchName)}>
                      <GameCard
                        game={game}
                        getPath={getPath}
                        bookLabel={t("games.book")}
                        fullLabel={t("games.full")}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-ios flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-4xl">⚽</span>
            <p className="text-sm font-medium" style={{ color: "#6C6C70" }}>
              {language === "ar"
                ? "لا توجد مباريات متاحة حالياً."
                : "No games available right now."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
