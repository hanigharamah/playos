import { useEffect, useState } from "react";
import { LiquidCard } from "@/components/flashcard/LiquidCard";
import { Crown, MapPin, Check } from "lucide-react";

/* ── Sample data (prototype only) ───────────────────────────────── */
const YELLOW = ["Hani", "Faisal", "Omar", "Ziad", "Nawaf", "Turki"];
const PURPLE = ["Khalid", "Sultan", "Yousef", "Bandar", "Rakan", "Majed"];

const TINT = {
  yellow: { color: "#F4B01E", ink: "#7A5200", soft: "rgba(244,176,30,0.18)", strong: "rgba(244,176,30,0.55)", glow: "rgba(244,176,30,0.5)" },
  purple: { color: "#7B4DFF", ink: "#3E2494", soft: "rgba(123,77,255,0.16)", strong: "rgba(123,77,255,0.5)", glow: "rgba(123,77,255,0.45)" },
  green:  { color: "#34C759", ink: "#0E6B2E", soft: "rgba(52,199,89,0.18)", strong: "rgba(52,199,89,0.5)", glow: "rgba(52,199,89,0.45)" },
} as const;

type Tint = keyof typeof TINT;
const tintVars = (t: Tint) =>
  ({ "--tint-ink": TINT[t].ink, "--tint-soft": TINT[t].soft, "--tint-strong": TINT[t].strong, "--tint-glow": TINT[t].glow } as React.CSSProperties);

function Avatar({ name, tint }: { name: string; tint?: Tint }) {
  const c = tint ? TINT[tint].color : "#0A84FF";
  return (
    <span className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
      style={{ background: c }}>
      {name.charAt(0)}
    </span>
  );
}

type Phase = "arrival" | "pulse" | "forming" | "reveal" | "tactical";

