export default function About() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8" style={{ color: "#1D3557" }}>About PlayOS</h1>

      <div className="prose prose-slate max-w-none space-y-6 text-[#3A3A3C]">
        <p className="text-base leading-relaxed">
          PlayOS is a football game booking platform that connects players with pitch owners across Saudi Arabia.
          Players can discover, book, and pay for pickup football games instantly. Hosts can list their pitches,
          schedule games, track bookings, and receive automatic payouts.
        </p>

        <p className="text-base leading-relaxed">
          Our mission is to make organizing and joining football games as easy as booking a ride — no WhatsApp
          groups, no chasing payments, no confusion about who's playing.
        </p>

        <div className="border border-[#E5E5EA] rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-[#1C1C1E]">What We Offer</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0 text-lg">⚽</div>
              <div>
                <div className="font-semibold text-[#1C1C1E]">For Players</div>
                <p className="text-sm text-[#6C6C70] mt-0.5">
                  Browse open games, pick your spot on the pitch, pay securely, and get instant confirmation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
