import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateGame, useListPitches, getListGamesQueryKey } from "@/lib/supabase-api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function CreateGame() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pitches } = useListPitches();
  const createGame = useCreateGame();

  const [form, setForm] = useState({
    title: "",
    pitchName: "",
    locationText: "",
    kickoffTime: "",
    price: 50,
    capacity: 10,
    autoCancelHours: 4,
    durationMinutes: 60,
    isPublic: true,
    mapsUrl: "",
  });

  if (!user || user.role !== "organiser") {
    setLocation("/host/login");
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (form.capacity % 2 !== 0) {
      toast({ title: "Error", description: "Capacity must be an even number", variant: "destructive" });
      return;
    }

    createGame.mutate(
      {
        data: {
          title: form.title,
          pitchName: form.pitchName,
          locationText: form.locationText || null,
          kickoffTime: form.kickoffTime,
          price: form.price,
          capacity: form.capacity,
          autoCancelHours: form.autoCancelHours,
          durationMinutes: form.durationMinutes,
          isPublic: form.isPublic,
          mapsUrl: form.mapsUrl || null,
        },
      },
      {
        onSuccess: (game) => {
          queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
          toast({ title: "Game Created!", description: "Your game is now live." });
          setLocation(`/game/${game.id}/manage`);
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err?.data?.error || "Failed to create game", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t("dash.new_game")}</h1>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label>Title (2-80 chars)</Label>
              <Input
                required
                minLength={2}
                maxLength={80}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Friday Night Ballers"
                data-testid="input-game-title"
              />
            </div>

            {pitches && pitches.length > 0 ? (
              <div>
                <Label>Pitch</Label>
                <Select value={form.pitchName} onValueChange={(v) => setForm({ ...form, pitchName: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a pitch" />
                  </SelectTrigger>
                  <SelectContent>
                    {pitches.map((p) => (
                      <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                    ))}
                    <SelectItem value="__custom">Custom pitch name...</SelectItem>
                  </SelectContent>
                </Select>
                {form.pitchName === "__custom" && (
                  <Input
                    className="mt-2"
                    placeholder="Enter pitch name"
                    onChange={(e) => setForm({ ...form, pitchName: e.target.value })}
                  />
                )}
              </div>
            ) : (
              <div>
                <Label>Pitch Name</Label>
                <Input
                  required
                  value={form.pitchName}
                  onChange={(e) => setForm({ ...form, pitchName: e.target.value })}
                  placeholder="Al Noor Football Complex"
                />
              </div>
            )}

            <div>
              <Label>Location / Address (optional)</Label>
              <Input
                value={form.locationText}
                onChange={(e) => setForm({ ...form, locationText: e.target.value })}
                placeholder="Riyadh, Al Nakheel District"
              />
            </div>

            <div>
              <Label>Google Maps URL (optional)</Label>
              <Input
                type="url"
                value={form.mapsUrl}
                onChange={(e) => setForm({ ...form, mapsUrl: e.target.value })}
                placeholder="https://maps.google.com/?q=..."
              />
            </div>

            <div>
              <Label>Kickoff Time</Label>
              <Input
                type="datetime-local"
                required
                value={form.kickoffTime}
                onChange={(e) => setForm({ ...form, kickoffTime: e.target.value })}
                data-testid="input-kickoff-time"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price per player (SAR)</Label>
                <Input
                  type="number"
                  required
                  min={1}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label>Max Players (6-22, even)</Label>
                <Input
                  type="number"
                  required
                  min={6}
                  max={22}
                  step={2}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) })}
                  data-testid="input-capacity"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Auto-cancel if not full (hours before)</Label>
                <Input
                  type="number"
                  min={1}
                  max={72}
                  value={form.autoCancelHours}
                  onChange={(e) => setForm({ ...form, autoCancelHours: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  min={30}
                  max={180}
                  step={15}
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="isPublic"
                checked={form.isPublic}
                onCheckedChange={(v) => setForm({ ...form, isPublic: v })}
              />
              <Label htmlFor="isPublic">
                {form.isPublic ? "Public (visible to everyone)" : "Private (link only)"}
              </Label>
            </div>

            <Button type="submit" className="w-full" disabled={createGame.isPending} data-testid="button-create-game">
              {createGame.isPending ? "Creating..." : "Create Game"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
