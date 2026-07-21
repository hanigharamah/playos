import Svg, { Circle } from "react-native-svg";

/**
 * Flowing particle-wave background for the Home hero area.
 * Dots are laid along a parametric sine curve sweeping from top-right to
 * center-left, with perpendicular falloff (denser/bigger/more opaque at the
 * crest, thinning outward) to give a true wave shape rather than a radial fan.
 * Two overlapping bands at different amplitudes add depth.
 */
export function DotWaveBackground({ width, height }: { width: number; height: number }) {
  const dots: { x: number; y: number; r: number; opacity: number; color: string; key: string }[] = [];

  // Color palette: coral at the dense crest → peach → faint orange at edges
  const COLORS = ["#FF6F61", "#FF3D9A", "#FF9F5A", "#FF9F0A"];

  function colorAt(t: number): string {
    const idx = Math.min(Math.floor(t * (COLORS.length - 1)), COLORS.length - 2);
    return COLORS[idx];
  }

  // Seeded-ish deterministic jitter so it looks organic but doesn't re-render chaotically
  function jitter(seed: number, scale: number): number {
    return ((Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1) * scale - scale / 2;
  }

  // Two wave bands for depth
  const BANDS = [
    { tOffset: 0, amplitudeScale: 1.0, dotCount: 280, radiusRange: [1.0, 2.4], opacityPeak: 0.65 },
    { tOffset: 0.18, amplitudeScale: 0.72, dotCount: 180, radiusRange: [0.8, 1.8], opacityPeak: 0.4 },
  ];

  BANDS.forEach((band, bandIdx) => {
    for (let i = 0; i < band.dotCount; i++) {
      // t: position along the wave path (0 = top-right entry, 1 = center-left exit)
      const t = i / (band.dotCount - 1);

      // Wave crest path: parametric curve from (width*1.05, height*-0.05) sweeping
      // to (width*0.1, height*0.62). A sine bump peaks around t=0.45.
      const startX = width * 1.05;
      const startY = height * -0.05;
      const endX = width * 0.08;
      const endY = height * 0.68;
      const crestX = startX + (endX - startX) * t;
      const sineOffset = Math.sin(t * Math.PI) * height * 0.22 * band.amplitudeScale;
      const crestY = startY + (endY - startY) * t + sineOffset;

      // Perpendicular spread: each dot is offset from the crest perpendicular
      // to the path. Gaussian-ish distribution so dots thin away from crest.
      const spreadWidth = width * 0.28 * band.amplitudeScale;
      // Normal-approximated via average of randoms (Box-Muller would be exact but heavier)
      const u1 = jitter(i * 3.1 + bandIdx * 99.7 + 7.3, 1);
      const u2 = jitter(i * 5.7 + bandIdx * 41.1 + 13.9, 1);
      const gaussian = (u1 + u2) / 2; // approx normal, range ≈ [-0.5, 0.5]
      const spreadDist = gaussian * spreadWidth;

      // Perpendicular direction (rotate path tangent 90°)
      const dx = endX - startX;
      const dy = endY - startY + Math.cos(t * Math.PI) * height * 0.22 * band.amplitudeScale;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const perpX = -dy / len;
      const perpY = dx / len;

      const x = crestX + perpX * spreadDist + jitter(i * 2.3 + bandIdx * 17, 5);
      const y = crestY + perpY * spreadDist + jitter(i * 4.1 + bandIdx * 31, 5);

      // Skip dots that fall fully off-screen
      if (x < -4 || x > width + 4 || y < -4 || y > height + 4) continue;

      // Opacity and size: peak at crest (|gaussian| ≈ 0), fall off with distance
      const distFraction = Math.min(Math.abs(gaussian) * 2, 1);
      const opacity = band.opacityPeak * (1 - distFraction * distFraction) + 0.02;
      const [minR, maxR] = band.radiusRange;
      const r = maxR - (maxR - minR) * distFraction;

      dots.push({ x, y, r, opacity, color: colorAt(t + band.tOffset * 0.5), key: `${bandIdx}-${i}` });
    }
  });

  return (
    <Svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }} pointerEvents="none">
      {dots.map((d) => (
        <Circle key={d.key} cx={d.x} cy={d.y} r={d.r} fill={d.color} opacity={d.opacity} />
      ))}
    </Svg>
  );
}
