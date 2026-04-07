import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { language } = useI18n();
  const isArabic = language === "ar";
  const p = (path: string) => (isArabic ? `/ar${path}` : path);

  return (
    <footer className="border-t border-[#E5E5EA] bg-white mt-auto">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Main grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2">
            <div className="flex items-center mb-3">
              <span className="text-xl font-extrabold uppercase" style={{ color: "#1D3557", letterSpacing: "-0.03em" }}>PLAY</span>
              <span className="text-xl font-extrabold uppercase" style={{ color: "#0A84FF", letterSpacing: "-0.03em" }}>OS</span>
            </div>
            <p className="text-sm text-[#6C6C70] max-w-xs leading-relaxed">
              The #1 football pickup game booking platform in Saudi Arabia. Book your spot, show up, play.
            </p>
            <p className="text-xs text-[#8E8E93] mt-3">
              Owned &amp; operated by <span className="font-medium">E-vision technology services</span>
            </p>
          </div>

          {/* Company */}
          <div>
            <div className="text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-3">Company</div>
            <ul className="space-y-2">
              <li><Link href={p("/about")} className="text-sm text-[#6C6C70] hover:text-[#0A84FF] transition-colors">About Us</Link></li>
              <li><Link href={p("/contact")} className="text-sm text-[#6C6C70] hover:text-[#0A84FF] transition-colors">Contact Us</Link></li>
              <li><Link href={p("/complaints")} className="text-sm text-[#6C6C70] hover:text-[#0A84FF] transition-colors">Complaints</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <div className="text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-3">Legal</div>
            <ul className="space-y-2">
              <li><Link href={p("/terms")} className="text-sm text-[#6C6C70] hover:text-[#0A84FF] transition-colors">Terms &amp; Conditions</Link></li>
              <li><Link href={p("/privacy")} className="text-sm text-[#6C6C70] hover:text-[#0A84FF] transition-colors">Privacy Policy</Link></li>
              <li><Link href={p("/policies/refund")} className="text-sm text-[#6C6C70] hover:text-[#0A84FF] transition-colors">Refund &amp; Cancellation</Link></li>
              <li><Link href={p("/policies/delivery")} className="text-sm text-[#6C6C70] hover:text-[#0A84FF] transition-colors">Service Delivery</Link></li>
            </ul>
          </div>
        </div>

        {/* Payment logos */}
        <div className="border-t border-[#E5E5EA] pt-6">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            {/* Visa */}
            <div className="flex items-center justify-center h-8 px-3 rounded border border-[#E5E5EA] bg-white">
              <svg viewBox="0 0 60 20" className="h-4 w-auto" aria-label="Visa">
                <text x="0" y="16" fontFamily="Arial" fontSize="18" fontWeight="900" fill="#1A1F71">VISA</text>
              </svg>
            </div>
            {/* Mastercard */}
            <div className="flex items-center justify-center h-8 px-2 rounded border border-[#E5E5EA] bg-white gap-0.5">
              <div className="w-5 h-5 rounded-full bg-[#EB001B] opacity-90" />
              <div className="w-5 h-5 rounded-full bg-[#F79E1B] opacity-90 -ml-2.5" />
            </div>
            {/* mada */}
            <div className="flex items-center justify-center h-8 px-3 rounded border border-[#E5E5EA] bg-white">
              <svg viewBox="0 0 52 20" className="h-4 w-auto" aria-label="mada">
                <text x="0" y="16" fontFamily="Arial" fontSize="15" fontWeight="700" fill="#00A651">mada</text>
              </svg>
            </div>
            {/* Apple Pay */}
            <div className="flex items-center justify-center h-8 px-3 rounded border border-[#E5E5EA] bg-black">
              <svg viewBox="0 0 80 22" className="h-4 w-auto" aria-label="Apple Pay">
                <text x="2" y="16" fontFamily="Arial" fontSize="13" fontWeight="500" fill="white">Apple Pay</text>
              </svg>
            </div>
            {/* STC Pay */}
            <div className="flex items-center justify-center h-8 px-3 rounded border border-[#E5E5EA] bg-[#7B2F8E]">
              <svg viewBox="0 0 68 22" className="h-4 w-auto" aria-label="STC Pay">
                <text x="2" y="16" fontFamily="Arial" fontSize="13" fontWeight="700" fill="white">STC Pay</text>
              </svg>
            </div>
          </div>
          <p className="text-xs text-[#8E8E93] mb-4">Payments secured by Amazon Payment Services</p>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-[#8E8E93]">
            <p>© {new Date().getFullYear()} E-vision technology services. All rights reserved.</p>
            <p>Riyadh, Saudi Arabia · P.O. Box 12631</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
