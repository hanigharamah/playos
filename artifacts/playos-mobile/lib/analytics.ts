import PostHog from "posthog-react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * PostHog wrapper — same EU project + event names as the web app
 * (see ../playos/src/lib/analytics.ts) so funnels combine across platforms.
 * Silent no-op if no key is configured, matching the web app's behavior.
 */
const KEY = Constants.expoConfig?.extra?.posthogKey as string | undefined;
const HOST = (Constants.expoConfig?.extra?.posthogHost as string | undefined) || "https://eu.i.posthog.com";

// PostHog's JSON-safe property type — matches PostHogEventProperties without
// importing an unexported type name from the SDK.
type Props = Record<string, string | number | boolean | null>;

let client: PostHog | null = null;

export async function initAnalytics(): Promise<void> {
  if (client || !KEY) return;
  client = new PostHog(KEY, { host: HOST, captureNativeAppLifecycleEvents: true, customStorage: AsyncStorage });
}

export function screen(name: string, props?: Props): void {
  client?.screen(name, props);
}

export function identifyUser(id: string, props?: Props): void {
  client?.identify(id, props);
}

export function track(event: string, props?: Props): void {
  client?.capture(event, props);
}

export function resetAnalytics(): void {
  client?.reset();
}
