# Figma ↔ Code Map — PlayOS Mobile

Figma file: **PlayOS Mobile Designs** — https://www.figma.com/design/frr8kY9ogojfTg1mHsvMiN
(Code Connect is unavailable on the Pro plan — this doc is the manual equivalent.
When implementing a screen, pull specs with the Figma MCP `get_design_context`
using the node IDs below, and reuse the mapped code component instead of
regenerating it.)

## Design language (ported in lib/theme.ts, Phase 1)

- Screen bg: `<WarmCanvas />` (cream `colors.canvas` + peach/lavender radial glows)
- Cards: `<GlassCard />` (blur + white 78% + hairline white stroke + warm shadow — never black shadows)
- Script accents: `<HandwrittenHeader />` (Caveat Bold, orange)
- Ink: `colors.inkNavy` (flashcards) / `colors.inkDeep` (booking flow); secondary `colors.mutedLavender`
- Teams: `colors.teamOrange` / `colors.teamPurple` · meta icons `colors.purpleSoft`
- Gradients: `gradients.cta` (join match) · `sharePill` · `checkIn` · `streak`
- Radii: cards `radius.xl/xxl`, screens `radius.screen` (40)

## Components (🧩 Components page)

| Figma component | Node | Code |
|---|---|---|
| Match Card | 71:276 | `components/MatchCard.tsx` |
| Bottom Nav | 34:2 | `app/(tabs)/_layout.tsx` (tab bar config) |
| Dot Wave / 2 / Corner / Vortex | 71:247 / 247:399 / 247:400 / 253:398 | `components/DotWaveBackground.tsx` |
| PlayOS/Pitch + Pitch/Position + Pitch Selector | 213:327 / 213:326 / 215:316 | `components/PitchSVG.tsx` |
| PlayOS/CTA/Join Match | 214:316 | `components/GradientPillButton.tsx` |
| Icon/* (Person, Card, Bell, Help, Trophy, People) | 70:212–70:233 | `lucide-react-native` equivalents |
| Venue Row | 66:151 | _inline in Browse — extract to `components/VenueRow.tsx` when touched_ |
| Booking Row | 66:158 | _inline in Bookings — extract to `components/BookingRow.tsx`_ |
| Chat Row | 69:192 | _inline in Chats — extract to `components/ChatRow.tsx`_ |
| Menu Row | 70:243 | _inline in Profile — extract to `components/MenuRow.tsx`_ |
| Action Row | 70:254 | _inline in Post-match — extract to `components/ActionRow.tsx`_ |
| Match Row | 323:315 | _new — `components/MatchRow.tsx` (Browse-Matches)_ |
| Area Tile | 72:275 | _inline in Play — extract to `components/AreaTile.tsx`_ |

## Screens (Screens page — key node IDs)

Checkout is node **345:364** (dev notes 432:550).

| Screen | Node | Code route |
|---|---|---|
| Home | 1:2 | `app/(tabs)/index.tsx` |
| Checkout | 345:364 | `app/checkout/[bookingId].tsx` |
| Play | 1:3 | `app/(tabs)/play.tsx` |
| Game Detail (standalone Figma page) | 552:483 | `app/game/[id].tsx` |
| Bookings | 1:5 | `app/(tabs)/my-games.tsx` |
| Chats | 1:6 | `app/(tabs)/chat.tsx` |
| Profile | 1:7 | `app/(tabs)/settings.tsx` |
| Browse + Browse-Matches | 1:8 / 324:315 | `app/browse.tsx` (tabbed) |
| Activity | 1:9 | `app/activity.tsx` |
| Countdown | 1:10 | `app/countdown/[id].tsx` |
| Post-match | 1:11 | `app/post-match/[id].tsx` |
| Booking Confirmed | 369:568 | `app/booking-confirmed/[bookingId].tsx` (wired — checkout routes here on success) |
| Game Detail — Full (Waitlist) | 351:364 | `app/game/[id].tsx` (full state) |
| Legal — Terms of Service | 361:544 | new: `app/legal/terms.tsx` |
| Enable Notifications | 410:478 | new: `app/enable-notifications.tsx` |
| Dynamic Island / Live Activity | 383:499 | parked (needs dev build + Apple membership) |
| Flashcards: Check-in / Waiting / Hold / Starting / Pick side / Coin flip / Teams | 387:632 / 388:478 / 394:478 / 394:507 / 387:649 / 390:478 / 388:496 | `app/matchday/[id].tsx` (single flow, phase-driven like web `MatchDayFlow.tsx`) |

User-added screens (Auth, Onboarding, Checkout, Booking Confirmed, Chat screens,
Settings, Player Profile, empty states) live in named sections on the Screens
page — find node IDs via `get_metadata` on page `0:1`, frames are named exactly
("Checkout", "Auth - Phone Entry", …). Each has a `Dev Notes — <name>` frame
next to it; read it before implementing.

## Product rules (decided — full log on the 📐 Handoff page)

Check-in T-20 · free cancel 26h · hold-to-start = all *checked-in* players,
T+5 anyone-start, T+15 auto-start ≥6 else auto-cancel (tokens to checked-in
only) · waitlist offer 3-min hold + 30s countdown from open · chat T-20→T+20
soft-close, 30-day retention · commendations at launch (max 3, positive-only,
+5 XP), sportsmanship score deferred to v1.5 · coin flip server-side, stored
once · payments cash + STC Pay, single operator (the Checkout mock 345:364 and
its dev note 432:555 still show mada/Apple Pay/Google Pay/Card and saved cards
— stale, correct at source).

Venue cancellation (ratified): PlayOS or the venue cancels; the player chooses
cash or a game token; streak preserved either way; no XP either way; 48h to
choose; after that auto-refund CASH, never a token by default. Tokens expire
**30 days** (Figma 680:542 still says 60 — stale). Auto-cancel when fewer than
10 of 12 are checked in at T-10.

## Edge, errors & ops (⚠️ page)

| Screen | Node | Code |
|---|---|---|
| Error · Server 500 | 684:494 | `app/error/server.tsx` |
| Error · Offline | 683:545 | `app/error/offline.tsx` |
| Error · Session expired | 684:520 | `app/error/session-expired.tsx` |
| Error · Game not found | 686:586 | `components/MatchGone.tsx` (rendered by `app/game/[id].tsx`) |
| Error · Check-in not open yet | 684:542 | `app/check-in/[gameId].tsx` (server clock via `lib/serverTime.ts`) |
| Empty · Home, nothing booked | 684:570 | `components/HomeNothingBooked.tsx`, used by `app/(tabs)/index.tsx` |
| Error · Payment declined | 682:482 | _blocked: no payment gateway_ |
| Error · Spot taken mid-checkout | 682:511 | _blocked: checkout flow_ |
| Booking · Get alerted when a spot frees | 682:541 | _blocked: no waitlist backend_ |
| Waitlist · Head start alert | 683:488 | _blocked: no waitlist backend_ |
| Waitlist · Someone booked it first | 683:516 | _blocked: no waitlist backend_ |
| Ops · At-risk players T-10 | 685:502 | `app/ops/at-risk/[gameId].tsx` (RPCs in 2026-07-operator-surface.sql, unapplied) |
| Ops · Release spot | 685:558 | folded into the at-risk list as the per-player release action |
| Ops · Cancel match | 685:596 | `app/ops/cancel/[gameId].tsx` (RPCs in 2026-07-operator-surface.sql, unapplied) |
| Ops · Resolve disputed score | 686:508 | _blocked: no score schema_ |
| Ops · Review reported player | 686:549 | _blocked: no reports table_ |

## Launch backlog (🧱 page — 41 screens, all magenta NEW)

Built:

| Screen | Node | Code |
|---|---|---|
| Loading · Home skeleton | 698:518 | `components/Skeleton.tsx` → `HomeSkeleton`, used by `app/(tabs)/index.tsx` |
| Loading · Browse skeleton | 698:553 | `components/Skeleton.tsx` → `BrowseSkeleton`, used by `app/browse.tsx` |
| Loading · Bookings skeleton | 698:595 | `components/Skeleton.tsx` → `BookingsSkeleton`, used by `app/(tabs)/my-games.tsx` |
| Loading · Game detail skeleton | 698:636 | `components/Skeleton.tsx` → `GameDetailSkeleton`, used by `app/game/[id].tsx` |
| Empty · Play tab, nothing live | 697:506 | `components/PlayNothingLive.tsx`, used by `app/(tabs)/play.tsx` |
| Empty · Venues, no results | 697:540 | `components/BrowseEmpty.tsx` → `VenuesEmpty`, used by `app/browse.tsx` |
| Empty · Matches, no results | 697:585 | `components/BrowseEmpty.tsx` → `MatchesEmpty`, used by `app/browse.tsx` |
| Permission · Location denied | 696:620 | `app/permission/location.tsx` |
| Permission · Notifications off | 696:656 | `app/permission/notifications.tsx` |
| System · Update required | 696:690 | `app/system/update-required.tsx` |
| Error · Chat send failed | 698:664 | `app/chat/[conversationId].tsx` (a state of the thread, not a route) |
| Loading · Reconnecting | 698:699 | `components/ReconnectingState.tsx`, used by `app/match/[id].tsx` |
| Settings · Notifications | 699:726 | `app/account/notifications.tsx` |

Shared by the three empty states: `components/EmptyState.tsx` → `EmptyCard`
(the 350×148 halo card, identical in all three mocks) and `EmptyEyebrow`.

What the empty-state mocks ask for that the schema cannot back, and is
therefore omitted (same precedent as the venue star rating in Browse):
- **filter chips** (`indoor`, `under SAR 100`, `5-a-side`, `tonight`, `6v6`,
  `under SAR 40`), the **"DROP ONE FILTER"** suggestion rows and their per-filter
  counts, and **"clear my filters"** — Browse has a free-text query only; there
  is no filter model, no indoor/outdoor column and no price or kickoff filter.
  The query stands in for the chips and "clear my search" is the one-tap reset.
- **venue distance in km and indoor/outdoor** on the fallback venue rows — no
  device location, no venue coordinates, no surface column. Rows show games-open
  and the cheapest real price instead.
- **"alert me when one appears"** (matches mock) — needs a saved-search alert
  plus push delivery; both are blocked below. Replaced with "show all matches".

HomeSkeleton was ported number-for-number from 698:518, then deliberately
changed: its hero block was 196 and its rows 64, but the real Home hero is 238
and its rows 68. The annotation's own rule — block geometry matches the real
cards so nothing jumps when data lands — outranks the mock's numbers where the
two disagree. Same call as BrowseSkeleton. This is a documented divergence, not
an unverified screen.

Skeleton rules, from the annotations and enforced in code:
- block geometry mirrors the real cards exactly so nothing jumps when data lands
- held back 300ms (`useDelayedVisible`) so a warm cache doesn't flash it
- on request failure the screen routes to `/error/server`; the skeleton never keeps pulsing
- controls that are client state (filter chips, upcoming/past segment) stay live and tappable during load

Booking · Time clash (700:698) was deleted deliberately and is out of scope
for this phase. Do not re-export it.

Operator surface (ratified as the highest-priority area):

| Screen | Node | Code |
|---|---|---|
| Ops · At-risk players T-10 | 685:502 | `app/ops/at-risk/[gameId].tsx` |
| Ops · Cancel match | 685:596 | `app/ops/cancel/[gameId].tsx` |

Both call RPCs in `supabase/2026-07-operator-surface.sql`, NOT YET APPLIED.
Until it runs they surface the failure rather than reporting work that never
happened.

Venue cancellation policy (ratified, no longer blocked): PlayOS or the venue
cancels; the player chooses cash or a game token; streak preserved either way;
no XP either way; 48 hours to choose; after that we auto-refund CASH and never
default anyone into a token. Game tokens expire in **30 days** — any Figma copy
saying 60 is stale and needs correcting at source. Auto-cancel fires when fewer
than 10 of 12 are checked in at T-10.

Still blocked on a product decision: award categories. MVP / Fair Play / Engine
is placeholder text in Figma, not a decision — do not build the voting screen.

Blocked, with reason:

| Screen(s) | Node(s) | Blocked on |
|---|---|---|
| Payments · Saved methods / Add a card / Remove card? / Checkout · Choose method / Error · Saved card expired / Loading · Payment processing | 695:483, 695:525, 695:559, 695:588, 695:631, 696:492 | no payment gateway, no saved-card store |
| Empty · Wallet, zero tokens | 697:628 | no token ledger |
| Empty · Awards, nobody voted / Loading · Awards being counted / Awards · Voting closed | 697:693, 698:729, 701:672 | award categories not ratified, no vote schema |
| Result · Disputed, player view | 698:754 | no score/confirmation schema |
| Empty · New player profile | 697:661 | no public-profile RPC |
| Account · Edit profile / Delete account / Restricted | 699:534, 699:576, 699:613 | no account-lifecycle backend |
| Safety · Report a player / Report a message | 699:648, 699:685 | no reports table |
| Spot · Nobody took it | 701:556 | no waitlist backend |
| Ops · Check-in stalled | 701:595 | no operator surface |
| Match · Auto-cancelled / Match-day · Already started / Checked in late | 696:556, 696:585, 701:641 | match-day state machine not built |
| System · Push notifications | 700:546 | no push infrastructure |
| Share · Match link and OG card | 700:602 | web surface, not mobile |
| Brand · Splash / App icon | 700:639, 700:650 | app-config assets, not screens |
| Booking · Cancel inside 26h | 696:519 | already covered by `app/cancel/[bookingId].tsx` — verify against mock before duplicating |

## Design-system primitives (from the ⚠️ page annotations)

- `components/Btn3D.tsx` — primary CTA, 350×56 r28, fixed 4-stop orange gradient, one per screen
- `components/BtnOutline.tsx` — secondary, 350×56 r18, tone: neutral / destructive / warning; never side by side
- `components/Callout.tsx` — tone map: blocker(red) / warning(amber) / confirm(green) / neutral(grey).
  Blue = open product question and must never ship.
- `components/ErrorScreen.tsx` — shared error layout (dot wave 0.75, one glass card, primary + stacked secondary)
- Dot wave is always the exported image asset, never rebuilt in code.
