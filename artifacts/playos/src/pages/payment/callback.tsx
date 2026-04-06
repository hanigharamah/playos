import { useLocation, Link } from "wouter";
import { useVerifyPayment, getVerifyPaymentQueryKey } from "@workspace/api-client-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

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
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [data, gameId]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
      <Card className="w-full max-w-sm text-center">
        <CardContent className="pt-8 pb-8">
          {isLoading ? (
            <div className="space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <h2 className="text-xl font-semibold">Verifying Payment...</h2>
              <p className="text-muted-foreground text-sm">Please wait while we confirm your booking.</p>
            </div>
          ) : isError ? (
            <div className="space-y-4">
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-xl font-semibold">Payment Failed</h2>
              <p className="text-muted-foreground text-sm">Something went wrong. Please try again.</p>
              <Button asChild>
                <Link href={gameId ? `/game/${gameId}` : "/games"}>Try Again</Link>
              </Button>
            </div>
          ) : data?.status === "paid" ? (
            <div className="space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <div
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-semibold"
                data-testid="status-payment-success"
              >
                You're in!
              </div>
              <h2 className="text-xl font-semibold">Booking Confirmed</h2>
              <p className="text-muted-foreground text-sm">Your spot has been reserved. Redirecting to game page...</p>
              <Button asChild>
                <Link href={`/game/${gameId}`}>View Game</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <XCircle className="h-12 w-12 text-orange-500 mx-auto" />
              <h2 className="text-xl font-semibold">Payment Pending</h2>
              <p className="text-muted-foreground text-sm">Your payment is being processed.</p>
              <Button asChild>
                <Link href={gameId ? `/game/${gameId}` : "/games"}>Go Back</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
