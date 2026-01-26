import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

const webStorage = {
  getItem: (key: string) => (typeof window === "undefined" ? null : window.localStorage.getItem(key)),
  setItem: (key: string, value: string) => { if (typeof window !== "undefined") window.localStorage.setItem(key, value); },
  removeItem: (key: string) => { if (typeof window !== "undefined") window.localStorage.removeItem(key); },
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: webStorage as any,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
