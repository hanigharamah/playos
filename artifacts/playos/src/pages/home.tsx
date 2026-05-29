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
      <section className="relative py-20 lg:py-32 overflow-hidden bg-primary/5">
        <div className="container mx-auto px-4 relative z-10 text-center">
          <Badge className="mb-4" variant="secondary">
            {language === "ar" ? "المنصة الأولى لكرة القدم في السعودية" : "The #1 Football Platform in KSA"}
          </Badge>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 max-w-3xl mx-auto text-foreground">
            {t("hero.title")}
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            {t("hero.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8" asChild>
              <Link href={getPath("/games")}>{t("hero.cta")}</Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8" asChild>
              <Link href={getPath("/host/login")}>{t("hero.host_cta")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Games Section */}
      <section className="py-16 container mx-auto px-4">
        <div className="flex justify-between items-end mb-8">
          <h2 className="text-3xl font-bold tracking-tight">
            {language === "ar" ? "مباريات مميزة" : "Featured Games"}
          </h2>
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
