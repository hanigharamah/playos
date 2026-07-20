import { Tabs } from "expo-router";
import { Home, Search, Calendar, MessageCircle, User } from "lucide-react-native";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.pink,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: { backgroundColor: "#FFFFFF", borderTopColor: colors.hairline, height: 84, paddingTop: 8 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="play" options={{ title: "Play", tabBarIcon: ({ color, size }) => <Search color={color} size={size} /> }} />
      <Tabs.Screen name="my-games" options={{ title: "Bookings", tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} /> }} />
      <Tabs.Screen name="chat" options={{ title: "Chat", tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}
