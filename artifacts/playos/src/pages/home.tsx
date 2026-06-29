import { useI18n } from "@/lib/i18n";
import { useGetFeaturedGames } from "@/lib/supabase-api";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { format } from "date-fns";

export default function Home() {
  const { t, language } = useI18n();
  const { data: featuredGames, isLoading } = useGetFeaturedGames();
  const getPath = (path: string) => (language === "ar" ? `/ar${path}` : path);

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
          <p className="font-hand text-2xl sm:text-3xl mb-3" style={{ color: "#FF9F0A" }}>
            {language === "ar" ? "يلا نلعب" : "yalla, let's play"}
          </p>
          <h1
            className="font-extrabold tracking-tight mb-5 max-w-3xl mx-auto"
            style={{ color: "#1D3557", fontSize: "clamp(1.5rem, 6vw, 3.75rem)", lineHeight: 1.12 }}
          >
            {t("hero.title")}
          </h1>
          <p className="text-base sm:text-xl text-[#4A5568] mb-9 max-w-2xl mx-auto text-balance">
            {t("hero.subtitle")}
          </p>
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
              <Card key={game.id} className="flex flex-col overflow-hidden hover:border-primary/50 transition-colors">
                <div className="bg-muted p-4 border-b flex justify-between items-start">
                  <Badge variant={game.status === "open" ? "default" : "secondary"}>
                    {game.status === "open" ? (language === "ar" ? "مفتوح" : "Open") : t("games.full")}
                  </Badge>
                  <div className="text-lg font-bold">
                    {t("game.price")} {game.price}
                  </div>
                </div>
                <CardHeader>
                  <CardTitle className="line-clamp-1">{game.title}</CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span className="line-clamp-1">{game.pitchName}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-3 text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      <span>{format(new Date(game.kickoffTime), "MMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{format(new Date(game.kickoffTime), "h:mm a")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>
                      {game.capacity - game.bookedCount} {t("games.spots_left")} ({game.capacity} {language === "ar" ? "العدد الإجمالي" : "total"})
                    </span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" asChild disabled={game.status === "full"}>
                    <Link href={getPath(`/game/${game.id}`)}>
                      {t("games.book")}
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
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
