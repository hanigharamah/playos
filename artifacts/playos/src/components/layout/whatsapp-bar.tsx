import { useGetSettings } from "@/lib/supabase-api";
import { useI18n } from "@/lib/i18n";
import { MessageCircle } from "lucide-react";

/**
 * Persistent top bar inviting players to join the operator's WhatsApp group.
 * Always visible — games are coordinated there.
 */
export function WhatsAppBar() {
  const { data: settings } = useGetSettings();
  const { language } = useI18n();
  const isAr = language === "ar";

  const url = settings?.whatsappUrl;
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      style={{ background: "#25D366" }}
    >
      <MessageCircle className="h-4 w-4 flex-shrink-0" />
      <span>
        {isAr ? "انضم لمجموعة الواتساب لإدارة المباريات" : "Join our WhatsApp group to get game updates"}
      </span>
      <span className="hidden sm:inline opacity-80">→</span>
    </a>
  );
}
