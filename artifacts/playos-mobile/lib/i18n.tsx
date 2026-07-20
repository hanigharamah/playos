import { createContext, useContext, useState, type ReactNode } from "react";
import { I18nManager } from "react-native";

/**
 * Same key set and interface as ../playos/src/lib/i18n.tsx so translation
 * strings can be copy-pasted between web and mobile without reshaping.
 * RN's RTL is handled via I18nManager (requires an app restart to fully
 * mirror layout — acceptable for MVP; flag with a "restart to apply" toast
 * if this is wired to a live toggle).
 */
type Language = "en" | "ar";

interface I18nCtx {
  language: Language;
  t: (key: string) => string;
  toggleLanguage: () => void;
  dir: "ltr" | "rtl";
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    "nav.games": "Browse Games",
    "hero.title": "Find and book football games near you",
    "hero.cta": "Browse Games",
    "games.book": "Book Spot",
    "games.full": "Full",
    "game.book_spot": "Book Spot",
    "game.team1": "Team 1",
    "game.team2": "Team 2",
    "game.full": "Game Full",
    "game.share": "Share",
    "auth.login": "Sign In",
    "auth.signup": "Sign Up",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.name": "Name",
    "auth.phone": "Phone (e.g. 05xxxxxxxx)",
    "dash.new_game": "Create Game",
    "checkout.cash": "Cash at the pitch",
    "checkout.stcpay": "STC Pay",
    "checkout.reserved": "Spot reserved",
    "checkout.back_to_game": "Back to game",
    "checkout.join_whatsapp": "Join the WhatsApp group",
    "reminder.title": "Never miss kickoff",
    "reminder.subtitle": "We'll remind you 20 minutes before every game you book.",
    "reminder.cta": "Turn on reminders",
    "reminder.later": "Maybe later",
    "reminder.enabled": "Reminders are on",
    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.notifications": "Match reminders",
    "settings.signout": "Sign out",
  },
  ar: {
    "nav.games": "تصفح المباريات",
    "hero.title": "ابحث واحجز مباريات كرة قدم بالقرب منك",
    "hero.cta": "تصفح المباريات",
    "games.book": "احجز مقعد",
    "games.full": "مكتمل",
    "game.book_spot": "احجز مقعد",
    "game.team1": "فريق 1",
    "game.team2": "فريق 2",
    "game.full": "المباراة مكتملة",
    "game.share": "مشاركة",
    "auth.login": "تسجيل الدخول",
    "auth.signup": "حساب جديد",
    "auth.email": "البريد الإلكتروني",
    "auth.password": "كلمة المرور",
    "auth.name": "الاسم",
    "auth.phone": "رقم الجوال",
    "dash.new_game": "لعبة جديدة",
    "checkout.cash": "نقداً في الملعب",
    "checkout.stcpay": "STC Pay",
    "checkout.reserved": "تم تثبيت حجزك",
    "checkout.back_to_game": "العودة للمباراة",
    "checkout.join_whatsapp": "انضم لمجموعة الواتساب",
    "reminder.title": "لا تفوّت أي مباراة",
    "reminder.subtitle": "نذكّرك قبل ٢٠ دقيقة من بداية كل مباراة تحجزها.",
    "reminder.cta": "فعّل التذكيرات",
    "reminder.later": "ربما لاحقاً",
    "reminder.enabled": "تم تفعيل التذكيرات",
    "settings.title": "الإعدادات",
    "settings.language": "اللغة",
    "settings.notifications": "تذكيرات المباريات",
    "settings.signout": "تسجيل الخروج",
  },
};

const Ctx = createContext<I18nCtx | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  const t = (key: string) => translations[language][key] ?? key;
  const toggleLanguage = () => {
    const next = language === "en" ? "ar" : "en";
    setLanguage(next);
    // Full RTL mirroring needs I18nManager.forceRTL + app reload — leave as
    // a documented follow-up rather than silently no-op-ing the intent.
    I18nManager.allowRTL(next === "ar");
  };

  return (
    <Ctx.Provider value={{ language, t, toggleLanguage, dir: language === "ar" ? "rtl" : "ltr" }}>
      {children}
    </Ctx.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
