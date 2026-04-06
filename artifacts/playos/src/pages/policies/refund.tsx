import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function RefundPolicy() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Refund Policy</h1>
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
              <div className="text-sm text-muted-foreground">Full refund to all booked players</div>
            </div>
            <Badge className="shrink-0 bg-green-500 hover:bg-green-600">100% Refund</Badge>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold">12 hours or less before kickoff</div>
              <div className="text-sm text-muted-foreground">Full refund to all players + SAR 20 late cancellation penalty charged to the host</div>
            </div>
            <Badge className="shrink-0 bg-green-500 hover:bg-green-600">100% + Penalty</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Cancellation */}
      <Card>
        <CardHeader>
          <CardTitle>Auto-Cancellation</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          <p>
            If a game does not reach its minimum capacity by the auto-cancel deadline set by the host, the game is automatically
            cancelled and all booked players receive a full 100% refund. No penalty is applied in this case.
          </p>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      <div className="text-sm text-muted-foreground space-y-2">
        <p>To request a cancellation or refund, please contact us at <a href="mailto:support@playos.sa" className="text-primary">support@playos.sa</a>.</p>
        <p>Refunds are processed within 7-14 business days after approval.</p>
      </div>
    </div>
  );
}
