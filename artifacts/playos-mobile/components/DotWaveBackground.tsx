import { useMemo } from "react";
import { Canvas, Picture, Skia, createPicture } from "@shopify/react-native-skia";

/**
 * Flowing halftone dot-wave for the Home hero — the same generation math as
 * the approved Figma "Dot Wave" component (see FIGMA-MAP.md): concentric
 * streamlines flowing from an off-screen origin past the top-right corner,
 * with a warm bloom driving size, color (peach → coral → pink) and opacity.
 *
 * Implementation note: this was previously a SkSL RuntimeEffect fragment
 * shader, which failed to compile on some devices and vanished silently.
 * Dots are now computed in JS and recorded once into a Skia Picture —
 * deterministic, GPU-rendered, no shader compilation involved.
 */

const PEACH = { r: 255, g: 181, b: 122 };
const CORAL = { r: 255, g: 111, b: 97 };
const PINK = { r: 255, g: 74, b: 150 };

function palette(t: number) {
  const lerp = (a: number, b: number, k: number) => Math.round(a + (b - a) * k);
  if (t < 0.5) {
    const k = t / 0.5;
    return { r: lerp(PEACH.r, CORAL.r, k), g: lerp(PEACH.g, CORAL.g, k), b: lerp(PEACH.b, CORAL.b, k) };
  }
  const k = (t - 0.5) / 0.5;
  return { r: lerp(CORAL.r, PINK.r, k), g: lerp(CORAL.g, PINK.g, k), b: lerp(CORAL.b, PINK.b, k) };
}

// Base coordinate space is 390×600 (the Figma frame) — scaled to fit width.
const BASE_W = 390;
const BASE_H = 600;
const FLOW_X = 430, FLOW_Y = 40;      // flow origin, off-screen top-right
const BLOOM_X = 250, BLOOM_Y = 210;   // warm bloom centre
const BLOOM_R = 360;

interface Dot { x: number; y: number; r: number; color: string }

function generateDots(): Dot[] {
  const dots: Dot[] = [];
  for (let ring = 30; ring < 620 && dots.length < 1400; ring += 13) {
    const n = Math.max(6, Math.floor((2 * Math.PI * ring) / 15));
    for (let j = 0; j < n; j++) {
      const ang = (j / n) * 2 * Math.PI;
      const rr = ring + Math.sin(ang * 3 + ring * 0.03) * 10;
      const x = FLOW_X + rr * Math.cos(ang);
      const y = FLOW_Y + rr * Math.sin(ang) * 0.92;
      if (x < -10 || x > BASE_W + 10 || y < -10 || y > BASE_H + 10) continue;
      const bd = Math.hypot(x - BLOOM_X, y - BLOOM_Y);
      const prox = Math.max(0, Math.min(1, 1 - bd / BLOOM_R));
      const edgeL = Math.max(0, Math.min(1, x / 90));
      const edgeB = Math.max(0, Math.min(1, (BASE_H - y) / 220));
      const op = (0.10 + prox * 0.75) * edgeL * edgeB;
      if (op < 0.06) continue;
      const c = palette(prox);
      dots.push({
        x, y,
        r: (2.0 + prox * 4.5) / 2,
        color: `rgba(${c.r},${c.g},${c.b},${Math.min(0.95, op).toFixed(3)})`,
      });
      if (dots.length >= 1400) break;
    }
  }
  return dots;
}

export function DotWaveBackground({ width, height }: { width: number; height: number }) {
  const picture = useMemo(() => {
    const dots = generateDots();
    const s = width / BASE_W;
    return createPicture((canvas) => {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      for (const d of dots) {
        paint.setColor(Skia.Color(d.color));
        canvas.drawCircle(d.x * s, d.y * s, d.r * s, paint);
      }
    });
  }, [width]);

  return (
    <Canvas style={{ position: "absolute", top: 0, left: 0, width, height }} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}
