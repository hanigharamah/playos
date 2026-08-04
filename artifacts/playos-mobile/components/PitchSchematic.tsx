import { useMemo } from "react";
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";

/**
 * Line-art site plan for a venue thumbnail (Browse mock, venue card).
 *
 * The mock draws each venue as a hand-inked plan — pitch outlines, seating or
 * parking combs, a ring road, scattered trees and one orange dot — in a thin
 * warm tan on the cream card, no fill. That is ILLUSTRATION, not data: there
 * are no venue coordinates, no surface column and no entrance column in the
 * schema, so nothing here is claimed to be true of the real site. The orange
 * dot is decorative punctuation, NOT a mapped entrance.
 *
 * Four plans are hand-authored, one per real venue, plus a generic fallback
 * keyed by a hash of any other name so a new venue still gets a stable plan
 * rather than a blank box.
 *
 * Geometry is measured off the mock at 2x: the thumbnail box is 312x172 device
 * px = 156x86pt, strokes are 2 device px of #E5D3C1 (warm tan) for the site
 * work and #D5CDC5 (cool grey) for the ring road, and the dot is 13px across.
 * The viewBox is therefore 1 unit = 1 device px so the stroke widths below are
 * literal measurements.
 */

/** Warm tan — the ink everything on the plan is drawn in. */
const TAN = "#E5D3C1";
/** Cooler grey — the ring road / site boundary reads a shade colder. */
const ROAD = "#D5CDC5";
/** The one accent. Matches the mock's dot, sampled at (248,115,3). */
const DOT = "#FD6A03";

const VB_W = 320;
const VB_H = 176;

type Props = {
  name: string;
  width?: number;
  height?: number;
  /**
   * How the plan fits its box. "meet" letterboxes (the Browse card, whose box
   * already matches the mock's 156x86); "slice" fills and crops, which is what
   * a photo's resizeMode="cover" did on every screen VenueArt replaced.
   */
  fit?: "meet" | "slice";
};

