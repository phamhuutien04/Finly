import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { LogBox, Platform } from 'react-native';
import 'react-native-reanimated';

import GlobalAlertProvider from '@/components/GlobalAlertProvider';
import { ThemeProvider as AppThemeProvider, useAppColorScheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

// Tắt tất cả warnings và errors trên màn hình
LogBox.ignoreAllLogs(true);

// Fix autofill styling on web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    input:-webkit-autofill,
    input:-webkit-autofill:hover,
    input:-webkit-autofill:focus,
    input:-webkit-autofill:active {
      -webkit-background-clip: text !important;
      -webkit-text-fill-color: inherit !important;
      transition: background-color 5000s ease-in-out 0s !important;
      box-shadow: inset 0 0 20px 20px transparent !important;
    }
  `;
  document.head.appendChild(style);
}

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
  console.log('📂 ensureSeedCategories called for user:', userId);
  
  try {
    // 1) Kiểm tra đã có categories chưa với timeout
    console.log('🔍 Checking existing categories...');
    
    const checkPromise = supabase
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    
    // Timeout sau 5 giây
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Query timeout')), 5000)
    );
    
    const { count, error: countErr } = await Promise.race([
      checkPromise,
      timeoutPromise
    ]) as any;

    if (countErr) {
      console.log("❌ count categories error:", countErr.message);
      // Nếu lỗi, vẫn cố tạo danh mục
    } else {
      console.log('📊 Current categories count:', count);
      
      if ((count ?? 0) > 0) {
        console.log('✅ User already has categories, skipping seed');
        return;
      }
    }

    // 2) Tạo danh mục mặc định
    console.log('🌱 Creating default categories...');
    const payload = DEFAULT_CATEGORIES.map((c) => ({
      user_id: userId,
      name: c.name,
      type: c.type,
      emoji: c.emoji,
      icon_uri: c.icon_uri,
      icon_preset_id: c.icon_preset_id,
    }));

    console.log('📦 Inserting', payload.length, 'categories...');
    
    const insertPromise = supabase.from("categories").insert(payload);
    const insertTimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Insert timeout')), 5000)
    );
    
    const { error: insErr } = await Promise.race([
      insertPromise,
      insertTimeoutPromise
    ]) as any;
    
    if (insErr) {
      console.log("❌ seed categories error:", insErr.message);
    } else {
      console.log("✅ Created", payload.length, "default categories!");
    }
  } catch (err: any) {
    console.error("❌ Exception in ensureSeedCategories:", err.message);
    // Không throw error để không block app
  }
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootLayoutContent />
    </AppThemeProvider>
  );
}

function RootLayoutContent() {
  const colorScheme = useAppColorScheme();
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

    // Lắng nghe auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('🔔 Auth event:', _event);
      
      if (_event === 'SIGNED_OUT') {
        console.log('👋 User signed out');
        router.replace('/auth/login');
      } else if (_event === 'SIGNED_IN' && session?.user?.id) {
        console.log('👤 User signed in:', session.user.email);
        // Tạo danh mục trong background, không chờ
        ensureSeedCategories(session.user.id).catch(err => {
          console.error('❌ Failed to seed categories:', err);
        });
      }
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
