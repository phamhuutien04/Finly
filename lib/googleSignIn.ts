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
    // ✅ Dùng Android Client ID cho native, Web Client ID cho Supabase
    const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    
    if (!androidClientId) {
      console.error('❌ EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID not found in .env');
      return;
    }
    
    if (!webClientId) {
      console.error('❌ EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID not found in .env');
      return;
    }

    GoogleSignin.configure({
      webClientId: webClientId, // Dùng cho Supabase signInWithIdToken
      offlineAccess: true,
      scopes: ['profile', 'email'],
    });
    console.log('✅ Google Sign-In configured');
    console.log('   Android Client ID:', androidClientId.substring(0, 20) + '...');
    console.log('   Web Client ID:', webClientId.substring(0, 20) + '...');
  } catch (error) {
    console.error('❌ Error configuring Google Sign-In:', error);
  }
}

/**
 * Đăng nhập bằng Google
 * Dùng WebBrowser OAuth cho cả web và Android - đơn giản, không cần SHA-1
 */
export async function signInWithGoogle() {
  return signInWithGoogleWeb();
}

/**
 * Đăng nhập Google trên Web (Supabase OAuth)
 */
async function signInWithGoogleWeb() {
  try {
    console.log('🌐 Starting Google Sign-In with WebBrowser...');
    console.log('📱 Platform:', Platform.OS);
    
    let redirectTo: string;
    
    if (Platform.OS === 'web') {
      // Web
      redirectTo = typeof window !== 'undefined' 
        ? `${window.location.origin}/auth/login`
        : 'http://localhost:8081/auth/login';
    } else {
      // Native - dùng deep link
      redirectTo = 'finly://auth/login';
    }
    
    console.log('🔗 Redirect URL:', redirectTo);
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo,
        skipBrowserRedirect: Platform.OS !== 'web', // Quan trọng cho native!
      },
    });
    
    if (error) {
      throw error;
    }
    
    console.log('✅ OAuth initiated, URL:', data.url);
    
    // Trên native, mở browser
    if (Platform.OS !== 'web' && data.url) {
      const WebBrowser = require('expo-web-browser');
      console.log('🌐 Opening browser...');
      
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );
      
      console.log('📱 WebBrowser result:', result.type);
      
      if (result.type === 'success' && result.url) {
        console.log('🔑 Parsing tokens from URL...');
        
        // Parse tokens từ URL
        const url = new URL(result.url);
        const accessToken = url.searchParams.get('access_token') || 
                           url.hash.match(/access_token=([^&]+)/)?.[1];
        const refreshToken = url.searchParams.get('refresh_token') ||
                            url.hash.match(/refresh_token=([^&]+)/)?.[1];
        
        if (accessToken && refreshToken) {
          console.log('💾 Setting session...');
          
          // Set session
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (sessionError) {
            throw sessionError;
          }
          
          console.log('✅ Session set successfully!');
        }
      }
    }
    
    return {
      success: true,
      user: null,
    };
    
  } catch (error: any) {
    console.error('❌ Google Sign-In error:', error);
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
