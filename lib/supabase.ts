import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import "react-native-url-polyfill/auto";

// Web storage (an toàn cho SSR: chỉ dùng khi có window)
const webStorage = {
  getItem: (key: string) => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // ✅ Native: AsyncStorage | ✅ Web: localStorage (SSR-safe)
    storage: Platform.OS === "web" ? (webStorage as any) : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // ❌ Tắt để xử lý thủ công, tránh conflict
  },
});
