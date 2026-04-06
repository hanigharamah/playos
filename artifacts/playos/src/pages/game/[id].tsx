import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetGame, useBookSpot } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── PITCH POSITION MAPS ────────────────────────────────────── */
// Absolute SVG coords for the LEFT team (viewBox 0 0 400 260, pitch 12px margin)
// Team 2 mirrors at x2 = 400 - x1
type Pos = { x: number; y: number };

const POSITIONS: Record<number, Pos[]> = {
  3: [
    { x: 32, y: 130 }, { x: 95, y: 88 }, { x: 155, y: 130 },
  ],
  4: [
    { x: 30, y: 130 }, { x: 85, y: 78 }, { x: 85, y: 182 }, { x: 155, y: 130 },
  ],
  5: [
    { x: 30, y: 130 }, { x: 80, y: 72 }, { x: 80, y: 188 },
    { x: 132, y: 102 }, { x: 155, y: 162 },
  ],
  6: [
    { x: 28, y: 130 }, { x: 75, y: 62 }, { x: 75, y: 130 }, { x: 75, y: 198 },
    { x: 135, y: 92 }, { x: 155, y: 168 },
  ],
  7: [
    { x: 28, y: 130 }, { x: 70, y: 58 }, { x: 70, y: 104 }, { x: 70, y: 156 },
    { x: 70, y: 202 }, { x: 132, y: 90 }, { x: 155, y: 170 },
  ],
  8: [
    { x: 28, y: 130 }, { x: 68, y: 55 }, { x: 68, y: 98 }, { x: 68, y: 162 },
    { x: 68, y: 205 }, { x: 125, y: 80 }, { x: 125, y: 130 }, { x: 155, y: 180 },
  ],
  9: [
    { x: 28, y: 130 }, { x: 65, y: 52 }, { x: 65, y: 92 }, { x: 65, y: 168 },
    { x: 65, y: 208 }, { x: 118, y: 72 }, { x: 118, y: 120 }, { x: 118, y: 168 },
    { x: 155, y: 130 },
  ],
  10: [
    { x: 28, y: 130 }, { x: 63, y: 50 }, { x: 63, y: 90 }, { x: 63, y: 170 },
    { x: 63, y: 210 }, { x: 110, y: 68 }, { x: 110, y: 108 }, { x: 110, y: 152 },
    { x: 110, y: 192 }, { x: 155, y: 130 },
  ],
  11: [
    { x: 28, y: 130 }, { x: 60, y: 50 }, { x: 60, y: 88 }, { x: 60, y: 128 },
    { x: 60, y: 168 }, { x: 60, y: 208 }, { x: 106, y: 65 }, { x: 106, y: 100 },
    { x: 106, y: 140 }, { x: 106, y: 180 }, { x: 155, y: 130 },
  ],
};

function getPositions(teamSize: number): Pos[] {
  return POSITIONS[Math.min(11, Math.max(3, teamSize))] ?? POSITIONS[5];
}

