# PlayOS

A full-stack football pickup-game booking platform for Saudi Arabia. Players discover and book spots in games; organisers ("hosts") list pitches, create games, and get paid out weekly.

**Live:** https://playos.vercel.app

## Stack

| Area | Technology |
|------|------------|
| Monorepo | pnpm workspaces |
| Frontend | React 19 + Vite 7, Tailwind CSS 4, TanStack Query, Framer Motion |
| API | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod (`zod/v4`), `drizzle-zod` |
| API codegen | Orval (React Query hooks + Zod schemas from an OpenAPI spec) |
| Auth | JWT (Bearer token in `localStorage`) |
| Payments | Stripe (SAR currency) |
| i18n | English + Arabic (bilingual, RTL) |
| Runtime | Node.js 24, TypeScript 5.9 |
| Hosting | Vercel |

## Repository layout

```
artifacts/
  playos/        React + Vite web app
  api-server/    Express REST API + Stripe webhooks
lib/
  db/            Drizzle schema + DB client
  api-spec/      OpenAPI YAML spec
  api-client-react/  Generated React Query hooks (Orval)
scripts/         Workspace tooling
```

This is a pnpm monorepo — workspace packages live under `artifacts/*`, `lib/*`, `lib/integrations/*`, and `scripts` (see `pnpm-workspace.yaml`).

## Getting started

Requires **Node.js 24** and **pnpm** (the `preinstall` hook rejects npm/yarn).

```bash
pnpm install

# Type-check everything
pnpm run typecheck

# Build all packages
pnpm run build

# Run the API server locally
pnpm --filter @workspace/api-server run dev
```

### Useful commands

```bash
# Regenerate API hooks + Zod schemas from the OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes (dev only)
pnpm --filter @workspace/db run push

# Production build (web app + api server)
pnpm run build:production
```

## Database

Drizzle-managed PostgreSQL. Core tables:

- `users` — players and organisers (`role: "player" | "organiser"`)
- `games` — games with status `open | full | cancelled | completed`
- `bookings` — player spot bookings (team + slot index)
- `pitches` — organiser venues
- `host_payout_details` — IBAN / bank details for payouts
- `host_applications` — host onboarding applications
- `login_events` — auth audit log

See `supabase-setup.sql` for the SQL setup.

## Auth

- **Players** sign in with email + password at `/auth`
- **Hosts / organisers** sign in with phone + password at `/host/login`
- JWT tokens are stored in `localStorage` and sent as `Authorization: Bearer <token>` on each API request
- Protected organiser pages redirect to `/host/login`

## Business rules

- Capacity: **6–22 players**, must be even (split automatically into Team 1 / Team 2)
- Service fee: **SAR 2 per booking** (player pays price + 2)
- Host payout: **(price − 1) × paid player count**, paid out weekly on Sundays
- Auto-cancel: if the game is under capacity by its auto-cancel cutoff, it is cancelled

## Payments

Stripe in SAR. Checkout session at `POST /api/payment/checkout`, webhook at `POST /api/payment/webhook`, verification at `GET /api/payment/verify`.

## License

MIT
