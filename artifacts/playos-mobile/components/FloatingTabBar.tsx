import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Calendar, User } from "lucide-react-native";

// Minimal shape of @react-navigation/bottom-tabs' BottomTabBarProps —
// the package is only a transitive dep of expo-router, so its types
// aren't directly resolvable under pnpm.
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: any;
}
import Svg, { Circle, Path } from "react-native-svg";

/**
 * Floating glass tab bar — exact copy of the Figma "Bottom Nav" component
 * (node 34:2, see FIGMA-MAP.md): 358×68, r30, white 32% glass with warm
 * shadow; the active tab gets an orange 12% chip behind its icon and a
 * semibold label. Labels stay #6C6C70 in both states, per the design.
 */

const LABEL = "#6C6C70";
const ICON = "#4A4A4E";
const CHIP = "rgba(255,138,0,0.12)";

function FootballIcon({ size = 26, color = ICON }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} fill="none" />
      <Path d="M12 7.2l3.2 2.4-1.2 3.9h-4l-1.2-3.9z" stroke={color} strokeWidth={1.8} fill="none" strokeLinejoin="round" />
      <Path
        d="M12 7.2V3.2M15.2 9.6l3.6-1.4M14 13.5l2.4 3.1M10 13.5l-2.4 3.1M8.8 9.6 5.2 8.2"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" fill="none"
      />
    </Svg>
  );
}

/**
 * Four tabs, not five. Apple's guidance is three to five on iPhone, and the
 * reason for the ceiling is the one that applied here: every extra tab shrinks
 * the target. Play was a duplicate of Browse — same query, same aggregation —
 * and Chat was a tab that rendered its empty state for every user, every time.
 */
const TABS: Record<string, { label: string; icon: (color: string) => React.ReactNode }> = {
  index: { label: "home", icon: (c) => <Home size={24} color={c} strokeWidth={1.8} /> },
  browse: { label: "browse", icon: (c) => <FootballIcon size={24} color={c} /> },
  "my-games": { label: "bookings", icon: (c) => <Calendar size={24} color={c} strokeWidth={1.8} /> },
  settings: { label: "profile", icon: (c) => <User size={24} color={c} strokeWidth={1.8} /> },
};

export function FloatingTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={styles.shadow}>
        <BlurView intensity={Platform.OS === "ios" ? 24 : 0} tint="light" style={styles.bar}>
          {state.routes.map((route, i) => {
            const meta = TABS[route.name];
            if (!meta) return null;
            const active = state.index === i;
            const onPress = () => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!active && !event.defaultPrevented) navigation.navigate(route.name);
            };
            return (
              <Pressable key={route.key} style={styles.tab} onPress={onPress} hitSlop={6}>
                <View style={[styles.chip, active && { backgroundColor: CHIP }]}>
                  {meta.icon(active ? "#3A3A3C" : ICON)}
                </View>
                <Text style={[styles.label, active && styles.labelActive]}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  shadow: {
    borderRadius: 30, width: "100%", maxWidth: 358,
    shadowColor: "#8C5926", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 8,
  },
  bar: {
    flexDirection: "row", height: 68, borderRadius: 30, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.62)", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center", paddingHorizontal: 4,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingTop: 4 },
  chip: { width: 48, height: 34, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 10, color: LABEL, fontWeight: "400" },
  labelActive: { fontWeight: "600" },
});
