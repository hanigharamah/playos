import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { useFonts, Caveat_600SemiBold, Caveat_700Bold } from "@expo-google-fonts/caveat";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { colors } from "@/lib/theme";
import { initAnalytics } from "@/lib/analytics";
import { useNotificationTapNavigator } from "@/lib/notifications";

/**
 * Tell React Query whether the radio is actually up. Without this, a request
 * made with no signal fires into the void, burns its single retry within
 * seconds, and commits to isError — and because refetchOnWindowFocus is off
 * and nothing refetched on reconnect, the screen stayed broken until the app
 * was force-quit. That is the launch case exactly: one bar in a car park,
 * tapping a T-20 push. Bound this way the request simply waits for signal.
 */
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected && state.isInternetReachable !== false);
  }),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
      // The counterpart to onlineManager: recover on the way back up.
      refetchOnReconnect: true,
    },
  },
});

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({ Caveat_600SemiBold, Caveat_700Bold });

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
