import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useGetDashboardPayouts, useSavePayoutDetails, getGetDashboardPayoutsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function Payouts() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useGetDashboardPayouts();
  const saveDetails = useSavePayoutDetails();

  const [bankForm, setBankForm] = useState({
    accountHolder: data?.payoutDetails?.accountHolder || "",
    iban: data?.payoutDetails?.iban || "",
    bankName: data?.payoutDetails?.bankName || "",
    swift: data?.payoutDetails?.swift || "",
  });

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "organiser")) {
      setLocation("/host/login");
    }
  }, [authLoading, user]);

  if (authLoading || !user || user.role !== "organiser") {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const handleSaveBank = (e: React.FormEvent) => {
    e.preventDefault();
    saveDetails.mutate(
      { data: bankForm },
      {
        onSuccess: () => {
          toast({ title: "Saved", description: "Bank details updated." });
          queryClient.invalidateQueries({ queryKey: getGetDashboardPayoutsQueryKey() });
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err?.data?.error || "Failed to save", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Dashboard / Payouts toggle navigation */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex items-center bg-muted rounded-xl p-1 gap-1">
          <Link
            href="/dashboard"
            className="px-5 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Dashboard
          </Link>
          <span className="px-5 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 text-white shadow-sm">
            Payouts
          </span>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-6">{t("dash.payouts")}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Weekly Payout Card */}
          <Card>
            <CardHeader>
              <CardTitle>This Week's Payout</CardTitle>
              {data?.weekly && (
                <CardDescription>
                  {format(new Date(data.weekly.weekStart), "MMM d")} – {format(new Date(data.weekly.weekEnd), "MMM d, yyyy")}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse h-16 bg-muted rounded" />
              ) : data?.weekly ? (
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-primary">SAR {data.weekly.netPayout.toFixed(2)}</div>
                  <div className="text-sm text-muted-foreground">{data.weekly.paidPlayerCount} paid players this week</div>
                  <div className="text-sm text-muted-foreground">
                    Next payout: {format(new Date(data.weekly.nextPayoutDate), "EEEE, MMM d")}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* All-time stats */}
          <Card>
            <CardHeader><CardTitle>All-Time Stats</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse h-8 bg-muted rounded" />
              ) : (
                <div>
                  <div className="text-2xl font-bold">SAR {data?.allTimeGross?.toFixed(2)}</div>
                  <div className="text-sm text-muted-foreground">Total gross collected</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bank Details */}
          <Card>
            <CardHeader>
              <CardTitle>Bank Details</CardTitle>
              <CardDescription>Your payout will be transferred to this account every Sunday.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveBank} className="space-y-4">
                <div>
                  <Label>Account Holder Name</Label>
                  <Input
                    required
                    value={bankForm.accountHolder}
                    onChange={(e) => setBankForm({ ...bankForm, accountHolder: e.target.value })}
                    placeholder="Full name as it appears on bank account"
                  />
                </div>
                <div>
                  <Label>IBAN</Label>
                  <Input
                    required
                    minLength={10}
                    value={bankForm.iban}
                    onChange={(e) => setBankForm({ ...bankForm, iban: e.target.value })}
                    placeholder="SA0000000000000000000000"
                  />
                </div>
                <div>
                  <Label>Bank Name (optional)</Label>
                  <Input
                    value={bankForm.bankName}
                    onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                    placeholder="Al Rajhi Bank, SNB, etc."
                  />
                </div>
                <div>
                  <Label>SWIFT Code (optional)</Label>
                  <Input
                    value={bankForm.swift}
                    onChange={(e) => setBankForm({ ...bankForm, swift: e.target.value })}
                    placeholder="RJHISARI"
                  />
                </div>
                <Button type="submit" disabled={saveDetails.isPending}>
                  {saveDetails.isPending ? "Saving..." : "Save Bank Details"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Games Sidebar */}
        <div>
          <Card>
            <CardHeader><CardTitle>Upcoming Games</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="animate-pulse h-12 bg-muted rounded" />)}</div>
              ) : data?.upcomingGames.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming games.</p>
              ) : (
                <div className="space-y-3">
                  {data?.upcomingGames.map((game) => (
                    <div key={game.id} className="border-b pb-3 last:border-0 last:pb-0">
                      <div className="font-medium text-sm">{game.title}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(game.kickoffTime), "MMM d, h:mm a")}</div>
                      <div className="text-xs text-muted-foreground">{game.bookedCount}/{game.capacity} players</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
