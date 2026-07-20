import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts, Caveat_600SemiBold } from "@expo-google-fonts/caveat";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { colors } from "@/lib/theme";
import { initAnalytics } from "@/lib/analytics";
import { useNotificationTapNavigator } from "@/lib/notifications";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({ Caveat_600SemiBold });

  useEffect(() => {
    initAnalytics();
  }, []);

  // Tapping a "20 min to kickoff" push deep-links straight into the flashcard.
  useNotificationTapNavigator((url) => router.push(url as any));

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.creamDeep }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <AuthProvider>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.creamDeep },
                  animation: "slide_from_right",
                }}
              />
            </AuthProvider>
          </I18nProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
