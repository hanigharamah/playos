import { Router, type IRouter } from "express";
import { eq, and, gte, lt, sql } from "drizzle-orm";
import { db, gamesTable, bookingsTable, hostPayoutDetailsTable, usersTable } from "@workspace/db";
import {
  SavePayoutDetailsBody,
  GetDashboardGamesResponse,
  GetDashboardPayoutsResponse,
  GetPayoutDetailsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireOrganiser(req: any, res: any): string | null {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return userId;
}

async function getOrganiser(userId: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return user;
}

async function getPaidCount(gameId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.gameId, gameId), eq(bookingsTable.paymentStatus, "paid")));
  return row?.count ?? 0;
}

router.get("/dashboard/games", async (req, res): Promise<void> => {
  const userId = requireOrganiser(req, res);
  if (!userId) return;

  const user = await getOrganiser(userId);
  if (!user || user.role !== "organiser") {
    res.status(403).json({ error: "Organisers only" });
    return;
  }

  const now = new Date();
  const allGames = await db.select().from(gamesTable).where(eq(gamesTable.organiserId, userId));

  const upcoming = allGames.filter((g) => new Date(g.kickoffTime) >= now);
  const past = allGames.filter((g) => new Date(g.kickoffTime) < now);

  const withCounts = async (games: typeof allGames) =>
    Promise.all(
      games.map(async (g) => ({
        id: g.id,
        title: g.title,
        pitchName: g.pitchName,
        kickoffTime: g.kickoffTime,
        price: parseFloat(g.price as string),
        capacity: g.capacity,
        status: g.status,
        bookedCount: await getPaidCount(g.id),
        isPublic: g.isPublic,
        durationMinutes: g.durationMinutes,
      }))
    );

  const upcomingWithCounts = await withCounts(upcoming);
  const pastWithCounts = await withCounts(past);

  res.json(
    GetDashboardGamesResponse.parse({
      upcoming: upcomingWithCounts,
      past: pastWithCounts,
      totalUpcoming: upcoming.length,
      totalPast: past.length,
    })
  );
});

router.get("/dashboard/payouts", async (req, res): Promise<void> => {
  const userId = requireOrganiser(req, res);
  if (!userId) return;

  const user = await getOrganiser(userId);
  if (!user || user.role !== "organiser") {
    res.status(403).json({ error: "Organisers only" });
    return;
  }

  // Current week (Sun-Sat)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  // Next Sunday for payout
  const nextPayoutDate = new Date(weekEnd);

  // Get all organiser's games
  const orgGames = await db.select().from(gamesTable).where(eq(gamesTable.organiserId, userId));

  // Weekly games
  const weeklyGames = orgGames.filter((g) => {
    const kt = new Date(g.kickoffTime);
    return kt >= weekStart && kt < weekEnd;
  });

  let weeklyPaidCount = 0;
  let weeklyNet = 0;

  for (const game of weeklyGames) {
    const count = await getPaidCount(game.id);
    const price = parseFloat(game.price as string);
    weeklyPaidCount += count;
    weeklyNet += (price - 1) * count;
  }

  // All-time gross (price * paid count)
  let allTimeGross = 0;
  for (const game of orgGames) {
    const count = await getPaidCount(game.id);
    const price = parseFloat(game.price as string);
    allTimeGross += price * count;
  }

  // Upcoming games
  const upcomingGames = await Promise.all(
    orgGames
      .filter((g) => new Date(g.kickoffTime) >= now && g.status !== "cancelled")
      .sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime())
      .slice(0, 3)
      .map(async (g) => ({
        id: g.id,
        title: g.title,
        pitchName: g.pitchName,
        kickoffTime: g.kickoffTime,
        price: parseFloat(g.price as string),
        capacity: g.capacity,
        status: g.status,
        bookedCount: await getPaidCount(g.id),
        isPublic: g.isPublic,
        durationMinutes: g.durationMinutes,
      }))
  );

  // Payout details
  const [payoutDetails] = await db
    .select()
    .from(hostPayoutDetailsTable)
    .where(eq(hostPayoutDetailsTable.organiserId, userId));

  const response: any = {
    weekly: {
      weekStart,
      weekEnd,
      paidPlayerCount: weeklyPaidCount,
      netPayout: weeklyNet,
      nextPayoutDate,
    },
    allTimeGross,
    upcomingGames,
  };

  if (payoutDetails) {
    response.payoutDetails = payoutDetails;
  }

  res.json(GetDashboardPayoutsResponse.parse(response));
});

router.post("/dashboard/payout-details", async (req, res): Promise<void> => {
  const userId = requireOrganiser(req, res);
  if (!userId) return;

  const user = await getOrganiser(userId);
  if (!user || user.role !== "organiser") {
    res.status(403).json({ error: "Organisers only" });
    return;
  }

  const parsed = SavePayoutDetailsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { accountHolder, iban, bankName, swift } = parsed.data;

  if (iban.length < 10) {
    res.status(400).json({ error: "IBAN must be at least 10 characters" });
    return;
  }

  // Upsert
  await db
    .insert(hostPayoutDetailsTable)
    .values({
      organiserId: userId,
      accountHolder,
      iban,
      bankName: bankName || null,
      swift: swift || null,
    })
    .onConflictDoUpdate({
      target: hostPayoutDetailsTable.organiserId,
      set: {
        accountHolder,
        iban,
        bankName: bankName || null,
        swift: swift || null,
        updatedAt: new Date(),
      },
    });

  res.json({ success: true, message: "Payout details saved" });
});

router.get("/dashboard/payout-details/me", async (req, res): Promise<void> => {
  const userId = requireOrganiser(req, res);
  if (!userId) return;

  const [details] = await db
    .select()
    .from(hostPayoutDetailsTable)
    .where(eq(hostPayoutDetailsTable.organiserId, userId));

  if (!details) {
    res.status(404).json({ error: "No payout details found" });
    return;
  }

  res.json(GetPayoutDetailsResponse.parse(details));
});

export default router;
