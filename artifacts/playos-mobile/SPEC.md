# PlayOS Mobile — Build Spec

You are picking up a scaffolded Expo project and building it out to a
shippable iOS + Android app. This spec is the contract.

## 0. Read this first

- **Do not break the web app.** It lives in `../playos/` and stays
  the source of truth for anything ambiguous. Same Supabase project, same
  accounts, same tables — mobile is additive.
- **This scaffold is real, not a mockup.** `package.json`, `app.json`,
  `eas.json`, `metro.config.js`, `babel.config.js`, `tsconfig.json`,
  `.gitignore`, `lib/{theme,supabase,auth,notifications}.ts`, and the
  `app/` router shell all work. Placeholder screens are marked `SCAFFOLD
  PLACEHOLDER` and reference the section here that describes what to build.
- **You cannot invent RN APIs.** If a piece of behavior needs a native
  capability you're unsure about, ship a working alternative from the Expo
  SDK rather than gambling on a hallucinated module.

## 1. Product intent (why native, why now)

The web PWA works, but iOS push requires a manual "Add to Home Screen"
dance and there's a hard ceiling on OS-level features (Dynamic Island, Live
Activities, background scheduling, silent notifications, badge counts,
haptics beyond `Notification.vibrate()`).

Native lifts every one of those, and the primary product loop —
**book a game → get a T-20 push → tap → confirm your team → check in at
the pitch** — depends on that reliability. Everything below should optimize
for how well *that specific loop* feels.

## 2. Stack (locked in — do not swap)

- **Expo SDK 51** + **React Native 0.74**
- **expo-router 3** (file-based navigation; `app/` dir already laid out)
- **TypeScript strict** (see `tsconfig.json`)
- **@supabase/supabase-js** with AsyncStorage (already wired in
  `lib/supabase.ts`)
- **@tanstack/react-query v5** for server state
- **expo-notifications** for push (already wrapped in `lib/notifications.ts`)
- **react-native-reanimated** for gestures/motion
- **date-fns** for formatting (Riyadh locale)
- **EAS Build** for cloud builds — no Xcode required on dev machine

## 3. Repository layout

```
artifacts/playos-mobile/
├─ app/                          expo-router file-based routes
│  ├─ _layout.tsx                root: providers + Stack
│  ├─ index.tsx                  entry — redirect to auth or tabs
│  ├─ (auth)/
│  │  ├─ _layout.tsx
│  │  ├─ login.tsx               🔨 build
│  │  └─ signup.tsx              🔨 create
│  ├─ (tabs)/
│  │  ├─ _layout.tsx             tab bar
│  │  ├─ index.tsx               🔨 build — games list
│  │  ├─ my-games.tsx            🔨 build
│  │  └─ settings.tsx            (basic done — extend per §5)
│  ├─ onboarding.tsx             🔨 create — Never-miss-kickoff sheet
│  ├─ game/
│  │  └─ [id].tsx                🔨 create — game detail + booking
│  ├─ checkout/
│  │  └─ [bookingId].tsx         🔨 create — cash / STC pay confirm
│  └─ match/
│     └─ [id].tsx                🔨 create — the T-20 flashcard flow
├─ components/                   🔨 build — reusable UI (see §6)
├─ lib/
│  ├─ theme.ts                   ✅ design tokens
│  ├─ supabase.ts                ✅ client
│  ├─ auth.tsx                   ✅ context
│  ├─ notifications.ts           ✅ registerForPush
│  ├─ api.ts                     🔨 create — React Query hooks
│  └─ analytics.ts               🔨 create — posthog-react-native wrapper
├─ assets/                       🔨 add icon.png, splash.png,
│                                       adaptive-icon.png, notification-icon.png
├─ supabase/
│  └─ 2026-07-push-native.sql    ✅ migration (run once)
├─ app.json                      ✅
├─ eas.json                      ✅
├─ metro.config.js               ✅ monorepo-aware
├─ babel.config.js               ✅
├─ tsconfig.json                 ✅
├─ package.json                  ✅
├─ .gitignore                    ✅
├─ README.md                     ✅
└─ SPEC.md                       ✅ (this file)
```

## 4. Data model & backend

**Do not modify tables the web app depends on.** Reuse them:
- `profiles` — player info, phone, role (`player | operator | admin`)
- `pitches` — venues
- `games` — kickoff time, capacity, price, status
- `bookings` — player↔game, `payment_method`, `payment_status`, team, slot
- `push_subscriptions` — extended by this app's migration to carry
  `expo_push_token` + `platform`
- `games.reminder_sent_at` — idempotency guard for T-20 push

