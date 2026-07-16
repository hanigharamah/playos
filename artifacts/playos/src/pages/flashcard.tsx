import { useEffect, useState } from "react";
import { LiquidCard } from "@/components/flashcard/LiquidCard";
import { Crown, Users, Check } from "lucide-react";

/* ── Sample data (prototype only) ───────────────────────────────── */
const OTHERS = ["Faisal", "Omar", "Ziad", "Nawaf", "Turki", "Khalid", "Sultan", "Yousef", "Bandar", "Rakan", "Majed"];

const TINT = {
  yellow: { color: "#F4B01E", ink: "#7A5200", soft: "rgba(244,176,30,0.18)", strong: "rgba(244,176,30,0.55)", glow: "rgba(244,176,30,0.5)", label: "Yellow" },
  purple: { color: "#7B4DFF", ink: "#3E2494", soft: "rgba(123,77,255,0.16)", strong: "rgba(123,77,255,0.5)", glow: "rgba(123,77,255,0.45)", label: "Purple" },
  green:  { color: "#34C759", ink: "#0E6B2E", soft: "rgba(52,199,89,0.18)", strong: "rgba(52,199,89,0.5)", glow: "rgba(52,199,89,0.45)", label: "Go" },
} as const;

type Team = "yellow" | "purple";
type Tint = keyof typeof TINT;
const tintVars = (t: Tint) =>
  ({ "--tint-ink": TINT[t].ink, "--tint-soft": TINT[t].soft, "--tint-strong": TINT[t].strong, "--tint-glow": TINT[t].glow } as React.CSSProperties);

function Avatar({ name, team }: { name: string; team?: Team }) {
  return (
    <span className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
      style={{ background: team ? TINT[team].color : "#0A84FF" }}>
      {name.charAt(0)}
    </span>
  );
}

type Phase = "arrival" | "pulse" | "choose" | "coinflip" | "reveal" | "tactical";
const EXIT_MS = 340;

