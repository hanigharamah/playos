import { useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { useListGames } from "@/lib/supabase-api";
import { Link } from "wouter";
import { format } from "date-fns";
import { GamesMap } from "@/components/GamesMap";
import { MapPin, Users, Calendar, Clock } from "lucide-react";

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
                  {group.games.map((game) => {
                    const spotsLeft = game.capacity - game.bookedCount;
                    const pct = game.capacity > 0 ? game.bookedCount / game.capacity : 0;
                    const barColor =
                      pct >= 1 ? "#FF3B30" : pct >= 0.8 ? "#FF9F0A" : "#0A84FF";

                    return (
                      <div
                        key={game.id}
                        ref={firstPitchCardRef(game.pitchName)}
                        className="card-ios overflow-hidden flex flex-col"
                      >
                        {/* Status + price row */}
                        <div className="px-4 py-2.5 flex justify-between items-center border-b border-[#E5E5EA]">
                          <span
                            className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                            style={{
                              background:
                                game.status === "open"
                                  ? "rgba(10,132,255,0.1)"
                                  : "rgba(174,174,178,0.2)",
                              color: game.status === "open" ? "#0A84FF" : "#6C6C70",
                            }}
                          >
                            {game.status === "open"
                              ? language === "ar" ? "مفتوح" : "Open"
                              : t("games.full")}
                          </span>
                          <span className="text-sm font-bold" style={{ color: "#1D3557" }}>
                            SAR {game.price}
                          </span>
                        </div>

                        {/* Body */}
                        <div className="px-4 py-3 flex-1">
                          <h3
                            className="text-base font-bold mb-1 line-clamp-1"
                            style={{ color: "#1C1C1E" }}
                          >
                            {game.title}
                          </h3>
                          <div
                            className="flex items-center gap-1 text-xs mb-1.5"
                            style={{ color: "#6C6C70" }}
                          >
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{game.pitchName}</span>
                          </div>
                          <div
                            className="flex items-center gap-3 text-xs mb-3"
                            style={{ color: "#6C6C70" }}
                          >
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(game.kickoffTime), "d MMM")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(game.kickoffTime), "h:mm a")}
                            </span>
                          </div>

                          {/* Fill bar */}
                          <div
                            className="flex justify-between mb-1"
                            style={{ color: "#AEAEB2", fontSize: 10 }}
                          >
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
                            </span>
                            <span>
                              {game.bookedCount}/{game.capacity}
                            </span>
                          </div>
                          <div
                            className="w-full rounded-full overflow-hidden"
                            style={{ height: 2, background: "#E5E5EA" }}
                          >
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, pct * 100)}%`,
                                background: barColor,
                              }}
                            />
                          </div>
                        </div>

                        {/* CTA button */}
                        <div className="px-4 pb-4">
                          <Link href={getPath(`/game/${game.id}`)}>
                            <button
                              disabled={game.status !== "open"}
                              className="w-full py-2.5 rounded-[10px] text-sm font-semibold transition-all hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{
                                background: game.status === "open" ? "#0A84FF" : "#E5E5EA",
                                color: game.status === "open" ? "#fff" : "#6C6C70",
                                boxShadow:
                                  game.status === "open"
                                    ? "0 4px 12px rgba(10,132,255,0.25)"
                                    : "none",
                              }}
                            >
                              {t("games.book")}
                            </button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
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
