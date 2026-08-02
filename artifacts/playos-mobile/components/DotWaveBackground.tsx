import { Image } from "react-native";

/**
 * Flowing halftone dot-wave — exported straight from the Figma "Dot Wave"
 * component (390×600 @3x, see FIGMA-MAP.md), so it is pixel-identical to the
 * design. Re-export from Figma node 71:248 if the design changes; do not
 * regenerate procedurally.
 *
 * Every mock places this layer at **opacity 0.75** (`opacity-75` on the Dot
 * Wave node of 684:494, 684:542, 697:506, 698:518 and the rest). That was
 * missing here, so it rendered at full strength and competed with the content
 * on top of it — most visible on a sparse screen such as an empty Home.
 *
 * Operator screens deliberately pass 0.35 instead: ops chrome has to read
 * differently from a player screen at a glance.
 */
export function DotWaveBackground({
  width,
  height,
  opacity = 0.75,
}: {
  width: number;
  height: number;
  opacity?: number;
}) {
  return (
    <Image
      source={require("../assets/dotwave.png")}
      style={{ position: "absolute", top: 0, left: 0, width, height, opacity }}
      resizeMode="cover"
    />
  );
}
