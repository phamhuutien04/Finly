import React, { useMemo, useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Link, Stack, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { supabase } from "@/lib/supabase";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

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

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ThemedView style={styles.screen}>
          {/* Header */}
          <ThemedView style={styles.header}>
            <ThemedView style={styles.logo}>
              <ThemedText style={styles.logoText}>F</ThemedText>
            </ThemedView>

            <ThemedText type="title">Đăng nhập</ThemedText>
            <ThemedText style={styles.muted}>
              Quản lí chi tiêu nhanh, gọn, rõ ràng.
            </ThemedText>
          </ThemedView>

          {/* Card */}
          <ThemedView style={styles.card}>
            <ThemedText style={styles.label}>Email</ThemedText>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color="#6B7280" />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="vd: tien@gmail.com"
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
                editable={!loading}
              />
            </View>

            <ThemedText style={[styles.label, { marginTop: 12 }]}>
              Mật khẩu
            </ThemedText>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color="#6B7280" />
              <TextInput
                value={pass}
                onChangeText={setPass}
                placeholder="Nhập mật khẩu"
                secureTextEntry={!show}
                style={styles.input}
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
                  color="#6B7280"
                />
              </Pressable>
            </View>

            {/* Row links */}
            <View style={styles.row}>
              <Pressable onPress={onForgot} disabled={loading}>
                <ThemedText style={styles.link}>Quên mật khẩu?</ThemedText>
              </Pressable>

              <Link href="/auth/register" asChild>
                <Pressable disabled={loading}>
                  <ThemedText style={styles.link}>Đăng ký</ThemedText>
                </Pressable>
              </Link>
            </View>

            {/* Button */}
            <Pressable
              onPress={onLogin}
              style={[styles.btnSolid, (!canSubmit || loading) && styles.btnDisabled]}
              disabled={!canSubmit || loading}
            >
              {loading ? (
                <ActivityIndicator />
              ) : (
                <ThemedText style={styles.btnSolidText}>Đăng nhập</ThemedText>
              )}
            </Pressable>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.line} />
              <ThemedText style={styles.muted}>hoặc</ThemedText>
              <View style={styles.line} />
            </View>

            <Pressable
              onPress={() =>
                Alert.alert(
                  "Google",
                  "Muốn Google login thì phải bật Provider Google trong Supabase + cấu hình redirect."
                )
              }
              style={styles.btnOutline}
              disabled={loading}
            >
              <Ionicons name="logo-google" size={18} color="#111" />
              <ThemedText style={styles.btnOutlineText}>
                Đăng nhập với Google
              </ThemedText>
            </Pressable>
          </ThemedView>

          <ThemedText style={styles.copy}>
            © {new Date().getFullYear()} Finly
          </ThemedText>
        </ThemedView>
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
    borderColor: "rgba(127,127,127,0.25)",
    marginBottom: 6,
  },
  logoText: { fontSize: 22, fontWeight: "900" },

  muted: { opacity: 0.7, marginTop: 2 },

  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
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
    borderColor: "rgba(127,127,127,0.25)",
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
    backgroundColor: "#111",
    alignItems: "center",
  },
  btnSolidText: { color: "#fff", fontWeight: "900" },
  btnDisabled: { opacity: 0.6 },

  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 },
  line: { flex: 1, height: 1, backgroundColor: "rgba(127,127,127,0.25)" },

  btnOutline: {
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
  },
  btnOutlineText: { fontWeight: "900" },

  copy: { textAlign: "center", opacity: 0.6, marginTop: 12, fontSize: 12 },
});
