import Svg, { Rect, Line, Circle, Path, Text as SvgText, G } from "react-native-svg";
import { colors } from "@/lib/theme";

/**
 * Interactive pitch spot-picker, restyled to the Figma glass booking page
 * (node 1:4): cream turf #F6EADE, tan line work, Team A orange / Team B
 * purple dots with soft glows, dashed open slots. Slot POSITIONS are the
 * tuned geometry ported from the web — do not "improve" them.
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

const LINE = "rgba(184,168,148,0.5)";
const TURF = "#F6EADE";

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
  const paidBookings = bookings.filter((b) => b.paymentStatus !== "refunded");

  function getBooking(team: number, slot: number) {
    return paidBookings.find((b) => b.team === team && b.slotIndex === slot);
  }

  function renderSlot(team: number, slot: number, pos: Pos) {
    const booking = getBooking(team, slot);
    const isSelected = selectedSlot?.team === team && selectedSlot?.slot === slot;
    const isCurrentUser = !!booking && booking.userId === currentUserId;
    const teamColor = team === 1 ? colors.teamOrange : colors.teamPurple;
    const canClick = gameOpen && !booking && !isPending;

    // react-native-svg shapes take onPress directly — they can't be wrapped
    // in a React Native <Pressable> since Svg only accepts SVG-node children.
    if (booking) {
      return (
        <G key={`${team}-${slot}`}>
          <Circle cx={pos.x} cy={pos.y} r={16} fill={teamColor} opacity={0.22} />
          <Circle cx={pos.x} cy={pos.y} r={11.5} fill={teamColor} stroke="#FFFFFF" strokeWidth={2} />
          <SvgText x={pos.x} y={pos.y} textAnchor="middle" fontSize={7.5} fontWeight="bold" fill="#FFFFFF" dy={3}>
            {isCurrentUser ? "YOU" : initials(booking.playerName)}
          </SvgText>
        </G>
      );
    }

    if (isSelected) {
      return (
        <G key={`${team}-${slot}`} onPress={canClick ? () => onSlotClick(team, slot) : undefined}>
          <Circle cx={pos.x} cy={pos.y} r={16} fill={teamColor} opacity={0.18} />
          <Circle cx={pos.x} cy={pos.y} r={11.5} fill={teamColor} fillOpacity={0.3} stroke={teamColor} strokeWidth={2} />
          <SvgText x={pos.x} y={pos.y} textAnchor="middle" fontSize={12} fontWeight="bold" fill={teamColor} dy={4}>
            +
          </SvgText>
        </G>
      );
    }

    return (
      <G key={`${team}-${slot}`} onPress={canClick ? () => onSlotClick(team, slot) : undefined}>
        <Circle
          cx={pos.x} cy={pos.y} r={10}
          fill="transparent"
          stroke="rgba(184,168,148,0.9)"
          strokeWidth={1.5}
          strokeDasharray="3,3"
        />
        <SvgText x={pos.x} y={pos.y} textAnchor="middle" fontSize={11} fontWeight="600" fill="rgba(184,168,148,0.9)" dy={4}>
          +
        </SvgText>
      </G>
    );
  }

  return (
    <Svg viewBox="0 0 400 260" width="100%" height="100%">
      <Rect x={0} y={0} width={400} height={260} rx={14} fill={TURF} />

      {/* Line work — tan on cream, per the Figma pitch */}
      <Rect x={6} y={6} width={388} height={248} fill="none" stroke={LINE} strokeWidth={1.5} />
      <Line x1={200} y1={6} x2={200} y2={254} stroke={LINE} strokeWidth={1.5} />
      <Circle cx={200} cy={130} r={27} fill="none" stroke={LINE} strokeWidth={1.5} />
      <Circle cx={200} cy={130} r={2.5} fill={LINE} />

      <Rect x={6} y={78} width={52} height={104} fill="none" stroke={LINE} strokeWidth={1.2} />
      <Rect x={6} y={100} width={22} height={60} fill="none" stroke={LINE} strokeWidth={1.2} />
      <Rect x={342} y={78} width={52} height={104} fill="none" stroke={LINE} strokeWidth={1.2} />
      <Rect x={372} y={100} width={22} height={60} fill="none" stroke={LINE} strokeWidth={1.2} />

      {/* Corner arcs */}
      <Path d="M 6 20 A 14 14 0 0 0 20 6" fill="none" stroke={LINE} strokeWidth={1.2} />
      <Path d="M 380 6 A 14 14 0 0 0 394 20" fill="none" stroke={LINE} strokeWidth={1.2} />
      <Path d="M 394 240 A 14 14 0 0 0 380 254" fill="none" stroke={LINE} strokeWidth={1.2} />
      <Path d="M 20 254 A 14 14 0 0 0 6 240" fill="none" stroke={LINE} strokeWidth={1.2} />

      {positions.map((pos, i) => renderSlot(1, i, pos))}
      {positions.map((pos, i) => renderSlot(2, i, mirrorX(pos)))}

      {isPending && <Rect x={0} y={0} width={400} height={260} rx={14} fill="rgba(246,234,222,0.55)" />}
    </Svg>
  );
}
