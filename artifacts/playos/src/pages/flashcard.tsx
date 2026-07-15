import { useState } from "react";
import { FlashcardModal } from "@/components/flashcard/FlashcardModal";

/** Temporary preview route (/flashcard) to iterate on the liquid-glass card. */
export default function FlashcardPreview() {
  const [open, setOpen] = useState(true);
  const [team, setTeam] = useState<"yellow" | "purple">("yellow");

  return (
    <div className="min-h-screen">
      {/* Sample page content behind the popup (so you can see the dim + blur) */}
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
        <h1 className="text-2xl font-bold" style={{ color: "#1D3557" }}>Al Rowad 8PM</h1>
        <p className="text-sm text-[#6C6C70]">Tuesday, 30 June · 8:00 PM · Al Rowad pitch</p>
        <div className="card-ios p-4">
          <p className="text-sm text-[#6C6C70]">8 / 12 players checked in · warming up…</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card-ios h-16" />
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-4">
          <button className="glass glass-btn px-4 py-2 text-sm" onClick={() => setOpen(true)}>
            Reveal flashcard
          </button>
          <button className="glass glass-btn px-4 py-2 text-sm" onClick={() => setTeam("yellow")}>
            Yellow
          </button>
          <button className="glass glass-btn px-4 py-2 text-sm" onClick={() => setTeam("purple")}>
            Purple
          </button>
        </div>
      </div>

      <FlashcardModal
        open={open}
        onClose={() => setOpen(false)}
        team={team}
        playerName="Hani"
        position="Midfield"
        end={team === "yellow" ? "North" : "South"}
        isCaptain
      />
    </div>
  );
}
