// lib/googleSignIn.ts - Google Sign-In integration
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Cấu hình Google Sign-In
 * Gọi hàm này khi app khởi động
 */
export function configureGoogleSignIn() {
  // Chỉ configure trên native (Android/iOS)
  if (Platform.OS === 'web') {
    console.log('⚠️ Google Sign-In not available on web, use Supabase OAuth instead');
    return;
  }

  try {
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    
    if (!webClientId) {
      console.error('❌ EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID not found in .env');
      return;
    }

    GoogleSignin.configure({
      webClientId: webClientId,
      offlineAccess: true,
      scopes: ['profile', 'email'],
    });
    console.log('✅ Google Sign-In configured with webClientId:', webClientId.substring(0, 20) + '...');
  } catch (error) {
    console.error('❌ Error configuring Google Sign-In:', error);
  }
}

/**
 * Đăng nhập bằng Google
 */
export async function signInWithGoogle() {
  // Dùng Supabase OAuth cho cả web và native
  return signInWithGoogleWeb();
}

/**
 * Đăng nhập Google trên Web (Supabase OAuth)
 */
async function signInWithGoogleWeb() {
  try {
    console.log('🌐 Starting Google Sign-In on web...');
    
    let redirectTo: string;
    
    if (typeof window !== 'undefined') {
      // Web
      redirectTo = `${window.location.origin}/auth/login`;
    } else {
      // Native - dùng deep link
      redirectTo = 'finly://auth/login';
    }
    
    console.log('🔗 Redirect URL:', redirectTo);
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo,
      },
    });
    
    if (error) {
      throw error;
    }
    
    // OAuth sẽ redirect, không cần xử lý gì thêm
    return {
      success: true,
      user: null,
    };
    
  } catch (error: any) {
    console.error('❌ Google Sign-In error on web:', error);
    return {
      success: false,
      error: error.message || 'Đăng nhập thất bại',
    };
  }
}

/**
 * Đăng nhập Google trên Native (Android/iOS)
 */
async function signInWithGoogleNative() {
  try {
    console.log('📱 Starting Google Sign-In on native...');
    
    // Kiểm tra Google Play Services
    await GoogleSignin.hasPlayServices();
    console.log('✅ Google Play Services available');
    
    // Đăng nhập
    const response = await GoogleSignin.signIn();
    console.log('✅ Google Sign-In successful:', response.data?.user.email);
    
    // Lấy ID token
    const tokens = await GoogleSignin.getTokens();
    const idToken = tokens.idToken;
    
    if (!idToken) {
      throw new Error('No ID token received from Google');
    }
    
    console.log('🔑 Got ID token, signing in to Supabase...');
    
    // Đăng nhập vào Supabase với Google token
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Signed in to Supabase:', data.user?.email);
    
    return {
      success: true,
      user: data.user,
    };
    
  } catch (error: any) {
    console.error('❌ Google Sign-In error on native:', error);
    
    // Xử lý các lỗi cụ thể
    if (error.code === 'SIGN_IN_CANCELLED') {
      return {
        success: false,
        error: 'Đăng nhập bị hủy',
      };
    }
    
    if (error.code === 'IN_PROGRESS') {
      return {
        success: false,
        error: 'Đang xử lý đăng nhập',
      };
    }
    
    if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
      return {
        success: false,
        error: 'Google Play Services không khả dụng. Cần cài Google Play Services để dùng tính năng này.',
      };
    }
    
    return {
      success: false,
      error: error.message || 'Đăng nhập thất bại',
    };
  }
}

/**
 * Đăng xuất Google
 */
export async function signOutGoogle() {
  try {
    await GoogleSignin.signOut();
    console.log('✅ Signed out from Google');
  } catch (error) {
    console.error('❌ Error signing out from Google:', error);
  }
}

/**
 * Kiểm tra đã đăng nhập Google chưa
 */
export async function isSignedInGoogle(): Promise<boolean> {
  try {
    const isSignedIn = await GoogleSignin.getCurrentUser();
    return isSignedIn !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Lấy thông tin user hiện tại từ Google
 */
export async function getCurrentGoogleUser() {
  try {
    const userInfo = await GoogleSignin.signInSilently();
    return userInfo;
  } catch (error) {
    return null;
  }
}
