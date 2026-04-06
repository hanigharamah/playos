import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hostPayoutDetailsTable = pgTable("host_payout_details", {
  organiserId: text("organiser_id").primaryKey(),
  accountHolder: text("account_holder").notNull(),
  iban: text("iban").notNull(),
  bankName: text("bank_name"),
  swift: text("swift"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHostPayoutDetailsSchema = createInsertSchema(hostPayoutDetailsTable);
export type InsertHostPayoutDetails = z.infer<typeof insertHostPayoutDetailsSchema>;
export type HostPayoutDetails = typeof hostPayoutDetailsTable.$inferSelect;
