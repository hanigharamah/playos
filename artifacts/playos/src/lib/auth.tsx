import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import type { AuthUser } from "@workspace/api-client-react";

// No-ops kept for import compat in pages that still reference them
export function storeAuthToken(_token: string): void {}
export function clearAuthToken(): void {}
export function initAuthToken(): void {}

interface AuthContextType {
  user: AuthUser | null | undefined;
  isLoading: boolean;
  /** Alias for isLoading — some pages use this spelling */
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchProfile(userId: string): Promise<AuthUser | null> {
  const { data } = await supabase
    .from("users")
    .select("id, email, phone, name, role, created_at")
    .eq("id", userId)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    email: data.email ?? null,
    phone: data.phone ?? null,
    name: data.name,
    role: data.role,
    createdAt: data.created_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // Tracks whose profile we've already resolved, so routine re-validation
  // events (token refresh, tab-focus session recheck) don't re-fetch the
  // profile — and can't null the user if that redundant fetch happens to
  // fail transiently. Only a real account change or explicit sign-out
  // should ever touch this.
  const resolvedUserId = useRef<string | null>(null);

  useEffect(() => {
    // Never hang: if Supabase is unreachable (wrong/paused URL) getSession()
    // can stay pending forever, leaving the whole app on a spinner.
    const failSafe = setTimeout(() => setIsLoading(false), 8000);

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (session?.user) {
          setUser(await fetchProfile(session.user.id));
          resolvedUserId.current = session.user.id;
        } else {
          setUser(null);
        }
      })
      .catch((err) => {
        console.error("Auth session lookup failed:", err);
        setUser(null);
      })
      .finally(() => {
        clearTimeout(failSafe);
        setIsLoading(false);
      });

    // Never await a Supabase call inside this callback: supabase-js fires it
    // while holding its auth lock, and any call made here queues for that same
    // lock — deadlocking this and every later auth call. Defer off the callback
    // so the lock releases first.
    //
    // Only clear the user on an explicit SIGNED_OUT. Switching tabs makes
    // supabase-js re-validate the session on refocus, which can fire this
    // callback with a momentarily-empty session before the real refresh
    // lands — treating that as a sign-out nulled the user for an instant,
    // which unmounted every role-gated page (e.g. the operator dashboard)
    // and wiped whatever the user was mid-typing, like an open create-game
    // form. Real sign-outs always carry the SIGNED_OUT event; other events
    // with no session yet are just noise to ignore.
    //
    // Also: if we've already resolved this exact user id, skip re-fetching
    // their profile entirely on subsequent events (token refresh fires this
    // callback routinely, including right when a backgrounded tab wakes back
    // up). That redundant fetch was the second way the same tab-switch bug
    // could still null the user — a transient failure on that unnecessary
    // network call fell into the same "profile lookup failed" catch below.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          resolvedUserId.current = null;
          setUser(null);
          return;
        }
        const userId = session?.user?.id;
        if (!userId) return;
        if (resolvedUserId.current === userId) return;
        resolvedUserId.current = userId;
        setTimeout(() => {
          fetchProfile(userId)
            .then(setUser)
            .catch((err) => {
              console.error("Profile lookup failed:", err);
              resolvedUserId.current = null;
              setUser(null);
            });
        }, 0);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, loading: isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
