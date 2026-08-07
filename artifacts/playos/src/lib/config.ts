/**
 * Central MVP configuration.
 *
 * Values are read from Vite build-time env vars where possible so they can be
 * changed without code edits. Defaults keep the app working out of the box.
 *
 * NOTE: anything referenced here ships in the client bundle. The operator
 * "secret URL" is security-through-obscurity by design (see VITE_OPERATOR_SECRET)
 * — keep the link private.
 */

/**
 * Token that gates the hidden operator login route (/x/<token>).
 * Set VITE_OPERATOR_SECRET in Vercel. Unset ⇒ the route 404s for everyone.
 *
 * ⚠️ This is NOT a secret: Vite inlines VITE_* values into the public bundle,
 * so anyone reading the shipped JS can find it. It only keeps the route out of
 * players' faces. The real access control is Supabase auth + RLS.
 */
export const OPERATOR_SECRET = (import.meta.env.VITE_OPERATOR_SECRET as string | undefined) || "";

/** Path to paste to reach the operator login, e.g. /x/<secret>. */
export const operatorLoginPath = (lang: "en" | "ar" = "en") =>
  `${lang === "ar" ? "/ar" : ""}/x/${OPERATOR_SECRET}`;

/**
 * Optional operator credentials for auto-sign-in at the secret URL.
 * Set VITE_OPERATOR_EMAIL / VITE_OPERATOR_PASSWORD in Vercel.
 * Unset ⇒ the secret URL shows a normal login form instead.
 *
 * ⚠️ Auto-login means the password is inlined into the PUBLIC bundle at build
 * time — anyone reading the shipped JS can sign in as the operator. Env vars
 * keep it out of git, they do NOT make it secret. Treat the link as the key,
 * and rotate the password if it leaks. The secure option is to leave
 * VITE_OPERATOR_PASSWORD unset and type it once (the session then persists).
 */
export const OPERATOR_EMAIL = (import.meta.env.VITE_OPERATOR_EMAIL as string | undefined) || "";
export const OPERATOR_PASSWORD =
  (import.meta.env.VITE_OPERATOR_PASSWORD as string | undefined) || "";

/**
 * Mapbox public token — set VITE_MAPBOX_TOKEN in Vercel (and .env.local for dev).
 * Never hardcode it: GitHub push protection blocks Mapbox tokens in the repo.
 * Without it, the browse map falls back to a "Map coming soon" placeholder.
 */
export const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) || "";

/**
 * Single-operator model: anyone who isn't a regular player is the operator.
 * Avoids the legacy organiser/host/admin role mismatch across pages.
 */
export const isOperator = (role?: string | null): boolean =>
  !!role && role !== "player";

/** Defaults used until the operator saves real values in the dashboard. */
export const DEFAULT_SETTINGS = {
  bookingFee: 30,
  whatsappUrl: "https://chat.whatsapp.com/HCxwGYDtqyg0tabr8U5JEU?mode=gi_t",
  stcpayNumber: "",
  stcpayLink: "",
  guidelines:
    "Arrive 15 minutes before kickoff.\n" +
    "Wear non-marking shoes — no metal studs.\n" +
    "Bring both a light and a dark shirt.\n" +
    "Respect other players and the venue staff.\n" +
    "No-shows may lose booking priority for future games.",
} as const;

/**
 * Send players to the app instead of the web booking flow.
 *
 * The website is a brochure now — the app is what gets marketed, and the web
 * booking flow exists but is not promoted. When this is on, tapping a game
 * card's CTA opens /get-app instead of the booking page.
 *
 * OFF BY DEFAULT, and it must stay off until the app is actually downloadable
 * on both stores: with it on and no store listing, the CTA leads nowhere.
 * Set VITE_APP_GATE=true in Vercel on launch day.
 *
 * Deliberately narrow. It gates the PLAYER booking CTA and nothing else — the
 * games list stays browsable (it is the proof the thing is alive), and host
 * login, the dashboard and the /x/<token> operator route are untouched. Those
 * are working tools, and a download prompt swallowing them would remove a
 * workflow rather than redirect one.
 */
export const APP_GATE = (import.meta.env.VITE_APP_GATE as string | undefined) === "true";

/** Store listings. Empty until the apps are live; the page hides a missing one. */
export const IOS_APP_URL = (import.meta.env.VITE_IOS_APP_URL as string | undefined) || "";
export const ANDROID_APP_URL = (import.meta.env.VITE_ANDROID_APP_URL as string | undefined) || "";
