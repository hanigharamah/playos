import { useRef, type ReactNode } from "react";

interface LiquidCardProps {
  children: ReactNode;
  onBackdrop?: () => void;
  maxWidth?: number;
}

/** Layered liquid-glass popup: ghosts → outer shell → caustic → inner plate.
 *  Dims + blurs the page behind it and tilts toward the cursor. */
export function LiquidCard({ children, onBackdrop, maxWidth = 340 }: LiquidCardProps) {
  const stackRef = useRef<HTMLDivElement>(null);

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
    <div className="lg-backdrop" onClick={onBackdrop}>
      <div
        ref={stackRef}
        className="lg-stack"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        <div className="lg-ghost lg-ghost--2" aria-hidden="true" />
        <div className="lg-ghost lg-ghost--1" aria-hidden="true" />
        <div className="lg-shell">
          <div className="lg-caustic" aria-hidden="true" />
          <div className="lg-plate">{children}</div>
        </div>
      </div>
    </div>
  );
}