function mirrorX(p: Pos): Pos {
  return { x: 400 - p.x, y: p.y };
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

/* ─── PITCH SVG ─────────────────────────────────────────────── */
interface PitchProps {
  teamSize: number;
  bookings: Array<{
    team: number;
    slotIndex: number;
    userId: string;
    playerName: string;
    paymentStatus: string;
  }>;
  selectedSlot: { team: number; slot: number } | null;
  onSlotClick: (team: number, slot: number) => void;
  currentUserId?: string;
  isPending: boolean;
  gameOpen: boolean;
}

function PitchSVG({
  teamSize,
  bookings,
  selectedSlot,
  onSlotClick,
  currentUserId,
  isPending,
  gameOpen,
}: PitchProps) {
  const positions = getPositions(teamSize);

  const paidBookings = bookings.filter((b) => b.paymentStatus !== "refunded");

  function getBooking(team: number, slot: number) {
    return paidBookings.find((b) => b.team === team && b.slotIndex === slot);
  }

  function renderSlot(team: number, slot: number, pos: Pos) {
    const booking = getBooking(team, slot);
    const isSelected =
      selectedSlot?.team === team && selectedSlot?.slot === slot;
    const isCurrentUser = booking && booking.userId === currentUserId;

    // Colors
    let fillColor = "rgba(255,255,255,0.12)";
    let strokeColor = "rgba(255,255,255,0.5)";
    let strokeDash = "4 3";
    let strokeWidth = 1.5;
    let textColor = "rgba(255,255,255,0.6)";
    let label = "+";

    if (booking) {
      if (isCurrentUser) {
        fillColor = "#FFD60A";
        textColor = "#1C1C1E";
      } else if (team === 1) {
        fillColor = "#0A84FF";
        textColor = "#FFFFFF";
      } else {
        fillColor = "#FF3B30";
        textColor = "#FFFFFF";
      }
      strokeColor = "rgba(255,255,255,0.9)";
      strokeDash = "";
      strokeWidth = 2;
      label = initials(booking.playerName);
    } else if (isSelected) {
      fillColor = "rgba(255,214,10,0.35)";
      strokeColor = "#FFD60A";
      strokeDash = "";
      strokeWidth = 2;
      label = "+";
      textColor = "#FFD60A";
    }

    const canClick = gameOpen && !booking && !isPending;

    return (
      <g
        key={`${team}-${slot}`}
        onClick={() => canClick && onSlotClick(team, slot)}
        style={{ cursor: canClick ? "pointer" : "default" }}
      >
        <circle
          cx={pos.x}
          cy={pos.y}
          r={14}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
        />
        <text
          x={pos.x}
          y={pos.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={booking ? 7.5 : 11}
          fontWeight="bold"
          fill={textColor}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {label}
        </text>
      </g>
    );
  }

  return (
    <svg
      viewBox="0 0 400 260"
      className="w-full rounded-xl"
      style={{ display: "block" }}
    >
      {/* Pitch background */}
      <rect x="0" y="0" width="400" height="260" rx="10" fill="#276B39" />

      {/* Alternating stripes */}
      {Array.from({ length: 8 }).map((_, i) => (
        <rect
          key={i}
          x={12 + i * 47}
          y={12}
          width={47}
          height={236}
          fill={i % 2 === 0 ? "rgba(0,0,0,0.04)" : "transparent"}
        />
      ))}

      {/* Boundary */}
      <rect x="12" y="12" width="376" height="236" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />

      {/* Center line */}
      <line x1="200" y1="12" x2="200" y2="248" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />

      {/* Center circle */}
      <circle cx="200" cy="130" r="28" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
      <circle cx="200" cy="130" r="2.5" fill="rgba(255,255,255,0.8)" />

      {/* Left penalty box */}
      <rect x="12" y="78" width="52" height="104" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" />
      {/* Left goal box */}
      <rect x="12" y="100" width="24" height="60" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" />

      {/* Right penalty box */}
      <rect x="336" y="78" width="52" height="104" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" />
      {/* Right goal box */}
      <rect x="364" y="100" width="24" height="60" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" />

      {/* Team labels */}
      <text x="100" y="26" textAnchor="middle" fontSize="9" fontWeight="700" fill="rgba(255,255,255,0.25)" letterSpacing="2" style={{ textTransform: "uppercase" }}>TEAM 1</text>
      <text x="300" y="26" textAnchor="middle" fontSize="9" fontWeight="700" fill="rgba(255,255,255,0.25)" letterSpacing="2" style={{ textTransform: "uppercase" }}>TEAM 2</text>

      {/* Team 1 slots (left half) */}
      {positions.map((pos, i) => renderSlot(1, i, pos))}

      {/* Team 2 slots (right half, mirrored) */}
      {positions.map((pos, i) => renderSlot(2, i, mirrorX(pos)))}

      {/* Loading overlay */}
      {isPending && (
        <rect x="0" y="0" width="400" height="260" rx="10" fill="rgba(0,0,0,0.4)" />
      )}
    </svg>
  );
}

/* ─── FILL BAR ───────────────────────────────────────────────── */
function FillBar({ booked, capacity }: { booked: number; capacity: number }) {
  const pct = capacity > 0 ? booked / capacity : 0;
  const barColor = pct >= 1 ? "#FF3B30" : pct >= 0.8 ? "#FF9F0A" : "#0A84FF";

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-widest">
          Booked
        </span>
        <span className="text-sm font-bold text-[#1C1C1E]">
          {booked} / {capacity}
        </span>
      </div>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: 1.5, background: "#E5E5EA" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, pct * 100)}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

/* ─── SHARE BUTTON ───────────────────────────────────────────── */
function ShareButton({ onShare }: { onShare: () => void }) {
  return (
    <button
      onClick={onShare}
      className="transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: "radial-gradient(120% 140% at 30% 20%, #ffd2f1 0%, #d5b6ff 55%, #9e89ff 100%)",
        color: "#fff",
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        borderRadius: 999,
        padding: "8px 20px",
        border: "none",
        boxShadow: "0 4px 16px rgba(158,137,255,0.45), 0 0 0 0 transparent",
        textShadow: "0 0 12px rgba(255,255,255,0.6)",
        cursor: "pointer",
      }}
    >
      Share
    </button>
  );
}

