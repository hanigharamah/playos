import { pgTable, text, timestamp, numeric, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gamesTable = pgTable("games", {
  id: text("id").primaryKey(),
  organiserId: text("organiser_id").notNull(),
  title: text("title").notNull(),
  pitchName: text("pitch_name").notNull(),
  locationText: text("location_text"),
  kickoffTime: timestamp("kickoff_time", { withTimezone: true }).notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  capacity: integer("capacity").notNull(),
  status: text("status").notNull().default("open"), // 'open' | 'full' | 'cancelled'
  autoCancelHours: integer("auto_cancel_hours").notNull().default(4),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  isPublic: boolean("is_public").notNull().default(true),
  mapsUrl: text("maps_url"),
  latitude: numeric("latitude", { precision: 10, scale: 6 }),
  longitude: numeric("longitude", { precision: 10, scale: 6 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGameSchema = createInsertSchema(gamesTable).omit({ createdAt: true });
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof gamesTable.$inferSelect;