Run [`supabase/2026-07-push-native.sql`](./supabase/2026-07-push-native.sql)
in the Supabase SQL editor once.

All RLS policies stay as they are. RN client uses the anon key + user JWT
identically to the web app.

## 5. Screens — what to build

Match the web app's flows literally unless flagged. Ports, not redesigns.

### Auth (`app/(auth)/login.tsx`, `signup.tsx`)
- Email + password (Supabase auth), plus name + phone on signup.
- Signup writes a `profiles` row (`useCreateProfile` in web is the reference).
- On success: **navigate to `/onboarding` first, not `/(tabs)`** — this is
  where we ask for notification permission (see §7).
- Show "Sign in with Apple" if trivial via `expo-apple-authentication`
  (iOS only), otherwise skip — email/password is enough for MVP.

### Onboarding (`app/onboarding.tsx`)
The mobile version of the web's `FullExperienceSheet`. Full-screen, not a
sheet, because we own the app now.
- Bell icon, headline "Never miss kickoff", subhead "We'll remind you 20
  minutes before every game you book." (EN + AR).
- Primary button "Turn on reminders" → calls
  `registerForPush(user.id)` from `lib/notifications.ts`, then routes to
  `/(tabs)`. Muted "Maybe later" also routes to `/(tabs)`.
- Fire `reminder_onboarding_shown` and either `reminder_enabled` or
  `reminder_onboarding_dismissed` PostHog events matching web semantics.

### Games list (`app/(tabs)/index.tsx`)
- Fetch upcoming games via Supabase (`games` + `bookings(count)`).
- Group by day (web does the same — mirror the `groupByDay` helper).
- Each card: title, pitch name, time, price (SAR), fill bar + occupancy
  chip (colors from `lib/theme.ts`). Tap → `/game/[id]`.
- Pull-to-refresh; empty state with a friendly Caveat headline.

### My Games (`app/(tabs)/my-games.tsx`)
- Two sections: upcoming (chronological), past (grouped by month).
- Each row: game title, kickoff, team assignment, status pill (paid,
  pending cash, refunded).
- Long-press → sheet with `Cancel booking` (calls same RPC the web uses).

### Game detail (`app/game/[id].tsx`)
- Hero: title, pitch, kickoff time (in `Asia/Riyadh`).
- Fill bar + count of paid vs pending bookings.
- Pitch SVG showing team slots — reuse the SVG geometry from the web's
  `PitchSVG` (copy verbatim, just render inside `react-native-svg`).
- Tap a slot → book (creates a `bookings` row `pending`, then
  `router.push(\`/checkout/\${bookingId}\`)`).
- Operators see extra controls: cancel game (soft-set `status=cancelled`),
  hard delete (destructive; the web has this on `/game/:id/manage`).

### Checkout (`app/checkout/[bookingId].tsx`)
- Two method cards: **STC Pay** (show number + copy button) and **Cash at
  the pitch**.
- Confirm → `bookings.update({ payment_method })`, then present the
  "Spot reserved" screen.
- "Spot reserved" state includes: WhatsApp group join CTA, back-to-game,
  and if push isn't enabled yet, an inline "Turn on reminders" nudge
  (calls `registerForPush`). Mirror the web's second-chance pattern.

### Match flow (`app/match/[id].tsx`)
- Opened by tapping the T-20 push, OR from a "Match day" banner on the
  game screen when `now >= kickoff - 15 min`.
- Steps: (1) pick your team (2 or 3 based on capacity), (2) confirm
  check-in code shown by operator, (3) done.
- Use `react-native-reanimated` for smooth step transitions.
- Fire `matchday_flashcard_started`, `_step_completed`, `_completed`.

### Settings (extend scaffold)
- Push toggle: shows current permission state, opens iOS/Android settings
  if denied (`Linking.openSettings()`).
- Language toggle (EN ↔ AR — the web app supports this; port the i18n
  bundle).
- Sign out (already wired).
- Legal links: Terms, Privacy, Refund, Delivery — WebViews to the web pages
  (`react-native-webview`), so we don't fork policy text.

## 6. Components to build (in `components/`)

Small, focused. No design systems yet — just what these screens need:

- `GlassCard` — the frosted-cream card equivalent used on the web
  (`background: #FFFDF9 → #FFF8F0` gradient via
  `expo-linear-gradient`, 1px `rgba(255,255,255,0.65)` border, soft shadow).
- `PillButton` — primary/secondary, EN/AR safe.
- `FillBar` — matches web's occupancy bar, animated with reanimated.
- `OccupancyChip` — 6-state (`Spots open`, `Players joining`, …) — copy
  the machine from web's `GameCard.tsx`.
