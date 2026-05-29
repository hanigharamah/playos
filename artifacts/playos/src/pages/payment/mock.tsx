import { useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, CreditCard } from "lucide-react";

export default function MockPayment() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get("bookingId") ?? "";
  const gameId = params.get("gameId") ?? "";

  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fake card form state — values are never sent anywhere
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "", name: "" });

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingId || !gameId) { setError("Invalid payment link."); return; }
    setPaying(true);
    setError(null);

    // Mark booking as paid directly in Supabase
    const { error: upErr } = await supabase
      .from("bookings")
      .update({ payment_status: "paid", payment_id: `mock_${bookingId}` })
      .eq("id", bookingId);

    if (upErr) { setError("Payment failed — please try again."); setPaying(false); return; }

    // Mark game full if at capacity
    const { data: game } = await supabase
      .from("games")
      .select("capacity, bookings(id, payment_status)")
      .eq("id", gameId)
      .single();

    if (game) {
      const paidCount = (game.bookings as any[]).filter((b) => b.payment_status === "paid").length;
      if (paidCount >= game.capacity) {
        await supabase.from("games").update({ status: "full" }).eq("id", gameId);
      }
    }

    // Reuse the existing success UI on the callback page
    setLocation(`/payment/callback?session_id=${bookingId}&gameId=${gameId}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7] px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-[#1D3557] px-6 py-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="h-4 w-4 opacity-70" />
            <span className="text-xs opacity-70 font-medium">Secure Payment</span>
          </div>
          <p className="text-lg font-bold">PlayOS Checkout</p>
        </div>

        <form onSubmit={handlePay} className="px-6 py-5 space-y-4">
          <div>
            <Label htmlFor="card-name">Cardholder name</Label>
            <Input
              id="card-name"
              placeholder="Ahmed Al-Rashidi"
              value={card.name}
              onChange={(e) => setCard({ ...card, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="card-number">Card number</Label>
            <div className="relative">
              <Input
                id="card-number"
                placeholder="1234 5678 9012 3456"
                value={card.number}
                onChange={(e) =>
                  setCard({
                    ...card,
                    number: e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 16)
                      .replace(/(.{4})/g, "$1 ")
                      .trim(),
                  })
                }
                required
                maxLength={19}
              />
              <CreditCard className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="card-expiry">Expiry</Label>
              <Input
                id="card-expiry"
                placeholder="MM / YY"
                value={card.expiry}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setCard({ ...card, expiry: v.length > 2 ? `${v.slice(0, 2)} / ${v.slice(2)}` : v });
                }}
                required
                maxLength={7}
              />
            </div>
            <div>
              <Label htmlFor="card-cvc">CVC</Label>
              <Input
                id="card-cvc"
                placeholder="123"
                value={card.cvc}
                onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                required
                maxLength={4}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={paying}>
            {paying ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing…</>
            ) : (
              "Pay Now"
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Powered by PlayOS · Your card details are not stored
          </p>
        </form>
      </div>
    </div>
  );
}
