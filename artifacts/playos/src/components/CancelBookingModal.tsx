import { useState } from "react";
import { useCancelBooking } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info } from "lucide-react";

interface CancelBookingModalProps {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  gameTitle: string;
  kickoffTime: Date;
  totalPaid: number;
  onCancelled?: () => void;
}

function getRefundTier(kickoffTime: Date, total: number) {
  const now = new Date();
  const hoursUntil = (kickoffTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntil > 12) {
    return {
      tier: "full" as const,
      message: `You will receive a 100% refund of SAR ${total.toFixed(2)}.`,
      severity: "info" as const,
    };
  } else if (hoursUntil >= 6) {
    const half = (total * 0.5).toFixed(2);
    const other = (total * 0.5).toFixed(2);
    return {
      tier: "half" as const,
      message: `You will receive a 50% refund of SAR ${half}. SAR ${other} will not be refunded.`,
      severity: "warn" as const,
    };
  } else {
    return {
      tier: "none" as const,
      message: `No refund is available. Your booking cannot be cancelled less than 6 hours before kickoff. You will not receive any refund.`,
      severity: "danger" as const,
    };
  }
}

export function CancelBookingModal({
  open,
  onClose,
  bookingId,
  gameTitle,
  kickoffTime,
  totalPaid,
  onCancelled,
}: CancelBookingModalProps) {
  const { toast } = useToast();
  const cancel = useCancelBooking();
  const refund = getRefundTier(kickoffTime, totalPaid);

  const handleConfirm = () => {
    cancel.mutate(
      { id: bookingId },
      {
        onSuccess: (data) => {
          toast({ title: "Booking cancelled", description: data.message });
          onClose();
          onCancelled?.();
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Could not cancel",
            description: err?.data?.error || err?.message || "Please try again.",
          });
        },
      }
    );
  };

  const bgColor =
    refund.severity === "danger"
      ? "bg-red-50 border-red-200"
      : refund.severity === "warn"
      ? "bg-yellow-50 border-yellow-200"
      : "bg-blue-50 border-blue-200";

  const textColor =
    refund.severity === "danger"
      ? "text-red-800"
      : refund.severity === "warn"
      ? "text-yellow-800"
      : "text-blue-800";

  const Icon = refund.severity === "danger" || refund.severity === "warn" ? AlertTriangle : Info;
  const iconColor =
    refund.severity === "danger"
      ? "text-red-500"
      : refund.severity === "warn"
      ? "text-yellow-500"
      : "text-blue-500";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancel Booking?</DialogTitle>
          <DialogDescription className="text-sm text-[#6C6C70]">
            {gameTitle}
          </DialogDescription>
        </DialogHeader>

        <div className={`flex gap-3 p-3 rounded-lg border ${bgColor}`}>
          <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${iconColor}`} />
          <p className={`text-sm leading-relaxed ${textColor}`}>{refund.message}</p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={cancel.isPending}
          >
            Keep My Spot
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleConfirm}
            disabled={cancel.isPending}
          >
            {cancel.isPending ? "Cancelling..." : "Cancel Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
