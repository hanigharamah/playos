# PlayOS — Flashcard Match-Day Flow: Integration Spec

> **Purpose of this doc.** The `/flashcard` route today is a self-contained, timer-driven
> **prototype** with entirely fake data (`pages/flashcard.tsx`, `components/flashcard/LiquidCard.tsx`,
> `components/flashcard/FlashcardModal.tsx`). This spec is the complete list of what must be
> built to turn it into a real, multiplayer, data-backed match-day flow whose job is to
> **let players sort themselves into teams on the day, removing the need for an operator on the field.**
>
> Written to be handed to an implementing model. Real function/field names are used throughout so
> nothing has to be re-derived.

---

## 0. Decisions already made

- **No captains.** The concept is removed entirely. The prototype currently renders a "Captain"
  badge in the **reveal** phase and a crown on the first roster member in the **tactical** phase —
  both must be deleted (see §7). No captain field, no captain logic, anywhere.

- **Team model = choose-on-the-day (not booking-time auto-assign).** This is the load-bearing
  assumption and it drives the schema. Rationale: the feature exists to remove the on-field
  operator, whose job is sorting teams; so players must sort themselves at check-in.
  - **Today's behavior (to change):** `useBookSpot` (`lib/supabase-api.ts` ~L430) assigns
    `team` (1 or 2) and `slot_index` at **booking** time via a slot-filling algorithm.
  - **New behavior:** booking reserves a spot only; `team` is chosen during the flashcard flow on
    match day.
  - **If you'd rather keep auto-assign at booking:** then §2.2, §3.2 (claim_side), and the
    **choose** phase in §4/§5 collapse into a read-only reveal of the team you were already put on.
    Everything else in this doc still applies. Don't do this unless you consciously want it.

---

## 1. Prerequisites — the feature is non-functional without these three

### 1.1 RLS: players currently cannot see their own teammates
**This is the single biggest blocker.** The bookings read policy (`supabase-setup.sql` ~L163) is:

```sql
create policy "bookings: read own or organiser"
  on public.bookings for select
  using (user_id = auth.uid()
         or game_id in (select id from public.games where organiser_id = auth.uid()));
```

A player can read **only their own booking**. Every screen in the flow — "8/12 checked in",
"6/6 Yellow", the live roster, "see both teams" — is impossible under this policy; each player
would see only themselves.

**Required:** add a policy letting a player read all bookings for any game they have a booking in:

```sql
create policy "bookings: read co-players in same game"
  on public.bookings for select
  using (
    game_id in (select b.game_id from public.bookings b where b.user_id = auth.uid())
  );
```

**Privacy note (decide consciously):** this exposes teammates' `guest_name`/`guest_phone`/`user_id`
to each other. If phone numbers must stay private, the roster must be read through a
`SECURITY DEFINER` view/RPC that returns only `{ name, team, checked_in }` — not the raw row.
Recommended: expose name + team + checked_in only, never phone.

### 1.2 Realtime: none exists in the app today
The only Supabase subscription anywhere is `onAuthStateChange` (`lib/auth.tsx`). The prototype fakes
"live" with `setInterval`. Real live counts require Supabase Realtime.

**Required:**
1. Enable the publication on the table (SQL, once):
   ```sql
   alter publication supabase_realtime add table public.bookings;
   ```
2. Realtime respects RLS, so it streams nothing useful until §1.1 lands. Do §1.1 first.

### 1.3 Profiles: signup must reliably create a `public.users` row
`useGetMe` returns `null` when a profile row is missing, so a player with no profile reads as
signed-out and their booking can't resolve a name. A repair script exists
(`supabase-fix-profiles.sql`) that reinstalls the `on_auth_user_created` trigger and backfills.
**This must be confirmed applied** before the flow can bind to real identities.

---

## 2. Schema changes

### 2.1 `games` — persist the coin flip once (never per-device)
The prototype runs `Math.random()` in the browser, so two players see **different** kickoff winners.
The winner must be decided a single time and stored.

```sql
alter table public.games add column if not exists kickoff_team  smallint;      -- 1 or 2, null until decided
alter table public.games add column if not exists teams_locked_at timestamptz;  -- when sides closed & flip ran
```

