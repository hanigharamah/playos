import Svg, { Circle } from "react-native-svg";
import { colors } from "@/lib/theme";

/**
 * Decorative dotted-wave pattern for the Home hero area (mockup background).
 * Purely visual — a fan of dots radiating from the top-right corner, fading
 * out with distance. Positioned absolute, non-interactive, sits behind content.
 */
export function DotWaveBackground({ width, height }: { width: number; height: number }) {
  const cx = width * 0.92;
  const cy = height * -0.02;
  const rings = 11;

  const dots: { x: number; y: number; r: number; opacity: number; key: string }[] = [];
  for (let ring = 0; ring < rings; ring++) {
    const radius = 36 + ring * 30;
    const count = 10 + ring * 2;
    const t = ring / (rings - 1);
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 0.52 + (Math.PI * 0.72) * (i / (count - 1));
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      if (x < -8 || x > width + 8 || y < -8 || y > height + 8) continue;
      dots.push({
        x,
        y,
        r: 1.1 + (1 - t) * 1.5,
        opacity: 0.55 * (1 - t) + 0.04,
        key: `${ring}-${i}`,
      });
    }
  }

  return (
    <Svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }} pointerEvents="none">
      {dots.map((d) => (
        <Circle key={d.key} cx={d.x} cy={d.y} r={d.r} fill={colors.orange} opacity={d.opacity} />
      ))}
    </Svg>
  );
}
