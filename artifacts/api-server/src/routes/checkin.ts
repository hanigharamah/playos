import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, gamesTable, bookingsTable, pitchesTable } from "@workspace/db";
import { CheckInParams, CheckInResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// POST /api/checkin/:pitchId — check in a player at a pitch
router.post("/checkin/:pitchId", async (req, res): Promise<void> => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const params = CheckInParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { pitchId } = params.data;

  // Look up the pitch
  const [pitch] = await db
    .select()
    .from(pitchesTable)
    .where(eq(pitchesTable.id, pitchId));

  const pitchName = pitch?.name ?? null;

  const now = new Date();
  const CHECK_IN_OPEN_MINUTES = 15;

  // Find all games at this pitch that are within the check-in window
  // Window: kickoff - 15min <= now <= kickoff + duration_minutes
  const allGamesAtPitch = await db
    .select()
    .from(gamesTable)
    .where(
      and(
        eq(gamesTable.pitchName, pitch?.name ?? ""),
        eq(gamesTable.organiserId, pitch?.organiserId ?? "")
      )
    );

  // Filter to games in the check-in window
  const inWindow = allGamesAtPitch.filter((g) => {
    const kickoff = new Date(g.kickoffTime);
    const opensAt = new Date(kickoff.getTime() - CHECK_IN_OPEN_MINUTES * 60_000);
    const closesAt = new Date(kickoff.getTime() + g.durationMinutes * 60_000);
    return now >= opensAt && now <= closesAt;
  });

  if (inWindow.length === 0) {
    // Check if there's an upcoming game soon (to give a helpful message)
    const soonest = allGamesAtPitch
      .filter((g) => new Date(g.kickoffTime) > now)
      .sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime())[0];

    if (soonest) {
      const kickoff = new Date(soonest.kickoffTime);
      const opensAt = new Date(kickoff.getTime() - CHECK_IN_OPEN_MINUTES * 60_000);

      // Check if player has a booking
      const [booking] = await db
        .select()
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.gameId, soonest.id),
            eq(bookingsTable.userId, userId),
            eq(bookingsTable.paymentStatus, "paid")
          )
        );

      if (booking) {
        res.json(
          CheckInResponse.parse({
            status: "outside_window",
            opensAt,
            title: soonest.title,
            pitchName: soonest.pitchName,
          })
        );
        return;
      }
    }

    res.json(CheckInResponse.parse({ status: "no_match", pitchName }));
    return;
  }

  // Find paid bookings for this player at any of the in-window games
  const gameIds = inWindow.map((g) => g.id);
  const playerBookings = await Promise.all(
    gameIds.map(async (gid) => {
      const [b] = await db
        .select()
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.gameId, gid),
            eq(bookingsTable.userId, userId),
            eq(bookingsTable.paymentStatus, "paid")
          )
        );
      if (!b) return null;
      const game = inWindow.find((g) => g.id === gid)!;
      return { booking: b, game };
    })
  );

  const matches = playerBookings.filter((x): x is NonNullable<typeof x> => x !== null);

  if (matches.length === 0) {
    res.json(CheckInResponse.parse({ status: "no_match", pitchName }));
    return;
  }

  // Multiple matches — rare but possible with overlapping game windows
  if (matches.length > 1) {
    res.json(
      CheckInResponse.parse({
        status: "multiple_matches",
        matches: matches.map(({ booking, game }) => ({
          bookingId: booking.id,
          gameId: game.id,
          title: game.title,
          kickoffTime: game.kickoffTime,
          team: booking.team,
          pitchName: game.pitchName,
        })),
      })
    );
    return;
  }

  const { booking, game } = matches[0]!;

  // Already checked in
  if (booking.checkedIn) {
    res.json(
      CheckInResponse.parse({
        status: "already_checked_in",
        bookingId: booking.id,
        gameId: game.id,
        title: game.title,
        team: booking.team,
        pitchName: game.pitchName,
        checkedInAt: booking.checkedInAt!,
      })
    );
    return;
  }

  // Mark checked in
  const checkedInAt = now;
  await db
    .update(bookingsTable)
    .set({ checkedIn: true, checkedInAt })
    .where(eq(bookingsTable.id, booking.id));

  const kickoff = new Date(game.kickoffTime);
  const minutesLate =
    checkedInAt > kickoff
      ? Math.round((checkedInAt.getTime() - kickoff.getTime()) / 60_000)
      : null;

  res.json(
    CheckInResponse.parse({
      status: "checked_in",
      bookingId: booking.id,
      gameId: game.id,
      title: game.title,
      kickoffTime: game.kickoffTime,
      team: booking.team,
      pitchName: game.pitchName,
      checkedInAt,
      minutesLate,
    })
  );
});

// POST /api/checkin/:pitchId/game/:gameId — explicit check-in when multiple matches
router.post("/checkin/:pitchId/game/:gameId", async (req, res): Promise<void> => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const pitchId = req.params.pitchId;
  const gameId = req.params.gameId;

  const [pitch] = await db.select().from(pitchesTable).where(eq(pitchesTable.id, pitchId));
  if (!pitch) {
    res.status(404).json({ error: "Pitch not found" });
    return;
  }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
  if (!game || game.pitchName !== pitch.name) {
    res.status(404).json({ error: "Game not found at this pitch" });
    return;
  }

  const now = new Date();
  const kickoff = new Date(game.kickoffTime);
  const opensAt = new Date(kickoff.getTime() - 15 * 60_000);
  const closesAt = new Date(kickoff.getTime() + game.durationMinutes * 60_000);

  if (now < opensAt || now > closesAt) {
    res.status(400).json({ error: "Outside check-in window" });
    return;
  }

  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.gameId, gameId),
        eq(bookingsTable.userId, userId),
        eq(bookingsTable.paymentStatus, "paid")
      )
    );

  if (!booking) {
    res.status(404).json({ error: "No booking found" });
    return;
  }

  if (booking.checkedIn) {
    res.json(
      CheckInResponse.parse({
        status: "already_checked_in",
        bookingId: booking.id,
        gameId: game.id,
        title: game.title,
        team: booking.team,
        pitchName: game.pitchName,
        checkedInAt: booking.checkedInAt!,
      })
    );
    return;
  }

  const checkedInAt = now;
  await db
    .update(bookingsTable)
    .set({ checkedIn: true, checkedInAt })
    .where(eq(bookingsTable.id, booking.id));

  const minutesLate =
    checkedInAt > kickoff
      ? Math.round((checkedInAt.getTime() - kickoff.getTime()) / 60_000)
      : null;

  res.json(
    CheckInResponse.parse({
      status: "checked_in",
      bookingId: booking.id,
      gameId: game.id,
      title: game.title,
      kickoffTime: game.kickoffTime,
      team: booking.team,
      pitchName: game.pitchName,
      checkedInAt,
      minutesLate,
    })
  );
});

export default router;
