import { Share, Plus, Bell, X } from "lucide-react";

/**
 * iOS-only guidance for enabling match reminders.
 *
 * Apple blocks Web Push in a normal Safari tab — a site can only subscribe once
 * it's been added to the Home Screen and launched in standalone mode (iOS 16.4+).
 * There's no install prompt/button on iOS, so we spell out the manual steps.
 */
export function IosInstallSheet({
  open,
  onClose,
  isAr,
}: {
  open: boolean;
  onClose: () => void;
  isAr: boolean;
}) {
  if (!open) return null;

  const steps = isAr
    ? [
        { icon: Share, text: "اضغط زر المشاركة في شريط سفاري بالأسفل" },
        { icon: Plus, text: "اختر «إضافة إلى الشاشة الرئيسية»" },
        { icon: Bell, text: "افتح PlayOS من الأيقونة الجديدة، ثم احجز واضغط «ذكّرني»" },
      ]
    : [
        { icon: Share, text: "Tap the Share button in Safari's bottom bar" },
        { icon: Plus, text: 'Choose "Add to Home Screen"' },
        { icon: Bell, text: 'Open PlayOS from the new icon, book, then tap "Get a reminder"' },
      ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
      dir={isAr ? "rtl" : "ltr"}
    >
      <div
        className="w-full max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#1D3557] px-6 py-5 text-white relative">
          <button
            onClick={onClose}
            aria-label={isAr ? "إغلاق" : "Close"}
            className="absolute top-4 end-4 text-white/70 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="mx-auto mb-2 w-11 h-11 rounded-full bg-white/15 flex items-center justify-center">
            <Bell className="h-5 w-5" />
          </div>
          <p className="text-center text-lg font-bold">
            {isAr ? "تذكيرات المباريات على الآيفون" : "Match reminders on iPhone"}
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-[#6C6C70] text-center">
            {isAr
              ? "لتصلك تذكيرات قبل ٢٠ دقيقة من المباراة، أضف PlayOS إلى شاشتك الرئيسية أولاً — تُفعّلها آبل فقط بعد الإضافة."
              : "To get a reminder 20 min before kickoff, add PlayOS to your Home Screen first — Apple only allows reminders after that."}
          </p>

          <ol className="space-y-3">
            {steps.map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="shrink-0 w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center text-[#1D3557] font-bold text-sm">
                  {i + 1}
                </span>
                <Icon className="h-5 w-5 shrink-0 text-[#FF9F0A]" />
                <span className="text-sm text-[#1D3557]">{text}</span>
              </li>
            ))}
          </ol>

          <button
            onClick={onClose}
            className="glass glass-btn w-full py-2.5 text-sm"
          >
            {isAr ? "فهمت" : "Got it"}
          </button>
        </div>
      </div>
    </div>
  );
}
