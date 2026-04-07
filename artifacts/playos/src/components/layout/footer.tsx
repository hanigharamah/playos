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
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {/* Visa */}
            <img src="/pay-visa.svg" alt="Visa" className="h-[35px] w-auto object-contain rounded border border-[#E5E5EA] rounded-tl-[10px] rounded-tr-[10px] rounded-br-[10px] rounded-bl-[10px]" />
            {/* Mastercard */}
            <img src="/pay-mastercard.svg" alt="Mastercard" className="h-[35px] w-auto object-contain rounded border border-[#E5E5EA]" />
            {/* mada — transparent logo on white pill */}
            <div className="h-[35px] px-2 rounded border border-[#E5E5EA] bg-white flex items-center justify-center">
              <img src="/pay-mada.png" alt="mada" className="h-[28px] w-auto object-contain" />
            </div>
            {/* Apple Pay */}
            <div className="h-[35px] px-3 rounded border border-[#E5E5EA] bg-white flex items-center justify-center">
              <img src="/pay-applepay.png" alt="Apple Pay" className="h-[20px] w-auto object-contain" />
            </div>
            {/* STC Bank */}
            <div className="h-[35px] px-2 rounded border border-[#E5E5EA] bg-white flex items-center justify-center">
              <img src="/pay-stcpay.png" alt="STC Pay" className="h-[22px] w-auto object-contain" />
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
