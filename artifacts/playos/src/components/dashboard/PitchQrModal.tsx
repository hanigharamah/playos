import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Download, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  pitch: { id: string; name: string };
  open: boolean;
  onClose: () => void;
}

export function PitchQrModal({ pitch, open, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  const checkInUrl = (() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const origin = window.location.origin;
    return `${origin}${base}/checkin/${pitch.id}`;
  })();

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(checkInUrl, {
      width: 400,
      margin: 2,
      color: { dark: "#1D3557", light: "#ffffff" },
      errorCorrectionLevel: "H",
    }).then(setDataUrl);
  }, [open, checkInUrl]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-checkin-${pitch.name.toLowerCase().replace(/\s+/g, "-")}.png`;
    a.click();
  };

  const handlePrint = () => {
    if (!dataUrl) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code – ${pitch.name}</title>
          <style>
            body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui, sans-serif; }
            img { width: 300px; height: 300px; }
            h2 { font-size: 22px; font-weight: bold; margin: 20px 0 8px; }
            p { color: #555; font-size: 14px; margin: 0; }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" alt="QR Code" />
          <h2>${pitch.name}</h2>
          <p>Scan with your phone camera to check in</p>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Check-in QR — {pitch.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {dataUrl ? (
            <img src={dataUrl} alt={`QR code for ${pitch.name}`} className="w-56 h-56 rounded-lg border shadow-sm" />
          ) : (
            <div className="w-56 h-56 bg-muted rounded-lg animate-pulse" />
          )}

          <div className="text-center space-y-1">
            <p className="text-sm font-medium">Print this and display it at your pitch entrance</p>
            <p className="text-xs text-muted-foreground break-all">{checkInUrl}</p>
          </div>

          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={handleDownload} disabled={!dataUrl}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button className="flex-1" onClick={handlePrint} disabled={!dataUrl}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
