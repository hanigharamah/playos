/**
 * PlayOS design tokens — mirror of the web app's Apple-liquid-glass palette
 * so the two experiences feel like the same product. When in doubt, match
 * the web (artifacts/playos/src/index.css) rather than invent.
 */
export const colors = {
  // Backgrounds
  cream: "#FFFDF9",
  creamDeep: "#FFF8F0",
  glassBg: "rgba(255,255,255,0.7)",
  glassBorder: "rgba(255,255,255,0.65)",

  // Text
  ink: "#1C1C1E",
  inkNavy: "#1D3557",
  inkMuted: "#6C6C70",
  inkFaint: "#AEAEB2",

  // PlayOS gradient (the "vivid" palette used on price / occupancy bars)
  peach: "#FF9F5A",
  coral: "#FF6F61",
  pink: "#FF3D9A",
  purple: "#8E3DFF",
  deepPurple: "#6D28D9",
  orange: "#FF9F0A",

  // Semantics
  success: "#30D158",
  warning: "#FF9F0A",
  danger: "#FF3B30",
  ok: "#34C759",

  // Divider
  hairline: "#E5E5EA",
} as const;

export const gradients = {
  // Same 4-stop gradient the web pill/price uses.
  vivid: [colors.peach, colors.coral, colors.pink, colors.purple] as const,
} as const;

/** iOS-style pill radius; use for cards, buttons, sheets. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const font = {
  // Load `Caveat` (Google Fonts) at app boot via expo-font for handwritten
  // headers; system font (SF Pro on iOS, Roboto on Android) for the rest.
  hand: "Caveat_600SemiBold",
  body: undefined, // undefined = system default
} as const;
