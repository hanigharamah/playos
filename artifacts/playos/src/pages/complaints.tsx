import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Shield, CheckCircle } from "lucide-react";

export default function Complaints() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Complaint Policy</h1>
      <p className="text-muted-foreground mb-8">How we handle disputes and complaints at PlayOS.</p>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>24-Hour Response SLA</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            All complaints received through our official channels will receive an initial response within 24 hours during business days
            (Saturday–Thursday, 9:00 AM – 6:00 PM AST).
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>How to File a Complaint</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Email us at <a href="mailto:complaints@playos.sa" className="text-primary">complaints@playos.sa</a></li>
              <li>Include your name, phone number, and booking/game ID</li>
              <li>Describe the issue clearly with any relevant details</li>
              <li>Our team will investigate and respond within 24 hours</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <CheckCircle className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Resolution Process</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p className="mb-3">Our team will:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Acknowledge your complaint within 24 hours</li>
              <li>Investigate the issue within 48 hours</li>
              <li>Provide a resolution or status update within 5 business days</li>
              <li>Process any approved refunds within 7-14 business days</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
