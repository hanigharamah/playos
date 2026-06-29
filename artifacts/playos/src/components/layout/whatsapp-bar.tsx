import { useGetSettings } from "@/lib/supabase-api";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_SETTINGS } from "@/lib/config";
import { MessageCircle } from "lucide-react";

/**
 * Full-width WhatsApp-green bar above the header, always visible, inviting
 * players to join the group. Uses the operator-configured link, falling back
 * to the build-time default.
 */
export function WhatsAppBar() {
  const { data: settings } = useGetSettings();
  const { language } = useI18n();
  const isAr = language === "ar";

  const url = (settings?.whatsappUrl || DEFAULT_SETTINGS.whatsappUrl || "").trim();

  return (
    <a
      href={url || "#"}
      target={url ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="flex w-full items-center justify-center gap-2 px-4 py-2.5 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
      style={{ background: "#25D366" }}
    >
      <MessageCircle className="h-4 w-4 flex-shrink-0" />
      <span>
        {isAr
          ? "انضم إلى مجموعتنا على واتساب لحجز المباريات وآخر التحديثات"
          : "Join our WhatsApp group to book games & get the latest updates"}
      </span>
      <span className="underline underline-offset-2">
        {isAr ? "انضم الآن ←" : "Join now →"}
      </span>
    </a>
  );
}
