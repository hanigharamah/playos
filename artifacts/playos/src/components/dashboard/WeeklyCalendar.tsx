import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { format, addDays, startOfWeek, isSameDay, isToday, isBefore } from "date-fns";
import { ChevronLeft, ChevronRight, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateGameModal } from "./CreateGameModal";
import { PitchQrModal } from "./PitchQrModal";

const HOUR_HEIGHT = 60; // px per hour
const CAL_START_HOUR = 15; // 3 PM
const CAL_END_HOUR = 3; // 3 AM next day (exclusive, so we show 15–3 = 12 hours of slots)
const TOTAL_HOURS = 12; // 3 PM to 3 AM
const TIME_COL_WIDTH = 56; // px

const HOURS: number[] = [];
for (let i = 0; i < TOTAL_HOURS; i++) {
  HOURS.push((CAL_START_HOUR + i) % 24);
}

function hourToSlot(hour: number, minute = 0): number {
  const normalised = (hour - CAL_START_HOUR + 24) % 24;
  return normalised + minute / 60;
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function slotToTimeString(slot: number): string {
  const totalMins = Math.round(slot * 60);
  const h = (Math.floor(totalMins / 60) + CAL_START_HOUR) % 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function slotToDisplayTime(slot: number): string {
  const totalMins = Math.round(slot * 60);
  const h = (Math.floor(totalMins / 60) + CAL_START_HOUR) % 24;
  const m = totalMins % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, "0")} ${period}`;
}

function getGameColor(status: string, bookedCount: number, capacity: number): string {
  if (status === "cancelled") return "#9ca3af";
  if (status === "full" || bookedCount >= capacity) return "#22c55e";
  const pct = bookedCount / capacity;
  if (pct >= 0.5) return "#eab308";
  if (pct > 0) return "#f97316";
  return "#ef4444";
}

interface DashboardGame {
  id: string;
  title: string;
  pitchName: string;
  kickoffTime: string;
  price: number;
  capacity: number;
  status: string;
  bookedCount: number;
  isPublic: boolean;
  durationMinutes: number;
}

interface WeeklyCalendarProps {
  games: DashboardGame[];
  activePitch: string | null;
  pitches: { id: string; name: string }[];
  onPitchChange: (pitch: string | null) => void;
}

export function WeeklyCalendar({ games, activePitch, pitches, onPitchChange }: WeeklyCalendarProps) {
  const [, setLocation] = useLocation();

  // Saudi weekend: if today is Friday or Saturday, show next week by default
  const getDefaultWeekStart = () => {
    const today = new Date();
    const day = today.getDay(); // 0=Sun, 5=Fri, 6=Sat
    const weekStart = startOfWeek(today, { weekStartsOn: 0 });
    if (day === 6) return startOfWeek(addDays(today, 7), { weekStartsOn: 0 });
    return weekStart;
  };

  const [weekStart, setWeekStart] = useState<Date>(getDefaultWeekStart);
  const [nowTick, setNowTick] = useState(new Date());
  const [qrPitch, setQrPitch] = useState<{ id: string; name: string } | null>(null);
  const [modal, setModal] = useState<{
    open: boolean;
    date: Date;
    startTime: string;
    endTime: string;
  } | null>(null);

  // Drag state
  const drag = useRef<{
    dayIndex: number;
    startSlot: number;
    endSlot: number;
    active: boolean;
  } | null>(null);
  const [dragOverlay, setDragOverlay] = useState<{
    dayIndex: number;
    top: number;
    height: number;
    label: string;
  } | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => setNowTick(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const goToToday = () => setWeekStart(getDefaultWeekStart());
  const prevWeek = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setWeekStart((d) => addDays(d, 7));

  const monthLabel = (() => {
    const start = format(weekStart, "MMMM yyyy");
    const end = format(addDays(weekStart, 6), "MMMM yyyy");
    return start === end ? start : `${format(weekStart, "MMM")} – ${format(addDays(weekStart, 6), "MMM yyyy")}`;
  })();

  // Current time slot (relative to 3 PM start)
  const nowSlot = (() => {
    const h = nowTick.getHours();
    const m = nowTick.getMinutes();
    const slot = hourToSlot(h, m);
    // Only show if within [0, TOTAL_HOURS]
    if (slot < 0 || slot > TOTAL_HOURS) return null;
    return slot;
  })();

  // Filter games by active pitch
  const visibleGames = activePitch
    ? games.filter((g) => g.pitchName === activePitch)
    : games;

  // Convert a MouseEvent Y position within the grid to a slot (rounded to 30 min)
  const yToSlot = useCallback((y: number) => {
    const raw = y / HOUR_HEIGHT;
    return Math.max(0, Math.min(TOTAL_HOURS, Math.round(raw * 2) / 2));
  }, []);

  // Get column x bounds from day index
  const getColX = (dayIndex: number, rect: DOMRect) => {
    const colW = (rect.width - TIME_COL_WIDTH) / 7;
    return TIME_COL_WIDTH + dayIndex * colW;
  };

  const getDayIndexFromX = (x: number, rect: DOMRect) => {
    const colW = (rect.width - TIME_COL_WIDTH) / 7;
    const adjustedX = x - TIME_COL_WIDTH;
    if (adjustedX < 0) return -1;
    return Math.min(6, Math.floor(adjustedX / colW));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dayIndex = getDayIndexFromX(x, rect);
    if (dayIndex < 0) return;

    const dayDate = weekDays[dayIndex];
    // Don't allow creating in the past
    const now = new Date();
    if (isBefore(dayDate, new Date(now.getFullYear(), now.getMonth(), now.getDate()))) return;

    const slot = yToSlot(y);

    drag.current = { dayIndex, startSlot: slot, endSlot: slot, active: true };
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drag.current?.active || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const slot = yToSlot(y);
    const endSlot = Math.max(drag.current.startSlot + 1, slot); // minimum 1 hour
    drag.current.endSlot = endSlot;

    const topSlot = drag.current.startSlot;
    const heightSlots = endSlot - topSlot;

    setDragOverlay({
      dayIndex: drag.current.dayIndex,
      top: topSlot * HOUR_HEIGHT,
      height: Math.max(HOUR_HEIGHT, heightSlots * HOUR_HEIGHT),
      label: `${slotToDisplayTime(topSlot)} – ${slotToDisplayTime(endSlot)}`,
    });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drag.current?.active) return;
    const { dayIndex, startSlot, endSlot } = drag.current;
    drag.current = null;
    setDragOverlay(null);

    const actualEnd = Math.max(startSlot + 1, endSlot);
    const date = weekDays[dayIndex];

    setModal({
      open: true,
      date,
      startTime: slotToTimeString(startSlot),
      endTime: slotToTimeString(actualEnd),
    });
  };

  const handleMouseLeave = () => {
    if (drag.current?.active) {
      drag.current = null;
      setDragOverlay(null);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 select-none">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0 bg-background gap-4 flex-wrap">
        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday} className="text-xs h-8 px-3">
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-foreground">{monthLabel}</span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block bg-green-500" /> Full
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block bg-yellow-400" /> &gt;50%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block bg-orange-400" /> &lt;50%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block bg-red-500" /> Empty
          </span>
        </div>

        {/* Pitch Filter Tabs + QR Buttons */}
        {pitches.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {pitches.length > 1 && (
              <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
                <button
                  onClick={() => onPitchChange(null)}
                  className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${
                    activePitch === null
                      ? "bg-blue-600 text-white"
                      : "text-muted-foreground border border-border bg-background hover:bg-muted"
                  }`}
                >
                  All
                </button>
                {pitches.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onPitchChange(p.name)}
                    className={`text-xs px-3 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                      activePitch === p.name
                        ? "bg-blue-600 text-white"
                        : "text-muted-foreground border border-border bg-background hover:bg-muted"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            {pitches.map((p) => (
              <button
                key={`qr-${p.id}`}
                onClick={() => setQrPitch(p)}
                title={`Get QR code for ${p.name}`}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                <QrCode className="w-3.5 h-3.5" />
                {pitches.length > 1 ? `QR · ${p.name}` : "QR Code"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Day headers — sticky */}
      <div
        className="flex flex-shrink-0 border-b bg-background"
        style={{ paddingLeft: TIME_COL_WIDTH }}
      >
        {weekDays.map((day, i) => {
          const isT = isToday(day);
          return (
            <div
              key={i}
              className="flex-1 text-center py-2 text-xs font-medium text-muted-foreground"
            >
              <div className="uppercase text-[10px] tracking-wide">{format(day, "EEE")}</div>
              <div
                className={`mx-auto mt-0.5 w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold ${
                  isT ? "bg-blue-600 text-white" : "text-foreground"
                }`}
              >
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable grid area */}
      <div className="overflow-y-auto flex-1 min-h-0 pt-2">
        {/* Grid */}
        <div
          ref={gridRef}
          className="relative flex cursor-crosshair"
          style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          {/* Time labels column */}
          <div className="flex-shrink-0" style={{ width: TIME_COL_WIDTH }}>
            {HOURS.map((h, i) => (
              <div
                key={h}
                className="flex items-start justify-end pr-2 text-[10px] text-muted-foreground"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="-translate-y-2">{formatHour(h)}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, dayIndex) => {
            const isPast = isBefore(day, new Date(new Date().setHours(0, 0, 0, 0)));
            const isT = isToday(day);

            // Games on this day
            const dayGames = visibleGames.filter((g) => {
              const kickoff = new Date(g.kickoffTime);
              return isSameDay(kickoff, day);
            });

            return (
              <div
                key={dayIndex}
                className={`flex-1 border-l relative ${isPast ? "opacity-30 pointer-events-none" : ""}`}
              >
                {/* Hour grid lines */}
                {HOURS.map((h, i) => (
                  <div
                    key={h}
                    className="border-b border-border/40"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {/* Current time indicator */}
                {isT && nowSlot !== null && (
                  <div
                    className="absolute left-0 right-0 flex items-center pointer-events-none z-20"
                    style={{ top: nowSlot * HOUR_HEIGHT - 1 }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 flex-shrink-0" />
                    <div className="flex-1 h-0.5 bg-red-500" />
                  </div>
                )}

                {/* Drag overlay */}
                {dragOverlay && dragOverlay.dayIndex === dayIndex && (
                  <div
                    className="absolute left-0.5 right-0.5 rounded-md bg-red-500/30 border-2 border-red-500 flex items-center justify-center pointer-events-none z-10"
                    style={{
                      top: dragOverlay.top,
                      height: Math.max(dragOverlay.height, HOUR_HEIGHT),
                    }}
                  >
                    <span className="text-[10px] font-semibold text-red-700 px-1 text-center">
                      {dragOverlay.label}
                    </span>
                  </div>
                )}

                {/* Game slots */}
                {dayGames.map((game) => {
                  const kickoff = new Date(game.kickoffTime);
                  const startH = kickoff.getHours();
                  const startM = kickoff.getMinutes();
                  const slot = hourToSlot(startH, startM);
                  if (slot < 0 || slot >= TOTAL_HOURS) return null;
                  const height = Math.max(30, (game.durationMinutes / 60) * HOUR_HEIGHT);
                  const color = getGameColor(game.status, game.bookedCount, game.capacity);

                  return (
                    <div
                      key={game.id}
                      className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-0.5 cursor-pointer overflow-hidden z-10 hover:brightness-95 transition-all shadow-sm"
                      style={{
                        top: slot * HOUR_HEIGHT,
                        height,
                        backgroundColor: color,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/game/${game.id}/manage`);
                      }}
                    >
                      <div className="text-[10px] font-bold text-white leading-tight truncate">
                        {game.title}
                      </div>
                      <div className="text-[9px] text-white/80 leading-tight truncate">
                        {format(kickoff, "h:mm a")} · {game.bookedCount}/{game.capacity}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Game Modal */}
      {modal && (
        <CreateGameModal
          open={modal.open}
          onClose={() => setModal(null)}
          defaultDate={modal.date}
          defaultStartTime={modal.startTime}
          defaultEndTime={modal.endTime}
          activePitchName={activePitch}
        />
      )}

      {/* QR Code Modal */}
      {qrPitch && (
        <PitchQrModal
          pitch={qrPitch}
          open={!!qrPitch}
          onClose={() => setQrPitch(null)}
        />
      )}
    </div>
  );
}
