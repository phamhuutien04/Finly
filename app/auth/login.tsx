import Ionicons from "@expo/vector-icons/Ionicons";
import { Link, Stack, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    TextInput,
    View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppColorScheme } from "@/contexts/ThemeContext";
import { configureGoogleSignIn, signInWithGoogle } from "@/lib/googleSignIn";
import { supabase } from "@/lib/supabase";


const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export default function LoginScreen() {
  const router = useRouter();
  const colorScheme = useAppColorScheme();
  const isDark = colorScheme === 'dark';

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(false);

  const checkSession = async () => {
    // Tránh xử lý nhiều lần
    if (isProcessingOAuth) {
      console.log('⏭️ Already processing OAuth, skipping');
      return;
    }

    try {
      console.log('🔍 checkSession called');
      
      // Trên web, xử lý OAuth callback từ hash fragment
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash;
        
        if (hash && hash.includes('access_token')) {
          setIsProcessingOAuth(true);
          console.log('🔗 OAuth callback detected');
          
          // Parse tokens
          const hashParams = new URLSearchParams(hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            console.log('🔑 Setting session...');
            
            // Xóa hash ngay để tránh xử lý lại
            window.history.replaceState(null, '', window.location.pathname);
            
            try {
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              
              if (error) {
                console.error('❌ setSession error:', error.message);
                Alert.alert('Lỗi đăng nhập', error.message);
                setIsProcessingOAuth(false);
                return;
              }
              
              if (data.session?.user?.id) {
                console.log('✅ Session created');
                
                // Redirect - danh mục sẽ được tạo ở _layout.tsx
                router.replace('/(tabs)');
                return;
              }
            } catch (err: any) {
              console.error('❌ Exception:', err.message);
              setIsProcessingOAuth(false);
              return;
            }
          }
        }
      }

      // Kiểm tra session thông thường
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        console.log('✅ Already logged in');
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      console.error('❌ checkSession error:', error.message);
      setIsProcessingOAuth(false);
    }
  };

  // Configure Google Sign-In khi component mount
  React.useEffect(() => {
    let mounted = true;
    
    configureGoogleSignIn();
    
    // Kiểm tra session khi vào trang login
    if (mounted) {
      checkSession();
    }

    return () => {
      mounted = false;
    };
  }, []);

  const canSubmit = useMemo(() => {
    const e = email.trim();
    return !loading && e.length > 0 && pass.length > 0;
  }, [email, pass, loading]);

  const onLogin = async () => {
    if (loading) return;

    const e = email.trim().toLowerCase();
    if (!e || !pass) {
      Alert.alert("Thiếu thông tin", "Nhập email và mật khẩu nhé.");
      return;
    }
    if (!isValidEmail(e)) {
      Alert.alert("Email không hợp lệ", "Bạn nhập đúng định dạng email nha.");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: e,
        password: pass,
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();

        if (msg.includes("email not confirmed")) {
          Alert.alert(
            "Chưa xác nhận email",
            "Bạn hãy vào email để xác nhận tài khoản rồi đăng nhập lại."
          );
          return;
        }
        if (msg.includes("invalid login credentials")) {
          Alert.alert("Sai thông tin", "Email hoặc mật khẩu không đúng.");
          return;
        }

        Alert.alert("Đăng nhập thất bại", error.message);
        return;
      }

      if (data.session) {
        router.replace("/(tabs)");
        return;
      }

      // hiếm khi xảy ra, nhưng vẫn để fallback
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message ?? "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  };

  const onForgot = async () => {
    if (loading) return;

    const e = email.trim().toLowerCase();
    if (!e) {
      Alert.alert("Quên mật khẩu", "Nhập email trước rồi bấm lại nhé.");
      return;
    }
    if (!isValidEmail(e)) {
      Alert.alert("Email không hợp lệ", "Bạn nhập đúng định dạng email nha.");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(e, {
        // Nếu bạn dùng deep link reset password thì mở dòng dưới và chỉnh lại scheme
        // redirectTo: "finly://auth/reset",
      });

      if (error) {
        Alert.alert("Không gửi được", error.message);
        return;
      }

      Alert.alert("Đã gửi email", "Kiểm tra hộp thư để đặt lại mật khẩu nha.");
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message ?? "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  };

  const onGoogleSignIn = async () => {
    if (googleLoading || loading) return;

    try {
      setGoogleLoading(true);
      console.log('🔍 Starting Google Sign-In...');
      
      const result = await signInWithGoogle();
      
      if (result.success) {
        console.log('✅ Google Sign-In successful');
        // Tự động chuyển trang, không cần alert
        router.replace('/(tabs)');
      } else {
        console.error('❌ Google Sign-In failed:', result.error);
        Alert.alert('Đăng nhập thất bại', result.error || 'Có lỗi xảy ra');
      }
    } catch (err: any) {
      console.error('❌ Google Sign-In error:', err);
      Alert.alert('Lỗi', err?.message ?? 'Có lỗi xảy ra khi đăng nhập với Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  // Theme colors
  const screenBg = isDark ? '#111827' : '#fafafa';
  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const text = isDark ? '#f9fafb' : '#1f2937';
  const subtleText = isDark ? '#9ca3af' : '#64748b';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const inputBg = isDark ? '#374151' : '#ffffff';
  const inputText = isDark ? '#f9fafb' : '#111827';
  const iconColor = isDark ? '#9ca3af' : '#6B7280';
  const buttonBg = isDark ? '#6366f1' : '#111';
  const buttonText = '#ffffff';
  const outlineButtonBg = isDark ? '#374151' : '#ffffff';
  const outlineButtonText = isDark ? '#f9fafb' : '#111';
  const outlineButtonIcon = isDark ? '#f9fafb' : '#111';

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.screen, { backgroundColor: screenBg }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.logo, { borderColor, backgroundColor: cardBg }]}>
              <ThemedText style={[styles.logoText, { color: text }]}>F</ThemedText>
            </View>

            <ThemedText type="title" style={{ color: text }}>Đăng nhập</ThemedText>
            <ThemedText style={[styles.muted, { color: subtleText }]}>
              Quản lí chi tiêu nhanh, gọn, rõ ràng.
            </ThemedText>
          </View>

          {/* Card */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <ThemedText style={[styles.label, { color: text }]}>Email</ThemedText>
            <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor }]}>
              <Ionicons name="mail-outline" size={18} color={iconColor} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={subtleText}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                style={[styles.input, { color: inputText, backgroundColor: inputBg }]}
                editable={!loading}
              />
            </View>

            <ThemedText style={[styles.label, { marginTop: 12, color: text }]}>
              Mật khẩu
            </ThemedText>
            <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor }]}>
              <Ionicons name="lock-closed-outline" size={18} color={iconColor} />
              <TextInput
                value={pass}
                onChangeText={setPass}
                placeholder="Mật khẩu"
                placeholderTextColor={subtleText}
                secureTextEntry={!show}
                autoComplete="password"
                style={[styles.input, { color: inputText, backgroundColor: inputBg }]}
                editable={!loading}
              />
              <Pressable
                onPress={() => setShow((v) => !v)}
                style={styles.eyeBtn}
                disabled={loading}
              >
                <Ionicons
                  name={show ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={iconColor}
                />
              </Pressable>
            </View>

            {/* Row links */}
            <View style={styles.row}>
              <Pressable onPress={onForgot} disabled={loading}>
                <ThemedText style={[styles.link, { color: text }]}>Quên mật khẩu?</ThemedText>
              </Pressable>

              <Link href="/auth/register" asChild>
                <Pressable disabled={loading}>
                  <ThemedText style={[styles.link, { color: text }]}>Đăng ký</ThemedText>
                </Pressable>
              </Link>
            </View>

            {/* Button */}
            <Pressable
              onPress={onLogin}
              style={[
                styles.btnSolid, 
                { backgroundColor: buttonBg },
                (!canSubmit || loading) && styles.btnDisabled
              ]}
              disabled={!canSubmit || loading}
            >
              {loading ? (
                <ActivityIndicator color={buttonText} />
              ) : (
                <ThemedText style={[styles.btnSolidText, { color: buttonText }]}>Đăng nhập</ThemedText>
              )}
            </Pressable>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={[styles.line, { backgroundColor: borderColor }]} />
              <ThemedText style={[styles.muted, { color: subtleText }]}>hoặc</ThemedText>
              <View style={[styles.line, { backgroundColor: borderColor }]} />
            </View>

            <Pressable
              onPress={onGoogleSignIn}
              style={[
                styles.btnOutline, 
                { backgroundColor: outlineButtonBg, borderColor },
                googleLoading && styles.btnDisabled
              ]}
              disabled={loading || googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color={outlineButtonText} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={18} color={outlineButtonIcon} />
                  <ThemedText style={[styles.btnOutlineText, { color: outlineButtonText }]}>
                    Đăng nhập với Google
                  </ThemedText>
                </>
              )}
            </Pressable>
          </View>

          <ThemedText style={[styles.copy, { color: subtleText }]}>
            © {new Date().getFullYear()} Finly
          </ThemedText>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    justifyContent: "center",
  },

  header: { alignItems: "center", gap: 6, marginBottom: 12 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
  },
  logoText: { fontSize: 22, fontWeight: "900" },

  muted: { opacity: 0.7, marginTop: 2 },

  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },

  label: { fontWeight: "800", marginBottom: 8 },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1 },

  eyeBtn: { padding: 6, marginRight: -6 },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 14,
  },

  link: { fontSize: 13, fontWeight: "800", opacity: 0.9 },

  btnSolid: {
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
  },
  btnSolidText: { fontWeight: "900" },
  btnDisabled: { opacity: 0.6 },

  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 },
  line: { flex: 1, height: 1 },

  btnOutline: {
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnOutlineText: { fontWeight: "900" },

  copy: { textAlign: "center", opacity: 0.6, marginTop: 12, fontSize: 12 },
});
