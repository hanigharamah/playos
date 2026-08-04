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
 * `slice` rather than `meet`, matching `resizeMode="cover"`: the art fills the
 * frame and crops, so a wide hero and a 40pt square thumbnail both read as a
 * plan rather than a squashed one. On the smallest thumbs the crop lands on
 * the centre of the site, which is the pitch itself.
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
        <PitchSchematic name={name} width={size.w} height={size.h} fit="slice" />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: "#F6EADF", overflow: "hidden" },
});
