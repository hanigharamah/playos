import { useLocation, Link } from "wouter";
import { useVerifyPayment, getVerifyPaymentQueryKey } from "@/lib/supabase-api";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, CalendarDays, MapPin, Users, Trophy } from "lucide-react";
import { format } from "date-fns";

export default function PaymentCallback() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id") || "";
  const gameId = params.get("gameId") || "";

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

  useEffect(() => {
    if (data?.status === "paid" && gameId) {
      const timer = setTimeout(() => {
        setLocation(`/game/${gameId}`);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [data, gameId]);

  const booking = data?.booking;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#F2F2F7]">
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