### 2.2 `bookings` — team is chosen on the day (model from §0)
```sql
alter table public.bookings alter column team drop not null;      -- null until the player picks a side
alter table public.bookings alter column slot_index drop not null; -- assigned when team is chosen, or keep for pitch SVG
```
`team` semantics: `null` = checked in but hasn't picked; `1`/`2` = picked. Map 1→Yellow, 2→Purple
in the UI layer (no need to store color).

> **Consequence to accept:** the pre-match pitch SVG on `pages/game/[id].tsx` (which lays players out
> by `team`/`slot_index`) will show everyone unassigned until match day. That's correct under this model.

### 2.3 No captain field. (Explicitly: do not add one.)

---

## 3. Data-access layer — new hooks / RPCs (in `lib/supabase-api.ts`)

### 3.1 `useGameRoster(gameId)` — live roster + counts
- Query: bookings for `gameId` joined to `users(name)`, returning `{ id, userId, name (guest_name fallback), team, checkedIn }`.
- Subscribe to `postgres_changes` on `bookings` filtered `game_id=eq.<gameId>`; invalidate/patch the
  query on any insert/update. **Unsubscribe on unmount.** This replaces every `setInterval` in the prototype.
- Derived selectors the UI needs: `checkedInCount`, `capacity`, `yellowCount`/`purpleCount`,
  `mySpotsLeftPerSide = capacity/2 - teamCount`.

### 3.2 `claimSide(gameId, team)` — atomic, race-safe side pick
Two players tapping the last Yellow spot at once must not produce 7v5. Do **not** do a
read-count-then-write in JS. Implement a `SECURITY DEFINER` Postgres RPC:

```
claim_side(p_game_id text, p_team smallint) returns text  -- 'ok' | 'full' | 'already_picked' | 'not_checked_in'
```
Logic inside one transaction: verify caller is checked in for this game; count current `team = p_team`
for the game; if `>= capacity/2` return `'full'`; else set the caller's booking `team = p_team`
(+ assign next free `slot_index` if still used). Expose as `useClaimSide()`.

### 3.3 `lockTeamsAndFlip(gameId)` — decide kickoff once
When both sides are full (or an operator/host triggers it), set `games.kickoff_team` (random, server-side),
`games.teams_locked_at = now()`, and `games.status` as appropriate. Guard so it runs **once**
(`where kickoff_team is null`). Expose as `useLockTeams()`. Who triggers it: see §4.

### 3.4 Reuse what already exists — do not rebuild
- **Check-in:** `performCheckIn(pitchId, gameId?)` (~L1007) already resolves the caller's paid booking
  at a pitch within the time window (opens 15 min before kickoff; window −90/+30 min), sets
  `checked_in`/`checked_in_at`, and returns `checked_in | already_checked_in | multiple_matches |
  no_match | outside_window`. The flashcard's **"I'm Here"** button calls this; do not write a new one.
- **Entry route:** `/checkin/:pitchId` (`pages/checkin/[pitchId].tsx`) already auth-gates and redirects
  to `/auth?returnUrl=…`. The QR (`PitchQrModal`) already points at `/checkin/{pitch.id}`. The flashcard
  is what the check-in **success** transitions into.

---

## 4. Phase orchestration — replace timers with real gates

The prototype advances on `setTimeout`. Each phase now has a **real entry condition** from DB/realtime
state. The flow must also **resume at the correct phase** if a player closes and reopens (derive phase
from data, never restart at `arrival`).

| Phase | Prototype trigger | Real entry condition |
|------|-------------------|----------------------|
| `arrival` | page load | player has a paid booking for a game whose check-in window is open, and `checked_in = false` |
| (check-in) | "I'm Here" button | calls `performCheckIn`; on `checked_in`/`already_checked_in` → advance |
| `pulse` | fake counter to 12 | live `checkedInCount` from `useGameRoster`; advance when check-in closes OR host advances |
| `choose` | fake side-claims | player's `team is null`; show live side counts; tap → `claimSide` |
| `coinflip` | `Math.random()` | both sides full (all teams picked) → `lockTeamsAndFlip` runs once; read `games.kickoff_team` |
| `reveal` | timer | `games.teams_locked_at` set and caller's `team` known |
| `tactical` | timer | same; render both rosters from `useGameRoster`, mark the `kickoff_team` side |

