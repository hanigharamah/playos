import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hostApplicationsTable = pgTable("host_applications", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  pitchName: text("pitch_name").notNull(),
  phone: text("phone").notNull(),
  city: text("city").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHostApplicationSchema = createInsertSchema(hostApplicationsTable).omit({ createdAt: true });
export type InsertHostApplication = z.infer<typeof insertHostApplicationSchema>;
export type HostApplication = typeof hostApplicationsTable.$inferSelect;
