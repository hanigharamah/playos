import { useState, type ReactNode } from "react";
import { View, StyleSheet, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { PitchSchematic } from "./PitchSchematic";

/**
 * A venue, drawn instead of photographed.
 *
 * Every screen that showed a pitch used to render `<Image>` with a stock photo
 * from `getVenuePhoto`. Two problems with that, and the second is the real one:
 *
 *   1. `pitches.photo_url` did not exist until 2026-08-pitch-surface.sql, so
 *      the lookup 42703'd, the error was swallowed, and EVERY venue silently
 *      fell back to a generic placeholder. No screen ever showed a real photo
 *      of a real pitch.
 *   2. A stock photo of some other pitch is a claim about a place. The line
 *      plan is obviously a drawing, so it illustrates without asserting —
 *      which is the same reason the star rating and the km distance were left
 *      off the Browse card.
 *
 * Drop-in for `<Image style={...}>`: pass the same style and this fills the
 * same box. Size is measured rather than passed, so the seventeen call sites
 * keep their existing width/height/borderRadius and none of them had to be
 * hand-edited.
 *
 * `meet`, NOT the `slice` that matched a photo's `resizeMode="cover"`. Cropping
 * is right for a photograph, where any part of it is still a photograph, and
 * wrong for a drawing: slicing a site plan to fill a 110pt-tall hero showed
 * the middle third at high magnification, which read as zoomed-in and cheap.
 * The plan is centred at whatever scale fits, whole.
 *
 * Below ~84pt PitchSchematic swaps to a simplified one-pitch mark on its own
 * account, because at thumbnail size the full plan is unreadable however it
 * is fitted.
 */
export function VenueArt({
  name,
  style,
  children,
}: {
  name: string;
  style?: StyleProp<ViewStyle>;
  /** Rendered over the art, for the screens that used `<ImageBackground>`. */
  children?: ReactNode;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    // Only when it actually changes: setState in onLayout otherwise loops.
    setSize((prev) =>
      prev && Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5
        ? prev
        : { w: width, h: height },
    );
  }

  return (
    <View style={[styles.frame, style]} onLayout={onLayout}>
      {/* The plan is stroke-only with no fill, so the frame supplies the
          ground the photo used to. Without it the art floats on whatever is
          behind, which on the darker screens is unreadable. */}
      {size && size.w > 0 && size.h > 0 && (
        <PitchSchematic name={name} width={size.w} height={size.h} fit="meet" />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: "#F6EADF", overflow: "hidden" },
});
