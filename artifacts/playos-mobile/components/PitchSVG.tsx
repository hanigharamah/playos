import Svg, { Rect, Line, Circle, Text as SvgText, G } from "react-native-svg";

/**
 * Direct port of ../playos/src/pages/game/[id].tsx PitchSVG. Positions,
 * viewBox, and colors are copied verbatim — do not "improve" the geometry,
 * it was tuned by eye on the web and must look identical here.
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

    let fillColor = "rgba(255,255,255,0.12)";
    let strokeColor = "rgba(255,255,255,0.5)";
    let strokeDash = "4,3";
    let strokeWidth = 1.5;
    let textColor = "rgba(255,255,255,0.6)";
    let label = "+";

    if (booking) {
      if (isCurrentUser) {
        fillColor = "#FFD60A";
        textColor = "#1C1C1E";
      } else if (team === 1) {
        fillColor = "#0A84FF";
        textColor = "#FFFFFF";
      } else {
        fillColor = "#FF3B30";
        textColor = "#FFFFFF";
      }
      strokeColor = "rgba(255,255,255,0.9)";
      strokeDash = "";
      strokeWidth = 2;
      label = initials(booking.playerName);
    } else if (isSelected) {
      fillColor = "rgba(255,214,10,0.35)";
      strokeColor = "#FFD60A";
      strokeDash = "";
      strokeWidth = 2;
      label = "+";
      textColor = "#FFD60A";
    }

    const canClick = gameOpen && !booking && !isPending;

    // react-native-svg shapes take onPress directly — they can't be wrapped
    // in a React Native <Pressable> since Svg only accepts SVG-node children.
    return (
      <G key={`${team}-${slot}`} onPress={canClick ? () => onSlotClick(team, slot) : undefined}>
        <Circle cx={pos.x} cy={pos.y} r={14} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray={strokeDash} />
        <SvgText x={pos.x} y={pos.y} textAnchor="middle" fontSize={booking ? 7.5 : 11} fontWeight="bold" fill={textColor} dy={4}>
          {label}
        </SvgText>
      </G>
    );
  }

  return (
    <Svg viewBox="0 0 400 260" width="100%" height="100%">
      <Rect x={0} y={0} width={400} height={260} rx={10} fill="#276B39" />

      {Array.from({ length: 8 }).map((_, i) => (
        <Rect key={i} x={12 + i * 47} y={12} width={47} height={236} fill={i % 2 === 0 ? "rgba(0,0,0,0.04)" : "transparent"} />
      ))}

      <Rect x={12} y={12} width={376} height={236} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5} />
      <Line x1={200} y1={12} x2={200} y2={248} stroke="rgba(255,255,255,0.7)" strokeWidth={1.5} />
      <Circle cx={200} cy={130} r={28} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5} />
      <Circle cx={200} cy={130} r={2.5} fill="rgba(255,255,255,0.8)" />

      <Rect x={12} y={78} width={52} height={104} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={1.2} />
      <Rect x={12} y={100} width={24} height={60} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={1.2} />
      <Rect x={336} y={78} width={52} height={104} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={1.2} />
      <Rect x={364} y={100} width={24} height={60} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={1.2} />

      <SvgText x={100} y={26} textAnchor="middle" fontSize={9} fontWeight="700" fill="rgba(255,255,255,0.25)" letterSpacing={2}>TEAM 1</SvgText>
      <SvgText x={300} y={26} textAnchor="middle" fontSize={9} fontWeight="700" fill="rgba(255,255,255,0.25)" letterSpacing={2}>TEAM 2</SvgText>

      {positions.map((pos, i) => renderSlot(1, i, pos))}
      {positions.map((pos, i) => renderSlot(2, i, mirrorX(pos)))}

      {isPending && <Rect x={0} y={0} width={400} height={260} rx={10} fill="rgba(0,0,0,0.4)" />}
    </Svg>
  );
}
