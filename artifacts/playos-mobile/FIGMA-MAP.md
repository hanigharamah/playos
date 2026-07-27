# Figma ↔ Code Map — PlayOS Mobile

Figma file: **PlayOS Mobile Designs** — https://www.figma.com/design/frr8kY9ogojfTg1mHsvMiN
(Code Connect is unavailable on the Pro plan — this doc is the manual equivalent.
When implementing a screen, pull specs with the Figma MCP `get_design_context`
using the node IDs below, and reuse the mapped code component instead of
regenerating it.)

## Design language (ported in lib/theme.ts, Phase 1)

- Screen bg: `<WarmCanvas />` (cream `colors.canvas` + peach/lavender radial glows)
- Cards: `<GlassCard />` (blur + white 78% + hairline white stroke + warm shadow — never black shadows)
- Script accents: `<HandwrittenHeader />` (Pacifico, orange)
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

| Screen | Node | Code route |
|---|---|---|
| Home | 1:2 | `app/(tabs)/index.tsx` |
| Play | 1:3 | `app/(tabs)/play.tsx` |
| Game Detail (standalone Figma page) | 552:483 | `app/game/[id].tsx` |
| Bookings | 1:5 | `app/(tabs)/my-games.tsx` |
| Chats | 1:6 | `app/(tabs)/chat.tsx` |
| Profile | 1:7 | `app/(tabs)/profile.tsx` |
| Browse + Browse-Matches | 1:8 / 324:315 | `app/browse.tsx` (tabbed) |
| Activity | 1:9 | `app/activity.tsx` |
| Countdown | 1:10 | `app/countdown/[id].tsx` |
| Post-match | 1:11 | `app/post-match/[id].tsx` |
| Booking Confirmed | 369:568 | `app/booking-confirmed/[bookingId].tsx` (built, not yet wired — see note) |
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
once · payments mada/Apple Pay/Google Pay (gateway TBD).

## Edge, errors & ops (⚠️ page)

| Screen | Node | Code |
|---|---|---|
| Error · Server 500 | 684:494 | `app/error/server.tsx` |
| Error · Offline | 683:545 | `app/error/offline.tsx` |
| Error · Session expired | 684:520 | `app/error/session-expired.tsx` |
| Error · Game not found | 686:586 | `components/MatchGone.tsx` (rendered by `app/game/[id].tsx`) |
| Error · Check-in not open yet | 684:542 | _not built_ |
| Empty · Home, nothing booked | 684:570 | _not built_ |
| Error · Payment declined | 682:482 | _blocked: no payment gateway_ |
| Error · Spot taken mid-checkout | 682:511 | _blocked: checkout flow_ |
| Booking · Get alerted when a spot frees | 682:541 | _blocked: no waitlist backend_ |
| Waitlist · Head start alert | 683:488 | _blocked: no waitlist backend_ |
| Waitlist · Someone booked it first | 683:516 | _blocked: no waitlist backend_ |
| Ops · At-risk players T-10 | 685:502 | _blocked: no operator surface_ |
| Ops · Release spot | 685:558 | _blocked: no operator surface_ |
| Ops · Cancel match | 685:596 | _blocked: no operator surface_ |
| Ops · Resolve disputed score | 686:508 | _blocked: no score schema_ |
| Ops · Review reported player | 686:549 | _blocked: no reports table_ |

## Design-system primitives (from the ⚠️ page annotations)

- `components/Btn3D.tsx` — primary CTA, 350×56 r28, fixed 4-stop orange gradient, one per screen
- `components/BtnOutline.tsx` — secondary, 350×56 r18, tone: neutral / destructive / warning; never side by side
- `components/Callout.tsx` — tone map: blocker(red) / warning(amber) / confirm(green) / neutral(grey).
  Blue = open product question and must never ship.
- `components/ErrorScreen.tsx` — shared error layout (dot wave 0.75, one glass card, primary + stacked secondary)
- Dot wave is always the exported image asset, never rebuilt in code.
