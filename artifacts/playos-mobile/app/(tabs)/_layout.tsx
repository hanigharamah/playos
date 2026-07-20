import { Tabs } from "expo-router";
import { colors } from "@/lib/theme";
// Icons: replace with @expo/vector-icons or lucide-react-native at build time.

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: { backgroundColor: "#FFFFFF", borderTopColor: colors.hairline },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Games" }} />
      <Tabs.Screen name="my-games" options={{ title: "My Games" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
