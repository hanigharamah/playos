import { useLocation, Link } from "wouter";
import { useGetGameManagement, useUpdateGame, useDeleteGame, useMarkBookingPaid, useGetSettings, getGetGameManagementQueryKey, getGetGameQueryKey } from "@/lib/supabase-api";
import { useAuth } from "@/lib/auth";
import { isOperator } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Share2, Trash2, ArrowLeft, Users, MapPin, Clock, DollarSign, CheckCircle, Circle, MessageCircle, BadgeCheck } from "lucide-react";
import { useState } from "react";

interface Props {
  params: { id: string };
}

function CheckInBadge({ checkedIn, checkedInAt }: { checkedIn: boolean; checkedInAt?: Date | null }) {
  if (checkedIn && checkedInAt) {
    return (
      <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
        <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
        {format(new Date(checkedInAt), "h:mm a")}
      </span>
    );
  }
  return <Circle className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />;
}

export default function GameManage({ params }: Props) {
  const { id } = params;
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading } = useGetGameManagement(id, {
    query: { enabled: !!id, queryKey: getGetGameManagementQueryKey(id) },
  });

  const updateGame = useUpdateGame();
  const deleteGame = useDeleteGame();
  const markPaid = useMarkBookingPaid();
  const { data: settings } = useGetSettings();

  if (!isOperator(user?.role)) {
    setLocation("/");
    return null;
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!data) {
    return <div className="text-center py-16 text-muted-foreground">Game not found.</div>;
  }

  const { game, bookings, bookedCount, netPayout, shareUrl } = data;
  const team1 = bookings.filter((b) => b.team === 1 && b.paymentStatus === "paid");
  const team2 = bookings.filter((b) => b.team === 2 && b.paymentStatus === "paid");
  const paidBookings = bookings.filter((b) => b.paymentStatus === "paid");
  const pendingBookings = bookings.filter((b) => b.paymentStatus === "pending");
  const checkedInCount = paidBookings.filter((b) => b.checkedIn).length;
  const fee = game.price;

  const handleMarkPaid = (bookingId: string) => {
    markPaid.mutate(
      { id: bookingId, gameId: id },
      {
        onSuccess: () => toast({ title: "Marked paid", description: "Booking confirmed." }),
        onError: (err: any) =>
          toast({ title: "Error", description: err?.message || "Could not update", variant: "destructive" }),
      },
    );
  };

  // Open WhatsApp to the player with a prefilled STC Pay payment request.
  const sendStcLink = (phone: string | null | undefined, playerName: string) => {
    if (!phone) {
      toast({ title: "No phone number", description: "This player has no phone on file.", variant: "destructive" });
      return;
    }
    const digits = phone.replace(/\D/g, "");
    const payInfo = settings?.stcpayLink
      ? settings.stcpayLink
      : settings?.stcpayNumber
        ? `STC Pay number: ${settings.stcpayNumber}`
        : "(STC Pay details to follow)";
    const msg =
      `Hi ${playerName}, to confirm your spot in "${game.title}" ` +
      `please send SAR ${fee} via STC Pay.\n${payInfo}\n\nThanks!`;
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleToggleVisibility = () => {
    updateGame.mutate(
      { id, data: { isPublic: !game.isPublic } },
      {
        onSuccess: () => {
          toast({ title: "Updated", description: `Game is now ${!game.isPublic ? "public" : "private"}` });
          queryClient.invalidateQueries({ queryKey: getGetGameManagementQueryKey(id) });
        },
      }
    );
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: game.title, url: shareUrl });
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link Copied", description: "Game link copied to clipboard." });
    }
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteGame.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Deleted", description: "Game has been deleted." });
          setLocation("/dashboard");
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err?.data?.error || "Failed to delete", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Dashboard
          </Link>
        </Button>
        <h1 className="text-xl font-bold truncate">{game.title}</h1>
      </div>

      {/* Game Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Users className="h-3 w-3" />Booked</div>
            <div className="text-2xl font-bold">{bookedCount}/{game.capacity}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><CheckCircle className="h-3 w-3" />Checked In</div>
            <div className="text-2xl font-bold text-green-600">{checkedInCount}/{bookedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="h-3 w-3" />Net Payout</div>
            <div className="text-2xl font-bold">SAR {netPayout.toFixed(0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Clock className="h-3 w-3" />Kickoff</div>
            <div className="text-sm font-medium">{format(new Date(game.kickoffTime), "MMM d, h:mm a")}</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch
                id="visibility"
                checked={game.isPublic}
                onCheckedChange={handleToggleVisibility}
              />
              <Label htmlFor="visibility">
                {game.isPublic ? "Public (visible in browse)" : "Private (link only)"}
              </Label>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button
                variant={confirmDelete ? "destructive" : "outline"}
                size="sm"
                onClick={handleDelete}
                disabled={deleteGame.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {confirmDelete ? "Confirm Delete" : "Delete Game"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending payments — confirm STC Pay / cash */}
      {pendingBookings.length > 0 && (
        <Card className="mb-4 border-amber-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Awaiting payment ({pendingBookings.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingBookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{b.playerName}</p>
                  <p className="text-xs text-muted-foreground">
                    Team {b.team}
                    {(b as any).paymentMethod ? ` · ${(b as any).paymentMethod}` : ""}
                    {b.playerPhone ? ` · ${b.playerPhone}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => sendStcLink(b.playerPhone, b.playerName)}
                  >
                    <MessageCircle className="h-4 w-4 mr-1.5" />
                    Send STC Pay
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleMarkPaid(b.id)}
                    disabled={markPaid.isPending}
                  >
                    <BadgeCheck className="h-4 w-4 mr-1.5" />
                    Mark paid
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Player Rosters with check-in */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{t("game.team1")} ({team1.length})</span>
              {team1.length > 0 && (
                <span className="text-xs font-normal text-green-600">
                  {team1.filter((b) => b.checkedIn).length}/{team1.length} in
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {team1.length === 0 ? (
              <p className="text-sm text-muted-foreground">No players yet.</p>
            ) : (
              <div className="space-y-2.5">
                {team1.map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-sm gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckInBadge checkedIn={b.checkedIn} checkedInAt={b.checkedInAt} />
                      <span className="truncate">{b.playerName}</span>
                    </div>
                    <Badge variant={b.paymentStatus === "paid" ? "default" : "outline"} className="text-xs flex-shrink-0">
                      {b.paymentStatus}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{t("game.team2")} ({team2.length})</span>
              {team2.length > 0 && (
                <span className="text-xs font-normal text-green-600">
                  {team2.filter((b) => b.checkedIn).length}/{team2.length} in
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {team2.length === 0 ? (
              <p className="text-sm text-muted-foreground">No players yet.</p>
            ) : (
              <div className="space-y-2.5">
                {team2.map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-sm gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckInBadge checkedIn={b.checkedIn} checkedInAt={b.checkedInAt} />
                      <span className="truncate">{b.playerName}</span>
                    </div>
                    <Badge variant={b.paymentStatus === "paid" ? "default" : "outline"} className="text-xs flex-shrink-0">
                      {b.paymentStatus}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 text-center">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/game/${id}`}>View game page</Link>
        </Button>
      </div>
    </div>
  );
}
