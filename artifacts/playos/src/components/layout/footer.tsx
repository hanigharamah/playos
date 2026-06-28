import { Link } from "wouter";
import { Lock } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { language } = useI18n();
  const isArabic = language === "ar";
  const p = (path: string) => (isArabic ? `/ar${path}` : path);

  const logos = [
    { src: "/pay-stcpay.png", alt: "STC Pay" },
  ];

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

        {/* Payment section */}
        <div className="border-t border-[#E5E5EA] pt-5">
          {/* Single unified pill containing all logos */}
          <div
            className="inline-flex items-center gap-3 px-4 py-2.5 rounded-lg mb-2"
            style={{ background: "#F8F9FA", border: "1px solid #E5E5EA" }}
          >
            {logos.map(({ src, alt }) => (
              <img
                key={alt}
                src={src}
                alt={alt}
                className="h-[16px] w-auto object-contain"
                style={{ filter: "grayscale(100%) opacity(0.55)" }}
              />
            ))}
            <span
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "#8E8E93" }}
            >
              {isArabic ? "نقداً" : "Cash"}
            </span>
          </div>

          {/* Security text */}
          <div className="flex items-center gap-1 mb-4">
            <Lock className="h-3 w-3 text-[#AEAEB2]" />
            <p style={{ fontSize: "11px", color: "#AEAEB2" }}>
              {isArabic ? "ادفع عبر STC Pay أو نقداً" : "Pay by STC Pay or cash"}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-[#8E8E93]">
            <p>© {new Date().getFullYear()} E-vision technology services. All rights reserved.</p>
            <p>Riyadh, Saudi Arabia · P.O. Box 12631</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
