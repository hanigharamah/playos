import { useMemo } from "react";
import Svg, { Circle, Defs, RadialGradient, Stop, Ellipse } from "react-native-svg";

type Dot = { x: number; y: number; r: number; color: string; opacity: number };

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/**
 * Flowing particle-wave background for the Home hero (mockup style).
 *
 * The dots are laid along concentric curved streamlines emanating from an
 * off-screen centre just past the top-right corner, sweeping down and to the
 * left across the hero area — this gives the flowing "contour ribbon" look
 * rather than a scatter. A soft pink→peach radial bloom sits under the dots,
 * and each dot's colour + opacity + size is driven by its proximity to that
 * bloom (pink + bright + larger near it, faint peach far away). Dots fade out
 * toward the left edge and above the featured card.
 */
export function DotWaveBackground({ width, height }: { width: number; height: number }) {
  const bx = width * 0.70;
  const by = height * 0.34;

  const dots = useMemo<Dot[]>(() => {
    const out: Dot[] = [];

    const cx = width * 1.02; // streamline centre, just off the right edge near the top
    const cy = height * 0.15;
    const bloomR = width * 0.58;

    const PEACH: [number, number, number] = [255, 181, 122]; // #FFB57A
    const CORAL: [number, number, number] = [255, 111, 97]; // #FF6F61
    const PINK: [number, number, number] = [255, 74, 150]; // #FF4A96

    const baseR = width * 0.10;
    const arcSpacing = width * 0.044;
    const arcCount = 27;
    const stepLen = 15; // px between dots along a streamline

    for (let a = 0; a < arcCount; a++) {
      const R = baseR + a * arcSpacing;
      const thetaStart = Math.PI * 0.52;
      const thetaEnd = Math.PI * 1.16;
      const arcLen = (thetaEnd - thetaStart) * R;
      const steps = Math.max(6, Math.floor(arcLen / stepLen));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const theta = thetaStart + (thetaEnd - thetaStart) * t;
        // deterministic organic jitter so streamlines aren't mechanically perfect
        const jitter = Math.sin(a * 12.9898 + s * 4.1414) * arcSpacing * 0.28;
        const rr = R + jitter;
        const x = cx + rr * Math.cos(theta);
        const y = cy + rr * Math.sin(theta);
        if (x < -6 || x > width + 6 || y < -6 || y > height + 6) continue;

        const d = Math.hypot(x - bx, y - by) / bloomR;
        const prox = Math.max(0, 1 - d); // 1 at bloom centre → 0 far out

        const col = prox < 0.5 ? mix(PEACH, CORAL, prox / 0.5) : mix(CORAL, PINK, (prox - 0.5) / 0.5);

        const edgeFadeL = Math.min(1, Math.max(0, (x - width * 0.01) / (width * 0.26)));
        const bottomFade = Math.min(1, Math.max(0, (height * 0.66 - y) / (height * 0.22)));
        const opacity = Math.min(0.88, 0.13 + prox * 0.72) * edgeFadeL * (0.32 + 0.68 * bottomFade);
        if (opacity < 0.03) continue;

        out.push({
          x,
          y,
          r: 0.9 + prox * 1.7,
          color: `rgb(${col[0]},${col[1]},${col[2]})`,
          opacity,
        });
      }
    }
    return out;
  }, [width, height, bx, by]);

  return (
    <Svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }} pointerEvents="none">
      <Defs>
        <RadialGradient id="bloom" cx="70%" cy="34%" rx="58%" ry="40%">
          <Stop offset="0%" stopColor="#FF4A96" stopOpacity="0.22" />
          <Stop offset="42%" stopColor="#FF8A5A" stopOpacity="0.11" />
          <Stop offset="100%" stopColor="#FFB57A" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx={bx} cy={by} rx={width * 0.62} ry={height * 0.36} fill="url(#bloom)" />
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.color} opacity={d.opacity} />
      ))}
    </Svg>
  );
}
