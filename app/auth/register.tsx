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
import { supabase } from "@/lib/supabase";

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export default function RegisterScreen() {
  const router = useRouter();
  const colorScheme = useAppColorScheme();
  const isDark = colorScheme === 'dark';

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agree, setAgree] = useState(true);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    const n = fullName.trim();
    const e = email.trim();
    return (
      !loading &&
      agree &&
      n.length > 0 &&
      e.length > 0 &&
      pass.length >= 6 &&
      confirm.length >= 6
    );
  }, [fullName, email, pass, confirm, agree, loading]);

  const onRegister = async () => {
    if (loading) return;

    const n = fullName.trim();
    const e = email.trim().toLowerCase();

    if (!n || !e || !pass || !confirm) {
      Alert.alert("Thiếu thông tin", "Bạn nhập đầy đủ thông tin nhé.");
      return;
    }
    if (!isValidEmail(e)) {
      Alert.alert("Email không hợp lệ", "Bạn nhập đúng định dạng email nha.");
      return;
    }
    if (pass.length < 6) {
      Alert.alert("Mật khẩu yếu", "Mật khẩu nên từ 6 ký tự trở lên.");
      return;
    }
    if (pass !== confirm) {
      Alert.alert("Không khớp", "Mật khẩu xác nhận không khớp.");
      return;
    }
    if (!agree) {
      Alert.alert("Điều khoản", "Bạn cần đồng ý điều khoản để tiếp tục.");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email: e,
        password: pass,
        options: {
          data: { 
            full_name: n,
            display_name: n,  // Thêm display_name để trigger lấy được
            name: n,
          },
        },
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("rate limit")) {
          Alert.alert("Thao tác quá nhanh", "Bạn thử lại sau vài phút.");
          return;
        }
        if (msg.includes("already registered") || msg.includes("user already")) {
          Alert.alert("Email đã tồn tại", "Email này đã được đăng ký rồi.");
          return;
        }
        Alert.alert("Đăng ký thất bại", error.message);
        return;
      }

      const user = data.user;

      // ✅ Danh mục sẽ được tạo tự động bởi _layout.tsx khi SIGNED_IN
      if (data.session) {
        // Có session ngay => đã đăng nhập
        Alert.alert("Thành công", "Tạo tài khoản thành công!");
      } else {
        // Cần confirm email
        Alert.alert(
          "Đăng ký gần xong!",
          "Bạn hãy kiểm tra email để xác nhận tài khoản. Khi bạn đăng nhập lần đầu, app sẽ tự tạo danh mục mặc định."
        );
      }
      
      router.replace("/auth/login");
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message ?? "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
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
  const checkboxBg = isDark ? '#4b5563' : '#E5E7EB';
  const checkboxIcon = isDark ? '#f9fafb' : '#111';

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.screen, { backgroundColor: screenBg }]}>
          <View style={styles.header}>
            <View style={[styles.logo, { borderColor, backgroundColor: cardBg }]}>
              <ThemedText style={[styles.logoText, { color: text }]}>F</ThemedText>
            </View>

            <ThemedText type="title" style={{ color: text }}>Đăng ký</ThemedText>
            <ThemedText style={[styles.muted, { color: subtleText }]}>
              Tạo tài khoản để bắt đầu quản lí chi tiêu.
            </ThemedText>
          </View>

          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <ThemedText style={[styles.label, { color: text }]}>Họ và tên</ThemedText>
            <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor }]}>
              <Ionicons name="person-outline" size={18} color={iconColor} />
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Họ và tên"
                placeholderTextColor={subtleText}
                autoComplete="name"
                style={[styles.input, { color: inputText, backgroundColor: inputBg }]}
              />
            </View>

            <ThemedText style={[styles.label, { marginTop: 12, color: text }]}>
              Email
            </ThemedText>
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
                placeholder="Tối thiểu 6 ký tự"
                placeholderTextColor={subtleText}
                secureTextEntry={!showPass}
                autoComplete="new-password"
                style={[styles.input, { color: inputText, backgroundColor: inputBg }]}
              />
              <Pressable
                onPress={() => setShowPass((v) => !v)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPass ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={iconColor}
                />
              </Pressable>
            </View>

            <ThemedText style={[styles.label, { marginTop: 12, color: text }]}>
              Xác nhận mật khẩu
            </ThemedText>
            <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={iconColor} />
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Nhập lại mật khẩu"
                placeholderTextColor={subtleText}
                secureTextEntry={!showConfirm}
                autoComplete="new-password"
                style={[styles.input, { color: inputText, backgroundColor: inputBg }]}
              />
              <Pressable
                onPress={() => setShowConfirm((v) => !v)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showConfirm ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={iconColor}
                />
              </Pressable>
            </View>

            <Pressable
              onPress={() => setAgree((v) => !v)}
              style={styles.termsRow}
              disabled={loading}
            >
              <View style={[styles.checkbox, { borderColor }, agree && { backgroundColor: checkboxBg }]}>
                {agree && <Ionicons name="checkmark" size={14} color={checkboxIcon} />}
              </View>
              <ThemedText style={{ flex: 1, fontWeight: "700", opacity: 0.9, color: text }}>
                Tôi đồng ý Điều khoản & Chính sách
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={onRegister}
              style={[
                styles.btnSolid,
                { backgroundColor: buttonBg },
                (!canSubmit || loading) && styles.btnDisabled,
              ]}
              disabled={!canSubmit || loading}
            >
              {loading ? (
                <ActivityIndicator color={buttonText} />
              ) : (
                <ThemedText style={[styles.btnSolidText, { color: buttonText }]}>Tạo tài khoản</ThemedText>
              )}
            </Pressable>

            <View style={styles.footerRow}>
              <ThemedText style={[styles.muted, { color: subtleText }]}>Đã có tài khoản?</ThemedText>
              <Link href="/auth/login" asChild>
                <Pressable disabled={loading}>
                  <ThemedText style={[styles.link, { color: text }]}>Đăng nhập</ThemedText>
                </Pressable>
              </Link>
            </View>
          </View>

          <ThemedText style={[styles.copy, { color: subtleText }]}>© {new Date().getFullYear()} Finly</ThemedText>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, paddingTop: 14, justifyContent: "center" },

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

  termsRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },

  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },

  btnSolid: {
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
  },
  btnSolidText: { fontWeight: "900" },
  btnDisabled: { opacity: 0.6 },

  footerRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 14 },
  link: { fontSize: 13, fontWeight: "900", opacity: 0.95 },

  copy: { textAlign: "center", opacity: 0.6, marginTop: 12, fontSize: 12 },
});
