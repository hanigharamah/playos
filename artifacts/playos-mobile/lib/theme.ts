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

  // ── Figma redesign palette (glass/cream language, July 2026) ──
  canvas: "#FCF4ED",           // warm cream screen base
  inkDeep: "#211C33",          // booking-flow ink (slightly violet navy)
  mutedLavender: "#6B6678",    // secondary text on cream
  faintLavender: "#858091",    // tertiary text / captions
  purpleSoft: "#8B7CF6",       // meta icons (6v6 · 90 mins · distance)
  teamOrange: "#FF9F0A",       // Team A
  teamPurple: "#7B4DFF",       // Team B
  glassFill: "rgba(255,255,255,0.78)",
  glassStroke: "rgba(255,255,255,0.9)",
  warmShadow: "#8C5926",       // every card shadow tints warm, never black
} as const;

export const gradients = {
  // Same 4-stop gradient the web pill/price uses.
  vivid: [colors.peach, colors.coral, colors.pink, colors.purple] as const,
  // Figma redesign gradients
  cta: ["#FFC7A8", "#B8A6F7"] as const,       // join match pill (peach→lavender)
  sharePill: ["#FFD9C6", "#C9BDF8"] as const, // glass nav Share pill
  checkIn: ["#FFC26B", "#FA8C1A"] as const,   // island check-in button
  streak: ["#F27D40", "#E8456E"] as const,    // activity day bubbles / streak flame
  glowPeach: ["rgba(255,222,194,0.55)", "rgba(255,222,194,0)"] as const,
  glowLavender: ["rgba(219,207,250,0.30)", "rgba(219,207,250,0)"] as const,
} as const;

/** iOS-style pill radius; use for cards, buttons, sheets. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 28,
  screen: 40,
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
  /** Script accents — the Figma designs use Caveat Bold (nodes 1:2, 1:4). */
  hand: "Caveat_700Bold",
  /** Legacy alias kept for older screens; prefer `hand`. */
  script: "Caveat_700Bold",
  body: undefined, // undefined = system default
} as const;
