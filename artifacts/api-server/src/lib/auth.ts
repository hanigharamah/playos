import crypto from "crypto";

const SALT = "playos_2025";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + SALT).digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function normalizePhone(phone: string): string {
  // Convert Saudi local format 05XXXXXXXX to +9665XXXXXXXX
  const cleaned = phone.replace(/\s+/g, "").replace(/-/g, "");
  if (cleaned.startsWith("+966")) return cleaned;
  if (cleaned.startsWith("966")) return "+" + cleaned;
  if (cleaned.startsWith("0")) return "+966" + cleaned.slice(1);
  return "+966" + cleaned;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function validateSaudiPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^\+9665[0-9]{8}$/.test(normalized);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}
