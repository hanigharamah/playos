import Svg, { Rect, Line, Circle, Path, Text as SvgText, G, Defs, LinearGradient, Stop } from "react-native-svg";
import { colors } from "@/lib/theme";

/**
 * Interactive pitch spot-picker, restyled to the Figma glass booking page
 * (node 1:4): warm clay turf, white line work, one colour for every taken
 * spot, dashed open slots. Slot POSITIONS are the tuned geometry ported from
 * the web — do not "improve" them.
 */
type Pos = { x: number; y: number };

const POSITIONS: Record<number, Pos[]> = {
  3: [{ x: 32, y: 130 }, { x: 95, y: 88 }, { x: 155, y: 130 }],
  4: [{ x: 30, y: 130 }, { x: 85, y: 78 }, { x: 85, y: 182 }, { x: 155, y: 130 }],
  5: [
    { x: 30, y: 130 }, { x: 80, y: 72 }, { x: 80, y: 188 },
    { x: 132, y: 102 }, { x: 155, y: 162 },
  ],
  6: [
    { x: 28, y: 130 }, { x: 75, y: 62 }, { x: 75, y: 130 }, { x: 75, y: 198 },
    { x: 135, y: 92 }, { x: 155, y: 168 },
  ],
  7: [
    { x: 28, y: 130 }, { x: 70, y: 58 }, { x: 70, y: 104 }, { x: 70, y: 156 },
    { x: 70, y: 202 }, { x: 132, y: 90 }, { x: 155, y: 170 },
  ],
  8: [
    { x: 28, y: 130 }, { x: 68, y: 55 }, { x: 68, y: 98 }, { x: 68, y: 162 },
    { x: 68, y: 205 }, { x: 125, y: 80 }, { x: 125, y: 130 }, { x: 155, y: 180 },
  ],
  9: [
    { x: 28, y: 130 }, { x: 65, y: 52 }, { x: 65, y: 92 }, { x: 65, y: 168 },
    { x: 65, y: 208 }, { x: 118, y: 72 }, { x: 118, y: 120 }, { x: 118, y: 168 },
    { x: 155, y: 130 },
  ],
  10: [
    { x: 28, y: 130 }, { x: 63, y: 50 }, { x: 63, y: 90 }, { x: 63, y: 170 },
    { x: 63, y: 210 }, { x: 110, y: 68 }, { x: 110, y: 108 }, { x: 110, y: 152 },
    { x: 110, y: 192 }, { x: 155, y: 130 },
  ],
  11: [
    { x: 28, y: 130 }, { x: 60, y: 50 }, { x: 60, y: 88 }, { x: 60, y: 128 },
    { x: 60, y: 168 }, { x: 60, y: 208 }, { x: 106, y: 65 }, { x: 106, y: 100 },
    { x: 106, y: 140 }, { x: 106, y: 180 }, { x: 155, y: 130 },
  ],
};

/**
 * Smoky green — muted and desaturated so it sits beside the cream rather than
 * shouting over it, and dark enough that WHITE markings finally work, which is
 * the convention every real pitch uses. Earlier passes tried cream, clay,
 * sand, a darker cream, glass and peach; the light ones all failed for the
 * same reason, that white lines need a dark ground and anything light forced
 * the markings warm and muddy.
 *
 * Open slots are a ringed plus. The ring is NEUTRAL white until the player
 * taps one — orange is reserved for the slot actually chosen, so the pitch
 * has exactly one orange thing on it at a time and it means "this is yours".
 */
const LINE = "rgba(255,255,255,0.85)";
/** Smoky green — muted and desaturated, so it sits with the cream. */
const TURF_TOP = "#C6D2C0";
const TURF_BOTTOM = "#A9B9A3";
/** Open slots: light on the dark turf now, where they used to be dark on light. */
const EMPTY = "rgba(255,255,255,0.9)";
/** Open-slot ring — the "tap me" affordance the bare plus never had. */
const SLOT_FILL = "rgba(255,255,255,0.22)";
/** Neutral until chosen. Orange is reserved for the slot you picked. */
const SLOT_RING = "rgba(255,255,255,0.75)";
const SLOT_RING_OFF = "rgba(255,255,255,0.35)";
/** Design pitch is 326×122 (wide + short); slot POSITIONS were tuned on a
 *  400×260 board, so squash Y to fit without distorting the dots. */
const VB_H = 150;
const Y_SCALE = VB_H / 260;

function getPositions(teamSize: number): Pos[] {
  return POSITIONS[Math.min(11, Math.max(3, teamSize))] ?? POSITIONS[5];
}

function mirrorX(p: Pos): Pos {
  return { x: 400 - p.x, y: p.y };
}

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
}

interface Booking {
  team: number;
  slotIndex: number;
  userId: string | null;
  playerName: string;
  paymentStatus: string;
}

interface Props {
  teamSize: number;
  bookings: Booking[];
  selectedSlot: { team: number; slot: number } | null;
  onSlotClick: (team: number, slot: number) => void;
  currentUserId?: string;
  isPending: boolean;
  gameOpen: boolean;
}

