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
import { ThemedView } from "@/components/themed-view";
import { supabase } from "@/lib/supabase";

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

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
    return; // không chặn luồng
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
}

export default function RegisterScreen() {
  const router = useRouter();

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

      // ✅ SEED categories (CHỈ khi có session => tức là đã đăng nhập)
      if (data.session && user?.id) {
        await ensureSeedCategories(user.id);
        Alert.alert("Thành công", "Tạo tài khoản + danh mục mặc định thành công!");
        router.replace("/auth/login");
        return;
      }

      // ✅ Nếu confirm email => chưa có session => chưa seed được ngay
      Alert.alert(
        "Đăng ký gần xong!",
        "Bạn hãy kiểm tra email để xác nhận tài khoản. Khi bạn đăng nhập lần đầu, app sẽ tự tạo danh mục mặc định."
      );
      router.replace("/auth/login");
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
          <ThemedView style={styles.header}>
            <ThemedView style={styles.logo}>
              <ThemedText style={styles.logoText}>F</ThemedText>
            </ThemedView>

            <ThemedText type="title">Đăng ký</ThemedText>
            <ThemedText style={styles.muted}>
              Tạo tài khoản để bắt đầu quản lí chi tiêu.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <ThemedText style={styles.label}>Họ và tên</ThemedText>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color="#6B7280" />
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="vd: Phạm Hữu Tiến"
                style={styles.input}
              />
            </View>

            <ThemedText style={[styles.label, { marginTop: 12 }]}>
              Email
            </ThemedText>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color="#6B7280" />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="vd: tien@gmail.com"
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
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
                placeholder="Tối thiểu 6 ký tự"
                secureTextEntry={!showPass}
                style={styles.input}
              />
              <Pressable
                onPress={() => setShowPass((v) => !v)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPass ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color="#6B7280"
                />
              </Pressable>
            </View>

            <ThemedText style={[styles.label, { marginTop: 12 }]}>
              Xác nhận mật khẩu
            </ThemedText>
            <View style={styles.inputWrap}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#6B7280" />
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Nhập lại mật khẩu"
                secureTextEntry={!showConfirm}
                style={styles.input}
              />
              <Pressable
                onPress={() => setShowConfirm((v) => !v)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showConfirm ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color="#6B7280"
                />
              </Pressable>
            </View>

            <Pressable
              onPress={() => setAgree((v) => !v)}
              style={styles.termsRow}
              disabled={loading}
            >
              <View style={[styles.checkbox, agree && styles.checkboxOn]}>
                {agree && <Ionicons name="checkmark" size={14} color="#111" />}
              </View>
              <ThemedText style={{ flex: 1, fontWeight: "700", opacity: 0.9 }}>
                Tôi đồng ý Điều khoản & Chính sách
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={onRegister}
              style={[
                styles.btnSolid,
                (!canSubmit || loading) && styles.btnDisabled,
              ]}
              disabled={!canSubmit || loading}
            >
              {loading ? (
                <ActivityIndicator />
              ) : (
                <ThemedText style={styles.btnSolidText}>Tạo tài khoản</ThemedText>
              )}
            </Pressable>

            <View style={styles.footerRow}>
              <ThemedText style={styles.muted}>Đã có tài khoản?</ThemedText>
              <Link href="/auth/login" asChild>
                <Pressable disabled={loading}>
                  <ThemedText style={styles.link}>Đăng nhập</ThemedText>
                </Pressable>
              </Link>
            </View>
          </ThemedView>

          <ThemedText style={styles.copy}>© {new Date().getFullYear()} Finly</ThemedText>
        </ThemedView>
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

  termsRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },

  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: "#E5E7EB" },

  btnSolid: {
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: "#111",
    alignItems: "center",
  },
  btnSolidText: { color: "#fff", fontWeight: "900" },
  btnDisabled: { opacity: 0.6 },

  footerRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 14 },
  link: { fontSize: 13, fontWeight: "900", opacity: 0.95 },

  copy: { textAlign: "center", opacity: 0.6, marginTop: 12, fontSize: 12 },
});
