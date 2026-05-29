import { useState, useEffect } from "react";
import { useCreateGame, useListPitches, getGetDashboardGamesQueryKey } from "@/lib/supabase-api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, addMinutes, parse, isValid } from "date-fns";
import { Globe, Lock } from "lucide-react";

interface CreateGameModalProps {
  open: boolean;
  onClose: () => void;
  defaultDate: Date;
  defaultStartTime: string;
  defaultEndTime: string;
  activePitchName?: string | null;
}

const LS_PRICE_KEY = "playos_default_price";
const LS_CAPACITY_KEY = "playos_default_capacity";

function snapTo30Min(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const snapped = m < 30 ? 0 : 30;
  return `${String(h).padStart(2, "0")}:${String(snapped).padStart(2, "0")}`;
}

export function CreateGameModal({
  open,
  onClose,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  activePitchName,
}: CreateGameModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pitches } = useListPitches();
  const createGame = useCreateGame();

  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const [isPublic, setIsPublic] = useState(true);
  const [pitchName, setPitchName] = useState(activePitchName || "");
  const [capacity, setCapacity] = useState<number>(() => {
    const saved = localStorage.getItem(LS_CAPACITY_KEY);
    return saved ? parseInt(saved) : 10;
  });
  const [price, setPrice] = useState<number>(() => {
    const saved = localStorage.getItem(LS_PRICE_KEY);
    return saved ? parseFloat(saved) : 50;
  });
  const [autoCancelHours, setAutoCancelHours] = useState(4);

  useEffect(() => {
    setStartTime(defaultStartTime);
    setEndTime(defaultEndTime);
    setPitchName(activePitchName || (pitches && pitches.length > 0 ? pitches[0].name : ""));
  }, [defaultStartTime, defaultEndTime, activePitchName, pitches, open]);

  useEffect(() => {
    if (pitches && pitches.length === 1 && !activePitchName) {
      setPitchName(pitches[0].name);
    }
  }, [pitches, activePitchName]);

  const durationMinutes = (() => {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const startMins = sh * 60 + sm;
    let endMins = eh * 60 + em;
    if (endMins <= startMins) endMins += 24 * 60;
    return endMins - startMins;
  })();

  const kickoffDatetime = (() => {
    const [h, m] = startTime.split(":").map(Number);
    const d = new Date(defaultDate);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pitchName.trim()) {
      toast({ title: "Error", description: "Please select a pitch", variant: "destructive" });
      return;
    }
    const cap = Math.max(6, Math.min(22, Math.round(capacity / 2) * 2));
    localStorage.setItem(LS_PRICE_KEY, String(price));
    localStorage.setItem(LS_CAPACITY_KEY, String(cap));

    createGame.mutate(
      {
        data: {
          title: title || `Game – ${format(defaultDate, "MMM d")}`,
          pitchName,
          locationText: null,
          kickoffTime: kickoffDatetime,
          price,
          capacity: cap,
          autoCancelHours,
          durationMinutes,
          isPublic,
          mapsUrl: null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDashboardGamesQueryKey() });
          toast({ title: "Game Created!", description: "Your game has been added to the calendar." });
          onClose();
          setTitle("");
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err?.data?.error || "Failed to create game", variant: "destructive" });
        },
      }
    );
  };

  const showPitchDropdown = !activePitchName && pitches && pitches.length > 1;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm w-full">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">New Game</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {format(defaultDate, "EEEE, d MMMM")}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Title */}
          <div>
            <Label htmlFor="modal-title">Title</Label>
            <Input
              id="modal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Game – ${format(defaultDate, "MMM d")}`}
              autoFocus
            />
          </div>

          {/* Time range */}
          <div>
            <Label>Time</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="time"
                step={1800}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="flex-1"
              />
              <span className="text-muted-foreground text-sm">→</span>
              <Input
                type="time"
                step={1800}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {durationMinutes >= 60
                ? `${Math.floor(durationMinutes / 60)}h${durationMinutes % 60 > 0 ? ` ${durationMinutes % 60}m` : ""}`
                : `${durationMinutes}m`}
              {" · "}Time zone · Riyadh
            </p>
          </div>

          {/* Visibility */}
          <div>
            <Label>Visibility</Label>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md border text-sm font-medium transition-colors ${
                  isPublic ? "bg-blue-600 text-white border-blue-600" : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                Public
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md border text-sm font-medium transition-colors ${
                  !isPublic ? "bg-blue-600 text-white border-blue-600" : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <Lock className="h-3.5 w-3.5" />
                Private
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isPublic ? "Visible in Available Games" : "Link only"}
            </p>
          </div>

          {/* Pitch (only if multiple pitches and no filter active) */}
          {showPitchDropdown && (
            <div>
              <Label>Pitch</Label>
              <Select value={pitchName} onValueChange={setPitchName}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select pitch" />
                </SelectTrigger>
                <SelectContent>
                  {pitches?.map((p) => (
                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Single pitch — show as text */}
          {!showPitchDropdown && (activePitchName || (pitches && pitches.length === 1)) && (
            <div>
              <Label>Pitch</Label>
              <Input value={pitchName} onChange={(e) => setPitchName(e.target.value)} placeholder="Pitch name" className="mt-1" />
            </div>
          )}

          {/* Players + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Players (max)</Label>
              <Input
                type="number"
                min={6}
                max={22}
                step={2}
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value) || 10)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Price (SAR)</Label>
              <Input
                type="number"
                min={1}
                step={5}
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 50)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Auto-cancel */}
          <div>
            <Label>Auto-cancel hours before kickoff</Label>
            <Input
              type="number"
              min={1}
              max={24}
              value={autoCancelHours}
              onChange={(e) => setAutoCancelHours(parseInt(e.target.value) || 4)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              The game will be cancelled if all spots aren't taken by this time
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={createGame.isPending}>
              {createGame.isPending ? "Creating..." : "Create Game"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
