import { Text, type TextProps } from "react-native";
import { colors, font } from "@/lib/theme";

/**
 * Script-font header for the orange handwritten accents ("your next match is
 * tonight.", "coming up", "tonight"). The current Figma designs use Caveat
 * Bold (verified via get_design_context on nodes 1:2 / 1:4) — loaded in
 * app/_layout.tsx.
 */
export function HandwrittenHeader({ style, ...rest }: TextProps) {
  return (
    <Text
      style={[{ fontFamily: font.hand, color: colors.orange, fontSize: 26 }, style]}
      {...rest}
    />
  );
}
