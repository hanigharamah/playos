/**
 * Dot wave background — DISABLED.
 *
 * Turned off across the app on request: the source art in Figma is an imported
 * bitmap capped at 780×1200, so on a 3x screen it renders soft, and there is
 * no higher-resolution original anywhere in the file. Figma's own 4x export is
 * measurably softer than the raw source (it upscales the same bitmap), and the
 * node carries no shader or vector to re-render from.
 *
 * This renders nothing rather than being ripped out of ~15 screens, so turning
 * it back on is a one-line change here and every call site stays correct.
 *
 * To restore, put the body back:
 *
 *   import { Image } from "react-native";
 *   <Image
 *     source={require("../assets/dotwave.png")}
 *     style={{ position: "absolute", top: 0, left: 0, width, height, opacity }}
 *     resizeMode="cover"
 *   />
 *
 * The mocks place this layer at opacity 0.75 (operator screens at 0.35), which
 * is what the `opacity` prop defaults to. assets/dotwave.png is kept in the
 * repo — it is no longer required by any module, so it is not bundled.
 *
 * Getting to HD needs one of: a re-render of the original art at 3-4x and a
 * re-import to Figma, or a procedural generator drawn at device resolution.
 */
export function DotWaveBackground(_props: {
  width: number;
  height: number;
  opacity?: number;
}) {
  return null;
}
