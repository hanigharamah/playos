# PlayOS Workspace

## Overview

PlayOS is a full-stack football pickup game booking platform for Saudi Arabia. Built as a pnpm monorepo with a React + Vite frontend, Express 5 API server, PostgreSQL + Drizzle ORM database, and Stripe payments.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: JWT-based (jsonwebtoken, SHA-256 + salt; token stored in `localStorage` as `playos_auth_token`, sent as `Authorization: Bearer <token>` header on every API request via `setAuthTokenGetter`)
- **Payments**: Stripe (SAR currency, +SAR 2 service fee per booking)
- **i18n**: EN + AR (bilingual, RTL for Arabic)

## Artifacts

### `artifacts/playos` — PlayOS Web App (port $PORT)
- React + Vite frontend at `/`
- Pages: home, games, game detail, auth, host/login, dashboard, dashboard/payouts, game/new, game/manage, payment/callback, contact, complaints, policies/refund
- Auth guard: protected pages redirect to `/host/login` (for organiser pages)
- `src/components/dashboard/WeeklyCalendar.tsx` — Google Calendar-style grid (3 PM–3 AM, 7 columns, drag-to-create, game color coding, week navigation, pitch filter tabs, current time indicator)
- `src/components/dashboard/CreateGameModal.tsx` — modal for new game creation (time pre-fill from drag, pitch select, capacity/price/auto-cancel, public/private toggle)

### `artifacts/api-server` — Express API Server (port 8080)
- REST API at `/api/*`
- Routes: auth, host, games, dashboard, payment
- Stripe webhook at `/api/payment/webhook`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Tables

- `users` — players and organisers (role: "player" | "organiser")
- `games` — football games with status (open/full/cancelled/completed)
- `bookings` — player spot bookings (team 1 or 2, slotIndex)
- `pitches` — organiser pitches/venues
- `host_payout_details` — IBAN and bank details for host payouts
- `host_applications` — host onboarding applications
- `login_events` — auth audit log

## Auth

- Players: email + password login at `/auth`
- Hosts/Organisers: phone + password login at `/host/login`
- Session cookie: `playos_session`
- Password hashing: SHA-256 + salt "playos_2025"
- Demo host: phone `+966501234567`, password `demo123`
- Demo player: email `player@playos.sa`, password `demo123`

## Business Rules

- Capacity: 6–22 players, must be even
- Service fee: SAR 2 per booking (player pays price + 2)
- Host payout: (price - 1) × paid player count
- Auto-cancel: if kickoffTime - autoCancelHours has passed and bookedCount < capacity → cancelled
- Players split into Team 1 and Team 2 automatically
- Weekly payouts to hosts on Sundays

## Stripe Integration

- Stripe connection: `conn_stripe_01KNHSXK2R6HRDYG8SBEJN8BXK`
- Currency: SAR (Saudi Riyal)
- Checkout session created at `POST /api/payment/checkout`
- Webhook at `POST /api/payment/webhook`
- Payment verification at `GET /api/payment/verify`

## Shared Libraries

- `lib/db` — Drizzle schema + db client
- `lib/api-spec` — OpenAPI YAML spec
- `lib/api-client-react` — Generated React Query hooks (via Orval)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
