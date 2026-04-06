import { useParams, useLocation } from "wouter";
import { useGetGame, useBookSpot } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, CalendarDays, Clock, Share2, ShieldAlert, Check } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function GameDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id!;
  const { language, t } = useI18n();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: game, isLoading } = useGetGame(id);
  const bookSpot = useBookSpot(id);

  const getPath = (path: string) => (language === "ar" ? `/ar${path}` : path);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: game?.title,
          url,
        });
      } catch (err) {
        console.error("Share failed", err);
      }
    } else {
      navigator.clipboard.writeText(url);
      toast({ title: "Link copied to clipboard" });
    }
  };

  const handleSlotClick = (team: number, slotIndex: number) => {
    if (!user) {
      setLocation(getPath(`/auth?returnUrl=/game/${id}`));
      return;
    }
    
    if (game?.status !== "open") return;

    // Check if slot is already booked
    const isBooked = game?.bookings?.some(b => b.team === team && b.slotIndex === slotIndex && b.paymentStatus !== "refunded");
    if (isBooked) return;

    bookSpot.mutate(
      { data: { team, slotIndex } },
      {
        onSuccess: (data) => {
          window.location.href = data.checkoutUrl;
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Error booking spot",
            description: err?.message || "Please try again later.",
          });
        }
      }
    );
  };

  if (isLoading || !game) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-1/2 mb-4" />
        <Skeleton className="h-64 w-full mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48 col-span-2" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  const teamSize = game.capacity / 2;
  const price = game.price;
  const serviceFee = 2;
  const total = price + serviceFee;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={game.status === "open" ? "default" : "secondary"}>
              {game.status === "open" ? "Open" : "Full"}
            </Badge>
            <Badge variant="outline">{game.durationMinutes} min</Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{game.title}</h1>
        </div>
        <div className="flex gap-2">
          {user?.role === "organiser" && user.id === game.organiserId && (
            <Button variant="outline" onClick={() => setLocation(getPath(`/game/${id}/manage`))}>
              {t("game.manage")}
            </Button>
          )}
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="mr-2 h-4 w-4" />
            {t("game.share")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Pitch UI */}
          <div className="bg-[#2e7d32] rounded-xl p-4 sm:p-8 aspect-[4/3] sm:aspect-[16/9] relative overflow-hidden shadow-inner border-4 border-white">
            {/* Pitch Markings */}
            <div className="absolute inset-4 border-2 border-white/60 pointer-events-none" />
            <div className="absolute top-4 bottom-4 left-1/2 w-0 border-l-2 border-white/60 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 sm:w-32 sm:h-32 rounded-full border-2 border-white/60 pointer-events-none" />
            <div className="absolute top-1/2 left-4 -translate-y-1/2 w-16 sm:w-24 h-32 sm:h-48 border-2 border-l-0 border-white/60 pointer-events-none" />
            <div className="absolute top-1/2 right-4 -translate-y-1/2 w-16 sm:w-24 h-32 sm:h-48 border-2 border-r-0 border-white/60 pointer-events-none" />
            <div className="absolute top-1/2 left-4 -translate-y-1/2 w-8 sm:w-12 h-16 sm:h-24 border-2 border-l-0 border-white/60 pointer-events-none" />
            <div className="absolute top-1/2 right-4 -translate-y-1/2 w-8 sm:w-12 h-16 sm:h-24 border-2 border-r-0 border-white/60 pointer-events-none" />

            <div className="absolute inset-0 flex">
              {/* Team 1 (Left) */}
              <div className="flex-1 flex flex-wrap content-around justify-center gap-2 sm:gap-4 p-8">
                {Array.from({ length: teamSize }).map((_, i) => {
                  const booking = game.bookings?.find(b => b.team === 1 && b.slotIndex === i && b.paymentStatus !== "refunded");
                  return (
                    <button
                      key={`t1-${i}`}
                      onClick={() => handleSlotClick(1, i)}
                      disabled={!!booking || game.status !== "open" || bookSpot.isPending}
                      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-base transition-all z-10 ${
                        booking
                          ? "bg-white text-[#2e7d32] shadow-md border-2 border-[#1b5e20]"
                          : "border-2 border-dashed border-white/80 text-white/80 hover:bg-white/20 hover:border-white hover:text-white"
                      }`}
                    >
                      {booking ? booking.playerName.charAt(0).toUpperCase() : "+"}
                    </button>
                  );
                })}
              </div>

              {/* Team 2 (Right) */}
              <div className="flex-1 flex flex-wrap content-around justify-center gap-2 sm:gap-4 p-8">
                {Array.from({ length: teamSize }).map((_, i) => {
                  const booking = game.bookings?.find(b => b.team === 2 && b.slotIndex === i && b.paymentStatus !== "refunded");
                  return (
                    <button
                      key={`t2-${i}`}
                      onClick={() => handleSlotClick(2, i)}
                      disabled={!!booking || game.status !== "open" || bookSpot.isPending}
                      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-base transition-all z-10 ${
                        booking
                          ? "bg-[#1b5e20] text-white shadow-md border-2 border-white"
                          : "border-2 border-dashed border-white/80 text-white/80 hover:bg-white/20 hover:border-white hover:text-white"
                      }`}
                    >
                      {booking ? booking.playerName.charAt(0).toUpperCase() : "+"}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Roster list mobile fallback could go here, or just show under */}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Game Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <CalendarDays className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">{format(new Date(game.kickoffTime), "EEEE, MMMM d, yyyy")}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">{format(new Date(game.kickoffTime), "h:mm a")}</p>
                  <p className="text-sm text-muted-foreground">{game.durationMinutes} minutes</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">{game.pitchName}</p>
                  {game.locationText && <p className="text-sm text-muted-foreground">{game.locationText}</p>}
                  {game.mapsUrl && (
                    <a href={game.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline block mt-1">
                      View on Google Maps
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Game Price</span>
                <span>SAR {price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Service Fee</span>
                <span>SAR {serviceFee.toFixed(2)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-bold">
                <span>Total to pay</span>
                <span>SAR {total.toFixed(2)}</span>
              </div>
              
              <div className="mt-4 bg-muted/50 p-3 rounded-md flex gap-2 items-start text-xs text-muted-foreground">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <p>Cancellations allowed up to 12h before kickoff for a full refund.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
