# PlayOS — Match-Day Delivery Spec (PWA push · game-page launch · start-match)

> **Read this second.** [`flashcard-integration-spec.md`](./flashcard-integration-spec.md) covers turning the
> flashcard prototype into a real, data-backed flow — that work is **already built and committed**
> (`useGameRoster`, `useClaimSide`, `useLockTeams`, RLS, realtime, `supabase-flashcard.sql`, captains
> removed). This doc covers the **delivery layer** decided after that: how a player is brought into the
> flow on match day, where the flow lives, and how the match starts when sides don't fill.
>
> Written to be handed to an implementing model. Real file/function names throughout.

---

## 0. Decisions already made (do not re-litigate)

1. **How players are brought in = PWA push notification.** No native app. At ~T-20 min the platform
   sends a Web Push notification; tapping it deep-links to the **game page**, which launches the flashcard.
2. **No QR.** The QR/`/checkin/:pitchId` presence path is dropped as a player entry point for now.
   (The `performCheckIn` function and `/checkin/:pitchId` route still exist and still work — we're just
   not asking players to scan anything. Check-in becomes an in-flow "I'm Here" tap. See §3.4.)
3. **The flashcard launches on the game page, not as its own route.** The current standalone
   `/flashcard/:gameId` route is retired. The notification deep-links to `/game/:id?matchday=1`; the
   game page (`pages/game/[id].tsx`) detects match-day and opens the flow as a full-screen overlay.
4. **Start-anyways = hold-to-start button that appears at kickoff time (T).** Before T, a countdown.
   At T, a hold-to-start button materializes. Any checked-in player can trigger it. It **balances the
   unpicked players and guests across both teams, then flips** — see §4.
5. **Presence is soft.** Without the QR there's no proof a player is physically at the pitch. Accepted
   tradeoff for a trusted community MVP. Do not add geofencing.
