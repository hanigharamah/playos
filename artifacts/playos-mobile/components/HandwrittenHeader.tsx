import { Text, type TextProps } from "react-native";
import { colors, font } from "@/lib/theme";

/**
 * Script-font header for the orange handwritten accents ("tonight", "coming
 * up", "pick your side"). The Figma redesign standardized on Pacifico; both
 * Pacifico_400Regular and the legacy Caveat_600SemiBold are loaded in
 * app/_layout.tsx.
 */
export function HandwrittenHeader({ style, ...rest }: TextProps) {
  return (
    <Text
      style={[{ fontFamily: font.script, color: colors.orange, fontSize: 26 }, style]}
      {...rest}
    />
  );
}
