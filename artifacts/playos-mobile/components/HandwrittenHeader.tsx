import { Text, type TextProps } from "react-native";
import { colors, font } from "@/lib/theme";

/**
 * Caveat-font header used for the orange handwritten accents throughout the
 * web app (hero title, "coming up" labels). Requires Caveat_600SemiBold to
 * be loaded via useFonts in app/_layout.tsx (already wired).
 */
export function HandwrittenHeader({ style, ...rest }: TextProps) {
  return (
    <Text
      style={[{ fontFamily: font.hand, color: colors.orange, fontSize: 28, letterSpacing: -0.5 }, style]}
      {...rest}
    />
  );
}
