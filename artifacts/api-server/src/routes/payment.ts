import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, gamesTable, bookingsTable, usersTable } from "@workspace/db";
import {
  BookSpotParams,
  BookSpotBody,
  BookSpotResponse,
  VerifyPaymentQueryParams,
  VerifyPaymentResponse,
} from "@workspace/api-zod";
import { getUncachableStripeClient, getStripeSecretKey } from "../lib/stripe";
import { generateId } from "../lib/auth";
import { logger } from "../lib/logger";
import type { Request } from "express";

const router: IRouter = Router();

// GET /payment/verify
router.get("/payment/verify", async (req, res): Promise<void> => {
  const parsed = VerifyPaymentQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing session_id or gameId" });
    return;
  }

  const { session_id, gameId } = parsed.data;

  try {
    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      res.status(400).json({ error: "Payment not completed" });
      return;
    }

    // Find booking for this session
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.paymentId, session_id));

    res.json(
      VerifyPaymentResponse.parse({
        status: "paid",
        booking: booking || null,
        gameId,
      })
    );
  } catch (err) {
    req.log.error({ err }, "Payment verify error");
    res.status(400).json({ error: "Failed to verify payment" });
  }
});

// POST /games/:id/book
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

  // Get user
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  const gamePrice = parseFloat(game.price as string);
  const serviceFee = 2;
  const totalAmount = gamePrice + serviceFee;

  // Determine success/cancel URLs
  const domain = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "http://localhost:80";

  const successUrl = `${domain}/payment/callback?session_id={CHECKOUT_SESSION_ID}&gameId=${gameId}&userId=${userId}&team=${team}&slot=${slotIndex}`;
  const cancelUrl = `${domain}/game/${gameId}`;

  try {
    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "sar",
            product_data: {
              name: game.title,
              description: `${game.pitchName} - Team ${team}, Slot ${slotIndex + 1}`,
            },
            unit_amount: Math.round(totalAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        game_id: gameId,
        user_id: userId,
        team: team.toString(),
        slot_index: slotIndex.toString(),
      },
      customer_email: user.email || undefined,
    });

    res.json(
      BookSpotResponse.parse({
        checkoutUrl: session.url,
        sessionId: session.id,
      })
    );
  } catch (err) {
    req.log.error({ err }, "Stripe checkout creation error");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// POST /payment/webhook
router.post("/payment/webhook", async (req, res): Promise<void> => {
  const secretKey = await getStripeSecretKey().catch(() => null);

  let event: any;

  try {
    const stripe = await getUncachableStripeClient();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (webhookSecret && req.headers["stripe-signature"]) {
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          req.headers["stripe-signature"] as string,
          webhookSecret
        );
      } catch (err) {
        req.log.warn({ err }, "Webhook signature verification failed");
        res.status(400).json({ error: "Invalid signature" });
        return;
      }
    } else {
      // No webhook secret configured — parse raw body
      event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { game_id, user_id, team, slot_index } = session.metadata || {};

      if (!game_id || !user_id) {
        req.log.warn("Webhook: missing metadata");
        res.json({ success: true });
        return;
      }

      // Check if booking already exists
      const [existing] = await db
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.paymentId, session.id));

      if (existing) {
        res.json({ success: true });
        return;
      }

      // Fetch game
      const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, game_id));
      if (!game) {
        req.log.warn({ game_id }, "Webhook: game not found");
        res.json({ success: true });
        return;
      }

      // Get existing paid bookings for slot assignment
      const existingBookings = await db
        .select()
        .from(bookingsTable)
        .where(and(eq(bookingsTable.gameId, game_id), eq(bookingsTable.paymentStatus, "paid")));

      const slotsPerTeam = game.capacity / 2;
      let assignedTeam = parseInt(team || "1");
      let assignedSlot = parseInt(slot_index || "0");

      // Check if requested slot is taken
      const slotTaken = existingBookings.some(
        (b) => b.team === assignedTeam && b.slotIndex === assignedSlot
      );

      if (slotTaken) {
        // Find next free slot on same team
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
          // Try other team
          const otherTeam = assignedTeam === 1 ? 2 : 1;
          const otherTeamBookings = existingBookings.filter((b) => b.team === otherTeam);
          const otherUsedSlots = new Set(otherTeamBookings.map((b) => b.slotIndex));

          for (let s = 0; s < slotsPerTeam; s++) {
            if (!otherUsedSlots.has(s)) {
              assignedTeam = otherTeam;
              assignedSlot = s;
              found = true;
              break;
            }
          }

          if (!found) {
            req.log.warn({ game_id }, "Webhook: no slots available");
            res.json({ success: true });
            return;
          }
        }
      }

      // Create booking
      await db.insert(bookingsTable).values({
        id: generateId(),
        gameId: game_id,
        userId: user_id,
        team: assignedTeam,
        slotIndex: assignedSlot,
        paymentStatus: "paid",
        paymentId: session.id,
      });

      // Check if game is now full
      const newCount = existingBookings.length + 1;
      if (newCount >= game.capacity) {
        await db.update(gamesTable).set({ status: "full" }).where(eq(gamesTable.id, game_id));
      }

      req.log.info({ game_id, user_id, assignedTeam, assignedSlot }, "Booking confirmed");
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Webhook processing error");
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