**Open orchestration questions to resolve during build:**
- Who fires `lockTeamsAndFlip` — automatically when the last spot is claimed, or an explicit host tap?
  (Recommend: automatic on last claim, with a host override for no-shows.)
- **Late arrival** (checks in after `teams_locked_at`): skip choose/coinflip, drop them onto the
  smaller side via `claimSide`, land them straight on `reveal`.
- **Before check-in opens:** show an "opens at HH:MM" state (reuse `performCheckIn`'s `outside_window`).

---

## 5. Frontend wiring — per phase (in `pages/flashcard.tsx`)

The visual shells (`LiquidCard`, phase layouts, liquid-glass CSS) are **keep-as-is**; only the data
source and transitions change. Replace all local demo state (`OTHERS`, `count`, `counts`,
`Math.random`, every `setInterval`/`setTimeout` that fakes progress).

- **Route/params:** the flow needs a real `gameId` (and the caller's `bookingId`). Reach it from the
  `/checkin/:pitchId` success, or a match-day link on the game page. It must load real state, not mount fake.
- **`arrival`:** real game title/pitch/kickoff from the game row; "I'm Here" → `performCheckIn`.
- **`pulse`:** `checkedInCount / capacity` and avatar grid from `useGameRoster` (real names/initials).
- **`choose`:** side buttons show live `n/(capacity/2)`; disabled when full or after the caller picked;
  tap → `useClaimSide`. Live dots reflect real picks via realtime.
- **`coinflip`:** animation stays; **outcome is read from `games.kickoff_team`**, identical on every device.
- **`reveal`:** show the caller's real name + their team color. **No captain badge** (delete it).
- **`tactical`:** both rosters from `useGameRoster`; "Kicks off" badge on the `kickoff_team` side.
  **No crown** on any player (delete it).

**States the prototype has none of (must add):** loading, check-in failed, outside window, no booking
found, realtime disconnect/reconnect, already checked in.

**i18n / RTL:** the app is bilingual (EN/AR, RTL). The prototype is hardcoded English. Every string
goes through `useI18n().t()` and the layout needs an RTL pass.

---

## 6. Edge cases to handle explicitly

- **Guest bookings** (`useOperatorBookSpot`, `user_id = null`, `guest_name` set): these players have no
  account and can't open the flashcard on their own phone. Decide: does the operator pick their side on
  a shared device, or are guests auto-balanced onto the smaller side at lock time? (Recommend: auto-balance.)
- **Odd numbers / no-shows:** if a side never fills because someone didn't check in, the auto-lock never
  fires. Needs the host override from §4.
- **Double-tap / re-entry:** `claimSide` must be idempotent for a player who already picked
  (`already_picked`). `performCheckIn` already handles re-check-in.
- **Cancellation after check-in:** a refunded booking should drop out of counts/rosters
  (`useGameRoster` filters `payment_status in ('paid','pending')` and excludes `refunded`).

---

## 7. Removals — captain (delete these from `pages/flashcard.tsx`)

- **reveal phase (~L219–224):** the `Crown` + "Captain" gradient badge next to the player's name. Remove
  the badge entirely; keep just the name.
- **tactical phase (~L256):** the `Crown` rendered on `i === 0` of each roster, and the `i === 0`
  special-casing in the `.map`. Rosters render as a flat list, no highlighted member.
- Remove the now-unused `Crown` import if nothing else uses it.
- No captain field is added to the schema (stated for the avoidance of doubt).

---

## 8. Build order (dependency-first)

1. **§1.1 RLS** (players can read co-players) + **§1.2 realtime enablement** — nothing works before this.
2. **§1.3** confirm profile backfill applied.
3. **§2 schema** (`kickoff_team`, `teams_locked_at`, nullable `team`).
4. **§3.2 `claim_side` RPC** and **§3.3 `lockTeamsAndFlip`** (server-side determinism first).
5. **§3.1 `useGameRoster`** with realtime subscription.
6. **§7 remove captain** (small, do it early while touching the file).
7. **§4/§5** rebind phases to real check-in + roster data; delete all fake timers.
8. **§4 orchestration + resume-from-state**, then **§6 edge cases**.
9. **§5 i18n/RTL + missing UI states**, then polish (haptics/sound on reveal — from the original design,
   not yet built, lowest priority).
