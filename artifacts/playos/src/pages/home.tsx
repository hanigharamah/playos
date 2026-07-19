import { useI18n } from "@/lib/i18n";
import { useGetFeaturedGames } from "@/lib/supabase-api";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GameCard } from "@/components/GameCard";

export default function Home() {
  const { t, language } = useI18n();
  const { data: featuredGamesRaw, isLoading } = useGetFeaturedGames();
  const getPath = (path: string) => (language === "ar" ? `/ar${path}` : path);

  // A fully booked game has nothing to offer here — Featured is meant to
  // pull people toward games they can actually join.
  const featuredGames = featuredGamesRaw?.filter((g) => g.bookedCount < g.capacity);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-16 pb-24 sm:pt-20 lg:pt-28 lg:pb-36 overflow-hidden">
        {/* Background video — masked so its edges fade into the cream gradient */}
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

        {/* Soft centred light scrim for text legibility (transparent at edges) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 75% 55% at 50% 50%, rgba(251,247,242,0.32), rgba(251,247,242,0) 72%)",
          }}
        />

        <div className="container mx-auto px-4 relative z-10 text-center">
          <h1
            className="font-hand mb-9 max-w-3xl mx-auto"
            style={{ color: "#FF9F0A", fontSize: "clamp(2rem, 7vw, 4.5rem)", lineHeight: 1.12 }}
          >
            {t("hero.title")}
          </h1>
          <div className="flex justify-center">
            <Button size="lg" className="text-base sm:text-lg px-8" asChild>
              <Link href={getPath("/games")}>{t("hero.cta")}</Link>
            </Button>
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
          <Button variant="ghost" asChild>
            <Link href={getPath("/games")}>
              {language === "ar" ? "عرض الكل" : "View All"}
            </Link>
          </Button>
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
