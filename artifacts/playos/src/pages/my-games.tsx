import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetMyBookings, getGetMyBookingsQueryKey } from "@/lib/supabase-api";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { CancelBookingModal } from "@/components/CancelBookingModal";
import { CalendarDays, MapPin, Users, Trophy } from "lucide-react";

interface CancelTarget {
  bookingId: string;
  gameTitle: string;
  kickoffTime: Date;
  totalPaid: number;
}

function BookingCard({
  booking,
  isPast,
  onCancel,
  getPath,
}: {
  booking: any;
  isPast: boolean;
  onCancel: (target: CancelTarget) => void;
  getPath: (p: string) => string;
}) {
  const kickoff = new Date(booking.game.kickoffTime);
  const total = booking.game.price + 2;

  return (
    <div className="card-ios p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[#1D3557] truncate">{booking.game.title}</h3>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-[#6C6C70]">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{booking.game.pitchName}</span>
          </div>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0">
          Paid
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-widest">Date</span>
          <div className="flex items-center gap-1 text-xs font-medium text-[#1D3557]">
            <CalendarDays className="h-3 w-3 text-[#6C6C70]" />
            {format(kickoff, "d MMM")}
          </div>
          <span className="text-xs text-[#6C6C70]">{format(kickoff, "h:mm a")}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-widest">Team</span>
          <div className="flex items-center gap-1 text-xs font-medium text-[#1D3557]">
            <Trophy className="h-3 w-3 text-[#6C6C70]" />
            Team {booking.team}
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-widest">Players</span>
          <div className="flex items-center gap-1 text-xs font-medium text-[#1D3557]">
            <Users className="h-3 w-3 text-[#6C6C70]" />
            {booking.game.bookedCount}/{booking.game.capacity}
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-1 border-t border-[#F2F2F7]">
        <Link href={getPath(`/game/${booking.gameId}`)} className="flex-1">
          <button
            className="w-full text-xs font-semibold py-2 rounded-[8px] transition-all"
            style={{
              background: "rgba(10,132,255,0.1)",
              color: "#0A84FF",
              border: "1px solid rgba(10,132,255,0.2)",
            }}
          >
            View Game
          </button>
        </Link>
        {!isPast && (
          <button
            className="flex-1 text-xs font-semibold py-2 rounded-[8px] transition-all"
            style={{
              background: "rgba(255,59,48,0.08)",
              color: "#FF3B30",
              border: "1px solid rgba(255,59,48,0.15)",
            }}
            onClick={() =>
              onCancel({
                bookingId: booking.id,
                gameTitle: booking.game.title,
                kickoffTime: new Date(booking.game.kickoffTime),
                totalPaid: total,
              })
            }
          >
            Cancel Booking
          </button>
        )}
      </div>
    </div>
  );
}

export default function MyGames() {
  const { user } = useAuth();
  const { language } = useI18n();
  const [, setLocation] = useLocation();
  const getPath = (p: string) => (language === "ar" ? `/ar${p}` : p);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);

  if (!user) {
    setLocation(getPath("/auth?returnUrl=/my-games"));
    return null;
  }

  const { data, isLoading } = useGetMyBookings();

  const upcoming = data?.upcoming ?? [];
  const past = data?.past ?? [];
  const list = tab === "upcoming" ? upcoming : past;

  const handleCancelled = () => {
    queryClient.invalidateQueries({ queryKey: getGetMyBookingsQueryKey() });
    setCancelTarget(null);
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-2xl font-bold" style={{ color: "#1D3557" }}>
          My Games
        </h1>

        {/* Tabs */}
        <div
          className="flex rounded-[10px] p-0.5"
          style={{ background: "#E5E5EA" }}
        >
          {(["upcoming", "past"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 text-sm font-semibold rounded-[8px] transition-all capitalize"
              style={
                tab === t
                  ? { background: "#fff", color: "#1D3557", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                  : { color: "#6C6C70" }
              }
            >
              {t === "upcoming" ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[160px] rounded-xl" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="card-ios px-6 py-12 text-center">
            <p className="text-4xl mb-3">⚽</p>
            <p className="font-semibold text-[#1D3557] mb-1">
              {tab === "upcoming" ? "No upcoming games" : "No past games"}
            </p>
            <p className="text-sm text-[#6C6C70] mb-4">
              {tab === "upcoming" ? "Find a game and book your spot." : "Your completed games will appear here."}
            </p>
            {tab === "upcoming" && (
              <Link href={getPath("/games")}>
                <button className="glass glass-btn text-sm px-5 py-2">
                  Browse Games
                </button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((booking: any) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                isPast={tab === "past"}
                onCancel={setCancelTarget}
                getPath={getPath}
              />
            ))}
          </div>
        )}
      </div>

      {cancelTarget && (
        <CancelBookingModal
          open={true}
          onClose={() => setCancelTarget(null)}
          bookingId={cancelTarget.bookingId}
          gameTitle={cancelTarget.gameTitle}
          kickoffTime={cancelTarget.kickoffTime}
          totalPaid={cancelTarget.totalPaid}
          onCancelled={handleCancelled}
        />
      )}
    </div>
  );
}