6. **No captains.** (Carried over — stated again so it's never reintroduced.)

---

## 1. PWA foundation — the app is not a PWA yet

Today there is **no manifest, no service worker, no app icons**. All of push depends on this landing first.

### 1.1 Web app manifest
Create `artifacts/playos/public/manifest.webmanifest`. **Build output note:** `vite build` writes to
`../../public` (repo root `public/`) with `emptyOutDir: true`, so anything in
`artifacts/playos/public/` is copied to the served root — put the manifest, icons, and service worker
there. Reference it from `artifacts/playos/index.html` with `<link rel="manifest" href="/manifest.webmanifest">`.

```json
{
  "name": "PlayOS",
  "short_name": "PlayOS",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#FF9F0A",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```
Generate the three icons from the existing brand mark (`public/favicon.svg`). Maskable icon needs safe-zone padding.

### 1.2 Service worker
Create `artifacts/playos/public/sw.js`. It must handle two events:
- `push` → `self.registration.showNotification(title, { body, data: { url }, icon, badge, tag })`.
- `notificationclick` → `event.notification.close()`, then focus an existing client on that URL or
  `clients.openWindow(url)`. The `url` is `/game/:id?matchday=1`.

Register it once on app boot (e.g. in `main.tsx` or a small `lib/pwa.ts`):
`if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')`.

> **Do NOT reach for `vite-plugin-pwa` + Workbox precaching blindly.** This app builds into the repo
> `public/` dir and is served by Vercel; a hand-written `sw.js` that only does push is lower-risk than
> a precaching SW that can serve stale bundles. If you use `vite-plugin-pwa`, set
> `injectRegister: null` and `workbox: { navigateFallback: null }`, or use `strategies: 'injectManifest'`
> with push-only logic. Precaching the SPA shell has caused stale-deploy bugs — avoid unless asked.

### 1.3 The iOS constraint — design the install nudge around it
- **Android (Chrome/Firefox/Edge):** push works on the live site, no install required.
- **iOS/iPadOS Safari (16.4+):** push works **only after the user adds the site to their Home Screen**,
  and the permission prompt must fire from a **user gesture inside the installed PWA**. A normal Safari
  tab receives nothing.

Therefore:
- Detect standalone mode: `window.matchMedia('(display-mode: standalone)').matches` (and
  `navigator.standalone` on old iOS).
- On iOS Safari **not** installed → show an "Add PlayOS to your Home Screen for match reminders" hint
  (with the Share → Add to Home Screen instruction). Do not attempt to prompt for notifications there;
  it will silently fail.
- Only call `Notification.requestPermission()` from a tap, and only when push is actually supported
  (installed PWA on iOS, or any supported browser on Android).

### 1.4 Where to ask for permission
The natural gesture is **right after a successful booking** (`useBookSpot` success in
`pages/game/[id].tsx` / checkout callback): "Get a reminder 20 min before kickoff?" → on tap, subscribe.
Also offer it from a settings/profile spot for anyone who dismissed it.

---

## 2. Push subscription storage + backend

### 2.1 Schema — store subscriptions
```sql
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "push: manage own" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

### 2.2 Client — subscribe + persist
New helper `lib/push.ts`:
- `subscribeToPush()`: get the SW registration, `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: <VAPID public> })`, then upsert the resulting `{ endpoint, keys.p256dh, keys.auth }` into `push_subscriptions` for `auth.uid()`.
- VAPID **public** key ships in the client via `import.meta.env.VITE_VAPID_PUBLIC_KEY` (convert to Uint8Array).
- Handle re-subscription if `pushManager.getSubscription()` returns null or a changed endpoint.

### 2.3 Backend — send the push (Supabase Edge Function)
Create `supabase/functions/send-match-reminders/`.
- Uses the **VAPID private key** (Edge Function secret `VAPID_PRIVATE_KEY`, plus `VAPID_PUBLIC_KEY`,
  `VAPID_SUBJECT=mailto:...`). Use a Deno-compatible web-push library (e.g. `npm:web-push` via
  `esm.sh`, or a Deno web-push port).
- Query: games with `status != 'cancelled'`, `kickoff_time` between `now()+18min` and `now()+22min`,
  that have **not** already been notified (add `games.reminder_sent_at timestamptz` and set it after sending — the idempotency guard).
- For each such game: find its booked players (`bookings` with `payment_status in ('paid','pending')`,
  `user_id not null`), load their `push_subscriptions`, send:
  - title: game title (e.g. "Al Rowad 8PM")
  - body: "Starts in 20 min — tap to pick your team"
  - `data.url`: `/game/<gameId>?matchday=1`
- On a `410 Gone` / `404` response for a subscription, delete that subscription row.
- After a game's players are all sent, `update games set reminder_sent_at = now()`.

### 2.4 Scheduler — fire every few minutes
Use `pg_cron` (Supabase) to invoke the Edge Function every 2–3 min, **or** Supabase scheduled
functions. The ±2-min query window in §2.3 plus the `reminder_sent_at` guard makes it safe to run
often without double-sending.

---

## 3. Game-page launch — retire the standalone route

### 3.1 What changes
- **App.tsx:** remove the `/flashcard/:gameId` and `/flashcard` routes (both EN and `/ar`). The flow no
  longer has its own URL.
- **checkin/[pitchId].tsx:** its success branch currently does `setLocation('/flashcard/:gameId')`
  (added in the integration build). Since QR is dropped as an entry point, this file is no longer part
  of the player path. Leave `performCheckIn` in `supabase-api.ts` (the flow reuses its logic), but the
  page can be left as-is or removed from routing — implementer's call; it's not user-facing anymore.

### 3.2 The flow becomes an overlay component
Move the flow currently in `pages/flashcard.tsx` into a launchable component, e.g.
`components/flashcard/MatchDayFlow.tsx`, that takes `{ gameId, onClose }` and renders the existing
phase machine (`loading → no_booking / outside_window → arrival → pulse → choose → coinflip → reveal → tactical`).
All the data hooks (`useGameInfo`, `useMyBooking`, `useGameRoster`, `useClaimSide`, `useLockTeams`) move
with it unchanged. The old `pages/flashcard.tsx` file is deleted once its body lives here.

### 3.3 The game page opens it
In `pages/game/[id].tsx`:
- Read the query param: if `?matchday=1` **or** the game is "live now" for this player (game is today,
  within the check-in window, and the player has a `paid`/`pending` booking), show a prominent
  **"Match day → Enter"** banner/button, and auto-open `MatchDayFlow` when `?matchday=1` is present.
- `MatchDayFlow` renders full-screen over the page; `onClose` returns to the normal game detail view.
- This is the **in-app auto-surface fallback**: a player who opens the game page near kickoff (without a
  notification) still sees the banner and can enter.

### 3.4 Check-in inside the flow (no QR)
The `arrival` phase's "I'm Here" button already calls `performCheckIn(pitchId, gameId)`. Without a QR,
resolve `pitchId` from the game's `pitch_name` (the flow already does this lookup). `performCheckIn`'s
time-window logic (opens 15 min before kickoff) is the gate. Keep it — it's the soft-presence check.

---

## 4. Start-match — the hold-to-start button + a real RPC

### 4.1 The RPC the current build is missing
`lock_teams_and_flip` (already shipped) only sets `kickoff_team`. It assumes both sides are already
full. "Start anyways" means they are **not** — some checked-in players never picked, and guests
(`user_id null`) never can. Replace/extend with a single **`start_match(p_game_id)`** RPC that both the
auto-full path and the manual hold path call:

```
start_match(p_game_id text) returns text   -- 'ok' | 'already_locked' | 'not_found' | 'too_few'
```
Logic in one transaction, `security definer`:
1. Guard: if `games.kickoff_team is not null` → `already_locked`. If game missing → `not_found`.
2. Collect all **checked-in** bookings for the game (`checked_in = true`, `payment_status in ('paid','pending')`).
   Optionally include checked-in guests. If fewer than a floor (e.g. 4) → `too_few` (host can wait).
3. **Balance:** keep already-picked `team` values; take the remaining (team is null) and the guests and
   distribute them to even the two sides — assign to whichever side currently has fewer, alternating.
   Assign `slot_index` sequentially per team.
4. Set `kickoff_team = (floor(random()*2)+1)`, `teams_locked_at = now()`.
5. Return `ok`.

Keep it idempotent/race-safe: the `where kickoff_team is null` guard on the update, first caller wins.
Expose as `useStartMatch()` in `supabase-api.ts` (mirrors `useLockTeams`, which can be removed or kept
as an alias). The **auto-lock effect** currently in the flow (fires when both sides full) should call
`start_match` too, so there is exactly one lock path.

### 4.2 The button UX (a hold-to-start pattern)
On the waiting card (the `coinflip`/waiting phase before `teams_locked_at` is set):
- **Before kickoff time T:** show a live countdown "Kicks off in mm:ss". No start button.
- **At T (now >= kickoff_time):** a **hold-to-start** button materializes — spring scale-in
  (`cubic-bezier(.2,1.3,.4,1)`) + a brief pulsing glow ring to draw the eye after the stillness.
- **Interaction:** press-and-hold (Pointer Events, `touch-action: none`) fills a radial/linear progress
  over ~1s; releasing early resets; completing calls `start_match`, fires `navigator.vibrate(30)`, and
  the button confirms (turns green, "Starting"). A plain tap must NOT start — the hold is the safety.
- Any checked-in player sees and can use it. Realtime (`useGameRoster` / `teams_locked_at`) advances
  everyone to `reveal`/`tactical` once the first person completes the hold.
- `@media (prefers-reduced-motion: reduce)`: drop the spring/glow, keep the hold.

> A working reference implementation of this exact button (countdown → materialize → hold → complete)
> was prototyped in-chat during planning; reproduce that behavior. Colors: brand orange `#FF9F0A`
> idle, `#34C759` on completion.