/** Football pitch with the markings the mock actually draws. */
function Pitch({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  // Penalty and goal boxes run off the short ends (pitches are drawn portrait
  // in plans A/B, landscape in C/D — the caller picks w/h, this follows).
  const portrait = h >= w;
  const pen = portrait
    ? { w: w * 0.55, h: h * 0.16 }
    : { w: w * 0.16, h: h * 0.55 };
  const goal = portrait
    ? { w: w * 0.26, h: h * 0.06 }
    : { w: w * 0.06, h: h * 0.26 };
  return (
    <G stroke={TAN} strokeWidth={1.6} fill="none">
      <Rect x={x} y={y} width={w} height={h} />
      {portrait ? (
        <Line x1={x} y1={cy} x2={x + w} y2={cy} />
      ) : (
        <Line x1={cx} y1={y} x2={cx} y2={y + h} />
      )}
      <Circle cx={cx} cy={cy} r={Math.min(w, h) * 0.14} />
      <Circle cx={cx} cy={cy} r={1.2} />
      {portrait ? (
        <>
          <Rect x={cx - pen.w / 2} y={y} width={pen.w} height={pen.h} />
          <Rect x={cx - pen.w / 2} y={y + h - pen.h} width={pen.w} height={pen.h} />
          <Rect x={cx - goal.w / 2} y={y} width={goal.w} height={goal.h} />
          <Rect x={cx - goal.w / 2} y={y + h - goal.h} width={goal.w} height={goal.h} />
        </>
      ) : (
        <>
          <Rect x={x} y={cy - pen.h / 2} width={pen.w} height={pen.h} />
          <Rect x={x + w - pen.w} y={cy - pen.h / 2} width={pen.w} height={pen.h} />
          <Rect x={x} y={cy - goal.h / 2} width={goal.w} height={goal.h} />
          <Rect x={x + w - goal.w} y={cy - goal.h / 2} width={goal.w} height={goal.h} />
        </>
      )}
    </G>
  );
}

/** Seating / parking comb — a spine with evenly spaced teeth. */
function Comb({
  x,
  y,
  length,
  teeth,
  depth,
  vertical = false,
}: {
  x: number;
  y: number;
  length: number;
  teeth: number;
  depth: number;
  vertical?: boolean;
}) {
  const step = length / (teeth - 1);
  return (
    <G stroke={TAN} strokeWidth={1.2} fill="none">
      {vertical ? <Line x1={x} y1={y} x2={x} y2={y + length} /> : <Line x1={x} y1={y} x2={x + length} y2={y} />}
      {Array.from({ length: teeth }, (_, i) =>
        vertical ? (
          <Line key={i} x1={x - depth / 2} y1={y + i * step} x2={x + depth / 2} y2={y + i * step} />
        ) : (
          <Line key={i} x1={x + i * step} y1={y - depth / 2} x2={x + i * step} y2={y + depth / 2} />
        ),
      )}
    </G>
  );
}

/** Loose cluster of trees / planters along an edge. */
function Trees({ at }: { at: [number, number, number][] }) {
  return (
    <G stroke={TAN} strokeWidth={1.2} fill="none">
      {at.map(([cx, cy, r], i) => (
        <Ellipse key={i} cx={cx} cy={cy} rx={r} ry={r * 0.86} />
      ))}
    </G>
  );
}

function Ring({ x, y, w, h, r }: { x: number; y: number; w: number; h: number; r: number }) {
  return <Rect x={x} y={y} width={w} height={h} rx={r} stroke={ROAD} strokeWidth={1.8} fill="none" />;
}

function Dashed({ d }: { d: string }) {
  return <Path d={d} stroke={TAN} strokeWidth={1.1} strokeDasharray="4 5" fill="none" />;
}

/** Arena Riyadh — two pitches side by side, stand block to the east. */
function PlanArena() {
  return (
    <>
      <Ring x={16} y={12} w={288} h={152} r={30} />
      <Rect x={34} y={24} width={216} height={122} rx={22} stroke={TAN} strokeWidth={1.4} fill="none" />
      <Dashed d="M48 34 H236 M48 136 H236" />
      <Pitch x={58} y={44} w={78} h={84} />
      <Pitch x={152} y={44} w={78} h={84} />
      <Comb x={272} y={40} length={90} teeth={13} depth={22} vertical />
      <Rect x={256} y={28} width={38} height={116} rx={14} stroke={TAN} strokeWidth={1.2} fill="none" />
      <Trees
        at={[
          [26, 58, 6], [26, 78, 6], [26, 98, 6], [24, 118, 5],
          [300, 46, 6], [300, 66, 6], [300, 88, 6], [300, 110, 6], [300, 132, 6],
          [40, 156, 6], [64, 156, 6], [88, 155, 5],
        ]}
      />
      <Path d="M104 158 H196" stroke={TAN} strokeWidth={1.6} fill="none" />
      <Circle cx={150} cy={158} r={6.5} fill={DOT} />
    </>
  );
}

/** KAFD Pitch — one pitch north, two south, stand block to the east. */
function PlanKafd() {
  return (
    <>
      <Ring x={14} y={12} w={290} h={152} r={30} />
      <Rect x={32} y={22} width={218} height={126} rx={30} stroke={TAN} strokeWidth={1.4} fill="none" />
      <Dashed d="M46 28 H236 M46 146 H236" />
      <Pitch x={78} y={34} w={110} h={46} />
      <Pitch x={46} y={90} w={86} h={50} />
      <Pitch x={144} y={90} w={86} h={50} />
      <Comb x={268} y={34} length={86} teeth={12} depth={20} vertical />
      <Rect x={286} y={96} width={16} height={54} rx={8} stroke={TAN} strokeWidth={1.2} fill="none" />
      <Trees
        at={[
          [24, 30, 6], [24, 60, 6], [24, 92, 6], [24, 122, 6], [24, 152, 6],
          [222, 32, 6], [236, 44, 5], [232, 58, 5],
          [296, 30, 5], [298, 54, 5], [296, 76, 5],
          [98, 156, 6],
        ]}
      />
      <Path d="M112 160 H190" stroke={TAN} strokeWidth={1.6} fill="none" />
      <Circle cx={152} cy={158} r={6.5} fill={DOT} />
    </>
  );
}

/** Al Rowad — one full pitch under stands, a smaller indoor court east. */
function PlanRowad() {
  return (
    <>
      <Ring x={26} y={20} w={272} h={140} r={28} />
      <Rect x={38} y={28} width={132} height={124} rx={12} stroke={TAN} strokeWidth={1.3} fill="none" />
      <Comb x={44} y={38} length={118} teeth={13} depth={16} />
      <Comb x={44} y={142} length={118} teeth={13} depth={16} />
      <Pitch x={48} y={52} w={114} h={76} />
      <Dashed d="M178 44 H278 V138 H178 Z" />
      <Pitch x={190} y={60} w={64} h={48} />
      <Trees
        at={[
          [186, 20, 6], [200, 20, 6], [226, 18, 6], [254, 18, 6], [266, 26, 5],
          [284, 40, 5], [286, 62, 5], [288, 86, 5], [286, 110, 5], [284, 132, 5],
          [200, 150, 6], [224, 150, 6], [248, 148, 5],
        ]}
      />
      <Path d="M28 62 V118" stroke={TAN} strokeWidth={1.6} fill="none" />
      <Circle cx={28} cy={90} r={6.5} fill={DOT} />
    </>
  );
}

/** King Fahd Arena — two stacked pitches, car park east. */
function PlanKingFahd() {
  return (
    <>
      <Ring x={18} y={12} w={286} h={150} r={28} />
      <Rect x={34} y={20} width={148} height={132} rx={16} stroke={TAN} strokeWidth={1.4} fill="none" />
      <Dashed d="M42 26 H176 V148 H42" />
      <Pitch x={50} y={32} w={116} h={52} />
      <Pitch x={50} y={94} w={116} h={52} />
      <Rect x={194} y={20} width={98} height={132} rx={14} stroke={TAN} strokeWidth={1.3} fill="none" />
      <Comb x={204} y={44} length={76} teeth={11} depth={16} />
      <Comb x={204} y={72} length={76} teeth={11} depth={16} />
      <Comb x={204} y={100} length={76} teeth={11} depth={16} />
      <Comb x={204} y={128} length={76} teeth={11} depth={16} />
      <Trees
        at={[
          [26, 40, 6], [26, 62, 6], [26, 84, 6], [26, 108, 6], [26, 130, 6],
          [300, 40, 5], [300, 64, 5], [300, 88, 5], [300, 112, 5], [300, 136, 5],
          [206, 30, 5], [232, 30, 5],
        ]}
      />
      <Path d="M112 160 H196" stroke={TAN} strokeWidth={1.6} fill="none" />
      <Circle cx={148} cy={158} r={6.5} fill={DOT} />
    </>
  );
}

/** Anything not one of the four — a plain two-pitch yard, stable per name. */
function PlanGeneric({ seed }: { seed: number }) {
  // Two layout variants and a mirrored dot, picked deterministically so the
  // same venue always draws the same plan across renders and sessions.
  const stacked = seed % 2 === 0;
  return (
    <>
      <Ring x={18} y={14} w={284} h={148} r={28} />
      <Rect x={34} y={24} width={202} height={124} rx={20} stroke={TAN} strokeWidth={1.4} fill="none" />
      <Dashed d="M44 32 H226 M44 140 H226" />
      {stacked ? (
        <>
          <Pitch x={52} y={34} w={166} h={50} />
          <Pitch x={52} y={94} w={166} h={48} />
        </>
      ) : (
        <>
          <Pitch x={52} y={38} w={76} h={96} />
          <Pitch x={142} y={38} w={76} h={96} />
        </>
      )}
      <Comb x={262} y={40} length={88} teeth={12} depth={20} vertical />
      <Rect x={248} y={28} width={40} height={116} rx={14} stroke={TAN} strokeWidth={1.2} fill="none" />
      <Trees
        at={[
          [26, 46, 6], [26, 70, 6], [26, 94, 6], [26, 118, 6],
          [298, 44, 5], [298, 70, 5], [298, 96, 5], [298, 122, 5],
          [60, 156, 6], [84, 155, 5],
        ]}
      />
      <Path d="M104 158 H196" stroke={TAN} strokeWidth={1.6} fill="none" />
      <Circle cx={150} cy={158} r={6.5} fill={DOT} />
    </>
  );
}

/** Case- and spacing-insensitive so "kafd pitch" and "KAFD Pitch" agree. */
function key(name: string) {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

function hash(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

export function PitchSchematic({ name, width = 156, height = 86, fit = "meet" }: Props) {
  const plan = useMemo(() => {
    const k = key(name);
    if (k.includes("arenariyadh")) return <PlanArena />;
    if (k.includes("kafd")) return <PlanKafd />;
    if (k.includes("rowad")) return <PlanRowad />;
    if (k.includes("kingfahd")) return <PlanKingFahd />;
    return <PlanGeneric seed={hash(k)} />;
  }, [name]);

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio={`xMidYMid ${fit}`}
    >
      {plan}
    </Svg>
  );
}