- `PitchSVG` — port from web, render with `react-native-svg`.
- `HandwrittenHeader` — loads Caveat via `expo-font`, renders with
  `fontFamily: 'Caveat_600SemiBold'`, letterSpacing negative.
- `BottomSheet` — a lightweight custom sheet on top of
  `react-native-gesture-handler` — do not pull in a heavy modal library.

## 7. Push notifications (the whole point)

### Client
`lib/notifications.ts` is done. Call `registerForPush(user.id)` from:
1. **Onboarding screen**, primary path.
2. **Checkout "Spot reserved" screen**, secondary chance for skippers.
3. **Settings toggle**, always available.

Deep-link handling: when the user taps a push, the payload's `url` field
is a string like `/match/<game-id>`. Wire this in `app/_layout.tsx` via
`useNotificationTapNavigator((url) => router.push(url))`.

### Server (edge function change — do this carefully)
Update `supabase/functions/send-match-reminders/index.ts` (in the web repo)
to fan out to Expo push tokens as well as web VAPID subscriptions.

Rough diff:

```ts
// After collecting subs for game bookings, split by type:
const webSubs   = subs.filter(s => s.endpoint);           // existing
const expoSubs  = subs.filter(s => s.expo_push_token);    // new

// Existing web loop unchanged.

// New Expo loop — one HTTPS POST to Expo's push service:
if (expoSubs.length) {
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept-Encoding": "gzip, deflate" },
    body: JSON.stringify(expoSubs.map(s => ({
      to: s.expo_push_token,
      title: game.title,
      body: "Starts in 20 min — tap to pick your team",
      data: { url: `/match/${game.id}` },
      channelId: "match-reminders",
      priority: "high",
      sound: "default",
    }))),
  });
}
```

No VAPID keys or webpush lib needed for the Expo half — Expo's push service
handles APNs/FCM signing.

### Permission UX
- **Never** ask for permission on app boot. Always ask inside a screen
  where the player already understands why (onboarding or checkout).
- If denied twice, don't ask again. Show the settings-link path instead.

## 8. Analytics (PostHog)

Use `posthog-react-native` (add to deps when installing). Init with the
existing EU key `phc_AWm9NYadeyvRG4mASJPC8hcgNV8Ck37S9BAaywNtCZMv` at
`https://eu.i.posthog.com`. Reuse the exact event names shipped on web so
funnels combine cleanly:

- `player_signed_up`, `player_logged_in`
- `reminder_onboarding_shown`, `reminder_onboarding_dismissed`
- `reminder_enabled`, `reminder_denied` (with `source: 'signup' | 'checkout' | 'settings'`)
- `booking_started`, `booking_confirmed` (with `method`, `fee`)
- `matchday_push_delivered`, `matchday_flashcard_started`, `matchday_flashcard_completed`
- `pageview` equivalent: use `posthog.screen('ScreenName')` on every route change.

`identify(userId)` after auth; `reset()` after sign-out.

## 9. Non-goals / explicit anti-scope

- **No React Native Web.** This app is native-only. If someone wants a web
  build later, the existing web app already exists.
- **No offline mode.** Assume connectivity; show clear network errors.
- **No in-app payments.** Cash + STC Pay only, same as web.
- **No push scheduling on-device.** The Supabase edge function is the
  scheduler — do not attempt to shadow it with `expo-notifications`
  `scheduleNotificationAsync` (recipe for double-firing).
- **No Redux, MobX, or Zustand for server state.** React Query only.
  Zustand is fine for pure UI state.
- **Do not delete or restructure the web app.** Additive only.

## 10. Definition of done (MVP)

Ship-ready means all of the following pass:

1. `pnpm typecheck` — zero errors.
2. On a real iPhone: sign up → grant notification permission → book a game
   → within 20 min of kickoff, receive a push → tap → land on flashcard.
3. Same flow on a real Android device (or emulator with FCM configured).
4. `pnpm eas:build:preview` produces an installable build on both platforms.
5. All screens listed in §5 exist, render, and don't crash on empty data.
6. PostHog Live Events shows `player_signed_up` after a real test signup.
7. Web app is unchanged — regression-check by running `../playos` locally
   after your changes and completing one full booking there.

## 11. Handoff etiquette

- **Small commits, clear messages.** Follow the existing repo style — see
  recent commits on `mvp-launch`.
- **Do not push to `main`.** Work on `mvp-launch` or a `mobile/*` branch.
- **Update this SPEC.md** as the surface stabilizes — if you deviate from
  a section, note the deviation inline (`> Deviation: …`) rather than
  silently rewriting.
- **When stuck, ask for a decision, don't invent one.** Especially for
  anything payment-adjacent or that touches Supabase RLS.
