import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { supabase } from "./supabase";

/**
 * Native push notifications via Expo Push (which fronts APNs on iOS and
 * FCM on Android). Vastly better than the web push flow we shipped:
 *  - No "Add to Home Screen" dance on iPhone
 *  - The permission prompt fires from a real installed app, not a browser
 *  - Delivery works while the app is fully closed
 *
 * The Expo push token is stored in the SAME `push_subscriptions` Supabase
 * table used by the web PWA, in an `expo_push_token` column that the
 * send-match-reminders edge function must be taught to read.
 * See supabase/2026-08-expo-push-tokens.sql for the schema this depends on.
 */

// Foreground presentation behavior (banner + sound while app is open).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type RegisterResult =
  | { status: "granted"; token: string }
  | { status: "denied" }
  | { status: "unsupported" }
  | { status: "error"; reason: string };

/**
 * Requests notification permission, retrieves the Expo push token, and
 * registers it in `push_subscriptions` for the signed-in user.
 * Call once from the post-signup / post-login onboarding sheet.
 *
 * `_userId` is kept only so the five existing call sites keep compiling. The
 * row is written by register_push_token(), which takes the user from the JWT;
 * a caller-supplied id is not an identity claim and is deliberately ignored.
 */
export async function registerForPush(_userId: string): Promise<RegisterResult> {
  if (!Device.isDevice) return { status: "unsupported" };

  // Android needs a channel explicitly declared before any notification can arrive.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("match-reminders", {
      name: "Match reminders",
      description: "20-minute warning before your booked game kicks off.",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FD6A03",
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    const { status: asked } = await Notifications.requestPermissionsAsync();
    status = asked;
  }
  if (status !== "granted") return { status: "denied" };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return { status: "error", reason: "eas.projectId missing in app.json" };

  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });

  // push_subscriptions.platform is constrained to web|ios|android. Platform.OS
  // is wider than that (windows, macos), and an unexpected value would fail the
  // check constraint at 23514 rather than degrading — so narrow it here.
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return { status: "unsupported" };
  }

  // register_push_token() rather than a direct upsert. The table is protected
  // by RLS on user_id = auth.uid(), which correctly stops one player writing
  // another's row — but it also blocks the legitimate case where this phone
  // was last registered to a different account (sign out, sign in), because
  // the ON CONFLICT target row is invisible to the new user. The definer
  // function reassigns the device instead. It reads auth.uid() itself, so
  // `userId` is never trusted as an identity claim.
  const { error } = await supabase.rpc("register_push_token", {
    p_token: expoPushToken,
    p_platform: Platform.OS,
  });
  if (error) return { status: "error", reason: error.message };

  return { status: "granted", token: expoPushToken };
}

/**
 * Deep-link a tapped notification. Wire this into the root layout so a
 * "20 min to kickoff" push opens straight into the flashcard flow.
 */
export function useNotificationTapNavigator(onOpen: (url: string) => void) {
  // Previously registered straight from the render body with no cleanup, so
  // every root re-render added another listener and one notification tap
  // pushed the match screen once per listener.
  const handler = useRef(onOpen);
  handler.current = onOpen;

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url as string | undefined;
      if (url) handler.current(url);
    });
    return () => sub.remove();
  }, []);
}
