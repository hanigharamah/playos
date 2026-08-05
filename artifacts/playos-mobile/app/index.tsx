import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useGetMe, useIsOperator } from "@/lib/api";
import { View, ActivityIndicator } from "react-native";
import { colors } from "@/lib/theme";

/**
 * Entry route — send logged-in players to their game list, others to auth.
 * Mirrors the web's HomeOrMyGames component.
 */
export default function Index() {
  const { user, isLoading } = useAuth();
  // Server-side flag, not device storage: a player who reinstalls should not
  // be pitched again, and one who was killed ON the onboarding screen should.
  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: isOperator, isLoading: opsLoading } = useIsOperator();

  if (isLoading || (user && (meLoading || opsLoading))) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.creamDeep }}>
        <ActivityIndicator color={colors.orange} />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;

  // Never asked -> ask. Routing only from signup would lose anyone who was
  // killed or crashed on the onboarding screen itself: their session persists,
  // the next cold start comes through here, and they would never be asked
  // again — the same silent gap this whole change exists to close.
  if (me && !me.onboardingSeenAt) return <Redirect href="/onboarding" />;

  // An operator's account opens the operator screens, not the storefront.
  // There is one operator and this is what they signed in to do; making them
  // pass through a player home first is a tap they would take every time.
  // The hub still links across, because the same person also plays.
  if (isOperator) return <Redirect href="/ops" />;

  return <Redirect href="/(tabs)" />;
}
