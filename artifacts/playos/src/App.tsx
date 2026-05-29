import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

// Pages
import Home from "@/pages/home";
import Games from "@/pages/games";
import GameDetail from "@/pages/game/[id]";
import AuthPage from "@/pages/auth";
import HostLogin from "@/pages/host/login";
import Dashboard from "@/pages/dashboard";
import Payouts from "@/pages/dashboard/payouts";
import GameManage from "@/pages/game/manage";
import CreateGame from "@/pages/game/new";
import PaymentCallback from "@/pages/payment/callback";
import MockPayment from "@/pages/payment/mock";
import CheckIn from "@/pages/checkin/[pitchId]";
import About from "@/pages/about";
import Contact from "@/pages/contact";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import Complaints from "@/pages/complaints";
import RefundPolicy from "@/pages/policies/refund";
import DeliveryPolicy from "@/pages/policies/delivery";
import MyGames from "@/pages/my-games";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function AppContent() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/games" component={Games} />
          <Route path="/game/new" component={CreateGame} />
          <Route path="/game/:id/manage" component={GameManage} />
          <Route path="/game/:id" component={GameDetail} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/host/login" component={HostLogin} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/dashboard/payouts" component={Payouts} />
          <Route path="/payment/mock" component={MockPayment} />
          <Route path="/payment/callback" component={PaymentCallback} />
          <Route path="/checkin/:pitchId" component={CheckIn} />
          <Route path="/about" component={About} />
          <Route path="/contact" component={Contact} />
          <Route path="/terms" component={Terms} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/complaints" component={Complaints} />
          <Route path="/policies/refund" component={RefundPolicy} />
          <Route path="/policies/delivery" component={DeliveryPolicy} />
          <Route path="/my-games" component={MyGames} />

          {/* Arabic Routes */}
          <Route path="/ar" component={Home} />
          <Route path="/ar/games" component={Games} />
          <Route path="/ar/game/new" component={CreateGame} />
          <Route path="/ar/game/:id/manage" component={GameManage} />
          <Route path="/ar/game/:id" component={GameDetail} />
          <Route path="/ar/auth" component={AuthPage} />
          <Route path="/ar/host/login" component={HostLogin} />
          <Route path="/ar/dashboard" component={Dashboard} />
          <Route path="/ar/dashboard/payouts" component={Payouts} />
          <Route path="/ar/payment/mock" component={MockPayment} />
          <Route path="/ar/payment/callback" component={PaymentCallback} />
          <Route path="/ar/checkin/:pitchId" component={CheckIn} />
          <Route path="/ar/about" component={About} />
          <Route path="/ar/contact" component={Contact} />
          <Route path="/ar/terms" component={Terms} />
          <Route path="/ar/privacy" component={Privacy} />
          <Route path="/ar/complaints" component={Complaints} />
          <Route path="/ar/policies/refund" component={RefundPolicy} />
          <Route path="/ar/policies/delivery" component={DeliveryPolicy} />
          <Route path="/ar/my-games" component={MyGames} />

          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <I18nProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </I18nProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