/* ─── MAIN COMPONENT ─────────────────────────────────────────── */
export default function GameDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id!;
  const { language } = useI18n();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const queryClient = useQueryClient();
  const { data: game, isLoading } = useGetGame(id);
  const bookSpot = useBookSpot();

  const [selectedSlot, setSelectedSlot] = useState<{ team: number; slot: number } | null>(null);

  const getPath = (path: string) => (language === "ar" ? `/ar${path}` : path);

  const paidBookings =
    game?.bookings?.filter((b) => b.paymentStatus !== "refunded") || [];
  const bookedCount = paidBookings.length;
  const userBooking = paidBookings.find((b) => b.userId === user?.id);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: game?.title, url });
      } catch {}
    } else {
      navigator.clipboard.writeText(url);
      toast({ title: "Link copied!" });
    }
  };

  const handleSlotClick = (team: number, slot: number) => {
    if (!game || game.status !== "open") return;
    if (selectedSlot?.team === team && selectedSlot?.slot === slot) {
      setSelectedSlot(null);
      return;
    }
    setSelectedSlot({ team, slot });

    if (!user) return; // guest sees the book-spot button below
  };

  const handleBook = () => {
    if (!selectedSlot) return;
    if (!user) {
      setLocation(getPath(`/auth?returnUrl=/game/${id}?team=${selectedSlot.team}&slot=${selectedSlot.slot}`));
      return;
    }
    bookSpot.mutate(
      { id, data: { team: selectedSlot.team, slotIndex: selectedSlot.slot } },
      {
        onSuccess: () => {
          toast({ title: "Spot booked!", description: "You're in. See you on the pitch." });
          setSelectedSlot(null);
          queryClient.invalidateQueries({ queryKey: [`/api/games/${id}`] });
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Booking failed",
            description: err?.data?.error || err?.message || "Please try again.",
          });
        },
      }
    );
  };

  /* Loading state */
  if (isLoading || !game) {
    return (
      <div className="min-h-screen pb-28 bg-[#F2F2F7]">
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-5 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="w-full aspect-[400/260] rounded-xl" />
        </div>
      </div>
    );
  }

  const teamSize = game.capacity / 2;
  const price = game.price;
  const serviceFee = 2;
  const total = price + serviceFee;
  const kickoff = new Date(game.kickoffTime);

  /* CTA bar state */
  const ctaState = () => {
    if (game.status === "cancelled") return "cancelled";
    if (userBooking) return "booked";
    if (game.status === "full" || bookedCount >= game.capacity) return "full";
    if (!user) return "guest";
    return selectedSlot ? "ready" : "idle";
  };

  return (
    <div className="min-h-screen pb-28 bg-[#F2F2F7]">
      <div className="max-w-2xl mx-auto px-4 md:px-8 py-5 space-y-4">

        {/* ── Game Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold leading-tight" style={{ color: "#1D3557" }}>
              {game.title}
            </h1>
            <p className="text-sm mt-1" style={{ color: "#6C6C70" }}>
              {game.pitchName}
            </p>
            <p className="text-sm" style={{ color: "#6C6C70" }}>
              {format(kickoff, "d MMM yyyy")} · {format(kickoff, "h:mm a")}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {user?.role === "organiser" && (user as any).id === game.organiserId && (
              <Link href={getPath(`/game/${id}/manage`)}>
                <button
                  className="text-xs font-semibold px-3 py-1.5 rounded-[10px] border"
                  style={{ color: "#0A84FF", borderColor: "#0A84FF", background: "transparent" }}
                >
                  Manage
                </button>
              </Link>
            )}
            <ShareButton onShare={handleShare} />
          </div>
        </div>

        {/* ── Fill Bar Card ── */}
        <div className="card-ios px-4 py-3">
          <FillBar booked={bookedCount} capacity={game.capacity} />
        </div>

        {/* ── SVG Pitch Card ── */}
        <div className="card-ios p-3">
          <PitchSVG
            teamSize={teamSize}
            bookings={paidBookings as any}
            selectedSlot={selectedSlot}
            onSlotClick={handleSlotClick}
            currentUserId={user?.id}
            isPending={bookSpot.isPending}
            gameOpen={game.status === "open"}
          />

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-xs text-[#6C6C70]">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#0A84FF" }} />
              Team 1
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[#6C6C70]">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#FF3B30" }} />
              Team 2
            </span>
            {userBooking && (
              <span className="flex items-center gap-1.5 text-xs text-[#6C6C70]">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#FFD60A" }} />
                You
              </span>
            )}
          </div>

          {/* Guest hint / book button */}
          {!user && (
            <div className="mt-3 flex justify-center">
              {selectedSlot ? (
                <button
                  onClick={handleBook}
                  className="text-sm font-semibold px-6 py-2.5 rounded-xl transition-all hover:-translate-y-px"
                  style={{
                    background: "#0A84FF",
                    color: "#fff",
                    boxShadow: "0 4px 12px rgba(10,132,255,0.25)",
                  }}
                >
                  Book Spot · SAR {total}
                </button>
              ) : (
                <p className="text-xs text-[#AEAEB2]">Tap a spot to book</p>
              )}
            </div>
          )}
        </div>

        {/* ── Game Info Card ── */}
        <div className="card-ios overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-[#E5E5EA]">
            {/* Date */}
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-widest mb-0.5">
                Date
              </p>
              <p className="text-sm font-bold" style={{ color: "#1D3557" }}>
                {format(kickoff, "d MMM yyyy")}
              </p>
            </div>
            {/* Kickoff */}
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-widest mb-0.5">
                Kickoff
              </p>
              <p className="text-sm font-bold" style={{ color: "#1D3557" }}>
                {format(kickoff, "h:mm a")}
              </p>
            </div>
            {/* Pitch */}
            <div className="px-4 py-3 border-t border-[#E5E5EA]">
              <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-widest mb-0.5">
                Pitch
              </p>
              <p className="text-sm font-bold" style={{ color: "#1D3557" }}>
                {game.pitchName}
              </p>
            </div>
            {/* Price */}
            <div className="px-4 py-3 border-t border-[#E5E5EA]">
              <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-widest mb-0.5">
                Price
              </p>
              <p className="text-sm font-bold" style={{ color: "#1D3557" }}>
                SAR {price}
              </p>
            </div>
          </div>
          <div className="border-t border-[#E5E5EA] px-4 py-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#6C6C70]">Service fee</span>
              <span className="text-sm text-[#6C6C70]">SAR {serviceFee}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold" style={{ color: "#1D3557" }}>Total</span>
              <span className="text-sm font-bold" style={{ color: "#1D3557" }}>SAR {total}</span>
            </div>
          </div>
        </div>

        {/* ── Map Card ── */}
        {game.mapsUrl ? (
          <a
            href={game.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="card-ios px-4 py-3 flex items-center gap-3 hover:opacity-80 transition-opacity"
            style={{ background: "rgba(29,53,87,0.04)", display: "flex" }}
          >
            <span className="text-lg">📍</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#0A84FF" }}>
                Open in Google Maps
              </p>
              <p className="text-xs" style={{ color: "#6C6C70" }}>
                {game.pitchName}
                {game.locationText ? ` · ${game.locationText}` : ""}
              </p>
            </div>
          </a>
        ) : (
          <div
            className="card-ios px-4 py-3 flex items-center gap-3"
            style={{ background: "rgba(29,53,87,0.04)" }}
          >
            <span className="text-lg">📍</span>
            <div>
              <p className="text-sm font-bold" style={{ color: "#1D3557" }}>Map</p>
              <p className="text-xs" style={{ color: "#6C6C70" }}>Coming soon</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Sticky Bottom CTA ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#E5E5EA] bg-white/90 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3">
          {ctaState() === "cancelled" && (
            <button
              disabled
              className="w-full py-3 rounded-[10px] text-sm font-semibold"
              style={{ background: "#F2F2F7", color: "#AEAEB2", border: "1px solid #E5E5EA" }}
            >
              Game Cancelled
            </button>
          )}
          {ctaState() === "booked" && (
            <button
              disabled
              className="w-full py-3 rounded-[10px] text-sm font-semibold"
              style={{
                background: "rgba(10,132,255,0.1)",
                color: "#0A84FF",
                border: "1px solid rgba(10,132,255,0.2)",
              }}
            >
              You're in · Team {userBooking?.team}
            </button>
          )}
          {ctaState() === "full" && (
            <button
              disabled
              className="w-full py-3 rounded-[10px] text-sm font-semibold"
              style={{ background: "#F2F2F7", color: "#AEAEB2", border: "1px solid #E5E5EA" }}
            >
              Game Full
            </button>
          )}
          {ctaState() === "guest" && (
            <p className="text-center text-sm text-[#AEAEB2] py-2">
              ↑ Tap a spot on the pitch
            </p>
          )}
          {ctaState() === "idle" && (
            <p className="text-center text-sm text-[#AEAEB2] py-2">
              ↑ Tap a spot on the pitch
            </p>
          )}
          {ctaState() === "ready" && (
            <button
              onClick={handleBook}
              disabled={bookSpot.isPending}
              className="w-full py-3 rounded-[10px] text-sm font-semibold transition-all hover:-translate-y-px disabled:opacity-60"
              style={{
                background: "#0A84FF",
                color: "#fff",
                boxShadow: "0 4px 12px rgba(10,132,255,0.25)",
              }}
            >
              {bookSpot.isPending
                ? "Processing..."
                : `Book Spot · SAR ${total} · Team ${selectedSlot?.team}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
