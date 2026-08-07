import { useRoute } from "wouter";
import { Link } from "wouter";
import { format } from "date-fns";
import { Apple, Smartphone, Bell, CheckCircle2, Users } from "lucide-react";
import { useGetGame } from "@/lib/supabase-api";
import { useI18n } from "@/lib/i18n";
import { IOS_APP_URL, ANDROID_APP_URL } from "@/lib/config";

/**
 * "Get the app" — where a game CTA lands when APP_GATE is on.
 *
 * NOT a generic download page. It names the game the player just tapped —
 * venue, kickoff, price, spots left — because a contextual install prompt
 * converts materially better than a blank one: interstitials that reference
 * the specific thing the user wanted run around 5-12% tap-through against
 * 2-5% for generic prompts. "Install our app" asks for a favour; "your 9pm at
 * Al Rowad is in the app" continues something they already started.
 *
 * The game id is carried in the URL (/get-app/:id) rather than dropped. It
 * costs nothing now and it is the hook for deferred deep linking later —
 * carrying the game THROUGH the store round trip so the app opens on it
 * instead of a home screen, which is worth another 20-40% on web-to-app
 * conversion. That needs an attribution SDK (Branch/AppsFlyer/Adjust) because
 * the App Store trip loses local state, so it is deliberately not built yet:
 * an SDK and an account are not worth it before there are any users.
 */
export default function GetApp() {
  const [, params] = useRoute("/get-app/:id");
  const [, arParams] = useRoute("/ar/get-app/:id");
  const gameId = params?.id ?? arParams?.id ?? null;

  const { language } = useI18n();
  const ar = language === "ar";
  const getPath = (p: string) => (ar ? `/ar${p}` : p);

  const { data: game } = useGetGame(gameId ?? "");

  const spotsLeft = game ? Math.max(0, game.capacity - game.bookedCount) : null;
  const kickoff = game ? new Date(game.kickoffTime) : null;

  const benefits = ar
    ? [
        { icon: Bell, text: "تذكير قبل ٢٠ دقيقة من انطلاق مبارياتك" },
        { icon: CheckCircle2, text: "تسجيل الحضور من جوالك عند الوصول" },
        { icon: Users, text: "شاهد من انضم قبل أن تحجز" },
      ]
    : [
        { icon: Bell, text: "A reminder 20 minutes before every game you book" },
        { icon: CheckCircle2, text: "Check in from your phone when you arrive" },
        { icon: Users, text: "See who else is playing before you book" },
      ];

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-1" style={{ color: "#1D3557" }}>
        {ar ? "احجز من التطبيق" : "Book this in the app"}
      </h1>
      <p className="text-sm text-[#6C6C70] mb-6">
        {ar
          ? "الحجز صار داخل تطبيق PlayOS — مع التذكيرات وتسجيل الحضور."
          : "Booking now happens in the PlayOS app — with reminders and check-in."}
      </p>

      {/* The game they tapped. Absent while loading rather than a skeleton the
          size of a card: this page is short, and a placeholder that big is
          more distracting than a beat of nothing. */}
      {game && kickoff && (
        <div className="card-ios p-4 mb-6">
          <div className="font-semibold text-[#1C1C1E]">
            {Math.floor(game.capacity / 2)}v{Math.floor(game.capacity / 2)} · {game.pitchName}
          </div>
          <div className="text-sm text-[#6C6C70] mt-1">
            {format(kickoff, "EEEE d MMM")} · {format(kickoff, "h:mm a").toLowerCase()}
          </div>
          <div className="text-sm mt-2 flex items-center gap-3">
            <span className="font-semibold" style={{ color: "#1D3557" }}>
              SAR {game.price}
            </span>
            {spotsLeft !== null && spotsLeft > 0 && (
              <span className="text-[#6C6C70]">
                {ar ? `${spotsLeft} مقاعد متبقية` : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`}
              </span>
            )}
          </div>
        </div>
      )}

      <ul className="space-y-3 mb-7">
        {benefits.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3">
            <Icon size={18} className="mt-0.5 shrink-0" style={{ color: "#FF8A00" }} />
            <span className="text-sm text-[#3A3A3C]">{text}</span>
          </li>
        ))}
      </ul>

      {/* A store button only renders once that store has a listing. An empty
          href is a dead tap, and a dead tap on the one CTA is worse than one
          fewer button. */}
      <div className="space-y-3">
        {IOS_APP_URL && (
          <a
            href={IOS_APP_URL}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-white"
            style={{ background: "#1D3557" }}
          >
            <Apple size={18} />
            {ar ? "تحميل على iPhone" : "Download for iPhone"}
          </a>
        )}
        {ANDROID_APP_URL && (
          <a
            href={ANDROID_APP_URL}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-white"
            style={{ background: "#1D3557" }}
          >
            <Smartphone size={18} />
            {ar ? "تحميل على Android" : "Download for Android"}
          </a>
        )}
        {!IOS_APP_URL && !ANDROID_APP_URL && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#FFF0E0", color: "#A85A00" }}>
            {ar
              ? "التطبيق على وشك الإطلاق. تواصل معنا لحجز مكانك."
              : "The app is launching shortly. Message us to hold your spot."}
          </div>
        )}
      </div>

      <div className="mt-6 text-center">
        <Link href={getPath("/games")}>
          <span className="text-sm text-[#6C6C70] underline cursor-pointer">
            {ar ? "العودة إلى المباريات" : "back to games"}
          </span>
        </Link>
      </div>
    </div>
  );
}
