import { useEffect, type RefObject } from "react";

/**
 * Tap the tab you are already on and the list returns to the top — the iOS
 * convention, and the only way back up a long Bookings or Browse list without
 * dragging.
 *
 * React Navigation ships `useScrollToTop` for exactly this, but
 * `@react-navigation/native` is only a transitive dependency of expo-router
 * under pnpm and is not directly resolvable — the same reason
 * components/FloatingTabBar.tsx hand-writes its own BottomTabBarProps. So the
 * tab bar calls into this tiny registry instead: each tab screen registers a
 * scroller under its route name, and the bar fires it when the pressed tab is
 * already the active one.
 */

type Scroller = () => void;

const scrollers = new Map<string, Scroller>();

/** Anything with a scroll method — ScrollView, FlatList, SectionList. */
type Scrollable = {
  scrollTo?: (opts: { y: number; animated: boolean }) => void;
  scrollToOffset?: (opts: { offset: number; animated: boolean }) => void;
};

/**
 * Register this screen's scroller for `routeName` — the name used in
 * app/(tabs)/_layout.tsx, e.g. "index", "browse", "my-games", "settings".
 */
export function useScrollToTop(routeName: string, ref: RefObject<Scrollable | null>) {
  useEffect(() => {
    scrollers.set(routeName, () => {
      const node = ref.current;
      if (!node) return;
      // FlatList exposes scrollToOffset; ScrollView exposes scrollTo.
      if (typeof node.scrollToOffset === "function") node.scrollToOffset({ offset: 0, animated: true });
      else if (typeof node.scrollTo === "function") node.scrollTo({ y: 0, animated: true });
    });
    // Unregister on unmount so a stale ref from a torn-down screen cannot fire.
    return () => {
      if (scrollers.get(routeName)) scrollers.delete(routeName);
    };
  }, [routeName, ref]);
}

/** Called by the tab bar when the active tab is pressed again. */
export function scrollTabToTop(routeName: string) {
  scrollers.get(routeName)?.();
}