export default function FlashcardPreview() {
  const [phase, setPhase] = useState<Phase>("arrival");   // target
  const [shown, setShown] = useState<Phase>("arrival");    // currently rendered
  const [exiting, setExiting] = useState(false);

  const [count, setCount] = useState(8);
  const [counts, setCounts] = useState({ y: 2, p: 3 });
  const [myTeam, setMyTeam] = useState<Team>("yellow");
  const [picked, setPicked] = useState(false);
  const [flipWinner, setFlipWinner] = useState<Team>("yellow");
  const [flipDone, setFlipDone] = useState(false);

  /* card-to-card flip transition */
  useEffect(() => {
    if (phase === shown) return undefined;
    setExiting(true);
    const t = setTimeout(() => { setShown(phase); setExiting(false); }, EXIT_MS);
    return () => clearTimeout(t);
  }, [phase, shown]);

  /* pulse: everyone checks in */
  useEffect(() => {
    if (shown !== "pulse") return undefined;
    setCount(8);
    const iv = setInterval(() => setCount((c) => Math.min(12, c + 1)), 500);
    return () => clearInterval(iv);
  }, [shown]);
  useEffect(() => {
    if (shown === "pulse" && count >= 12) {
      const t = setTimeout(() => setPhase("choose"), 700);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [shown, count]);

  /* choose: other players keep claiming sides live, leaving one spot */
  useEffect(() => {
    if (shown !== "choose" || picked) return undefined;
    const iv = setInterval(() => {
      setCounts((c) => {
        if (c.y + c.p >= 11) return c;
        const canY = c.y < 6, canP = c.p < 6;
        if (!canY && !canP) return c;
        const toY = canY && (!canP || Math.random() < 0.5);
        return toY ? { ...c, y: c.y + 1 } : { ...c, p: c.p + 1 };
      });
    }, 850);
    return () => clearInterval(iv);
  }, [shown, picked]);

  const pick = (t: Team) => {
    if (picked) return;
    setMyTeam(t);
    setPicked(true);
    setCounts((c) => (t === "yellow" ? { ...c, y: c.y + 1 } : { ...c, p: c.p + 1 }));
    setTimeout(() => setCounts({ y: 6, p: 6 }), 500);
    setTimeout(() => setPhase("coinflip"), 1300);
  };

  /* coin toss: decides who kicks off */
  useEffect(() => {
    if (shown !== "coinflip") return undefined;
    setFlipDone(false);
    setFlipWinner(Math.random() < 0.5 ? "yellow" : "purple");
    const land = setTimeout(() => setFlipDone(true), 2250);
    const next = setTimeout(() => setPhase("reveal"), 4200);
    return () => { clearTimeout(land); clearTimeout(next); };
  }, [shown]);

  const restart = () => {
    setPhase("arrival"); setCount(8); setCounts({ y: 2, p: 3 }); setPicked(false);
  };

  const other: Team = myTeam === "yellow" ? "purple" : "yellow";
  const roster = (t: Team) => (t === myTeam ? ["Hani", ...OTHERS.slice(0, 5)] : OTHERS.slice(5, 11));

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-3">
        <h1 className="text-2xl font-bold" style={{ color: "#1D3557" }}>Al Rowad 8PM</h1>
        <p className="text-sm text-[#6C6C70]">Tuesday, 30 June · 8:00 PM · Al Rowad pitch</p>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card-ios h-16" />)}
        </div>
        <button className="glass glass-btn px-4 py-2 text-sm" onClick={restart}>Replay flow</button>
      </div>

      {/* ── ARRIVAL ── */}
      {shown === "arrival" && (
        <LiquidCard exiting={exiting}>
          <p className="text-[11px] uppercase tracking-widest text-[#AEAEB2] font-semibold">Check-in · opens now</p>
          <h2 className="text-2xl font-extrabold mt-1" style={{ color: "#1D3557" }}>Al Rowad 8PM</h2>
          <p className="text-sm text-[#6C6C70]">Al Rowad pitch · kickoff 8:00 PM</p>
          <p className="font-hand text-xl mt-5" style={{ color: "#FF9F0A" }}>you made it 👋</p>
          <button className="lg-tint-btn w-full py-3.5 mt-2 text-base flex items-center justify-center gap-2"
            style={tintVars("green")} onClick={() => setPhase("pulse")}>
            <Check className="h-5 w-5" /> I'm Here
          </button>
        </LiquidCard>
      )}

      {/* ── PITCH PULSE ── */}
      {shown === "pulse" && (
        <LiquidCard exiting={exiting}>
          <div className="text-center">
            <div className="relative mx-auto h-20 w-20 mb-2">
              <span className="absolute inset-0 rounded-full animate-ping" style={{ background: "rgba(10,132,255,0.18)" }} />
              <span className="absolute inset-3 rounded-full animate-ping" style={{ background: "rgba(10,132,255,0.22)", animationDelay: "0.4s" }} />
              <span className="absolute inset-6 rounded-full" style={{ background: "#0A84FF" }} />
            </div>
            <p className="text-4xl font-extrabold tabular-nums" style={{ color: "#1D3557" }}>
              {count} <span className="text-xl text-[#AEAEB2]">/ 12</span>
            </p>
            <p className="text-sm text-[#6C6C70]">checked in</p>
            <p className="font-hand text-lg mt-1" style={{ color: "#FF9F0A" }}>warming up…</p>
            <div className="flex flex-wrap justify-center gap-1.5 mt-4">
              {["Hani", ...OTHERS].slice(0, count).map((n) => <Avatar key={n} name={n} />)}
            </div>
          </div>
        </LiquidCard>
      )}

      {/* ── CHOOSE YOUR SIDE (live) ── */}
      {shown === "choose" && (
        <LiquidCard exiting={exiting}>
          <p className="font-hand text-2xl text-center leading-none" style={{ color: "#FF9F0A" }}>pick your side</p>
          <p className="text-xs text-center text-[#AEAEB2] mt-1 mb-4">
            {picked ? "Locked in — waiting for the rest…" : "First come, first served"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(["yellow", "purple"] as const).map((t) => {
              const n = t === "yellow" ? counts.y : counts.p;
              const full = n >= 6;
              const mine = picked && myTeam === t;
              return (
                <button key={t} disabled={full || picked} onClick={() => pick(t)}
                  className="lg-tint-btn py-4 px-3 flex flex-col items-center gap-1.5 disabled:cursor-not-allowed"
                  style={{ ...tintVars(t), outline: mine ? `2px solid ${TINT[t].color}` : undefined }}>
                  <span className="h-9 w-9 rounded-full" style={{ background: TINT[t].color }} />
                  <span className="text-sm font-bold">{TINT[t].label}</span>
                  <span className="text-lg font-extrabold tabular-nums">{n}/6</span>
                  <span className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.5)" }}>
                    <span className="block h-full rounded-full transition-all duration-500"
                      style={{ width: `${(n / 6) * 100}%`, background: TINT[t].color }} />
                  </span>
                  <span className="text-[10px] font-semibold">{mine ? "You're in" : full ? "Full" : `${6 - n} left`}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap justify-center gap-1 mt-4">
            {Array.from({ length: counts.y }).map((_, i) => (
              <span key={`y${i}`} className="h-2 w-2 rounded-full" style={{ background: TINT.yellow.color }} />
            ))}
            {Array.from({ length: counts.p }).map((_, i) => (
              <span key={`p${i}`} className="h-2 w-2 rounded-full" style={{ background: TINT.purple.color }} />
            ))}
          </div>
        </LiquidCard>
      )}

      {/* ── COIN TOSS (kick-off) ── */}
      {shown === "coinflip" && (
        <LiquidCard exiting={exiting}>
          <p className="font-hand text-2xl text-center leading-none mb-1" style={{ color: "#FF9F0A" }}>coin toss</p>
          <p className="text-xs text-center text-[#AEAEB2] mb-5">Deciding who kicks off</p>
          <div className="coin-scene">
            <div className={`coin ${flipWinner === "purple" ? "coin--purple" : ""}`}>
              <div className="coin__face text-2xl" style={{ background: `radial-gradient(circle at 35% 30%, #FFDD7A, ${TINT.yellow.color})` }}>Y</div>
              <div className="coin__face coin__face--back text-2xl" style={{ background: `radial-gradient(circle at 35% 30%, #A98BFF, ${TINT.purple.color})` }}>P</div>
            </div>
          </div>
          <p className="text-center text-sm font-bold mt-5 transition-opacity duration-300"
            style={{ color: flipDone ? TINT[flipWinner].ink : "#AEAEB2", opacity: flipDone ? 1 : 0.7 }}>
            {flipDone ? `${TINT[flipWinner].label} kicks off` : "flipping…"}
          </p>
        </LiquidCard>
      )}

      {/* ── REVEAL ── */}
      {shown === "reveal" && (
        <LiquidCard exiting={exiting} onBackdrop={() => setPhase("tactical")}>
          <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ background: TINT[myTeam].soft, color: TINT[myTeam].ink }}>
            <span className="h-2 w-2 rounded-full" style={{ background: TINT[myTeam].color }} /> Team {TINT[myTeam].label}
          </div>
          <p className="font-hand text-2xl mt-3 leading-none" style={{ color: "#FF9F0A" }}>you're in</p>
          <div className="flex items-center gap-2 mt-1">
            <h2 className="text-4xl font-extrabold tracking-tight" style={{ color: "#1D3557" }}>Hani</h2>
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
              style={{ background: "linear-gradient(120deg,#FFD75E,#F5A623)", color: "#5A3B00" }}>
              <Crown className="h-3 w-3" /> Captain
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "#6C6C70" }}>Midfield</p>
          <div className="lg-tint-btn mt-5 flex items-center gap-2 px-4 py-3" style={tintVars(myTeam)}>
            <Users className="h-4 w-4 shrink-0" style={{ color: TINT[myTeam].color }} />
            <span className="text-sm font-semibold">Find your team</span>
          </div>
          <button className="lg-tint-btn w-full py-3 mt-3 text-sm" style={tintVars(myTeam)} onClick={() => setPhase("tactical")}>
            View both teams
          </button>
        </LiquidCard>
      )}

      {/* ── TACTICAL ── */}
      {shown === "tactical" && (
        <LiquidCard exiting={exiting} maxWidth={460} onBackdrop={restart}>
          <p className="text-center font-hand text-2xl -mt-1 mb-3" style={{ color: "#1D3557" }}>teams are set</p>
          <div className="grid grid-cols-2 gap-3">
            {([myTeam, other] as const).map((tm) => (
              <div key={tm} className="rounded-2xl p-3" style={{ background: TINT[tm].soft }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: TINT[tm].color }} />
                  <span className="text-sm font-bold" style={{ color: TINT[tm].ink }}>{TINT[tm].label}</span>
                  {tm === flipWinner && (
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                      style={{ background: TINT[tm].color, color: "#fff" }}>Kicks off</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {roster(tm).map((n, i) => (
                    <div key={n} className="flex items-center gap-2">
                      <Avatar name={n} team={tm} />
                      <span className="text-sm font-medium truncate" style={{ color: "#1D3557" }}>{n}</span>
                      {i === 0 && <Crown className="h-3.5 w-3.5 ml-auto shrink-0" style={{ color: "#F5A623" }} />}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button className="lg-tint-btn w-full py-3 mt-4 text-sm" style={tintVars("green")} onClick={restart}>
            Done · replay
          </button>
        </LiquidCard>
      )}
    </div>
  );
}
