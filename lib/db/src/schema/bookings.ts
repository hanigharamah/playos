import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bookingsTable = pgTable("bookings", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull(),
  userId: text("user_id").notNull(),
  team: integer("team").notNull(), // 1 or 2
  slotIndex: integer("slot_index").notNull(),
  paymentStatus: text("payment_status").notNull().default("pending"), // 'pending' | 'paid' | 'refunded'
  paymentId: text("payment_id"),
  bookedAt: timestamp("booked_at", { withTimezone: true }).notNull().defaultNow(),
  checkedIn: boolean("checked_in").notNull().default(false),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ bookedAt: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
