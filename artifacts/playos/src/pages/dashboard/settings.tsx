import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { isOperator } from "@/lib/config";
import { OperatorSettings } from "@/components/dashboard/OperatorSettings";

export default function DashboardSettings() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isOperator(user?.role)) {
      setLocation("/");
    }
  }, [authLoading, user]);

  if (authLoading || !isOperator(user?.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <OperatorSettings />
    </div>
  );
}