export default function FlashcardPreview() {
  const [phase, setPhase] = useState<Phase>("arrival");
  const [count, setCount] = useState(8);

  // pulse: count up to 12, then auto-form
  useEffect(() => {
    if (phase !== "pulse") return;
    setCount(8);
    const iv = setInterval(() => setCount((c) => Math.min(12, c + 1)), 550);
    return () => clearInterval(iv);
  }, [phase]);
  useEffect(() => {
    if (phase === "pulse" && count >= 12) {
      const t = setTimeout(() => setPhase("forming"), 700);
      return () => clearTimeout(t);
    }
  }, [phase, count]);
  useEffect(() => {
    if (phase !== "forming") return;
    const t = setTimeout(() => setPhase("reveal"), 2400);
    return () => clearTimeout(t);
  }, [phase]);

  const restart = () => { setPhase("arrival"); setCount(8); };

  return (
    <div className="min-h-screen">
      {/* faint page behind the popup */}
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-3 opacity-90">
        <h1 className="text-2xl font-bold" style={{ color: "#1D3557" }}>Al Rowad 8PM</h1>
        <p className="text-sm text-[#6C6C70]">Tuesday, 30 June · 8:00 PM · Al Rowad pitch</p>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card-ios h-16" />)}
        </div>
        <button className="glass glass-btn px-4 py-2 text-sm" onClick={restart}>Replay flow</button>
      </div>

      {/* ── ARRIVAL ── */}
      {phase === "arrival" && (
        <LiquidCard>
          <p className="text-[11px] uppercase tracking-widest text-[#AEAEB2] font-semibold">Check-in · opens now</p>
          <h2 className="text-2xl font-extrabold mt-1" style={{ color: "#1D3557" }}>Al Rowad 8PM</h2>
          <p className="text-sm text-[#6C6C70]">Al Rowad pitch · kickoff 8:00 PM</p>
          <p className="font-hand text-xl mt-5" style={{ color: "#FF9F0A" }}>you made it 👋</p>
          <button
            className="lg-tint-btn w-full py-3.5 mt-2 text-base flex items-center justify-center gap-2"
            style={tintVars("green")}
            onClick={() => setPhase("pulse")}
          >
            <Check className="h-5 w-5" /> I'm Here
          </button>
        </LiquidCard>
      )}

      {/* ── PITCH PULSE ── */}
      {phase === "pulse" && (
        <LiquidCard>
          <div className="text-center">
            {/* radar */}
            <div className="relative mx-auto h-20 w-20 mb-2">
              <span className="absolute inset-0 rounded-full animate-ping" style={{ background: "rgba(10,132,255,0.18)" }} />
              <span className="absolute inset-3 rounded-full animate-ping" style={{ background: "rgba(10,132,255,0.22)", animationDelay: "0.4s" }} />
              <span className="absolute inset-6 rounded-full" style={{ background: "#0A84FF" }} />
            </div>
            <p className="text-4xl font-extrabold tabular-nums" style={{ color: "#1D3557" }}>{count} <span className="text-xl text-[#AEAEB2]">/ 12</span></p>
            <p className="text-sm text-[#6C6C70]">checked in</p>
            <p className="font-hand text-lg mt-1" style={{ color: "#FF9F0A" }}>warming up…</p>
            <div className="flex flex-wrap justify-center gap-1.5 mt-4">
              {[...YELLOW, ...PURPLE].slice(0, count).map((n) => <Avatar key={n} name={n} />)}
            </div>
            <p className="text-xs text-[#AEAEB2] mt-4">Teams form automatically when everyone's in</p>
          </div>
        </LiquidCard>
      )}

      {/* ── FORMING ── */}
      {phase === "forming" && (
        <LiquidCard>
          <div className="text-center py-6">
            <div className="flex justify-center gap-2 mb-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 w-10 rounded-lg animate-bounce"
                  style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.8)", animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <p className="font-hand text-3xl" style={{ color: "#1D3557" }}>forming teams…</p>
            <p className="text-xs text-[#AEAEB2] mt-2">Splitting 12 players into two balanced sides</p>
          </div>
        </LiquidCard>
      )}

      {/* ── REVEAL ── */}
      {phase === "reveal" && (
        <LiquidCard onBackdrop={() => setPhase("tactical")}>
          <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ background: TINT.yellow.soft, color: TINT.yellow.ink }}>
            <span className="h-2 w-2 rounded-full" style={{ background: TINT.yellow.color }} /> Team Yellow
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
          <div className="lg-tint-btn mt-5 flex items-center gap-2 px-4 py-3" style={tintVars("yellow")}>
            <MapPin className="h-4 w-4 flex-shrink-0" style={{ color: TINT.yellow.color }} />
            <span className="text-sm font-semibold">Head to the North end</span>
          </div>
          <button className="lg-tint-btn w-full py-3 mt-3 text-sm" style={tintVars("yellow")} onClick={() => setPhase("tactical")}>
            View both teams
          </button>
        </LiquidCard>
      )}

      {/* ── TACTICAL ── */}
      {phase === "tactical" && (
        <LiquidCard maxWidth={460} onBackdrop={restart}>
          <p className="text-center font-hand text-2xl -mt-1 mb-3" style={{ color: "#1D3557" }}>teams are set</p>
          <div className="grid grid-cols-2 gap-3">
            {(["yellow", "purple"] as const).map((tm) => {
              const roster = tm === "yellow" ? YELLOW : PURPLE;
              return (
                <div key={tm} className="rounded-2xl p-3" style={{ background: TINT[tm].soft }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: TINT[tm].color }} />
                    <span className="text-sm font-bold" style={{ color: TINT[tm].ink }}>{tm === "yellow" ? "Yellow" : "Purple"}</span>
                    <span className="ml-auto text-[10px] font-semibold" style={{ color: TINT[tm].ink }}>{tm === "yellow" ? "North" : "South"} end</span>
                  </div>
                  <div className="space-y-1.5">
                    {roster.map((n, i) => (
                      <div key={n} className="flex items-center gap-2">
                        <Avatar name={n} tint={tm} />
                        <span className="text-sm font-medium" style={{ color: "#1D3557" }}>{n}</span>
                        {i === 0 && <Crown className="h-3.5 w-3.5 ml-auto" style={{ color: "#F5A623" }} />}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <button className="lg-tint-btn w-full py-3 mt-4 text-sm" style={tintVars("green")} onClick={restart}>
            Done · replay
          </button>
        </LiquidCard>
      )}
    </div>
  );
}
