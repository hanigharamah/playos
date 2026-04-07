export default function About() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2" style={{ color: "#1D3557" }}>About PlayOS</h1>
      <p className="text-sm text-muted-foreground mb-8">Owned and managed by E-vision technology services</p>

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
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0 text-lg">🏟️</div>
              <div>
                <div className="font-semibold text-[#1C1C1E]">For Hosts</div>
                <p className="text-sm text-[#6C6C70] mt-0.5">
                  Schedule games, track bookings and payments in real time, and receive weekly payouts to your bank account.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-[#E5E5EA] rounded-xl p-6">
          <h2 className="text-xl font-semibold text-[#1C1C1E] mb-3">Company Information</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2"><dt className="text-[#6C6C70] w-36 shrink-0">Company Name</dt><dd className="font-medium text-[#1C1C1E]">E-vision technology services</dd></div>
            <div className="flex gap-2"><dt className="text-[#6C6C70] w-36 shrink-0">Address</dt><dd className="font-medium text-[#1C1C1E]">King Faisal Ibn Abdulaziz Saud, Riyadh, Saudi Arabia</dd></div>
            <div className="flex gap-2"><dt className="text-[#6C6C70] w-36 shrink-0">P.O. Box</dt><dd className="font-medium text-[#1C1C1E]">12631</dd></div>
            <div className="flex gap-2"><dt className="text-[#6C6C70] w-36 shrink-0">Country</dt><dd className="font-medium text-[#1C1C1E]">Saudi Arabia</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}
