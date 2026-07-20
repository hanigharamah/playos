import { useState } from "react";
import { Bell, Share, Plus, Check } from "lucide-react";
import { canRequestPush, isIOS, isStandalone } from "@/lib/pwa";
import { subscribeToPush } from "@/lib/push";

/**
 * Post-signup interstitial that nudges the new player to turn on match
 * reminders. Benefit-led, single primary action, low-pressure opt-out.
 *
 * Platform-aware:
 *  - Desktop / Android / installed iOS  → "Turn on reminders" (Web Push works here)
 *  - iOS Safari tab                      → guide Add-to-Home-Screen first, since
 *                                          Apple only allows push in standalone mode
 *
 * If the platform can offer neither, the parent should skip straight to onDone.
 */
export function shouldShowFullExperience(): boolean {
  return canRequestPush() || (isIOS() && !isStandalone());
}

export function FullExperienceSheet({
  open,
  userId,
  isAr,
  onDone,
}: {
  open: boolean;
  userId: string;
  isAr: boolean;
  onDone: () => void;
}) {
  const [state, setState] = useState<"idle" | "subscribing" | "done">("idle");
  if (!open) return null;

  const iosNeedsInstall = isIOS() && !isStandalone();

  async function enable() {
    if (!userId) return;
    setState("subscribing");
    const result = await subscribeToPush(userId);
    setState(result === "subscribed" ? "done" : "idle");
    if (result !== "subscribed") {
      // Permission denied or unsupported — don't trap the player here.
      onDone();
    }
  }

  const iosSteps = isAr
    ? [
        { icon: Share, text: "اضغط زر المشاركة في سفاري" },
        { icon: Plus, text: "اختر «إضافة إلى الشاشة الرئيسية»" },
        { icon: Bell, text: "افتح PlayOS من الأيقونة الجديدة" },
      ]
    : [
        { icon: Share, text: "Tap Share in Safari's bottom bar" },
        { icon: Plus, text: 'Choose "Add to Home Screen"' },
        { icon: Bell, text: "Open PlayOS from the new icon" },
      ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="w-full max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-lg overflow-hidden">
        {/* Header — benefit first */}
        <div className="bg-[#1D3557] px-6 pt-7 pb-6 text-white text-center">
          <div className="mx-auto mb-3 w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
            <Bell className="h-7 w-7" />
          </div>
          <p className="text-xl font-bold">
            {isAr ? "لا تفوّت أي مباراة" : "Never miss kickoff"}
          </p>
          <p className="mt-1.5 text-sm text-white/70">
            {isAr
              ? "نذكّرك قبل ٢٠ دقيقة من بداية كل مباراة تحجزها."
              : "We'll remind you 20 minutes before every game you book."}
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          {state === "done" ? (
            <>
              <div className="flex items-center justify-center gap-2 text-green-600 font-semibold">
                <Check className="h-5 w-5" />
                {isAr ? "تم تفعيل التذكيرات" : "Reminders are on"}
              </div>
              <button onClick={onDone} className="w-full py-3 rounded-xl bg-[#1D3557] text-white text-sm font-semibold">
                {isAr ? "متابعة" : "Continue"}
              </button>
            </>
          ) : iosNeedsInstall ? (
            <>
              <p className="text-sm text-[#6C6C70] text-center">
                {isAr
                  ? "على الآيفون، أضف PlayOS إلى شاشتك الرئيسية أولاً لتفعيل التذكيرات:"
                  : "On iPhone, add PlayOS to your Home Screen first to unlock reminders:"}
              </p>
              <ol className="space-y-2.5">
                {iosSteps.map(({ icon: Icon, text }, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-[#F2F2F7] flex items-center justify-center text-[#1D3557] font-bold text-xs">
                      {i + 1}
                    </span>
                    <Icon className="h-5 w-5 shrink-0 text-[#FF9F0A]" />
                    <span className="text-sm text-[#1D3557]">{text}</span>
                  </li>
                ))}
              </ol>
              <button onClick={onDone} className="w-full py-3 rounded-xl bg-[#1D3557] text-white text-sm font-semibold">
                {isAr ? "متابعة إلى المباراة" : "Continue to your game"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={enable}
                disabled={state === "subscribing"}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#FF9F0A] text-white text-sm font-bold disabled:opacity-60"
              >
                <Bell className="h-4 w-4" />
                {state === "subscribing"
                  ? isAr ? "جارٍ التفعيل…" : "Turning on…"
                  : isAr ? "فعّل التذكيرات" : "Turn on reminders"}
              </button>
              <button onClick={onDone} className="w-full py-2 text-sm font-medium text-[#8E8E93]">
                {isAr ? "ربما لاحقاً" : "Maybe later"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
