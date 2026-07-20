import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth";
import { View, ActivityIndicator } from "react-native";
import { colors } from "@/lib/theme";

/**
 * Entry route — send logged-in players to their game list, others to auth.
 * Mirrors the web's HomeOrMyGames component.
 */
export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.creamDeep }}>
        <ActivityIndicator color={colors.orange} />
      </View>
    );
  }

  return user ? <Redirect href="/(tabs)" /> : <Redirect href="/(auth)/login" />;
}
