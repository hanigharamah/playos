import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Raw body for Stripe webhook
app.use("/api/payment/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!process.env.SESSION_SECRET) {
  logger.warn("SESSION_SECRET not set — using insecure fallback");
}

// In Replit's preview iframe the app is embedded cross-origin, so the
// session cookie needs sameSite:"none" + secure:true to be sent by the browser.
const isReplit = Boolean(process.env.REPLIT_DOMAINS);
const isProduction = process.env.NODE_ENV === "production";
const secureCookie = isReplit || isProduction;

app.use(
  session({
    name: "playos_session",
    secret: process.env.SESSION_SECRET || "playos_dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: secureCookie,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: secureCookie ? "none" : "lax",
    },
  })
);

app.use("/api", router);

export default app;
