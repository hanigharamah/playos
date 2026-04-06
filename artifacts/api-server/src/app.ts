import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PgSession = connectPgSimple(session);

const app: Express = express();

// Trust the Replit/reverse-proxy's X-Forwarded-Proto header so that
// req.secure === true when the original client connection was HTTPS.
// This is required for express-session to set Secure cookies behind a proxy.
app.set("trust proxy", 1);

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
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: "user_sessions",
    }),
    cookie: {
      httpOnly: true,
      secure: secureCookie,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: secureCookie ? "none" : "lax",
    },
  })
);

app.use("/api", router);

// In production, serve the compiled Vite frontend and handle client-side routing.
// The frontend is built into artifacts/playos/dist/public relative to the workspace root.
if (process.env.NODE_ENV === "production") {
  const frontendDist = path.resolve(__dirname, "../../../artifacts/playos/dist/public");
  app.use(express.static(frontendDist));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