---

## 5. Build order (dependency-first)

1. **PWA foundation** — manifest, icons, `sw.js`, registration, install/standalone detection (§1).
2. **Push subscription + storage** — `push_subscriptions` table, `lib/push.ts`, permission nudge after
   booking (§1.4, §2.1, §2.2).
3. **Push backend + scheduler** — Edge Function `send-match-reminders`, `games.reminder_sent_at`, VAPID
   secrets, pg_cron (§2.3, §2.4). Deep-link target `/game/:id?matchday=1`.
4. **Game-page launch** — extract `MatchDayFlow.tsx`, wire the game page banner + `?matchday=1`
   auto-open, retire `/flashcard` routes (§3).
5. **`start_match` RPC + hold-to-start button** — replace flip-only lock, build the button, unify the
   auto-lock path (§4).
6. **QA the two platforms** — Android live-site push; iOS installed-PWA push. Verify deep link opens the
   game page and launches the flow at the right phase.
7. *(Later, separate)* live check-in tracking dashboard — foundation is already realtime via
   `useGameRoster`.

---

## 6. Edge cases / gotchas

- **iOS not installed** → no push possible; the install hint is the only lever. Don't silently fail a
  permission prompt.
- **Subscription expiry** → handle `410 Gone` by deleting the row (§2.3); re-subscribe on next app open.
- **Double notification** → the `reminder_sent_at` guard + windowed query prevent it; don't skip it.
- **Player taps notification late** (after `teams_locked_at`) → the flow already resumes at `reveal` and
  the late-arrival balances onto the smaller side. Verify this still holds through `MatchDayFlow`.
- **Guests (`user_id null`)** → no account, no push, no self-pick; `start_match` auto-balances them.
- **Only the notification `data.url` decides the destination** — never trust a URL from anywhere else.
- **Do not reintroduce captains** anywhere in the button, reveal, or tactical views.

---

## 7. Secrets / config checklist (hand to the human, not the model)

- Generate a **VAPID key pair** (e.g. `npx web-push generate-vapid-keys`).
- Client env: `VITE_VAPID_PUBLIC_KEY`.
- Edge Function secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:you@domain`).
- Run the SQL in §2.1 and add `games.reminder_sent_at`. Enable `pg_cron`.
- App icons (192, 512, 512-maskable) generated and placed in `artifacts/playos/public/icons/`.