export function PitchSVG({ teamSize, bookings, selectedSlot, onSlotClick, currentUserId, isPending, gameOpen }: Props) {
  const positions = getPositions(teamSize);
  const paidBookings = bookings.filter(
    (b) => b.paymentStatus !== "refunded" && b.paymentStatus !== "forfeited",
  );

  function getBooking(team: number, slot: number) {
    return paidBookings.find((b) => b.team === team && b.slotIndex === slot);
  }

  function renderSlot(team: number, slot: number, rawPos: Pos) {
    const pos = { x: rawPos.x, y: rawPos.y * Y_SCALE };
    const booking = getBooking(team, slot);
    const isSelected = selectedSlot?.team === team && selectedSlot?.slot === slot;
    const isCurrentUser = !!booking && booking.userId === currentUserId;
    // One colour for every spot. Booking is not picking a side — sides are
    // claimed in the match-day room at T-20 — so colouring the two halves
    // orange and purple here implied a commitment the player has not made.
    // The DB still stores team 1/2 by which half the spot is on; that is a
    // seat number, not a shirt.
    const teamColor = colors.teamOrange;
    const canClick = gameOpen && !booking && !isPending;

    // react-native-svg shapes take onPress directly — they can't be wrapped
    // in a React Native <Pressable> since Svg only accepts SVG-node children.
    if (booking) {
      return (
        <G key={`${team}-${slot}`}>
          <Circle cx={pos.x} cy={pos.y} r={13} fill={teamColor} opacity={0.2} />
          <Circle cx={pos.x} cy={pos.y} r={9.5} fill={teamColor} stroke="#FFFFFF" strokeWidth={1.6} />
          <SvgText x={pos.x} y={pos.y} textAnchor="middle" fontSize={7} fontWeight="bold" fill="#FFFFFF" dy={2.6}>
            {isCurrentUser ? "YOU" : initials(booking.playerName)}
          </SvgText>
        </G>
      );
    }

    if (isSelected) {
      return (
        <G key={`${team}-${slot}`} onPress={canClick ? () => onSlotClick(team, slot) : undefined}>
          <Circle cx={pos.x} cy={pos.y} r={13} fill={teamColor} opacity={0.18} />
          <Circle cx={pos.x} cy={pos.y} r={9.5} fill={teamColor} fillOpacity={0.3} stroke={teamColor} strokeWidth={1.8} />
          <SvgText x={pos.x} y={pos.y} textAnchor="middle" fontSize={11} fontWeight="bold" fill={teamColor} dy={3.6}>
            +
          </SvgText>
        </G>
      );
    }

    // Open slot: a ringed plus. The design had a bare plus with an invisible
    // hit circle, which gave no signal that the marks were tappable at all —
    // they read as pitch decoration. The ring is the affordance.
    return (
      <G key={`${team}-${slot}`} onPress={canClick ? () => onSlotClick(team, slot) : undefined}>
        <Circle
          cx={pos.x} cy={pos.y} r={11}
          fill={isSelected ? "rgba(255,159,10,0.28)" : SLOT_FILL}
          stroke={isSelected ? colors.teamOrange : canClick ? SLOT_RING : SLOT_RING_OFF}
          strokeWidth={isSelected ? 2.2 : 1.4}
        />
        <Rect x={pos.x - 4} y={pos.y - 0.85} width={8} height={1.7} rx={0.85} fill={EMPTY} />
        <Rect x={pos.x - 0.85} y={pos.y - 4} width={1.7} height={8} rx={0.85} fill={EMPTY} />
      </G>
    );
  }

  return (
    // preserveAspectRatio="none" plus a wrap whose aspectRatio is exactly
    // 400/VB_H: with the two ratios identical this cannot distort, and it
    // guarantees the pitch fills its card edge to edge. With "meet" the
    // SVG was scaling to fit and leaving the leftover width entirely on
    // the right, so the pitch sat visibly off-centre in its card.
    <Svg viewBox={`0 0 400 ${VB_H}`} width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="turf" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={TURF_TOP} />
          <Stop offset="1" stopColor={TURF_BOTTOM} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={400} height={VB_H} rx={12} fill="url(#turf)" />
      {/* Specular rim — the same top-edge highlight the glass cards carry. */}
      <Rect
        x={0.75} y={0.75} width={398.5} height={VB_H - 1.5} rx={11.5}
        fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5}
      />

      {/* Line work — white on clay */}
      <Rect x={5} y={4} width={390} height={142} fill="none" stroke={LINE} strokeWidth={1.5} />
      <Line x1={200} y1={4} x2={200} y2={146} stroke={LINE} strokeWidth={1.5} />
      <Circle cx={200} cy={75} r={21} fill="none" stroke={LINE} strokeWidth={1.5} />
      <Circle cx={200} cy={75} r={2} fill={LINE} />

      <Rect x={5} y={31} width={52} height={88} fill="none" stroke={LINE} strokeWidth={1.5} />
      <Rect x={5} y={48} width={20} height={54} fill="none" stroke={LINE} strokeWidth={1.5} />
      <Rect x={343} y={31} width={52} height={88} fill="none" stroke={LINE} strokeWidth={1.5} />
      <Rect x={375} y={48} width={20} height={54} fill="none" stroke={LINE} strokeWidth={1.5} />

      {/* Corner arcs */}
      <Path d="M 5 16 A 12 12 0 0 0 17 4" fill="none" stroke={LINE} strokeWidth={1.5} />
      <Path d="M 383 4 A 12 12 0 0 0 395 16" fill="none" stroke={LINE} strokeWidth={1.5} />
      <Path d="M 395 134 A 12 12 0 0 0 383 146" fill="none" stroke={LINE} strokeWidth={1.5} />
      <Path d="M 17 146 A 12 12 0 0 0 5 134" fill="none" stroke={LINE} strokeWidth={1.5} />

      {positions.map((pos, i) => renderSlot(1, i, pos))}
      {positions.map((pos, i) => renderSlot(2, i, mirrorX(pos)))}

      {isPending && <Rect x={0} y={0} width={400} height={VB_H} rx={12} fill="rgba(255,248,240,0.5)" />}
    </Svg>
  );
}
