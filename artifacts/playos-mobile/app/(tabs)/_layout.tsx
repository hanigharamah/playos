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
      <Tabs.Screen name="browse" />
      <Tabs.Screen name="my-games" />
      {/* Chat keeps its route and its URL, but leaves the bar. A group chat is
          alive for 40 minutes per booking (T-20 to T+20, FIGMA-MAP.md:86) —
          the window the match-day bar already owns — so players reach it from
          the match room and nowhere else. There is deliberately no player-side
          chat history: the 30-day retention is for operators, and once a chat
          soft-closes the messages a player still needs arrived as push. */}
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="settings" />
    </Tabs>
      {/* Above the tabs, on tab screens only — never over checkout or a modal. */}
      <MatchDayBar />
    </View>
  );
}
