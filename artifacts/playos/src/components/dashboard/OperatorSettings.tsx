import { useEffect, useState } from "react";
import { useGetSettings, useUpdateSettings, type AppSettings } from "@/lib/supabase-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export function OperatorSettings() {
  const { data, isLoading } = useGetSettings();
  const update = useUpdateSettings();
  const { toast } = useToast();

  const [form, setForm] = useState<AppSettings | null>(null);
  useEffect(() => { if (data && !form) setForm(data); }, [data]);

  if (isLoading || !form) {
    return <div className="p-8 text-center text-muted-foreground">Loading settings…</div>;
  }

  const set = (patch: Partial<AppSettings>) => setForm({ ...form, ...patch });

  const save = () => {
    update.mutate(
      { data: form },
      {
        onSuccess: () => toast({ title: "Saved", description: "Settings updated." }),
        onError: (err: any) =>
          toast({ title: "Error", description: err?.message || "Could not save", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Booking fee</CardTitle>
          <CardDescription>The fixed amount every player pays to book a spot.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">SAR</span>
            <Input
              type="number"
              min={0}
              value={form.bookingFee}
              onChange={(e) => set({ bookingFee: Number(e.target.value) })}
              className="max-w-[140px]"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">STC Pay</CardTitle>
          <CardDescription>Shown to players at checkout and used for "Send STC Pay link".</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="stc-number">STC Pay number</Label>
            <Input
              id="stc-number"
              value={form.stcpayNumber}
              onChange={(e) => set({ stcpayNumber: e.target.value })}
              placeholder="05XXXXXXXX"
            />
          </div>
          <div>
            <Label htmlFor="stc-link">STC Pay payment link (optional)</Label>
            <Input
              id="stc-link"
              value={form.stcpayLink}
              onChange={(e) => set({ stcpayLink: e.target.value })}
              placeholder="https://qr.stcpay.com.sa/…"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">WhatsApp group</CardTitle>
          <CardDescription>Invite link for the top bar and checkout.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={form.whatsappUrl}
            onChange={(e) => set({ whatsappUrl: e.target.value })}
            placeholder="https://chat.whatsapp.com/…"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pitch guidelines</CardTitle>
          <CardDescription>One rule per line. Shown on every game page.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={6}
            value={form.guidelines}
            onChange={(e) => set({ guidelines: e.target.value })}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end pb-8">
        <Button onClick={save} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
