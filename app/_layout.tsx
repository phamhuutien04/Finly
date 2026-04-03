import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import GlobalAlertProvider from '@/components/GlobalAlertProvider';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

export const unstable_settings = {
  anchor: '(tabs)',
};

// ✅ danh mục mặc định
const DEFAULT_CATEGORIES = [
  // expense
  { name: "Ăn uống", type: "expense", emoji: "🍜", icon_preset_id: "food", icon_uri: "https://cdn-icons-png.flaticon.com/512/3075/3075977.png" },
  { name: "Cafe", type: "expense", emoji: "☕", icon_preset_id: "coffee", icon_uri: "https://cdn-icons-png.flaticon.com/512/2935/2935414.png" },
  { name: "Di chuyển", type: "expense", emoji: "🛵", icon_preset_id: "car", icon_uri: "https://cdn-icons-png.flaticon.com/512/744/744465.png" },
  { name: "Mua sắm", type: "expense", emoji: "🛍️", icon_preset_id: "shopping", icon_uri: "https://cdn-icons-png.flaticon.com/512/3081/3081559.png" },
  { name: "Hóa đơn", type: "expense", emoji: "🧾", icon_preset_id: "bill", icon_uri: "https://cdn-icons-png.flaticon.com/512/3135/3135706.png" },
  { name: "Khác", type: "expense", emoji: "📝", icon_preset_id: "other", icon_uri: "https://cdn-icons-png.flaticon.com/512/3135/3135700.png" },

  // income
  { name: "Lương", type: "income", emoji: "💵", icon_preset_id: "salary", icon_uri: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png" },
  { name: "Thưởng", type: "income", emoji: "🎁", icon_preset_id: "gift", icon_uri: "https://cdn-icons-png.flaticon.com/512/4202/4202306.png" },
  { name: "Chuyển khoản", type: "income", emoji: "🏦", icon_preset_id: "bank", icon_uri: "https://cdn-icons-png.flaticon.com/512/2830/2830284.png" },
  { name: "Khác", type: "income", emoji: "📝", icon_preset_id: "other", icon_uri: "https://cdn-icons-png.flaticon.com/512/3135/3135700.png" },
] as const;

async function ensureSeedCategories(userId: string) {
  // 1) nếu đã có categories rồi thì thôi
  const { count, error: countErr } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countErr) {
    console.log("count categories error:", countErr.message);
    return;
  }
  if ((count ?? 0) > 0) return;

  // 2) insert seed
  const payload = DEFAULT_CATEGORIES.map((c) => ({
    user_id: userId,
    name: c.name,
    type: c.type,
    emoji: c.emoji,
    icon_uri: c.icon_uri,
    icon_preset_id: c.icon_preset_id,
  }));

  const { error: insErr } = await supabase.from("categories").insert(payload);
  if (insErr) console.log("seed categories error:", insErr.message);
  else console.log("✅ Created default categories for user");
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Kiểm tra session hiện tại
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('📋 Initial session check:', !!session);
      setIsReady(true);
      
      const inAuthGroup = segments[0] === 'auth';
      
      if (session && inAuthGroup) {
        console.log('🔄 Already logged in, redirecting to home');
        router.replace('/(tabs)');
      } else if (!session && !inAuthGroup && segments.length > 0) {
        console.log('🔄 Not logged in, redirecting to login');
        router.replace('/auth/login');
      }
    });

    // Chỉ lắng nghe SIGNED_OUT để redirect về login
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_OUT') {
        console.log('👋 User signed out');
        router.replace('/auth/login');
      }
      // Không xử lý SIGNED_IN ở đây nữa để tránh conflict
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [segments]);

  if (!isReady) {
    return null; // Hoặc loading screen
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <GlobalAlertProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </GlobalAlertProvider>
    </ThemeProvider>
  );
}
