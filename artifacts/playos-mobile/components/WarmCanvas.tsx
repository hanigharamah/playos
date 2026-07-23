import { Canvas, Fill, RadialGradient, Rect, vec } from "@shopify/react-native-skia";
import { StyleSheet, useWindowDimensions } from "react-native";
import { colors } from "@/lib/theme";

export interface Glow {
  /** Centre as fractions of width/height, radius as a fraction of width. */
  cx: number;
  cy: number;
  r: number;
  color: string;
}

interface Props {
  /** Override height (e.g. shorter glow area on scrolling screens). Defaults to full screen. */
  height?: number;
  /** Base fill — defaults to the booking-flow cream. */
  base?: string;
  /** Radial glows — defaults to the booking-flow peach + lavender pair. */
  glows?: Glow[];
}

const DEFAULT_GLOWS: Glow[] = [
  { cx: 0.95, cy: 0.08, r: 1.0, color: "rgba(255,222,194,0.55)" },
  { cx: 0.08, cy: 0.45, r: 0.9, color: "rgba(219,207,250,0.30)" },
];

/**
 * Figma-redesign screen background: warm cream base with a peach radial glow
 * bleeding in from the top-right and a soft lavender glow mid-left. Drop it as
 * the first child of a screen (absolute-fill) and render content on top.
 */
export function WarmCanvas({ height, base = colors.canvas, glows = DEFAULT_GLOWS }: Props) {
  const { width, height: winH } = useWindowDimensions();
  const h = height ?? winH;

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height: h }]} pointerEvents="none">
      <Fill color={base} />
      {glows.map((g, i) => (
        <Rect key={i} x={0} y={0} width={width} height={h}>
          <RadialGradient
            c={vec(width * g.cx, h * g.cy)}
            r={width * g.r}
            colors={[g.color, g.color.replace(/[\d.]+\)$/, "0)")]}
          />
        </Rect>
      ))}
    </Canvas>
  );
}
