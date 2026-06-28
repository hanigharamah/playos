import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function RefundPolicy() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Refund &amp; Cancellation Policy</h1>
      <p className="text-muted-foreground mb-8 text-sm">Last updated: April 2026</p>

      {/* Player Cancellations */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Player Cancellations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 pb-4 border-b">
            <div>
              <div className="font-semibold">More than 12 hours before kickoff</div>
              <div className="text-sm text-muted-foreground">Full refund to original payment method</div>
            </div>
            <Badge variant="default" className="shrink-0 bg-green-500 hover:bg-green-600">100% Refund</Badge>
          </div>
          <div className="flex items-start justify-between gap-4 pb-4 border-b">
            <div>
              <div className="font-semibold">6 to 12 hours before kickoff</div>
              <div className="text-sm text-muted-foreground">1 credit token to use toward your next match</div>
            </div>
            <Badge variant="secondary" className="shrink-0 bg-yellow-100 text-yellow-800 hover:bg-yellow-200">1 Credit Token</Badge>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold">Less than 6 hours before kickoff</div>
              <div className="text-sm text-muted-foreground">No refund available</div>
            </div>
            <Badge variant="destructive" className="shrink-0">No Refund</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Host Cancellations */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Game Cancellations by Host</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 pb-4 border-b">
            <div>
              <div className="font-semibold">More than 12 hours before kickoff</div>
              <div className="text-sm text-muted-foreground">100% refund to all players. Host pays processing fees.</div>
            </div>
            <Badge className="shrink-0 bg-green-500 hover:bg-green-600">100% Refund</Badge>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold">12 hours or less before kickoff</div>
              <div className="text-sm text-muted-foreground">100% refund to all players. Host pays processing fees plus SAR 20 late cancellation penalty.</div>
            </div>
            <Badge className="shrink-0 bg-green-500 hover:bg-green-600">100% + Penalty</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Refund Processing */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Refund Processing</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <p>
            Cancellations are handled in the app. Full refunds are returned via your original payment method (STC Pay or cash). Credit tokens are added to your account instantly and can be applied at checkout on your next booking.
          </p>
          <p>
            If no refund or credit is applicable (e.g. less than 6 hours before kickoff), this is shown clearly before you confirm a booking.
          </p>
        </CardContent>
      </Card>

      {/* Conditions */}
      <Card>
        <CardHeader>
          <CardTitle>Conditions for Cancellation</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
            <li>The game was cancelled by the host</li>
            <li>The game was auto-cancelled due to insufficient players</li>
            <li>The player cancels within the eligible time window (more than 6 hours before kickoff)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
