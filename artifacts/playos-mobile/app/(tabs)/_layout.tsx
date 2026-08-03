import { View } from "react-native";
import { Tabs } from "expo-router";
import { FloatingTabBar } from "@/components/FloatingTabBar";
import { MatchDayBar } from "@/components/MatchDayBar";

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="play" />
      <Tabs.Screen name="my-games" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="settings" />
    </Tabs>
      {/* Above the tabs, on tab screens only — never over checkout or a modal. */}
      <MatchDayBar />
    </View>
  );
}
