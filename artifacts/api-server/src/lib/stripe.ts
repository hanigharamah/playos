import Stripe from "stripe";

if (!process.env["STRIPE_SECRET_KEY"]) {
  throw new Error("STRIPE_SECRET_KEY environment variable is required");
}

export const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] as string, {
  apiVersion: "2025-03-31.basil",
});
