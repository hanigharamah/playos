import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

  useEffect(() => {
    // Never hang: if Supabase is unreachable (wrong/paused URL) getSession()
    // can stay pending forever, leaving the whole app on a spinner.
    const failSafe = setTimeout(() => setIsLoading(false), 8000);

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        setUser(session?.user ? await fetchProfile(session.user.id) : null);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          setUser(null);
          return;
        }
        const userId = session?.user?.id;
        if (!userId) return;
        setTimeout(() => {
          fetchProfile(userId)
            .then(setUser)
            .catch((err) => {
              console.error("Profile lookup failed:", err);
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
