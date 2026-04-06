import { useLocation, Link } from "wouter";
import { useGetDashboardGames } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { CalendarDays, Users, Plus } from "lucide-react";

function getStatusColor(status: string, bookedCount: number, capacity: number): string {
  if (status === "cancelled") return "bg-gray-400";
  if (status === "full" || bookedCount >= capacity) return "bg-green-500";
  const pct = bookedCount / capacity;
  if (pct >= 0.5) return "bg-yellow-400";
  if (pct > 0) return "bg-orange-500";
  return "bg-red-500";
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useI18n();
  const { data, isLoading } = useGetDashboardGames();

  if (authLoading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  if (!user || user.role !== "organiser") {
    setLocation("/host/login");
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Tabs */}
      <div className="flex items-center justify-center mb-8">
        <Tabs value="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">{t("dash.title")}</TabsTrigger>
            <TabsTrigger value="payouts" asChild>
              <Link href="/dashboard/payouts" data-testid="tab-payouts">{t("dash.payouts")}</Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t("dash.title")}</h1>
        <Button asChild>
          <Link href="/game/new">
            <Plus className="h-4 w-4 mr-2" />
            {t("dash.new_game")}
          </Link>
        </Button>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{data.totalUpcoming}</div>
              <div className="text-sm text-muted-foreground">Upcoming Games</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{data.totalPast}</div>
              <div className="text-sm text-muted-foreground">Past Games</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Color Legend */}
      <div className="flex flex-wrap gap-3 mb-6 p-3 bg-muted/30 rounded-lg text-sm">
        <span className="font-medium">Status:</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Full</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> 50%+ filled</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> Less than 50%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Empty</span>
      </div>

      {/* Upcoming Games */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Upcoming Games</h2>
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="animate-pulse h-24" />)}</div>
        ) : data?.upcoming.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No upcoming games. Create one!</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {data?.upcoming.map((game) => (
              <Card key={game.id} className="hover:border-primary/50 transition-colors" data-testid={`card-game-${game.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(game.status, game.bookedCount, game.capacity)}`} />
                      <div>
                        <div className="font-semibold">{game.title}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {format(new Date(game.kickoffTime), "MMM d, h:mm a")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {game.bookedCount}/{game.capacity}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Badge variant={game.status === "open" ? "default" : game.status === "full" ? "secondary" : "destructive"}>
                        {game.status}
                      </Badge>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/game/${game.id}/manage`}>Manage</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Past Games */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Past Games</h2>
        {data?.past.length === 0 ? (
          <p className="text-sm text-muted-foreground">No past games.</p>
        ) : (
          <div className="space-y-3">
            {data?.past.slice(0, 5).map((game) => (
              <Card key={game.id} className="opacity-70">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{game.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(game.kickoffTime), "MMM d, yyyy")} · {game.bookedCount}/{game.capacity} players
                      </div>
                    </div>
                    <Badge variant="outline">{game.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
