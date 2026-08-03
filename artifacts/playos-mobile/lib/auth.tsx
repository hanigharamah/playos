import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import { supabase } from "./supabase";
import type { Session, User } from "@supabase/supabase-js";

/**
 * Auth context — same shape as the web app's, so screen logic can be ported
 * with minimal changes. Session persistence is handled by Supabase's
 * AsyncStorage adapter (see supabase.ts).
 */

interface AuthCtx {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  /** Whether we were holding a session, so a null one reads as "expired". */
  const hadSessionRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      hadSessionRef.current = !!data.session;
      setIsLoading(false);
    });
    // A refresh token dying mid-session used to be completely silent: the
    // session nulled, every query started failing, and the player was left on
    // whatever screen they were on with no explanation. At T-20 that screen is
    // the match room, so it reads as check-in being broken. /error/session-expired
    // already exists and already routes to login — nothing ever reached it.
    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      const hadSession = hadSessionRef.current;
      setSession(s);
      hadSessionRef.current = !!s;
      // Only when a session we HELD goes away on its own. A deliberate signOut
      // sets session null through its own path, and SIGNED_OUT fires there too,
      // so that case is excluded by the ref already being false by then.
      if (!s && hadSession && (evt === "TOKEN_REFRESHED" || evt === "SIGNED_OUT")) {
        router.replace("/error/session-expired");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  const signOut = async () => {
    // Cleared BEFORE the call: signOut fires SIGNED_OUT through the listener
    // above, and without this a deliberate log-out would be reported to the
    // player as an expired session.
    hadSessionRef.current = false;
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <Ctx.Provider value={{ user: session?.user ?? null, session, isLoading, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
