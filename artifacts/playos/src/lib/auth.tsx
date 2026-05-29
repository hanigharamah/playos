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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ? await fetchProfile(session.user.id) : null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ? await fetchProfile(session.user.id) : null);
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
