import { useState } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useGetSettings, useGetMyCredits, useRedeemCredit, useGetGame } from "@/lib/supabase-api";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Smartphone, Banknote, Copy, Check, MessageCircle, Ticket } from "lucide-react";

type Method = "stcpay" | "cash";

export default function Checkout() {
  const { language } = useI18n();
  const isAr = language === "ar";
  const getPath = (p: string) => (isAr ? `/ar${p}` : p);
  const [, setLocation] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get("bookingId") ?? "";
  const gameId = params.get("gameId") ?? "";

  const { data: settings } = useGetSettings();
  const { data: game } = useGetGame(gameId);
  const { data: credits = 0 } = useGetMyCredits();
  const redeemCredit = useRedeemCredit();
  const { toast } = useToast();
  const fee = game?.price ?? 0;

  const [method, setMethod] = useState<Method | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<Method | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const choose = async (m: Method) => {
    if (!bookingId) { setError("Invalid payment link."); return; }
    setSaving(true);
    setError(null);
    // Record the chosen method; the booking stays "pending" until the
    // operator confirms payment from the dashboard.
    const { error: upErr } = await supabase
      .from("bookings").update({ payment_method: m }).eq("id", bookingId);
    setSaving(false);
    if (upErr) { setError("Something went wrong — please try again."); return; }
    setDone(m);
  };

  const handleRedeem = () => {
    redeemCredit.mutate(
      { bookingId, gameId },
      {
        onSuccess: () => {
          toast({ title: "You're in!", description: "1 credit token used — spot confirmed." });
          setLocation(getPath(`/game/${gameId}`));
        },
        onError: (err: any) =>
          setError(err?.data?.error || "Could not redeem credit. Please try again."),
      },
    );
  };

  if (!bookingId || !gameId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent px-4">
        <p className="text-[#6C6C70]">{isAr ? "رابط دفع غير صالح." : "Invalid payment link."}</p>
      </div>
    );
  }

  // ── Confirmation screen ──
  if (done) {
    const waUrl = settings?.whatsappUrl;
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent px-4 py-10">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg overflow-hidden text-center">
          <div className="bg-[#1D3557] px-6 py-6 text-white">
            <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">
              <Check className="h-6 w-6" />
            </div>
            <p className="text-lg font-bold">{isAr ? "تم تثبيت حجزك" : "Spot reserved"}</p>
          </div>
          <div className="px-6 py-5 space-y-3">
            <p className="text-sm text-[#6C6C70]">
              {done === "stcpay"
                ? isAr
                  ? `حوّل ${fee} ريال عبر STC Pay وسيتم تأكيد حجزك بعد استلام المبلغ.`
                  : `Send SAR ${fee} via STC Pay. Your spot is confirmed once payment is received.`
                : isAr
                  ? `ادفع ${fee} ريال نقداً في الملعب. سيتم تأكيد حجزك عند الدفع.`
                  : `Pay SAR ${fee} in cash at the pitch. Your spot is confirmed on payment.`}
            </p>
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: "#25D366" }}
              >
                <MessageCircle className="h-4 w-4" />
                {isAr ? "انضم لمجموعة الواتساب" : "Join the WhatsApp group"}
              </a>
            )}
            <button
              onClick={() => setLocation(getPath(`/game/${gameId}`))}
              className="glass glass-btn w-full py-2.5 text-sm"
            >
              {isAr ? "العودة للمباراة" : "Back to game"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Method selection ──
  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent px-4 py-10">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-[#1D3557] px-6 py-5 text-white">
          <p className="text-xs opacity-70 font-medium">{isAr ? "إتمام الحجز" : "Complete your booking"}</p>
          <p className="text-2xl font-bold mt-1">SAR {fee}</p>
        </div>

        <div className="px-6 py-5 space-y-3">
          {credits > 0 && (
            <button
              onClick={handleRedeem}
              disabled={redeemCredit.isPending}
              className="w-full text-left rounded-xl border p-4 transition-colors disabled:opacity-60"
              style={{ borderColor: "#0A84FF", background: "rgba(10,132,255,0.06)" }}
            >
              <div className="flex items-center gap-3">
                <Ticket className="h-5 w-5" style={{ color: "#0A84FF" }} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#1C1C1E]">
                    {isAr ? "استخدم رصيد" : "Use a credit token"} {redeemCredit.isPending && "…"}
                  </p>
                  <p className="text-xs text-[#6C6C70]">
                    {isAr ? `لديك ${credits} رصيد · مجاناً` : `You have ${credits} · books this match free`}
                  </p>
                </div>
              </div>
            </button>
          )}

          <p className="text-sm font-semibold text-[#1C1C1E]">
            {credits > 0
              ? (isAr ? "أو ادفع" : "Or pay")
              : (isAr ? "اختر طريقة الدفع" : "Choose how to pay")}
          </p>

          {/* STC Pay */}
          <button
            onClick={() => setMethod(method === "stcpay" ? null : "stcpay")}
            className="w-full text-left rounded-xl border p-4 transition-colors"
            style={{ borderColor: method === "stcpay" ? "#7B2FF7" : "#E5E5EA" }}
          >
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5" style={{ color: "#7B2FF7" }} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#1C1C1E]">STC Pay</p>
                <p className="text-xs text-[#6C6C70]">{isAr ? "تحويل فوري" : "Instant transfer"}</p>
              </div>
              <img src="/pay-stcpay.png" alt="STC Pay" className="h-5" />
            </div>

            {method === "stcpay" && (
              <div className="mt-3 pt-3 border-t border-[#E5E5EA] space-y-2">
                {settings?.stcpayNumber ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#6C6C70]">{isAr ? "رقم STC Pay" : "STC Pay number"}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); copy(settings.stcpayNumber); }}
                      className="flex items-center gap-1 text-sm font-bold text-[#1D3557]"
                    >
                      {settings.stcpayNumber}
                      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 text-[#AEAEB2]" />}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-[#6C6C70]">
                    {isAr ? "سيتم تزويدك برقم STC Pay على الواتساب." : "You'll be given the STC Pay number on WhatsApp."}
                  </p>
                )}
                {settings?.stcpayLink && (
                  <a
                    href={settings.stcpayLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="block text-center text-xs font-semibold text-[#7B2FF7] underline"
                  >
                    {isAr ? "افتح رابط الدفع" : "Open payment link"}
                  </a>
                )}
              </div>
            )}
          </button>

          {/* Cash */}
          <button
            onClick={() => setMethod(method === "cash" ? null : "cash")}
            className="w-full text-left rounded-xl border p-4 transition-colors"
            style={{ borderColor: method === "cash" ? "#34C759" : "#E5E5EA" }}
          >
            <div className="flex items-center gap-3">
              <Banknote className="h-5 w-5" style={{ color: "#34C759" }} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#1C1C1E]">{isAr ? "نقداً" : "Cash"}</p>
                <p className="text-xs text-[#6C6C70]">{isAr ? "ادفع في الملعب" : "Pay at the pitch"}</p>
              </div>
            </div>
          </button>

          {error && <p className="text-sm text-[#FF3B30]">{error}</p>}

          <button
            onClick={() => method && choose(method)}
            disabled={!method || saving}
            className="glass glass-btn w-full py-3 text-sm transition-all disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> {isAr ? "جارٍ الحفظ…" : "Saving…"}
              </span>
            ) : (
              isAr ? "تأكيد الحجز" : "Confirm booking"
            )}
          </button>

          <p className="text-center text-xs text-[#AEAEB2]">
            <Link href={getPath(`/game/${gameId}`)} className="hover:underline">
              {isAr ? "إلغاء" : "Cancel"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
