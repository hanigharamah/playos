import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import { db, gamesTable, bookingsTable } from "@workspace/db";
import {
  CancelBookingParams,
  CancelBookingResponse,
  GetMyBookingsResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { getUserId } from "../middleware/auth";

const router: IRouter = Router();

// GET /api/bookings/my
router.get("/bookings/my", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const now = new Date();

  const myBookings = await db
    .select({
      id: bookingsTable.id,
      gameId: bookingsTable.gameId,
      team: bookingsTable.team,
      slotIndex: bookingsTable.slotIndex,
      paymentStatus: bookingsTable.paymentStatus,
      bookedAt: bookingsTable.bookedAt,
      gameTitle: gamesTable.title,
      gamePitchName: gamesTable.pitchName,
      gameKickoffTime: gamesTable.kickoffTime,
      gamePrice: gamesTable.price,
      gameCapacity: gamesTable.capacity,
      gameStatus: gamesTable.status,
      gameId2: gamesTable.id,
    })
    .from(bookingsTable)
    .innerJoin(gamesTable, eq(bookingsTable.gameId, gamesTable.id))
    .where(
      and(
        eq(bookingsTable.userId, userId),
        eq(bookingsTable.paymentStatus, "paid")
      )
    );

  // Get booked counts for all games in a single aggregate query
  const gameIds = [...new Set(myBookings.map((b) => b.gameId))];
  const bookedCounts: Record<string, number> = {};

  if (gameIds.length > 0) {
    const countRows = await db
      .select({ gameId: bookingsTable.gameId, cnt: count() })
      .from(bookingsTable)
      .where(eq(bookingsTable.paymentStatus, "paid"))
      .groupBy(bookingsTable.gameId);
    for (const row of countRows) {
      if (gameIds.includes(row.gameId)) {
        bookedCounts[row.gameId] = Number(row.cnt);
      }
    }
  }

  const shaped = myBookings.map((b) => ({
    id: b.id,
    gameId: b.gameId,
    team: b.team,
    slotIndex: b.slotIndex,
    paymentStatus: b.paymentStatus as "paid" | "pending" | "refunded",
    bookedAt: b.bookedAt,
    game: {
      id: b.gameId,
      title: b.gameTitle,
      pitchName: b.gamePitchName,
      kickoffTime: b.gameKickoffTime,
      price: Number(b.gamePrice),
      capacity: b.gameCapacity,
      status: b.gameStatus as "open" | "full" | "cancelled",
      bookedCount: bookedCounts[b.gameId] ?? 0,
    },
  }));

  const upcoming = shaped
    .filter((b) => new Date(b.game.kickoffTime) > now)
    .sort(
      (a, b) =>
        new Date(a.game.kickoffTime).getTime() -
        new Date(b.game.kickoffTime).getTime()
    );

  const past = shaped
    .filter((b) => new Date(b.game.kickoffTime) <= now)
    .sort(
      (a, b) =>
        new Date(b.game.kickoffTime).getTime() -
        new Date(a.game.kickoffTime).getTime()
    );

  res.json(GetMyBookingsResponse.parse({ upcoming, past }));
});

// POST /api/bookings/:id/cancel
router.post("/bookings/:id/cancel", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = CancelBookingParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { id } = parsed.data;

  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.id, id), eq(bookingsTable.paymentStatus, "paid")));

  if (!booking) {
    res.status(404).json({ error: "Booking not found or already cancelled" });
    return;
  }

  if (booking.userId !== userId) {
    res.status(403).json({ error: "Not your booking" });
    return;
  }

  // Get the game for kickoff time
  const [game] = await db
    .select()
    .from(gamesTable)
    .where(eq(gamesTable.id, booking.gameId));

  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  // Calculate refund tier
  const kickoff = new Date(game.kickoffTime);
  const now = new Date();
  const hoursUntilKickoff = (kickoff.getTime() - now.getTime()) / (1000 * 60 * 60);
  const total = Number(game.price) + 2; // price + service fee

  let refundTier: "full" | "half" | "none";
  let refundAmount: number;
  let message: string;

  if (hoursUntilKickoff > 12) {
    refundTier = "full";
    refundAmount = total;
    message = `Your booking has been cancelled. A full refund of SAR ${total.toFixed(2)} will be processed.`;
  } else if (hoursUntilKickoff >= 6) {
    refundTier = "half";
    refundAmount = total * 0.5;
    message = `Your booking has been cancelled. A 50% refund of SAR ${refundAmount.toFixed(2)} will be processed.`;
  } else {
    refundTier = "none";
    refundAmount = 0;
    message = `Your booking has been cancelled. No refund is available for cancellations less than 6 hours before kickoff.`;
  }

  // Mark booking as refunded
  await db
    .update(bookingsTable)
    .set({ paymentStatus: "refunded" })
    .where(eq(bookingsTable.id, id));

  // If game was full, reopen it
  if (game.status === "full") {
    await db
      .update(gamesTable)
      .set({ status: "open" })
      .where(eq(gamesTable.id, game.id));
  }

  logger.info({ bookingId: id, userId, refundTier, gameId: game.id }, "Booking cancelled");

  res.json(
    CancelBookingResponse.parse({
      success: true,
      refundTier,
      refundAmount,
      message,
    })
  );
});

export default router;
