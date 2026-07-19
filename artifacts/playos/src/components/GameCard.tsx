import { Link } from "wouter";
import { format } from "date-fns";
import { MapPin, Users, Calendar, Clock, Ticket, ArrowRight } from "lucide-react";

// ── Occupancy state machine ────────────────────────────────────────────────
// Evaluated top-down, first match wins — this keeps "Almost full" / "Last
// spot" tied to actual spot counts (not %) so they mean the same thing at
// any capacity, and avoids ambiguous percentage boundaries entirely.

const ACCENT = {
  peach: "#FF9F5A",
  coral: "#FF6F61",
  pink: "#FF3D9A",
  purple: "#8E3DFF",
  deepPurple: "#6D28D9",
  gray: "#AEAEB2",
} as const;

type AccentKey = keyof typeof ACCENT;

function getOccupancyState(booked: number, capacity: number): { label: string; accent: AccentKey } {
  const left = capacity - booked;
  const pct = capacity > 0 ? booked / capacity : 0;

  if (left <= 0) return { label: "Full", accent: "gray" };
  if (left === 1) return { label: "Last spot", accent: "deepPurple" };
  if (left <= 3) return { label: "Almost full", accent: "purple" };
  if (pct >= 0.5) return { label: "Building up", accent: "pink" };
  if (pct >= 0.25) return { label: "Players joining", accent: "coral" };
  return { label: "Spots open", accent: "peach" };
}

const VIVID_GRADIENT = `linear-gradient(90deg, ${ACCENT.peach}, ${ACCENT.coral}, ${ACCENT.pink}, ${ACCENT.purple})`;

export interface GameCardData {
  id: string;
  title: string;
  pitchName: string;
  kickoffTime: string;
  price: number;
  capacity: number;
  bookedCount: number;
  status: string;
}

export interface GameCardProps {
  game: GameCardData;
  getPath: (path: string) => string;
  bookLabel: string;
  fullLabel: string;
  className?: string;
}

export function GameCard({ game, getPath, bookLabel, fullLabel, className }: GameCardProps) {
  const capacity = game.capacity;
  const booked = Math.min(game.bookedCount, capacity);
  const spotsLeft = capacity - booked;
  const pct = capacity > 0 ? booked / capacity : 0;
  const isFull = spotsLeft <= 0 || game.status !== "open";

  const { label, accent } = getOccupancyState(booked, capacity);
  const accentColor = ACCENT[accent];

  return (
    <div className={`card-ios overflow-hidden flex flex-col ${className ?? ""}`}>
      {/* Status badge + price row */}
      <div className="px-4 py-2.5 flex justify-between items-center border-b border-[#E5E5EA]">
        <span
          className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
          style={{ background: `${accentColor}1F`, color: isFull ? "#6C6C70" : accentColor }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: isFull ? "#AEAEB2" : accentColor }} />
          {isFull ? fullLabel : label}
        </span>
        <div className="text-right">
          <div
            className="text-lg font-extrabold leading-none"
            style={{
              background: VIVID_GRADIENT,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            SAR {game.price}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: "#AEAEB2" }}>
            per player
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 flex-1">
        <h3 className="text-base font-bold mb-1 line-clamp-1" style={{ color: "#1C1C1E" }}>
          {game.title}
        </h3>
        <div className="flex items-center gap-1 text-xs mb-1.5" style={{ color: "#6C6C70" }}>
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{game.pitchName}</span>
        </div>
        <div className="flex items-center gap-3 text-xs mb-3" style={{ color: "#6C6C70" }}>
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
        <div className="flex justify-between mb-1" style={{ color: "#AEAEB2", fontSize: 10 }}>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
          </span>
          <span>
            {booked}/{capacity}
          </span>
        </div>
        <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: "#E5E5EA" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, pct * 100)}%`,
              background: isFull ? "#AEAEB2" : VIVID_GRADIENT,
            }}
          />
        </div>
      </div>

      {/* CTA button — fixed blue glass, not tied to the occupancy accent;
          badge + bar are what carry the occupancy color. */}
      <div className="px-4 pb-4">
        <Link href={getPath(`/game/${game.id}`)}>
          <button
            disabled={isFull}
            className="btn-pill btn-pill-book w-full text-base font-bold flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              {isFull ? fullLabel : bookLabel}
            </span>
            <span className="btn-pill-book-arrow">
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        </Link>
      </div>
    </div>
  );
}
