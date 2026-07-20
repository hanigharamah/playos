import { useI18n } from "@/lib/i18n";
import { useGetFeaturedGames } from "@/lib/supabase-api";
import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GameCard } from "@/components/GameCard";
import { MapPin, Users, ShieldCheck, ChevronDown, ArrowRight } from "lucide-react";

function SoccerIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#4C4C56" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" />
      <polygon points="12,6.5 15.2,8.8 14.0,12.4 10.0,12.4 8.8,8.8" />
      <line x1="12"   y1="6.5"  x2="12"   y2="2.5" />
      <line x1="15.2" y1="8.8"  x2="19.2" y2="6.2" />
      <line x1="14.0" y1="12.4" x2="17.4" y2="16.0" />
      <line x1="10.0" y1="12.4" x2="6.6"  y2="16.0" />
      <line x1="8.8"  y1="8.8"  x2="4.8"  y2="6.2" />
    </svg>
  );
}

export default function Home() {
  const { t, language } = useI18n();
  const { data: featuredGamesRaw, isLoading } = useGetFeaturedGames();
  const getPath = (path: string) => (language === "ar" ? `/ar${path}` : path);

  const featuredGames = featuredGamesRaw?.filter((g) => g.bookedCount < g.capacity);

  const isAr = language === "ar";

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="home-hero relative flex flex-col items-center justify-center overflow-hidden">
        {/* Background video */}
        <video
          className="hero-video absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster="/hero-bg-poster.jpg"
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>

        {/* Dark overlay so text pops on night-time pitch */}
        <div className="home-hero-overlay absolute inset-0 pointer-events-none" />

        <div className="home-hero-content container mx-auto px-4 relative z-10 text-center flex flex-col items-center">
          <h1 className="home-hero-title font-hand">
            {t("hero.title")}
          </h1>

          {/* Trust badge row — dark glass, icon + title/subtitle + dividers */}
          <div className="hero-badge-row">
            <div className="hero-badge-item">
              <MapPin size={22} strokeWidth={1.5} />
              <div>
                <div className="hero-badge-title">{isAr ? "قريب منك"       : "Near you"}</div>
                <div className="hero-badge-sub">{isAr ? "ألعاب قريبة"      : "Games close by"}</div>
              </div>
            </div>
            <div className="hero-badge-divider" />
            <div className="hero-badge-item">
              <Users size={22} strokeWidth={1.5} />
              <div>
                <div className="hero-badge-title">{isAr ? "جميع المستويات" : "All levels"}</div>
                <div className="hero-badge-sub">{isAr ? "الجميع مرحب به"   : "Everyone's welcome"}</div>
              </div>
            </div>
            <div className="hero-badge-divider" />
            <div className="hero-badge-item">
              <ShieldCheck size={22} strokeWidth={1.5} />
              <div>
                <div className="hero-badge-title">{isAr ? "آمن وموثوق"     : "Safe & trusted"}</div>
                <div className="hero-badge-sub">{isAr ? "ملاعب معتمدة"     : "Verified venues"}</div>
              </div>
            </div>
          </div>

          {/* Hero CTA — neon gradient underglow below the pill */}
          <div className="hero-cta-row flex justify-center">
            <div className="hero-cta-wrap">
              <div className="hero-neon-glow" />
              <Link href={getPath("/games")} className="btn-pill btn-pill-hero">
                <span className="hero-pill-icon"><SoccerIcon size={22} /></span>
                {t("hero.cta")}
                <span className="hero-pill-arrow">
                  <ArrowRight size={16} strokeWidth={2} />
                </span>
              </Link>
            </div>
          </div>

          {/* Scroll chevron */}
          <div className="hero-chevron" aria-hidden="true">
            <ChevronDown size={22} strokeWidth={1.5} />
          </div>
        </div>
      </section>

      {/* Featured Games Section */}
      <section className="py-12 sm:py-16 container mx-auto px-4">
        <div className="flex justify-between items-end mb-6 sm:mb-8 gap-4">
          <div>
            <p className="font-hand text-xl sm:text-2xl leading-none" style={{ color: "#FF9F0A" }}>
              {language === "ar" ? "قادمة قريباً" : "coming up"}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {language === "ar" ? "مباريات مميزة" : "Featured Games"}
            </h2>
          </div>
          <Link
            href={getPath("/games")}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {language === "ar" ? "عرض الكل" : "View All"}
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-24 bg-muted rounded-t-lg" />
                <CardContent className="p-6 space-y-4">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : featuredGames && featuredGames.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                getPath={getPath}
                bookLabel={t("games.book")}
                fullLabel={t("games.full")}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/50 rounded-lg">
            <p className="text-muted-foreground">
              {language === "ar" ? "لا توجد مباريات مميزة حالياً." : "No featured games right now."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
