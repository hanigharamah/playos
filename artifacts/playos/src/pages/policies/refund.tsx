import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
              <div className="text-sm text-muted-foreground">Partial refund to original payment method</div>
            </div>
            <Badge variant="secondary" className="shrink-0 bg-yellow-100 text-yellow-800 hover:bg-yellow-200">50% Refund</Badge>
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
            Refunds will be made onto the original mode of payment and will be processed within <strong>10 to 45 days</strong> depending on the issuing bank of the credit card.
          </p>
          <p>
            If no cancellation or refund is applicable (e.g. less than 6 hours before kickoff for player cancellations), this will be clearly communicated to the cardholder before the purchase decision is made.
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
            <li>The player requests cancellation within the eligible time window (more than 6 hours before kickoff)</li>
          </ul>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      <div className="text-sm text-muted-foreground space-y-2">
        <p>To request a cancellation or refund, contact us at <a href="mailto:hani.gharamah@evision-corp.org" className="text-primary hover:underline">hani.gharamah@evision-corp.org</a>.</p>
      </div>
    </div>
  );
}
