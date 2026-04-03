import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    console.log('🔗 Auth callback page loaded');
    
    // Đợi Supabase xử lý hash fragment
    const checkSession = async () => {
      try {
        // Đợi một chút để Supabase xử lý token
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('📋 Session after OAuth:', !!session, error);
        
        if (session) {
          console.log('✅ OAuth successful, redirecting to home');
          router.replace('/(tabs)');
        } else {
          console.log('❌ No session found, redirecting to login');
          router.replace('/auth/login');
        }
      } catch (err) {
        console.error('❌ Error in callback:', err);
        router.replace('/auth/login');
      }
    };

    checkSession();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
      <ThemedText style={styles.text}>Đang xử lý đăng nhập...</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  text: {
    marginTop: 16,
  },
});
