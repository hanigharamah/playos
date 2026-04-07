import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, gamesTable, bookingsTable } from "@workspace/db";
import {
  BookSpotParams,
  BookSpotBody,
  BookSpotResponse,
  VerifyPaymentQueryParams,
  VerifyPaymentResponse,
} from "@workspace/api-zod";
import { generateId } from "../lib/auth";
import { logger } from "../lib/logger";
import { getUncachableStripeClient } from "../lib/stripe";
import { getUserId } from "../middleware/auth";

const router: IRouter = Router();

function getAppOrigin(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) {
    const first = domains.split(",")[0]?.trim();
    if (first) return `https://${first}`;
  }
  const devDomain = process.env["REPLIT_DEV_DOMAIN"];
  if (devDomain) return `https://${devDomain}`;
  return "http://localhost:26205";
}

// POST /api/games/:id/book — create Stripe Checkout session
router.post("/games/:id/book", async (req, res): Promise<void> => {
  const userId = getUserId(req);
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

  // Check if user already has a confirmed spot
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

  // Find an available slot
  const paidBookings = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.gameId, gameId), eq(bookingsTable.paymentStatus, "paid")));

  const slotsPerTeam = game.capacity / 2;
  let assignedTeam = team;
  let assignedSlot = slotIndex;

  const slotTaken = paidBookings.some(
    (b) => b.team === assignedTeam && b.slotIndex === assignedSlot
  );

  if (slotTaken) {
    const usedSlots = new Set(
      paidBookings.filter((b) => b.team === assignedTeam).map((b) => b.slotIndex)
    );
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
      const otherUsed = new Set(
        paidBookings.filter((b) => b.team === otherTeam).map((b) => b.slotIndex)
      );
      for (let s = 0; s < slotsPerTeam; s++) {
        if (!otherUsed.has(s)) {
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

  // Create a pending booking to hold the slot
  const bookingId = generateId();
  await db.insert(bookingsTable).values({
    id: bookingId,
    gameId,
    userId,
    team: assignedTeam,
    slotIndex: assignedSlot,
    paymentStatus: "pending",
    paymentId: null,
  });

  // Create Stripe Checkout session
  const origin = getAppOrigin();
  const priceInHalalas = Math.round(Number(game.price) * 100);
  const stripeClient = await getUncachableStripeClient();

  const session = await stripeClient.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "sar",
          product_data: {
            name: game.title,
            description: `${game.pitchName} · ${new Date(game.kickoffTime).toLocaleDateString("en-SA")}`,
          },
          unit_amount: priceInHalalas,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${origin}/payment/callback?session_id={CHECKOUT_SESSION_ID}&gameId=${gameId}`,
    cancel_url: `${origin}/game/${gameId}`,
    metadata: { bookingId, gameId, userId },
  });

  logger.info({ gameId, userId, sessionId: session.id, bookingId }, "Checkout session created");

  res.json(BookSpotResponse.parse({ checkoutUrl: session.url!, sessionId: session.id }));
});

// GET /api/payment/verify?session_id=...&gameId=...
router.get("/payment/verify", async (req, res): Promise<void> => {
  const parsed = VerifyPaymentQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { session_id, gameId } = parsed.data;

  const stripeClient = await getUncachableStripeClient();
  const session = await stripeClient.checkout.sessions.retrieve(session_id);

  if (session.payment_status === "paid") {
    const bookingId = session.metadata?.bookingId;
    if (bookingId) {
      // Confirm the pending booking
      await db
        .update(bookingsTable)
        .set({ paymentStatus: "paid", paymentId: session.id })
        .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.paymentStatus, "pending")));

      // Mark game full if at capacity
      const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
      if (game) {
        const paidCount = await db
          .select()
          .from(bookingsTable)
          .where(and(eq(bookingsTable.gameId, gameId), eq(bookingsTable.paymentStatus, "paid")));

        if (paidCount.length >= game.capacity) {
          await db.update(gamesTable).set({ status: "full" }).where(eq(gamesTable.id, gameId));
        }
      }

      const [booking] = await db
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.id, bookingId));

      logger.info({ bookingId, gameId }, "Booking confirmed after payment");

      res.json(
        VerifyPaymentResponse.parse({
          status: "paid",
          booking: booking
            ? {
                id: booking.id,
                gameId: booking.gameId,
                userId: booking.userId,
                team: booking.team,
                slotIndex: booking.slotIndex,
                paymentStatus: booking.paymentStatus,
                paymentId: booking.paymentId,
                bookedAt: booking.bookedAt,
              }
            : undefined,
          gameId,
        })
      );
      return;
    }
  }

  res.json(VerifyPaymentResponse.parse({ status: session.payment_status ?? "unknown", gameId }));
});

export default router;
