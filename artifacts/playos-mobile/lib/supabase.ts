import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client — points at the SAME project the web app uses, so accounts,
 * bookings, and games are shared across web and mobile.
 *
 * Anon key is public by design (RLS enforces per-user access). Fine to ship
 * in the client bundle. Values live in app.json → expo.extra so they're
 * baked into the build the same way Vite's VITE_* vars work on the web.
 */
const supabaseUrl = (Constants.expoConfig?.extra?.supabaseUrl as string) ?? "";
const supabaseAnonKey = (Constants.expoConfig?.extra?.supabaseAnonKey as string) ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[supabase] Missing supabaseUrl or supabaseAnonKey in app.json expo.extra");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
