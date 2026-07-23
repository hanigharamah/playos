import { Image } from "react-native";

/**
 * Flowing halftone dot-wave for the Home hero — exported straight from the
 * Figma "Dot Wave" component (390×600 @3x, see FIGMA-MAP.md), so it is
 * pixel-identical to the design. Re-export from Figma node 71:248 if the
 * design changes; do not regenerate procedurally.
 */
export function DotWaveBackground({ width, height }: { width: number; height: number }) {
  return (
    <Image
      source={require("../assets/dotwave.png")}
      style={{ position: "absolute", top: 0, left: 0, width, height }}
      resizeMode="cover"
    />
  );
}
