import { useEffect, useRef, type ReactNode } from "react";

interface LiquidCardProps {
  children: ReactNode;
  onBackdrop?: () => void;
  maxWidth?: number;
}

const BASE_RX = 6;
const BASE_RY = -10;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Layered liquid-glass popup: ghosts → outer shell → caustic → inner plate.
 *  Dims + blurs the page behind it. Tilts toward the pointer on desktop and
 *  with device motion on phones. */
export function LiquidCard({ children, onBackdrop, maxWidth = 340 }: LiquidCardProps) {
  const stackRef = useRef<HTMLDivElement>(null);

  const setTilt = (rx: number, ry: number) => {
    const el = stackRef.current;
    if (!el) return;
    el.style.setProperty("--rx", `${rx}deg`);
    el.style.setProperty("--ry", `${ry}deg`);
  };

  // Desktop: track the pointer across the whole backdrop so the card keeps
  // responding even when the cursor is beside it.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = stackRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      // normalised distance from card centre, scaled by viewport
      const px = clamp((e.clientX - cx) / (window.innerWidth / 2), -1, 1);
      const py = clamp((e.clientY - cy) / (window.innerHeight / 2), -1, 1);
      setTilt(BASE_RX - py * 16, BASE_RY + px * 20);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // Phones: tilt with the device.
  useEffect(() => {
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      const ry = clamp(e.gamma / 2.5, -20, 20);      // left/right lean
      const rx = clamp((e.beta - 45) / 2.5, -16, 16); // front/back lean
      setTilt(BASE_RX - rx, BASE_RY + ry);
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, []);

  return (
    <div className="lg-backdrop" onClick={onBackdrop}>
      <div
        ref={stackRef}
        className="lg-stack"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
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
