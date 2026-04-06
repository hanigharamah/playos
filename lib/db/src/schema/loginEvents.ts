import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const loginEventsTable = pgTable("login_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLoginEventSchema = createInsertSchema(loginEventsTable).omit({ createdAt: true });
export type InsertLoginEvent = z.infer<typeof insertLoginEventSchema>;
export type LoginEvent = typeof loginEventsTable.$inferSelect;
