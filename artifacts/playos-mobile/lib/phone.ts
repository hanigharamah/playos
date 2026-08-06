/**
 * Saudi mobile numbers, canonicalised.
 *
 * This mirrors `normalize_saudi_mobile` in
 * supabase/2026-08-close-access-holes.sql EXACTLY, and the two must stay in
 * step. The database is the authority — a trigger canonicalises every write —
 * but the client needs the same answer for two reasons WhatsApp auth makes
 * urgent:
 *
 *   1. the number is now the delivery address. A number the client and the
 *      server canonicalise differently sends the code to one string and looks
 *      the account up under another.
 *   2. the number is the identity. `users_phone_key` is unique over the
 *      canonical form, so two spellings of one number must never reach it.
 *
 * The previous client-side version (normalizePhone in api.ts) did none of
 * this: it accepted anything, and turned a 5-digit typo into '+9661234' rather
 * than rejecting it.
 */

/** Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹), which an Arabic keyboard produces by default. */
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹";
const ASCII_DIGITS = "01234567890123456789";

function foldDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const i = ARABIC_DIGITS.indexOf(ch);
    out += i === -1 ? ch : ASCII_DIGITS[i];
  }
  return out;
}

/**
 * Returns +9665XXXXXXXX, or null if this is not a Saudi mobile.
 *
 * Null is a real answer and callers must handle it — it is what stops a
 * landline, a typo or a foreign number becoming an account nobody can log into.
 */
export function normalizeSaudiMobile(input: string | null | undefined): string | null {
  if (!input) return null;

  let v = foldDigits(input);
  v = v.replace(/[^0-9+]/g, "");
  // A + is only meaningful in first position.
  v = v[0] === "+" ? "+" + v.slice(1).replace(/\+/g, "") : v.replace(/\+/g, "");

  if (/^\+9665\d{8}$/.test(v)) return v;
  if (/^009665\d{8}$/.test(v)) return "+" + v.slice(2);
  if (/^9665\d{8}$/.test(v)) return "+" + v;
  if (/^05\d{8}$/.test(v)) return "+966" + v.slice(1);
  if (/^5\d{8}$/.test(v)) return "+966" + v;

  return null;
}

/** True when this input is a Saudi mobile we can actually send a code to. */
export function isValidSaudiMobile(input: string): boolean {
  return normalizeSaudiMobile(input) !== null;
}

/**
 * `+966 53 447 8561` — for confirming back to the player which number the code
 * went to. Grouped rather than masked: they are about to check that exact
 * handset, so hiding digits helps nobody.
 */
export function formatSaudiMobile(input: string): string {
  const e164 = normalizeSaudiMobile(input);
  if (!e164) return input;
  const n = e164.slice(4); // drop +966
  return `+966 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
}
