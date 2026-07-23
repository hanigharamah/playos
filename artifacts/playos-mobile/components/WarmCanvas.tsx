import { Canvas, Fill, RadialGradient, Rect, vec } from "@shopify/react-native-skia";
import { StyleSheet, useWindowDimensions } from "react-native";
import { colors } from "@/lib/theme";

interface Props {
  /** Override height (e.g. shorter glow area on scrolling screens). Defaults to full screen. */
  height?: number;
}

/**
 * Figma-redesign screen background: warm cream base with a peach radial glow
 * bleeding in from the top-right and a soft lavender glow mid-left. Drop it as
 * the first child of a screen (absolute-fill) and render content on top.
 */
export function WarmCanvas({ height }: Props) {
  const { width, height: winH } = useWindowDimensions();
  const h = height ?? winH;

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height: h }]} pointerEvents="none">
      <Fill color={colors.canvas} />
      <Rect x={0} y={0} width={width} height={h}>
        <RadialGradient
          c={vec(width * 0.95, h * 0.08)}
          r={width * 1.0}
          colors={["rgba(255,222,194,0.55)", "rgba(255,222,194,0)"]}
        />
      </Rect>
      <Rect x={0} y={0} width={width} height={h}>
        <RadialGradient
          c={vec(width * 0.08, h * 0.45)}
          r={width * 0.9}
          colors={["rgba(219,207,250,0.30)", "rgba(219,207,250,0)"]}
        />
      </Rect>
    </Canvas>
  );
}
