import jwt from "jsonwebtoken";

const SECRET = process.env.SESSION_SECRET || "playos_dev_secret_change_me";
const EXPIRES_IN = "30d";

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, SECRET) as jwt.JwtPayload;
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}
