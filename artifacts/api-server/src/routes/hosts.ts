import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, hostApplicationsTable, pitchesTable, loginEventsTable } from "@workspace/db";
import {
  HostLoginBody,
  ApplyAsHostBody,
  CreatePitchBody,
  ListPitchesResponse,
} from "@workspace/api-zod";
import { verifyPassword, normalizePhone, generateId, validateSaudiPhone } from "../lib/auth";
import { signToken } from "../lib/jwt";
import { getUserId } from "../middleware/auth";

const router: IRouter = Router();

// Rate limit store
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

router.post("/host/login", async (req, res): Promise<void> => {
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";

  if (!checkRateLimit(`host-login:${ip}`, 10, 60000)) {
    res.status(429).json({ error: "Too many requests. Please try again later." });
    return;
  }

  const parsed = HostLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { phone, password } = parsed.data;
  const normalizedPhone = normalizePhone(phone);

  const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, normalizedPhone));
  if (!user || user.role !== "organiser" || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid phone or password" });
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

router.post("/host/apply", async (req, res): Promise<void> => {
  const parsed = ApplyAsHostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, pitchName, phone, city } = parsed.data;

  if (!validateSaudiPhone(phone)) {
    res.status(400).json({ error: "Invalid Saudi phone number. Use format: 05XXXXXXXX" });
    return;
  }

  await db.insert(hostApplicationsTable).values({
    id: generateId(),
    name,
    pitchName,
    phone: normalizePhone(phone),
    city,
  });

  res.status(201).json({ success: true, message: "Application submitted. We'll be in touch shortly." });
});

// Pitches
router.get("/pitches", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const pitches = await db.select().from(pitchesTable).where(eq(pitchesTable.organiserId, userId));
  res.json(ListPitchesResponse.parse(pitches));
});

router.post("/pitches", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.role !== "organiser") {
    res.status(403).json({ error: "Organisers only" });
    return;
  }

  const parsed = CreatePitchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [pitch] = await db.insert(pitchesTable).values({
    id: generateId(),
    organiserId: userId,
    name: parsed.data.name,
    mapsUrl: parsed.data.mapsUrl || null,
  }).returning();

  res.status(201).json(pitch);
});

export default router;
