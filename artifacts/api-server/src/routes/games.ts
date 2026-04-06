import { Router, type IRouter } from "express";
import { eq, and, gte, lt, desc, asc, sql } from "drizzle-orm";
import { db, gamesTable, bookingsTable, usersTable } from "@workspace/db";
import {
  CreateGameBody,
  UpdateGameBody,
  GetGameParams,
  UpdateGameParams,
  DeleteGameParams,
  GetGameManagementParams,
  ListGamesQueryParams,
  ListGamesResponse,
  GetFeaturedGamesResponse,
  GetGameResponse,
  UpdateGameResponse,
  GetGameManagementResponse,
} from "@workspace/api-zod";
import { generateId } from "../lib/auth";

const router: IRouter = Router();

// Helper: get paid booking count for a game
async function getPaidBookingCount(gameId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.gameId, gameId), eq(bookingsTable.paymentStatus, "paid")));
  return row?.count ?? 0;
}

// Helper: auto-cancel check
async function checkAndAutoCancelGame(game: any): Promise<typeof game> {
  if (game.status !== "open") return game;
  const now = new Date();
  const cancelThreshold = new Date(game.kickoffTime);
  cancelThreshold.setHours(cancelThreshold.getHours() - (game.autoCancelHours || 4));

  if (now >= cancelThreshold) {
    const count = await getPaidBookingCount(game.id);
    if (count < game.capacity) {
      await db.update(gamesTable).set({ status: "cancelled" }).where(eq(gamesTable.id, game.id));
      return { ...game, status: "cancelled" };
    }
  }
  return game;
}

// GET /games - list public open games
router.get("/games", async (req, res): Promise<void> => {
  const now = new Date();

  let games = await db
    .select()
    .from(gamesTable)
    .where(and(eq(gamesTable.isPublic, true), gte(gamesTable.kickoffTime, now)))
    .orderBy(asc(gamesTable.kickoffTime));

  // Auto-cancel check passively
  const processed = await Promise.all(games.map(checkAndAutoCancelGame));
  const openGames = processed.filter((g) => g.status === "open" || g.status === "full");

  const withCounts = await Promise.all(
    openGames.map(async (game) => ({
      id: game.id,
      title: game.title,
      pitchName: game.pitchName,
      locationText: game.locationText,
      kickoffTime: game.kickoffTime,
      price: parseFloat(game.price as string),
      capacity: game.capacity,
      status: game.status,
      bookedCount: await getPaidBookingCount(game.id),
      durationMinutes: game.durationMinutes,
      isPublic: game.isPublic,
      mapsUrl: game.mapsUrl,
    }))
  );

  res.json(ListGamesResponse.parse(withCounts));
});

// GET /games/featured
router.get("/games/featured", async (_req, res): Promise<void> => {
  const now = new Date();
  const games = await db
    .select()
    .from(gamesTable)
    .where(and(eq(gamesTable.isPublic, true), eq(gamesTable.status, "open"), gte(gamesTable.kickoffTime, now)))
    .orderBy(asc(gamesTable.kickoffTime))
    .limit(6);

  const withCounts = await Promise.all(
    games.map(async (game) => ({
      id: game.id,
      title: game.title,
      pitchName: game.pitchName,
      locationText: game.locationText,
      kickoffTime: game.kickoffTime,
      price: parseFloat(game.price as string),
      capacity: game.capacity,
      status: game.status,
      bookedCount: await getPaidBookingCount(game.id),
      durationMinutes: game.durationMinutes,
      isPublic: game.isPublic,
      mapsUrl: game.mapsUrl,
    }))
  );

  res.json(GetFeaturedGamesResponse.parse(withCounts));
});

// GET /games/:id
router.get("/games/:id", async (req, res): Promise<void> => {
  const params = GetGameParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, params.data.id));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  const checkedGame = await checkAndAutoCancelGame(game);

  // Get bookings with player info
  const bookings = await db
    .select({
      id: bookingsTable.id,
      gameId: bookingsTable.gameId,
      userId: bookingsTable.userId,
      team: bookingsTable.team,
      slotIndex: bookingsTable.slotIndex,
      paymentStatus: bookingsTable.paymentStatus,
      paymentId: bookingsTable.paymentId,
      bookedAt: bookingsTable.bookedAt,
      playerName: usersTable.name,
      playerPhone: usersTable.phone,
    })
    .from(bookingsTable)
    .innerJoin(usersTable, eq(bookingsTable.userId, usersTable.id))
    .where(and(eq(bookingsTable.gameId, game.id), eq(bookingsTable.paymentStatus, "paid")));

  const bookedCount = bookings.length;

  res.json(
    GetGameResponse.parse({
      id: checkedGame.id,
      organiserId: checkedGame.organiserId,
      title: checkedGame.title,
      pitchName: checkedGame.pitchName,
      locationText: checkedGame.locationText,
      kickoffTime: checkedGame.kickoffTime,
      price: parseFloat(checkedGame.price as string),
      capacity: checkedGame.capacity,
      status: checkedGame.status,
      autoCancelHours: checkedGame.autoCancelHours,
      durationMinutes: checkedGame.durationMinutes,
      isPublic: checkedGame.isPublic,
      mapsUrl: checkedGame.mapsUrl,
      createdAt: checkedGame.createdAt,
      bookings,
      bookedCount,
    })
  );
});

