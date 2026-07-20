import { useEffect } from "react";
import { View, Modal, Pressable, StyleSheet, Dimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withSpring } from "react-native-reanimated";
import { colors, radius } from "@/lib/theme";

const { height: SCREEN_H } = Dimensions.get("window");

/**
 * Lightweight bottom sheet — deliberately simple (no gorhom/reanimated
 * bottom-sheet dep) per SPEC.md §6. Slide-up + backdrop fade only.
 */
export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const translateY = useSharedValue(SCREEN_H);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (open) {
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withTiming(SCREEN_H, { duration: 200 });
      backdropOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [open]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sheet, sheetStyle]}>
        <View style={styles.grabber} />
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: 10,
    paddingBottom: 34,
    paddingHorizontal: 20,
    maxHeight: SCREEN_H * 0.85,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairline,
    marginBottom: 16,
  },
});
