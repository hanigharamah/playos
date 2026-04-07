import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin, useSignUp } from "@workspace/api-client-react";
import { storeAuthToken } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const returnUrl = new URLSearchParams(window.location.search).get("returnUrl") || "/";

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({ name: "", email: "", phone: "", password: "" });

  const loginMutation = useLogin();
  const signupMutation = useSignUp();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { data: loginForm },
      {
        onSuccess: (user) => {
          if (user.token) storeAuthToken(user.token);
          queryClient.setQueryData(["/api/auth/me"], user);
          setLocation(returnUrl);
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err?.data?.error || "Invalid credentials", variant: "destructive" });
        },
      }
    );
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    signupMutation.mutate(
      { data: signupForm },
      {
        onSuccess: (user) => {
          if (user.token) storeAuthToken(user.token);
          queryClient.setQueryData(["/api/auth/me"], user);
          setLocation(returnUrl);
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err?.data?.error || "Signup failed", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">PlayOS</CardTitle>
          <CardDescription>
            {t("auth.login")} / {t("auth.signup")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" data-testid="tab-login">{t("auth.login")}</TabsTrigger>
              <TabsTrigger value="signup" data-testid="tab-signup">{t("auth.signup")}</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email">{t("auth.email")}</Label>
                  <Input
                    id="login-email"
                    data-testid="input-email"
                    type="email"
                    required
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="login-password">{t("auth.password")}</Label>
                  <Input
                    id="login-password"
                    data-testid="input-password"
                    type="password"
                    required
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                <Button
                  data-testid="button-login"
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Signing in..." : t("auth.login")}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <Label htmlFor="signup-name">{t("auth.name")}</Label>
                  <Input
                    id="signup-name"
                    data-testid="input-name"
                    required
                    value={signupForm.name}
                    onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                    placeholder="Ahmed Al-Rashidi"
                  />
                </div>
                <div>
                  <Label htmlFor="signup-email">{t("auth.email")}</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    required
                    value={signupForm.email}
                    onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="signup-phone">{t("auth.phone")}</Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    required
                    value={signupForm.phone}
                    onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })}
                    placeholder="05XXXXXXXX"
                  />
                </div>
                <div>
                  <Label htmlFor="signup-password">{t("auth.password")}</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    required
                    minLength={4}
                    value={signupForm.password}
                    onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={signupMutation.isPending}>
                  {signupMutation.isPending ? "Creating account..." : t("auth.signup")}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
