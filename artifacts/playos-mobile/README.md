# PlayOS Mobile (Expo)

Native iOS + Android app for PlayOS. Sibling to the web app in
[`../playos`](../playos) — same Supabase backend, same accounts, same games.
The web app keeps running unchanged; this is additive.

Full build spec: **[SPEC.md](./SPEC.md)** — read that first if you're
implementing screens.

## Quick start

```bash
# From this dir. First-time install:
pnpm install
# or if pnpm has trouble with RN native deps in the monorepo:
#   cd .. && rm -rf node_modules && cd playos-mobile && npm install --legacy-peer-deps

# 2. Fill in local secrets (see .env template in SPEC.md)
cp .env.example .env.local  # then edit

# 3. Boot the Metro bundler
pnpm start

# 4. On your phone: install the "Expo Go" app, scan the QR code.
#    (For push notifications you'll need a dev-client build — see below.)
```

## Build a dev client (needed for push notifications)

Expo Go can't handle native push. First real build:

```bash
# One-time: create the EAS project
npx eas login
npx eas init             # replaces the REPLACE_WITH_EAS_PROJECT_ID placeholders in app.json

# Build a dev client and install it on your device
pnpm eas:build:ios --profile development
pnpm eas:build:android --profile development
```

## Ship a preview build (internal testing, no store)

```bash
pnpm eas:build:preview
# Shareable install link comes back from EAS — send to testers.
```

## Ship to App Store / Play Store

```bash
pnpm eas:build:production
pnpm eas:submit
```

Requires: Apple Developer Program membership ($99/yr), Google Play Console
account ($25 one-time), and the credential placeholders in `eas.json` /
`app.json` filled in.

## Supabase migration

Before push works on mobile, run
[`supabase/2026-07-push-native.sql`](./supabase/2026-07-push-native.sql)
in the Supabase SQL editor once. It adds `expo_push_token` + `platform`
columns to the existing `push_subscriptions` table without touching web rows.

The `send-match-reminders` edge function then needs to be updated to fan out
to Expo push tokens as well as web VAPID subscriptions — see SPEC.md >
"Push notifications" for the exact diff.
