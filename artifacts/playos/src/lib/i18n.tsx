import { createContext, useContext, ReactNode } from "react";
import { useLocation } from "wouter";

type Language = "en" | "ar";

interface I18nContextType {
  language: Language;
  t: (key: string) => string;
  toggleLanguage: () => void;
  dir: "ltr" | "rtl";
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    "nav.games": "Browse Games",
    "nav.host": "List Your Pitch",
    "nav.login": "Sign In",
    "nav.dashboard": "Dashboard",
    "hero.title": "Find and book football games near you",
    "hero.subtitle": "Join the biggest community of amateur footballers in Saudi Arabia.",
    "hero.cta": "Browse Games",
    "hero.host_cta": "List Your Pitch",
    "games.title": "Upcoming Games",
    "games.spots_left": "spots left",
    "games.full": "Full",
    "games.book": "Book Spot",
    "game.price": "SAR",
    "game.book_spot": "Book Spot",
    "game.team1": "Team 1",
    "game.team2": "Team 2",
    "game.full": "Game Full",
    "game.share": "Share",
    "game.manage": "Manage",
    "auth.login": "Sign In",
    "auth.signup": "Sign Up",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.name": "Name",
    "auth.phone": "Phone (e.g. 05xxxxxxxx)",
    "host.apply": "Apply as Host",
    "host.login": "Host Login",
    "host.pitch_name": "Pitch Name",
    "host.city": "City",
    "dash.title": "Dashboard",
    "dash.payouts": "Payouts",
    "dash.new_game": "Create Game",
  },
  ar: {
    "nav.games": "تصفح المباريات",
    "nav.host": "سجل ملعبك",
    "nav.login": "تسجيل الدخول",
    "nav.dashboard": "لوحة التحكم",
    "hero.title": "ابحث واحجز مباريات كرة قدم بالقرب منك",
    "hero.subtitle": "انضم إلى أكبر مجتمع للاعبي كرة القدم الهواة في السعودية.",
    "hero.cta": "تصفح المباريات",
    "hero.host_cta": "سجل ملعبك",
    "games.title": "المباريات القادمة",
    "games.spots_left": "مقاعد متبقية",
    "games.full": "مكتمل",
    "games.book": "احجز مقعد",
    "game.price": "ر.س",
    "game.book_spot": "احجز مقعد",
    "game.team1": "فريق 1",
    "game.team2": "فريق 2",
    "game.full": "المباراة مكتملة",
    "game.share": "مشاركة",
    "game.manage": "إدارة",
    "auth.login": "تسجيل الدخول",
    "auth.signup": "حساب جديد",
    "auth.email": "البريد الإلكتروني",
    "auth.password": "كلمة المرور",
    "auth.name": "الاسم",
    "auth.phone": "رقم الجوال",
    "host.apply": "سجل كمنظم",
    "host.login": "دخول المنظمين",
    "host.pitch_name": "اسم الملعب",
    "host.city": "المدينة",
    "dash.title": "لوحة التحكم",
    "dash.payouts": "المدفوعات",
    "dash.new_game": "لعبة جديدة",
  },
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const isArabic = location.startsWith("/ar");
  const language: Language = isArabic ? "ar" : "en";

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  const toggleLanguage = () => {
    if (isArabic) {
      setLocation(location.replace(/^\/ar/, "") || "/");
    } else {
      setLocation("/ar" + (location === "/" ? "" : location));
    }
  };

  return (
    <I18nContext.Provider
      value={{
        language,
        t,
        toggleLanguage,
        dir: isArabic ? "rtl" : "ltr",
      }}
    >
      <div dir={isArabic ? "rtl" : "ltr"} className={isArabic ? "font-sans font-arabic" : "font-sans"}>
        {children}
      </div>
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