// POST /games
router.post("/games", async (req, res): Promise<void> => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.role !== "organiser") {
    res.status(403).json({ error: "Organisers only" });
    return;
  }

  const parsed = CreateGameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { title, pitchName, locationText, kickoffTime, price, capacity, autoCancelHours, durationMinutes, isPublic, mapsUrl } = parsed.data;

  // Validate title length
  if (title.length < 2 || title.length > 80) {
    res.status(400).json({ error: "Title must be 2-80 characters" });
    return;
  }

  // Validate capacity (6-22, even)
  if (capacity < 6 || capacity > 22 || capacity % 2 !== 0) {
    res.status(400).json({ error: "Capacity must be an even number between 6 and 22" });
    return;
  }

  if (price <= 0) {
    res.status(400).json({ error: "Price must be positive" });
    return;
  }

  const [game] = await db.insert(gamesTable).values({
    id: generateId(),
    organiserId: userId,
    title,
    pitchName,
    locationText: locationText || null,
    kickoffTime: new Date(kickoffTime),
    price: price.toString(),
    capacity,
    status: "open",
    autoCancelHours: autoCancelHours || 4,
    durationMinutes: durationMinutes || 60,
    isPublic: isPublic !== undefined ? isPublic : true,
    mapsUrl: mapsUrl || null,
  }).returning();

  res.status(201).json({
    ...game,
    price: parseFloat(game.price as string),
  });
});

// PATCH /games/:id
router.patch("/games/:id", async (req, res): Promise<void> => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const params = UpdateGameParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, params.data.id));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  if (game.organiserId !== userId) {
    res.status(403).json({ error: "You can only manage your own games" });
    return;
  }

  const parsed = UpdateGameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, any> = {};
  const d = parsed.data;
  if (d.title !== undefined) updates.title = d.title;
  if (d.pitchName !== undefined) updates.pitchName = d.pitchName;
  if (d.locationText !== undefined) updates.locationText = d.locationText;
  if (d.kickoffTime !== undefined) updates.kickoffTime = new Date(d.kickoffTime);
  if (d.price !== undefined) updates.price = d.price.toString();
  if (d.capacity !== undefined) updates.capacity = d.capacity;
  if (d.isPublic !== undefined) updates.isPublic = d.isPublic;
  if (d.status !== undefined) updates.status = d.status;
  if (d.mapsUrl !== undefined) updates.mapsUrl = d.mapsUrl;

  const [updated] = await db.update(gamesTable).set(updates).where(eq(gamesTable.id, game.id)).returning();

  res.json(
    UpdateGameResponse.parse({
      ...updated,
      price: parseFloat(updated.price as string),
    })
  );
});

// DELETE /games/:id
router.delete("/games/:id", async (req, res): Promise<void> => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const params = DeleteGameParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, params.data.id));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  if (game.organiserId !== userId) {
    res.status(403).json({ error: "You can only delete your own games" });
    return;
  }

  await db.delete(gamesTable).where(eq(gamesTable.id, game.id));
  res.sendStatus(204);
});

// GET /games/:id/manage
router.get("/games/:id/manage", async (req, res): Promise<void> => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const params = GetGameManagementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, params.data.id));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  if (game.organiserId !== userId) {
    res.status(403).json({ error: "You can only manage your own games" });
    return;
  }

  const bookings = await db
    .select({
      id: bookingsTable.id,
      gameId: bookingsTable.gameId,
      userId: bookingsTable.userId,
      team: bookingsTable.team,
      slotIndex: bookingsTable.slotIndex,
      paymentStatus: bookingsTable.paymentStatus,
      paymentId: bookingsTable.paymentId,
      bookedAt: bookingsTable.bookedAt,
      playerName: usersTable.name,
      playerPhone: usersTable.phone,
    })
    .from(bookingsTable)
    .innerJoin(usersTable, eq(bookingsTable.userId, usersTable.id))
    .where(eq(bookingsTable.gameId, game.id));

  const paidBookings = bookings.filter((b) => b.paymentStatus === "paid");
  const paidCount = paidBookings.length;
  const gamePrice = parseFloat(game.price as string);
  // Host payout: (price - SAR 1 listing fee) * paid count
  const netPayout = (gamePrice - 1) * paidCount;

  const host = process.env.REPLIT_DEV_DOMAIN || "localhost";
  const shareUrl = `https://${host}/game/${game.id}`;

  res.json(
    GetGameManagementResponse.parse({
      game: { ...game, price: gamePrice },
      bookings,
      bookedCount: paidCount,
      netPayout,
      shareUrl,
    })
  );
});

export default router;
