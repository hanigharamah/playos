import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pitchesTable = pgTable("pitches", {
  id: text("id").primaryKey(),
  organiserId: text("organiser_id").notNull(),
  name: text("name").notNull(),
  mapsUrl: text("maps_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPitchSchema = createInsertSchema(pitchesTable).omit({ createdAt: true });
export type InsertPitch = z.infer<typeof insertPitchSchema>;
export type Pitch = typeof pitchesTable.$inferSelect;
