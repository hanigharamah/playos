import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, loginEventsTable } from "@workspace/db";
import {
  SignUpBody,
  LoginBody,
} from "@workspace/api-zod";
import { hashPassword, verifyPassword, normalizePhone, generateId, validateEmail, validateSaudiPhone } from "../lib/auth";
import { logger } from "../lib/logger";
import { signToken } from "../lib/jwt";
import { getUserId } from "../middleware/auth";

const router: IRouter = Router();

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

router.post("/auth/signup", async (req, res): Promise<void> => {
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";

  if (!checkRateLimit(`signup:${ip}`, 10, 60000)) {
    res.status(429).json({ error: "Too many requests. Please try again later." });
    return;
  }

  const parsed = SignUpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password, phone, name } = parsed.data;

  if (!validateEmail(email)) {
    res.status(400).json({ error: "Invalid email format" });
    return;
  }

  if (!validateSaudiPhone(phone)) {
    res.status(400).json({ error: "Invalid Saudi phone number. Use format: 05XXXXXXXX" });
    return;
  }

  if (password.length < 4 || password.length > 72) {
    res.status(400).json({ error: "Password must be 4-72 characters" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const normalizedPhone = normalizePhone(phone);
  const id = generateId();
  const passwordHash = hashPassword(password);

  const [user] = await db.insert(usersTable).values({
    id,
    email: email.toLowerCase(),
    phone: normalizedPhone,
    name,
    role: "player",
    passwordHash,
  }).returning();

  (req.session as any).userId = user.id;
  req.session.save(() => {});

  const token = signToken(user.id);

  res.status(201).json({
    token,
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";

  if (!checkRateLimit(`login:${ip}`, 10, 60000)) {
    res.status(429).json({ error: "Too many requests. Please try again later." });
    return;
  }

  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  await db.insert(loginEventsTable).values({
    id: generateId(),
    userId: user.id,
    ip,
    userAgent: req.headers["user-agent"] || null,
  });

  (req.session as any).userId = user.id;
  req.session.save(() => {});

  const token = signToken(user.id);

  res.json({
    token,
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  });
});

router.post("/auth/host-login", async (req, res): Promise<void> => {
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";

  if (!checkRateLimit(`login:${ip}`, 10, 60000)) {
    res.status(429).json({ error: "Too many requests. Please try again later." });
    return;
  }

  const { phone, password } = req.body as { phone?: string; password?: string };

  if (!phone || !password) {
    res.status(400).json({ error: "Phone and password required" });
    return;
  }

  const normalized = normalizePhone(phone);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, normalized));
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid phone or password" });
    return;
  }

  if (user.role !== "host" && user.role !== "admin") {
    res.status(403).json({ error: "Host account required" });
    return;
  }

  await db.insert(loginEventsTable).values({
    id: generateId(),
    userId: user.id,
    ip,
    userAgent: req.headers["user-agent"] || null,
  });

  (req.session as any).userId = user.id;
  req.session.save(() => {});

  const token = signToken(user.id);

  res.json({
    token,
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {});
  res.clearCookie("playos_session");
  res.json({ success: true, message: "Logged out" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  });
});

export default router;
