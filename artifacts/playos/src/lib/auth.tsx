// @refresh reset
import { createContext, useContext, ReactNode, useEffect } from "react";
import { useGetMe, useLogout, setAuthTokenGetter } from "@workspace/api-client-react";
import { AuthUser } from "@workspace/api-client-react/src/generated/api.schemas";
import { useQueryClient } from "@tanstack/react-query";

const TOKEN_KEY = "playos_auth_token";

export function storeAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  setAuthTokenGetter(null);
}

export function initAuthToken(): void {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
  }
}

interface AuthContextType {
  user: AuthUser | null | undefined;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initAuthToken();
  }, []);

  const { data: user, isLoading } = useGetMe({
    query: {
      retry: false,
    },
  });

  const queryClient = useQueryClient();
  const logoutMutation = useLogout();

  const logout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        clearAuthToken();
        queryClient.setQueryData([`/api/auth/me`], null);
        queryClient.clear();
      }
    });
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
