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
 * The turf was #F6EADE — within a few percent of the page's own #FFF8F0, so
 * the pitch barely separated from the card behind it and the white line work
 * had almost nothing to sit against. It is now a warm clay, dark enough for
 * the lines to read and for the team dots to sit ON something, and it keeps
 * the cream family rather than jumping to a green that belongs to a different
 * app. Vertical gradient so it has depth instead of reading as a flat swatch.
 */
const LINE = "rgba(255,255,255,0.92)";
const TURF_TOP = "#C8A784";
const TURF_BOTTOM = "#AD8A66";
/** Open slots: light on the dark turf now, where they used to be dark on light. */
const EMPTY = "rgba(255,255,255,0.6)";
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

    // Open slot: a small plus mark, per the design (no dashed ring)
    return (
      <G key={`${team}-${slot}`} onPress={canClick ? () => onSlotClick(team, slot) : undefined}>
        <Circle cx={pos.x} cy={pos.y} r={11} fill="transparent" />
        <Rect x={pos.x - 3.5} y={pos.y - 0.75} width={7} height={1.5} rx={0.5} fill={EMPTY} />
        <Rect x={pos.x - 0.75} y={pos.y - 3.5} width={1.5} height={7} rx={0.5} fill={EMPTY} />
      </G>
    );
  }

  return (
    <Svg viewBox={`0 0 400 ${VB_H}`} width="100%" height="100%">
      <Defs>
        <LinearGradient id="turf" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={TURF_TOP} />
          <Stop offset="1" stopColor={TURF_BOTTOM} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={400} height={VB_H} rx={12} fill="url(#turf)" />

      {/* Line work — white on clay */}
      <Rect x={5} y={4} width={390} height={142} fill="none" stroke={LINE} strokeWidth={1.2} />
      <Line x1={200} y1={4} x2={200} y2={146} stroke={LINE} strokeWidth={1.2} />
      <Circle cx={200} cy={75} r={21} fill="none" stroke={LINE} strokeWidth={1.2} />
      <Circle cx={200} cy={75} r={2} fill={LINE} />

      <Rect x={5} y={31} width={52} height={88} fill="none" stroke={LINE} strokeWidth={1.2} />
      <Rect x={5} y={48} width={20} height={54} fill="none" stroke={LINE} strokeWidth={1.2} />
      <Rect x={343} y={31} width={52} height={88} fill="none" stroke={LINE} strokeWidth={1.2} />
      <Rect x={375} y={48} width={20} height={54} fill="none" stroke={LINE} strokeWidth={1.2} />

      {/* Corner arcs */}
      <Path d="M 5 16 A 12 12 0 0 0 17 4" fill="none" stroke={LINE} strokeWidth={1.2} />
      <Path d="M 383 4 A 12 12 0 0 0 395 16" fill="none" stroke={LINE} strokeWidth={1.2} />
      <Path d="M 395 134 A 12 12 0 0 0 383 146" fill="none" stroke={LINE} strokeWidth={1.2} />
      <Path d="M 17 146 A 12 12 0 0 0 5 134" fill="none" stroke={LINE} strokeWidth={1.2} />

      {positions.map((pos, i) => renderSlot(1, i, pos))}
      {positions.map((pos, i) => renderSlot(2, i, mirrorX(pos)))}

      {isPending && <Rect x={0} y={0} width={400} height={VB_H} rx={12} fill="rgba(255,248,240,0.45)" />}
    </Svg>
  );
}
