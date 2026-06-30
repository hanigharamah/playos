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

/** Long, unguessable token that gates the hidden operator login route. */
export const OPERATOR_SECRET =
  (import.meta.env.VITE_OPERATOR_SECRET as string | undefined) ||
  "ops-7f3a9c2e8b1d4f60a5e7c9128d3b6f04a1";

/** Path to paste to reach the operator login, e.g. /x/<secret>. */
export const operatorLoginPath = (lang: "en" | "ar" = "en") =>
  `${lang === "ar" ? "/ar" : ""}/x/${OPERATOR_SECRET}`;

/**
 * Optional operator credentials. If both are set, visiting the secret URL
 * auto-signs the operator in (no password typing). Otherwise a login form
 * is shown at the secret URL as a fallback.
 */
export const OPERATOR_EMAIL =
  (import.meta.env.VITE_OPERATOR_EMAIL as string | undefined) || "operator@playos.sa";
export const OPERATOR_PASSWORD =
  (import.meta.env.VITE_OPERATOR_PASSWORD as string | undefined) || "Op_9x4Qm2Lt7Zr!2026";

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
