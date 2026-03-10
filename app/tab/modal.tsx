import { Stack, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { supabase } from "@/lib/supabase";

// Import notification functions conditionally
let requestNotificationPermissions: any = null;
let checkBudgetAfterTransaction: any = null;

try {
  const notifications = require("@/lib/budgetNotification");
  requestNotificationPermissions = notifications.requestNotificationPermissions;
  checkBudgetAfterTransaction = notifications.checkBudgetAfterTransaction;
} catch (error) {
  // Fallback functions if import fails
  requestNotificationPermissions = async () => {
    if (Platform.OS === 'web' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  };
  
  checkBudgetAfterTransaction = async () => {
    console.log('Budget check not available');
  };
}

// Chỉ import DateTimePicker khi không phải web
let DateTimePicker: any = null;
if (Platform.OS !== "web") {
  DateTimePicker = require("@react-native-community/datetimepicker").default;
}

type TxType = "income" | "expense";

type CategoryRow = {
  id: string | number; // bigint có thể về number
  user_id?: string | null;
  name?: string | null;
  type?: string | null; // income/expense/null
  emoji?: string | null;
  icon_uri?: string | null;
  icon_preset_id?: string | null;
};

const normalizeTxType = (t: any): TxType => (t === "income" ? "income" : "expense");

export default function ModalAddTransactionNoAccount() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<TxType>("expense");

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");

  const [amountText, setAmountText] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [transactionDate, setTransactionDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  const amountNumber = useMemo(() => {
    const cleaned = amountText.replace(/[^\d]/g, "");
    return cleaned ? Number(cleaned) : 0;
  }, [amountText]);

  const getUserId = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  };

  const fetchCategories = async () => {
    const uid = await getUserId();
    const cols = "id,user_id,name,type,emoji,icon_uri,icon_preset_id,created_at";

    // 1) thử lọc theo user_id (nếu có uid)
    if (uid) {
      const { data, error } = await supabase
        .from("categories")
        .select(cols)
        .eq("user_id", uid)
        .order("id", { ascending: true });

      if (!error) {
        return (data as CategoryRow[]) ?? [];
      }

      // nếu lỗi do bảng không có cột user_id => fallback
      const msg = (error.message || "").toLowerCase();
      const noUserIdCol = msg.includes("column") && msg.includes("user_id") && msg.includes("does not exist");
      if (!noUserIdCol) {
        throw error;
      }
    }

    // 2) fallback: lấy tất cả
    const { data: data2, error: error2 } = await supabase
      .from("categories")
      .select(cols)
      .order("id", { ascending: true });

    if (error2) throw error2;
    return (data2 as CategoryRow[]) ?? [];
  };

  const filteredCategories = useMemo(() => {
    // category.type null => cho hiện hết
    return categories.filter((c) => !c.type || normalizeTxType(c.type) === type);
  }, [categories, type]);

  const pickDefaultCategoryId = (t: TxType, list: CategoryRow[]) => {
    const firstMatch = list.find((c) => !c.type || normalizeTxType(c.type) === t);
    return firstMatch ? String(firstMatch.id) : "";
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);

        const { data: sess } = await supabase.auth.getSession();
        const user = sess.session?.user;
        if (!user) {
          router.replace("/auth/login");
          return;
        }

        // Yêu cầu quyền thông báo (không cần lên lịch)
        const hasPermission = await requestNotificationPermissions();
        if (hasPermission) {
          console.log('✅ Đã có quyền thông báo, sẵn sàng gửi cảnh báo ngân sách');
        }

        const cats = await fetchCategories();

        if (!mounted) return;
        setCategories(cats);

        // set mặc định theo type hiện tại (expense)
        setCategoryId(pickDefaultCategoryId(type, cats));
      } catch (e: any) {
        Alert.alert("Lỗi", e?.message ?? "Không tải được danh mục.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // đổi Chi/Thu -> auto chọn lại categoryId phù hợp
  useEffect(() => {
    setCategoryId(pickDefaultCategoryId(type, categories));
  }, [type, categories]);

  const save = async () => {
    if (saving) return;

    try {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;
      if (!user) {
        router.replace("/auth/login");
        return;
      }

      if (!categoryId) {
        Alert.alert("Thiếu danh mục", `Bạn chưa có danh mục cho "${type === "expense" ? "Chi tiêu" : "Thu nhập"}".`);
        return;
      }

      if (!amountNumber || amountNumber <= 0) {
        Alert.alert("Số tiền không hợp lệ", "Nhập số tiền > 0 nhé.");
        return;
      }

      setSaving(true);

      // ✅ KHÔNG account_id
      const { error: insErr } = await supabase.from("transactions").insert({
        user_id: user.id,
        category_id: categoryId,
        amount: amountNumber,
        type,
        transaction_date: transactionDate.toISOString(),
        note: note.trim() || null,
      });

      if (insErr) throw insErr;

      // Kiểm tra ngân sách nếu là giao dịch chi tiêu
      if (type === "expense" && checkBudgetAfterTransaction) {
        try {
          await checkBudgetAfterTransaction(
            user.id,
            Number(categoryId),
            amountNumber,
            transactionDate.toISOString().split('T')[0]
          );
        } catch (budgetError) {
          console.log('Lỗi kiểm tra ngân sách:', budgetError);
          // Không hiển thị lỗi cho user vì đây chỉ là tính năng phụ
        }
      }

      Alert.alert("Thành công", "Đã thêm giao dịch!");
      router.back();
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message ?? "Không lưu được giao dịch.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <Stack.Screen options={{ title: "Thêm giao dịch" }} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "Thêm giao dịch" }} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ThemedView style={styles.screen}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Type switch */}
            <ThemedText style={styles.label}>Loại</ThemedText>
            <View style={styles.pillsRow}>
              <Pressable onPress={() => setType("expense")} style={[styles.pill, type === "expense" && styles.pillOn]}>
                <ThemedText style={[styles.pillText, type === "expense" && styles.pillTextOn]}>Chi tiêu</ThemedText>
              </Pressable>

              <Pressable onPress={() => setType("income")} style={[styles.pill, type === "income" && styles.pillOn]}>
                <ThemedText style={[styles.pillText, type === "income" && styles.pillTextOn]}>Thu nhập</ThemedText>
              </Pressable>
            </View>

            {/* Category select */}
            <ThemedText style={[styles.label, { marginTop: 14 }]}>Danh mục</ThemedText>
            <View style={styles.selectBox}>
              {filteredCategories.map((c) => {
                const idStr = String(c.id);
                const selected = idStr === categoryId;

                return (
                  <Pressable
                    key={idStr}
                    onPress={() => setCategoryId(idStr)}
                    style={[styles.selectItem, selected && styles.selectItemOn]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={styles.iconBox}>
                        {c.icon_uri ? (
                          <Image source={{ uri: c.icon_uri }} style={{ width: 22, height: 22, borderRadius: 6 }} />
                        ) : (
                          <ThemedText style={{ fontSize: 16 }}>{c.emoji ?? "🏷️"}</ThemedText>
                        )}
                      </View>

                      <ThemedText style={{ fontWeight: "800" }}>
                        {c.name ?? "Khác"}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}

              {filteredCategories.length === 0 && (
                <ThemedText style={{ opacity: 0.7 }}>
                  Không có danh mục cho "{type === "expense" ? "Chi tiêu" : "Thu nhập"}".
                  Hãy tạo thêm trong bảng categories.
                </ThemedText>
              )}
            </View>

            {/* Amount */}
            <ThemedText style={[styles.label, { marginTop: 14 }]}>Số tiền</ThemedText>
            <View style={styles.inputWrap}>
              <TextInput
                value={amountText}
                onChangeText={setAmountText}
                placeholder="vd: 35000"
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>

            {/* Transaction Date */}
            <ThemedText style={[styles.label, { marginTop: 14 }]}>Ngày giao dịch</ThemedText>
            <Pressable onPress={() => setShowDatePicker(true)} style={styles.inputWrap}>
              <ThemedText style={{ fontSize: 15 }}>
                {transactionDate.toLocaleDateString("vi-VN", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </ThemedText>
            </Pressable>

            {/* Date Picker for Mobile */}
            {Platform.OS !== "web" && showDatePicker && (
              <View>
                <DateTimePicker
                  value={transactionDate}
                  mode="datetime"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_event :any, selectedDate : any) => {
                    if (Platform.OS === "android") {
                      setShowDatePicker(false);
                    }
                    if (selectedDate) {
                      setTransactionDate(selectedDate);
                    }
                  }}
                />
                {Platform.OS === "ios" && (
                  <Pressable
                    onPress={() => setShowDatePicker(false)}
                    style={[styles.btn, { marginTop: 8, backgroundColor: "#007AFF" }]}
                  >
                    <ThemedText style={styles.btnText}>Xong</ThemedText>
                  </Pressable>
                )}
              </View>
            )}

            {/* Date Picker for Web */}
            {Platform.OS === "web" && showDatePicker && (
              <View style={styles.webDatePicker}>
                <View style={styles.webDatePickerContent}>
                  <ThemedText style={[styles.label, { marginBottom: 12 }]}>Chọn ngày và giờ</ThemedText>
                  
                  <input
                    type="datetime-local"
                    value={transactionDate.toISOString().slice(0, 16)}
                    onChange={(e: any) => {
                      const newDate = new Date(e.target.value);
                      if (!isNaN(newDate.getTime())) {
                        setTransactionDate(newDate);
                      }
                    }}
                    style={{
                      fontSize: 15,
                      borderRadius: 14,
                      paddingLeft: 12,
                      paddingRight: 12,
                      paddingTop: 12,
                      paddingBottom: 12,
                      borderWidth: 0.5,
                      borderColor: "rgba(127,127,127,0.25)",
                      marginBottom: 12,
                      width: "100%",
                    }}
                  />

                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      onPress={() => setShowDatePicker(false)}
                      style={[styles.btn, { flex: 1, backgroundColor: "#007AFF" }]}
                    >
                      <ThemedText style={styles.btnText}>Xác nhận</ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => setShowDatePicker(false)}
                      style={[styles.btnGhost, { flex: 1 }]}
                    >
                      <ThemedText style={styles.btnGhostText}>Hủy</ThemedText>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {/* Note */}
            <ThemedText style={[styles.label, { marginTop: 14 }]}>Ghi chú</ThemedText>
            <View style={styles.inputWrap}>
              <TextInput value={note} onChangeText={setNote} placeholder="vd: Trà sữa" style={styles.input} />
            </View>

            {/* Save */}
            <Pressable onPress={save} disabled={saving} style={[styles.btn, saving && { opacity: 0.6 }]}>
              {saving ? <ActivityIndicator /> : <ThemedText style={styles.btnText}>Lưu giao dịch</ThemedText>}
            </Pressable>

            <Pressable onPress={() => router.back()} disabled={saving} style={styles.btnGhost}>
              <ThemedText style={styles.btnGhostText}>Hủy</ThemedText>
            </Pressable>
          </ScrollView>
        </ThemedView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16 },

  label: { fontWeight: "900", marginBottom: 8 },

  pillsRow: { flexDirection: "row", gap: 10 },
  pill: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.35)",
  },
  pillOn: { backgroundColor: "rgba(127,127,127,0.12)" },
  pillText: { fontWeight: "900", opacity: 0.85 },
  pillTextOn: { opacity: 1 },

  selectBox: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
    padding: 8,
    gap: 8,
  },
  selectItem: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.15)",
  },
  selectItemOn: { backgroundColor: "rgba(127,127,127,0.12)" },

  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
  },

  inputWrap: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
  },
  input: { fontSize: 15 },

  btn: {
    marginTop: 16,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: "#111",
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "900" },

  btnGhost: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
  },
  btnGhostText: { fontWeight: "900", opacity: 0.9 },

  webDatePicker: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  webDatePickerContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "90%",
    maxWidth: 400,
  },
});
