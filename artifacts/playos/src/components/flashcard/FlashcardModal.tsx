import { useRef } from "react";
import { X, Crown, MapPin } from "lucide-react";

export interface FlashcardModalProps {
  open: boolean;
  onClose: () => void;
  playerName?: string;
  team?: "yellow" | "purple";
  position?: string;
  end?: string;
  isCaptain?: boolean;
}

const TEAMS = {
  yellow: { label: "Team Yellow", color: "#F4B01E", soft: "rgba(244,176,30,0.16)" },
  purple: { label: "Team Purple", color: "#7B4DFF", soft: "rgba(123,77,255,0.16)" },
};

export function FlashcardModal({
  open,
  onClose,
  playerName = "Hani",
  team = "yellow",
  position = "Midfield",
  end = "North",
  isCaptain = true,
}: FlashcardModalProps) {
  const stackRef = useRef<HTMLDivElement>(null);
  if (!open) return null;
  const t = TEAMS[team];

  const onMove = (e: React.MouseEvent) => {
    const el = stackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${-11 + px * 18}deg`);
    el.style.setProperty("--rx", `${7 - py * 18}deg`);
  };
  const onLeave = () => {
    const el = stackRef.current;
    if (!el) return;
    el.style.removeProperty("--ry");
    el.style.removeProperty("--rx");
  };

  return (
    <div className="lg-backdrop" onClick={onClose}>
      <div
        ref={stackRef}
        className="lg-stack"
        onClick={(e) => e.stopPropagation()}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        {/* depth */}
        <div className="lg-ghost lg-ghost--2" aria-hidden="true" />
        <div className="lg-ghost lg-ghost--1" aria-hidden="true" />

        {/* outer glass shell */}
        <div className="lg-shell">
          <div className="lg-caustic" aria-hidden="true" />

          {/* inner plate */}
          <div className="lg-plate">
            {/* close */}
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 h-7 w-7 rounded-full flex items-center justify-center text-[#6C6C70] hover:bg-black/5"
            >
              <X className="h-4 w-4" />
            </button>

            {/* team tag */}
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: t.soft, color: t.color }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
              {t.label}
            </div>

            {/* handwriting accent */}
            <p className="font-hand text-2xl mt-3 leading-none" style={{ color: "#FF9F0A" }}>
              you're in
            </p>

            {/* name */}
            <div className="flex items-center gap-2 mt-1">
              <h2 className="text-4xl font-extrabold tracking-tight" style={{ color: "#1D3557" }}>
                {playerName}
              </h2>
              {isCaptain && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{ background: "linear-gradient(120deg,#FFD75E,#F5A623)", color: "#5A3B00" }}
                >
                  <Crown className="h-3 w-3" /> Captain
                </span>
              )}
            </div>

            <p className="text-sm mt-1" style={{ color: "#6C6C70" }}>{position}</p>

            {/* direction */}
            <div
              className="mt-5 flex items-center gap-2 rounded-2xl px-4 py-3"
              style={{ background: t.soft }}
            >
              <MapPin className="h-4 w-4 flex-shrink-0" style={{ color: t.color }} />
              <span className="text-sm font-semibold" style={{ color: "#1D3557" }}>
                Head to the {end} end
              </span>
            </div>

            {/* CTA */}
            <button
              onClick={onClose}
              className="mt-4 w-full rounded-2xl py-3 text-sm font-bold text-white"
              style={{ background: t.color, boxShadow: `0 10px 24px -8px ${t.color}` }}
            >
              View both teams
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
