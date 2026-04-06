import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, gamesTable, bookingsTable } from "@workspace/db";
import {
  BookSpotParams,
  BookSpotBody,
  BookSpotResponse,
} from "@workspace/api-zod";
import { generateId } from "../lib/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// POST /games/:id/book — payment bypassed, booking created immediately
router.post("/games/:id/book", async (req, res): Promise<void> => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const params = BookSpotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const gameId = params.data.id;

  const parsed = BookSpotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { team, slotIndex } = parsed.data;

  // Fetch game
  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  if (game.status === "cancelled") {
    res.status(400).json({ error: "Game is cancelled" });
    return;
  }

  if (game.status === "full") {
    res.status(400).json({ error: "Game is full" });
    return;
  }

  // Check if user already booked this game
  const [existingBooking] = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.gameId, gameId),
        eq(bookingsTable.userId, userId),
        eq(bookingsTable.paymentStatus, "paid")
      )
    );

  if (existingBooking) {
    res.status(409).json({ error: "You already have a spot in this game" });
    return;
  }

  // Get existing paid bookings to check slot availability
  const existingBookings = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.gameId, gameId), eq(bookingsTable.paymentStatus, "paid")));

  const slotsPerTeam = game.capacity / 2;
  let assignedTeam = team;
  let assignedSlot = slotIndex;

  // If requested slot is taken, find next available one
  const slotTaken = existingBookings.some(
    (b) => b.team === assignedTeam && b.slotIndex === assignedSlot
  );

  if (slotTaken) {
    const teamBookings = existingBookings.filter((b) => b.team === assignedTeam);
    const usedSlots = new Set(teamBookings.map((b) => b.slotIndex));
    let found = false;

    for (let s = 0; s < slotsPerTeam; s++) {
      if (!usedSlots.has(s)) {
        assignedSlot = s;
        found = true;
        break;
      }
    }

    if (!found) {
      const otherTeam = assignedTeam === 1 ? 2 : 1;
      const otherUsedSlots = new Set(
        existingBookings.filter((b) => b.team === otherTeam).map((b) => b.slotIndex)
      );

      for (let s = 0; s < slotsPerTeam; s++) {
        if (!otherUsedSlots.has(s)) {
          assignedTeam = otherTeam;
          assignedSlot = s;
          found = true;
          break;
        }
      }

      if (!found) {
        res.status(400).json({ error: "No spots available" });
        return;
      }
    }
  }

  // Create booking immediately (payment bypassed)
  const bookingId = generateId();
  await db.insert(bookingsTable).values({
    id: bookingId,
    gameId,
    userId,
    team: assignedTeam,
    slotIndex: assignedSlot,
    paymentStatus: "paid",
    paymentId: "bypassed",
  });

  // Mark game full if capacity reached
  if (existingBookings.length + 1 >= game.capacity) {
    await db.update(gamesTable).set({ status: "full" }).where(eq(gamesTable.id, gameId));
  }

  logger.info({ gameId, userId, assignedTeam, assignedSlot }, "Booking created (payment bypassed)");

  res.json(BookSpotResponse.parse({ booked: true, bookingId }));
});

export default router;
