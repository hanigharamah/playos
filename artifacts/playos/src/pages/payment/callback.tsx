import { useLocation, Link } from "wouter";
import { useVerifyPayment, getVerifyPaymentQueryKey } from "@/lib/supabase-api";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, CalendarDays, MapPin, Users, Trophy, Bell } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";
import { canRequestPush, isIOS, isStandalone } from "@/lib/pwa";
import { subscribeToPush, hasNotificationPermission } from "@/lib/push";

export default function PaymentCallback() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id") || "";
  const gameId = params.get("gameId") || "";

  const [pushState, setPushState] = useState<"idle" | "subscribing" | "done" | "hidden">(
    hasNotificationPermission() ? "hidden" : "idle",
  );

  const { data, isLoading, isError } = useVerifyPayment(
    { session_id: sessionId, gameId },
    {
      query: {
        enabled: !!(sessionId && gameId),
        queryKey: getVerifyPaymentQueryKey({ session_id: sessionId, gameId }),
        retry: 3,
      },
    }
  );

  async function enableReminder() {
    if (!user?.id) return;
    setPushState("subscribing");
    const result = await subscribeToPush(user.id);
    setPushState(result === "subscribed" ? "done" : "hidden");
  }

  useEffect(() => {
    if (data?.status === "paid" && gameId) {
      const timer = setTimeout(() => {
        setLocation(`/game/${gameId}`);
      }, 8000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [data, gameId]);

  const booking = data?.booking;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-transparent">
      {isLoading ? (
        <div className="card-ios w-full max-w-sm text-center p-10 space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <h2 className="text-xl font-semibold text-[#1D3557]">Verifying Payment…</h2>
          <p className="text-[#6C6C70] text-sm">Please wait while we confirm your booking.</p>
        </div>
      ) : isError ? (
        <div className="card-ios w-full max-w-sm text-center p-10 space-y-4">
          <XCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold text-[#1D3557]">Payment Failed</h2>
          <p className="text-[#6C6C70] text-sm">Something went wrong. Please try again.</p>
          <Button asChild>
            <Link href={gameId ? `/game/${gameId}` : "/games"}>Try Again</Link>
          </Button>
        </div>
      ) : data?.status === "paid" ? (
        <div className="card-ios w-full max-w-sm p-6 space-y-5">
          {/* Header */}
          <div className="text-center space-y-2">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-100 text-green-800 rounded-full text-sm font-semibold"
              data-testid="status-payment-success"
            >
              Booking Confirmed!
            </div>
            <h2 className="text-2xl font-bold text-[#1D3557]">You're in! 🎉</h2>
          </div>

          {/* Booking Details */}
          {booking && (
            <div className="rounded-xl border border-[#E5E5EA] overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-[#E5E5EA]">
                <div className="px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-widest mb-0.5">Team</p>
                  <div className="flex items-center gap-1 text-sm font-bold text-[#1D3557]">
                    <Trophy className="h-3.5 w-3.5 text-[#6C6C70]" />
                    Team {booking.team}
                  </div>
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-widest mb-0.5">Amount Paid</p>
                  <p className="text-sm font-bold text-green-600">SAR —</p>
                </div>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-[#AEAEB2]">
            Redirecting to game page in a moment…
          </p>

          {pushState !== "hidden" && pushState !== "done" && canRequestPush() && (
            <button
              onClick={enableReminder}
              disabled={pushState === "subscribing"}
              className="w-full flex items-center gap-2.5 rounded-xl border border-[#E5E5EA] px-3.5 py-3 text-left disabled:opacity-60"
            >
              <Bell className="h-4 w-4 shrink-0 text-[#FF9F0A]" />
              <span className="text-sm font-medium text-[#1D3557] flex-1">
                {pushState === "subscribing" ? "Enabling…" : "Get a reminder 20 min before kickoff"}
              </span>
            </button>
          )}
          {pushState !== "hidden" && pushState !== "done" && isIOS() && !isStandalone() && (
            <p className="text-center text-xs text-[#6C6C70] px-2">
              Add PlayOS to your Home Screen to get match reminders on iPhone.
            </p>
          )}
          {pushState === "done" && (
            <p className="text-center text-xs text-green-600 font-medium">Reminder enabled ✓</p>
          )}

          {/* Buttons */}
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link href={`/game/${gameId}`}>View Game</Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href="/my-games">My Games</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="card-ios w-full max-w-sm text-center p-10 space-y-4">
          <XCircle className="h-12 w-12 text-orange-500 mx-auto" />
          <h2 className="text-xl font-semibold text-[#1D3557]">Payment Pending</h2>
          <p className="text-[#6C6C70] text-sm">Your payment is being processed.</p>
          <Button asChild>
            <Link href={gameId ? `/game/${gameId}` : "/games"}>Go Back</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
