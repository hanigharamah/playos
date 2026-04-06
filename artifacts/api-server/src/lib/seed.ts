import { db, usersTable, pitchesTable, gamesTable } from "@workspace/db";
import { logger } from "./logger";

const DEMO_HASH = "bf9b20ebbec24fb6d0b276a0370d03ae336c906cc9bc6f48604277993c98aa29";

export async function seedDemoDataIfEmpty(): Promise<void> {
  const existing = await db.select().from(usersTable).limit(1);
  if (existing.length > 0) return;

  logger.info("Empty database detected — seeding demo data");

  await db.insert(usersTable).values([
    {
      id: "host-demo-001",
      email: "demo@playos.sa",
      phone: "+966501234567",
      name: "Ahmed Al-Rashidi",
      role: "organiser",
      passwordHash: DEMO_HASH,
    },
    {
      id: "player-demo-001",
      email: "player@playos.sa",
      phone: "+966509876543",
      name: "Mohammed Al-Zahrani",
      role: "player",
      passwordHash: DEMO_HASH,
    },
  ]);

  await db.insert(pitchesTable).values([
    {
      id: "pitch-001",
      organiserId: "host-demo-001",
      name: "Al Noor Football Complex",
      mapsUrl: "https://maps.google.com/?q=Riyadh+Al+Nakheel",
    },
    {
      id: "pitch-002",
      organiserId: "host-demo-001",
      name: "King Fahd Stadium Annex",
      mapsUrl: "https://maps.google.com/?q=Riyadh+Al+Olaya",
    },
  ]);

  const now = new Date();
  const daysFromNow = (d: number, h: number) => {
    const t = new Date(now);
    t.setDate(t.getDate() + d);
    t.setHours(h, 0, 0, 0);
    return t;
  };

  await db.insert(gamesTable).values([
    {
      id: "game-001",
      organiserId: "host-demo-001",
      title: "Friday Night Ballers",
      pitchName: "Al Noor Football Complex",
      locationText: "Riyadh, Al Nakheel District",
      kickoffTime: daysFromNow(2, 20),
      price: "50.00",
      capacity: 10,
      status: "open",
      durationMinutes: 60,
      autoCancelHours: 4,
      isPublic: true,
      latitude: "24.774265",
      longitude: "46.738586",
    },
    {
      id: "game-002",
      organiserId: "host-demo-001",
      title: "Weekend Warriors Cup",
      pitchName: "King Fahd Stadium Annex",
      locationText: "Riyadh, Al Olaya",
      kickoffTime: daysFromNow(4, 18),
      price: "60.00",
      capacity: 14,
      status: "open",
      durationMinutes: 90,
      autoCancelHours: 4,
      isPublic: true,
      latitude: "24.689354",
      longitude: "46.688461",
    },
    {
      id: "game-003",
      organiserId: "host-demo-001",
      title: "Sunset 5-a-Side",
      pitchName: "Al Noor Football Complex",
      locationText: "Riyadh, Al Nakheel District",
      kickoffTime: daysFromNow(7, 17),
      price: "40.00",
      capacity: 6,
      status: "open",
      durationMinutes: 60,
      autoCancelHours: 4,
      isPublic: true,
      latitude: "24.774265",
      longitude: "46.738586",
    },
  ]);

  logger.info("Demo seed complete — host: demo@playos.sa / player: player@playos.sa — password: demo123");
}
