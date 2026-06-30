import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { getGetMeQueryKey } from "@/lib/supabase-api";
import { OPERATOR_SECRET, OPERATOR_EMAIL, OPERATOR_PASSWORD, isOperator } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";

/**
 * Hidden operator login, reached only via the secret URL /x/<secret>.
 * - If the token doesn't match, render the 404 page (no hint the route exists).
 * - If operator env credentials are configured, auto-sign-in on mount.
 * - Otherwise show a minimal email + password form.
 */
export default function OpsLogin() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState(OPERATOR_EMAIL);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoTried = useRef(false);

  const tokenOk = token === OPERATOR_SECRET;

  const signIn = async (e: string, p: string) => {
    setBusy(true);
    setError(null);
    const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
      email: e,
      password: p,
    });
    if (authErr || !auth.user) {
      setBusy(false);
      setError("Sign-in failed.");
      return;
    }
    const { data: profile } = await supabase
      .from("users").select("*").eq("id", auth.user.id).single();
    if (!profile || !isOperator(profile.role)) {
      await supabase.auth.signOut();
      setBusy(false);
      setError("This account is not an operator.");
      return;
    }
    queryClient.setQueryData(getGetMeQueryKey(), {
      id: profile.id, email: profile.email, phone: profile.phone,
      name: profile.name, role: profile.role, createdAt: profile.created_at,
    });
    setLocation("/dashboard");
  };

  // Already signed in as operator on this device → straight to the dashboard.
  useEffect(() => {
    if (tokenOk && isOperator(user?.role)) setLocation("/dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenOk, user]);

  // Auto-login when env credentials are present (zero-typing access).
  useEffect(() => {
    if (tokenOk && !autoTried.current && !authLoading && !isOperator(user?.role)
        && OPERATOR_EMAIL && OPERATOR_PASSWORD) {
      autoTried.current = true;
      signIn(OPERATOR_EMAIL, OPERATOR_PASSWORD);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenOk, authLoading]);

  if (!tokenOk) return <NotFound />;

  // Don't flash the form while we resolve the session or auto sign-in.
  if ((busy || authLoading || (OPERATOR_EMAIL && OPERATOR_PASSWORD)) && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <Loader2 className="h-6 w-6 animate-spin text-[#6C6C70]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent px-4 py-16">
      <form
        onSubmit={(e) => { e.preventDefault(); signIn(email, password); }}
        className="max-w-sm mx-auto bg-white rounded-2xl shadow-lg p-6 space-y-4"
      >
        <p className="text-lg font-bold text-[#1D3557]">Operator sign-in</p>
        <div>
          <Label htmlFor="op-email">Email</Label>
          <Input id="op-email" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div>
          <Label htmlFor="op-pass">Password</Label>
          <Input id="op-pass" type="password" required value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        {error && <p className="text-sm text-[#FF3B30]">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
