import { useState } from "react";
import { useLocation } from "wouter";
import { useHostLogin, useApplyAsHost } from "@workspace/api-client-react";
import { storeAuthToken } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function HostLogin() {
  const [, setLocation] = useLocation();
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [loginForm, setLoginForm] = useState({ phone: "", password: "" });
  const [applyForm, setApplyForm] = useState({ name: "", pitchName: "", phone: "", city: "" });
  const [applied, setApplied] = useState(false);

  const loginMutation = useHostLogin();
  const applyMutation = useApplyAsHost();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { data: loginForm },
      {
        onSuccess: (user) => {
          if (user.token) storeAuthToken(user.token);
          queryClient.setQueryData(["/api/auth/me"], user);
          setLocation("/dashboard");
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err?.data?.error || "Invalid credentials", variant: "destructive" });
        },
      }
    );
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    applyMutation.mutate(
      { data: applyForm },
      {
        onSuccess: () => {
          setApplied(true);
          toast({ title: "Application Submitted", description: "We'll review your application and be in touch." });
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err?.data?.error || "Failed to submit", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-12">
      <div className="max-w-lg mx-auto space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">{t("host.login")}</CardTitle>
            <CardDescription>Sign in with your phone number and password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="host-phone">{t("auth.phone")}</Label>
                <Input
                  id="host-phone"
                  data-testid="input-host-phone"
                  type="tel"
                  required
                  value={loginForm.phone}
                  onChange={(e) => setLoginForm({ ...loginForm, phone: e.target.value })}
                  placeholder="05XXXXXXXX"
                />
              </div>
              <div>
                <Label htmlFor="host-password">{t("auth.password")}</Label>
                <Input
                  id="host-password"
                  data-testid="input-host-password"
                  type="password"
                  required
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <Button data-testid="button-host-login" type="submit" className="w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "Signing in..." : t("host.login")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold">{t("host.apply")}</CardTitle>
            <CardDescription>
              Don't have a host account? Submit an application and we'll review it shortly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {applied ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-3">✓</div>
                <h3 className="text-lg font-semibold mb-2">Application Received!</h3>
                <p className="text-muted-foreground">We'll review your application and contact you within 48 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleApply} className="space-y-4">
                <div>
                  <Label htmlFor="apply-name">{t("auth.name")}</Label>
                  <Input
                    id="apply-name"
                    required
                    value={applyForm.name}
                    onChange={(e) => setApplyForm({ ...applyForm, name: e.target.value })}
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <Label htmlFor="apply-pitch">{t("host.pitch_name")}</Label>
                  <Input
                    id="apply-pitch"
                    required
                    value={applyForm.pitchName}
                    onChange={(e) => setApplyForm({ ...applyForm, pitchName: e.target.value })}
                    placeholder="Name of your pitch / venue"
                  />
                </div>
                <div>
                  <Label htmlFor="apply-phone">{t("auth.phone")}</Label>
                  <Input
                    id="apply-phone"
                    type="tel"
                    required
                    value={applyForm.phone}
                    onChange={(e) => setApplyForm({ ...applyForm, phone: e.target.value })}
                    placeholder="05XXXXXXXX"
                  />
                </div>
                <div>
                  <Label htmlFor="apply-city">{t("host.city")}</Label>
                  <Input
                    id="apply-city"
                    required
                    value={applyForm.city}
                    onChange={(e) => setApplyForm({ ...applyForm, city: e.target.value })}
                    placeholder="Riyadh, Jeddah, Dammam..."
                  />
                </div>
                <Button type="submit" variant="outline" className="w-full" disabled={applyMutation.isPending}>
                  {applyMutation.isPending ? "Submitting..." : t("host.apply")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
