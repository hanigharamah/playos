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
 * table used by the web PWA, in a new `expo_push_token` column that the
 * send-match-reminders edge function must be taught to read.
 * See SPEC.md > "Push notifications" for the schema + edge-function change.
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
 * upserts it into `push_subscriptions` for the given user.
 * Call once from the post-signup / post-login onboarding sheet.
 */
export async function registerForPush(userId: string): Promise<RegisterResult> {
  if (!Device.isDevice) return { status: "unsupported" };

  // Android needs a channel explicitly declared before any notification can arrive.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("match-reminders", {
      name: "Match reminders",
      description: "20-minute warning before your booked game kicks off.",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF9F0A",
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

  const { data: tokenData } = await Notifications.getExpoPushTokenAsync({ projectId });

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      expo_push_token: tokenData.data,
      platform: Platform.OS,
    },
    { onConflict: "expo_push_token" },
  );
  if (error) return { status: "error", reason: error.message };

  return { status: "granted", token: tokenData.data };
}

/**
 * Deep-link a tapped notification. Wire this into the root layout so a
 * "20 min to kickoff" push opens straight into the flashcard flow.
 */
export function useNotificationTapNavigator(onOpen: (url: string) => void) {
  Notifications.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url as string | undefined;
    if (url) onOpen(url);
  });
}
