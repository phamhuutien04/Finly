import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Appearance,
    FlatList,
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
import { showError, showSuccess, showWarning } from "@/lib/globalAlert";
import { supabase } from "@/lib/supabase";

// Simple hook to get color scheme that works on all platforms
function useColorScheme() {
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());
  
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });
    
    return () => subscription.remove();
  }, []);
  
  return colorScheme;
}

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

type Friend = {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  email?: string;
};

const normalizeTxType = (t: any): TxType => (t === "income" ? "income" : "expense");

export default function ModalAddTransactionNoAccount() {
  const router = useRouter();
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Theme colors
  const screenBg = isDark ? '#111827' : '#ffffff';
  const cardBg = isDark ? '#1f2937' : '#f8f9fa';
  const text = isDark ? '#f9fafb' : '#1f2937';
  const subtleText = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const inputBg = isDark ? '#1f2937' : '#ffffff';
  const modalBg = isDark ? '#1f2937' : '#ffffff';
  const modalOverlayBg = isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)';
  const accentColor = '#6366f1';
  const selectedBg = isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<TxType>("expense");

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");

  const [amountText, setAmountText] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [transactionDate, setTransactionDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  // Split transaction states
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [showFriendPicker, setShowFriendPicker] = useState<boolean>(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState<string>("");

  // Format number with thousand separators
  const formatNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (!numbers) return '';
    return parseInt(numbers, 10).toLocaleString('vi-VN');
  };

  const handleAmountChange = (text: string) => {
    const formatted = formatNumber(text);
    setAmountText(formatted);
  };

  const amountNumber = useMemo(() => {
    const cleaned = amountText.replace(/[^\d]/g, "");
    return cleaned ? Number(cleaned) : 0;
  }, [amountText]);

  // Calculate split amount per person
  const splitAmount = useMemo(() => {
    const totalParticipants = selectedFriends.length + 1; // +1 for current user
    return totalParticipants > 1 ? Math.round(amountNumber / totalParticipants) : amountNumber;
  }, [amountNumber, selectedFriends.length]);

  const filteredFriends = useMemo(() => {
    if (!friendSearchQuery.trim()) return friends;
    return friends.filter(friend => 
      (friend.display_name || "").toLowerCase().includes(friendSearchQuery.toLowerCase()) ||
      (friend.email || "").toLowerCase().includes(friendSearchQuery.toLowerCase())
    );
  }, [friends, friendSearchQuery]);

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

  const fetchFriends = async () => {
    const uid = await getUserId();
    if (!uid) return [];

    try {
      // Get accepted friendships
      const { data: friendships, error } = await supabase
        .from("friendships")
        .select("friend_id")
        .eq("user_id", uid)
        .eq("status", "accepted");

      if (error || !friendships || friendships.length === 0) {
        return [];
      }

      // Get friend profiles
      const friendIds = friendships.map(f => f.friend_id);
      const { data: profiles, error: profileError } = await supabase
        .from("user_profiles")
        .select("id, user_id, display_name, avatar_url, email")
        .in("user_id", friendIds);

      if (profileError) {
        console.error("Error loading friend profiles:", profileError);
        return [];
      }

      return (profiles as Friend[]) || [];
    } catch (error) {
      console.error("Error fetching friends:", error);
      return [];
    }
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
        const friendsList = await fetchFriends();

        if (!mounted) return;
        setCategories(cats);
        setFriends(friendsList);

        // set mặc định theo type hiện tại (expense)
        setCategoryId(pickDefaultCategoryId(type, cats));
      } catch (e: any) {
        showError("Lỗi", e?.message ?? "Không tải được danh mục.");
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
        showWarning("Thiếu danh mục", `Bạn chưa có danh mục cho "${type === "expense" ? "Chi tiêu" : "Thu nhập"}".`);
        return;
      }

      if (!amountNumber || amountNumber <= 0) {
        showWarning("Số tiền không hợp lệ", "Nhập số tiền > 0 nhé.");
        return;
      }

      setSaving(true);

      const isSplit = selectedFriends.length > 0;
      const totalParticipants = selectedFriends.length + 1;

      if (isSplit) {
        // Create main transaction (split transaction)
        const { data: mainTransaction, error: mainError } = await supabase
          .from("transactions")
          .insert({
            user_id: user.id,
            category_id: categoryId,
            amount: splitAmount,
            type,
            transaction_date: transactionDate.toISOString(),
            note: note.trim() || null,
            is_split: true,
            split_total_amount: amountNumber,
            split_participants: totalParticipants,
          })
          .select(`
            *,
            category:categories(name, emoji, icon_uri)
          `)
          .single();

        if (mainError) throw mainError;

        // Create split participant record for current user
        const { error: participantError } = await supabase
          .from("split_transaction_participants")
          .insert({
            transaction_id: mainTransaction.id,
            user_id: user.id,
            amount: splitAmount,
            is_creator: true,
          });

        if (participantError) throw participantError;

        // Get current user's display name and selected category info
        const { data: currentUserProfile } = await supabase
          .from("user_profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .single();

        const { data: selectedCategory } = await supabase
          .from("categories")
          .select("name, type, emoji, icon_uri, icon_preset_id")
          .eq("id", categoryId)
          .single();

        const currentUserDisplayName = currentUserProfile?.display_name || user.email?.split('@')[0] || 'bạn';

        console.log(`🎯 Main transaction category:`, selectedCategory);
        console.log(`👤 Current user: ${currentUserDisplayName}`);
        console.log(`👥 Selected friends:`, selectedFriends.map(f => f.display_name));

        // Find matching category for each friend - prioritize same name, fallback to "Khác"
        const getMatchingCategoryForUser = async (userId: string) => {
          try {
            if (!selectedCategory) {
              console.log(`No selected category found`);
              return null;
            }

            console.log(`Looking for category "${selectedCategory.name}" (type: ${selectedCategory.type}) for user ${userId}`);

            // Step 1: Try to find existing category with EXACT same name and type
            const { data: exactMatch, error: findError } = await supabase
              .from("categories")
              .select("id")
              .eq("user_id", userId)
              .eq("name", selectedCategory.name)
              .eq("type", selectedCategory.type)
              .single();

            if (!findError && exactMatch) {
              console.log(`✅ Found exact match category ${exactMatch.id} for user ${userId}`);
              return exactMatch.id;
            }

            console.log(`❌ No exact match found for "${selectedCategory.name}", trying to create it...`);

            // Step 2: Try to create matching category with same name
            const { data: newCategory, error: createError } = await supabase
              .from("categories")
              .insert({
                user_id: userId,
                name: selectedCategory.name,
                type: selectedCategory.type,
                emoji: selectedCategory.emoji || '📝',
                icon_uri: selectedCategory.icon_uri,
                icon_preset_id: selectedCategory.icon_preset_id || 'other'
              })
              .select("id")
              .single();

            if (!createError && newCategory) {
              console.log(`✅ Created new category "${selectedCategory.name}" with id ${newCategory.id} for user ${userId}`);
              return newCategory.id;
            }

            console.log(`❌ Failed to create "${selectedCategory.name}":`, createError?.message);

            // Step 3: Fallback to "Khác" category with same type
            const { data: otherCategory, error: otherError } = await supabase
              .from("categories")
              .select("id")
              .eq("user_id", userId)
              .eq("name", "Khác")
              .eq("type", selectedCategory.type)
              .single();

            if (!otherError && otherCategory) {
              console.log(`✅ Using existing "Khác" category ${otherCategory.id} for user ${userId}`);
              return otherCategory.id;
            }

            console.log(`❌ No "Khác" category found, creating it...`);

            // Step 4: Create "Khác" category as final fallback
            const { data: createdOther, error: createOtherError } = await supabase
              .from("categories")
              .insert({
                user_id: userId,
                name: "Khác",
                type: selectedCategory.type,
                emoji: "📝",
                icon_uri: "https://cdn-icons-png.flaticon.com/512/3135/3135700.png",
                icon_preset_id: "other"
              })
              .select("id")
              .single();

            if (!createOtherError && createdOther) {
              console.log(`✅ Created "Khác" category ${createdOther.id} for user ${userId}`);
              return createdOther.id;
            }

            console.error(`❌ Failed to create "Khác" category for user ${userId}:`, createOtherError?.message);

            // Step 5: Last resort - find ANY category with same type
            const { data: anyCategory } = await supabase
              .from("categories")
              .select("id")
              .eq("user_id", userId)
              .eq("type", selectedCategory.type)
              .limit(1)
              .single();

            if (anyCategory) {
              console.log(`⚠️ Using any available category ${anyCategory.id} for user ${userId}`);
              return anyCategory.id;
            }

            console.error(`❌ No suitable category found for user ${userId}`);
            return null;

          } catch (error) {
            console.error("❌ Unexpected error in getMatchingCategoryForUser:", error);
            return null;
          }
        };

        // Create transactions for each friend with matching category
        const friendTransactions = [];
        for (const friend of selectedFriends) {
          console.log(`\n🔍 Processing friend: ${friend.display_name} (${friend.user_id})`);
          
          const friendCategoryId = await getMatchingCategoryForUser(friend.user_id);
          
          console.log(`📁 Friend ${friend.display_name}: categoryId = ${friendCategoryId}`);
          
          const friendTransaction = {
            user_id: friend.user_id,
            category_id: friendCategoryId,
            amount: splitAmount,
            type,
            transaction_date: transactionDate.toISOString(),
            note: `Chia tiền với ${currentUserDisplayName}: ${note.trim() || 'Giao dịch'}`,
            is_split: true,
            split_total_amount: amountNumber,
            split_participants: totalParticipants,
            original_transaction_id: mainTransaction.id,
          };
          
          console.log(`💾 Friend transaction for ${friend.display_name}:`, friendTransaction);
          friendTransactions.push(friendTransaction);
        }

        console.log(`Creating ${friendTransactions.length} friend transactions:`, friendTransactions);

        const { data: friendTransactionData, error: friendError } = await supabase
          .from("transactions")
          .insert(friendTransactions)
          .select();

        if (friendError) {
          console.error("Error creating friend transactions:", friendError);
          // Don't throw error, just log it - main transaction already succeeded
          showWarning(
            "Cảnh báo", 
            `Giao dịch chính đã lưu thành công, nhưng có lỗi khi tạo giao dịch cho bạn bè: ${friendError.message}`
          );
        } else {
          console.log(`Successfully created ${friendTransactionData?.length || 0} friend transactions`);
        }

        // Create split participant records for friends (only if friend transactions were created successfully)
        if (friendTransactionData && friendTransactionData.length > 0) {
          const friendParticipants = friendTransactionData.map((tx) => ({
            transaction_id: tx.id,
            user_id: tx.user_id,
            amount: splitAmount,
            is_creator: false,
          }));

          const { error: friendParticipantError } = await supabase
            .from("split_transaction_participants")
            .insert(friendParticipants);

          if (friendParticipantError) {
            console.error("Error creating friend participant records:", friendParticipantError);
            // Don't throw error, just log it
          }
        }

        showSuccess(
          "Thành công", 
          `Đã chia ${amountNumber.toLocaleString('vi-VN')}đ cho ${totalParticipants} người (${splitAmount.toLocaleString('vi-VN')}đ/người)!`
        );
      } else {
        // Regular transaction
        const { data: newTransaction, error: insErr } = await supabase
          .from("transactions")
          .insert({
            user_id: user.id,
            category_id: categoryId,
            amount: amountNumber,
            type,
            transaction_date: transactionDate.toISOString(),
            note: note.trim() || null,
          })
          .select(`
            *,
            category:categories(name, emoji, icon_uri)
          `)
          .single();

        if (insErr) throw insErr;
        
        // Không cần hiện thông báo, chỉ đóng modal
      }

      // Kiểm tra ngân sách nếu là giao dịch chi tiêu
      if (type === "expense" && checkBudgetAfterTransaction) {
        try {
          await checkBudgetAfterTransaction(
            user.id,
            Number(categoryId),
            isSplit ? splitAmount : amountNumber,
            transactionDate.toISOString().split('T')[0]
          );
        } catch (budgetError) {
          console.log('Lỗi kiểm tra ngân sách:', budgetError);
        }
      }

      // Navigate back to home screen
      router.back();

    } catch (e: any) {
      showError("Lỗi", e?.message ?? "Không lưu được giao dịch.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[{ flex: 1 }, { backgroundColor: screenBg }]}>
        <Stack.Screen options={{ title: "Thêm giao dịch" }} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={accentColor} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[{ flex: 1 }, { backgroundColor: screenBg }]}>
      <Stack.Screen options={{ title: "Thêm giao dịch" }} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ThemedView style={[styles.screen, { backgroundColor: screenBg }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Type switch */}
            <ThemedText style={[styles.label, { color: text }]}>Loại</ThemedText>
            <View style={styles.pillsRow}>
              <Pressable 
                onPress={() => setType("expense")} 
                style={[
                  styles.pill, 
                  { borderColor: borderColor, backgroundColor: type === "expense" ? '#ef4444' : inputBg }
                ]}
              >
                <ThemedText style={[styles.pillText, { color: type === "expense" ? '#fff' : text }]}>
                  Chi tiêu
                </ThemedText>
              </Pressable>

              <Pressable 
                onPress={() => setType("income")} 
                style={[
                  styles.pill, 
                  { borderColor: borderColor, backgroundColor: type === "income" ? '#10b981' : inputBg }
                ]}
              >
                <ThemedText style={[styles.pillText, { color: type === "income" ? '#fff' : text }]}>
                  Thu nhập
                </ThemedText>
              </Pressable>
            </View>

            {/* Category select */}
            <ThemedText style={[styles.label, { marginTop: 14, color: text }]}>Danh mục</ThemedText>
            <View style={[styles.selectBox, { borderColor: borderColor, backgroundColor: cardBg }]}>
              {filteredCategories.map((c) => {
                const idStr = String(c.id);
                const selected = idStr === categoryId;

                return (
                  <Pressable
                    key={idStr}
                    onPress={() => setCategoryId(idStr)}
                    style={[
                      styles.selectItem, 
                      { borderColor: borderColor, backgroundColor: selected ? selectedBg : 'transparent' }
                    ]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={[styles.iconBox, { borderColor: borderColor }]}>
                        {c.icon_uri ? (
                          <Image source={{ uri: c.icon_uri }} style={{ width: 22, height: 22, borderRadius: 6 }} />
                        ) : (
                          <ThemedText style={{ fontSize: 16 }}>{c.emoji ?? "🏷️"}</ThemedText>
                        )}
                      </View>

                      <ThemedText style={{ fontWeight: "800", color: text }}>
                        {c.name ?? "Khác"}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}

              {filteredCategories.length === 0 && (
                <ThemedText style={{ opacity: 0.7, color: subtleText }}>
                  Không có danh mục cho "{type === "expense" ? "Chi tiêu" : "Thu nhập"}".
                  Hãy tạo thêm trong bảng categories.
                </ThemedText>
              )}
            </View>

            {/* Amount */}
            <ThemedText style={[styles.label, { marginTop: 14, color: text }]}>Số tiền</ThemedText>
            <View style={[styles.inputWrap, { borderColor: borderColor, backgroundColor: inputBg }]}>
              <TextInput
                value={amountText}
                onChangeText={handleAmountChange}
                placeholder="Ví dụ: 35.000"
                placeholderTextColor={subtleText}
                keyboardType="number-pad"
                style={[styles.input, { color: text }]}
              />
            </View>

            {/* Transaction Date */}
            <ThemedText style={[styles.label, { marginTop: 14, color: text }]}>Ngày giao dịch</ThemedText>
            <Pressable onPress={() => setShowDatePicker(true)} style={[styles.inputWrap, { borderColor: borderColor, backgroundColor: inputBg }]}>
              <ThemedText style={{ fontSize: 15, color: text }}>
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
                    style={[styles.btn, { marginTop: 8, backgroundColor: accentColor }]}
                  >
                    <ThemedText style={styles.btnText}>Xong</ThemedText>
                  </Pressable>
                )}
              </View>
            )}

            {/* Date Picker for Web */}
            {Platform.OS === "web" && showDatePicker && (
              <View style={[styles.webDatePicker, { backgroundColor: modalOverlayBg }]}>
                <View style={[styles.webDatePickerContent, { backgroundColor: modalBg }]}>
                  <ThemedText style={[styles.label, { marginBottom: 12, color: text }]}>Chọn ngày và giờ</ThemedText>
                  
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
                      border: `1px solid ${borderColor}`,
                      marginBottom: 12,
                      width: "100%",
                      backgroundColor: inputBg,
                      color: text,
                    }}
                  />

                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      onPress={() => setShowDatePicker(false)}
                      style={[styles.btn, { flex: 1, backgroundColor: accentColor }]}
                    >
                      <ThemedText style={styles.btnText}>Xác nhận</ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => setShowDatePicker(false)}
                      style={[styles.btnGhost, { flex: 1, borderColor: borderColor }]}
                    >
                      <ThemedText style={[styles.btnGhostText, { color: text }]}>Hủy</ThemedText>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {/* Note */}
            <ThemedText style={[styles.label, { marginTop: 14, color: text }]}>Ghi chú</ThemedText>
            <View style={[styles.inputWrap, { borderColor: borderColor, backgroundColor: inputBg }]}>
              <TextInput 
                value={note} 
                onChangeText={setNote} 
                placeholder="Ví dụ: Trà sữa" 
                placeholderTextColor={subtleText}
                style={[styles.input, { color: text }]} 
              />
            </View>

            {/* Split with Friends */}
            {type === "expense" && (
              <>
                <ThemedText style={[styles.label, { marginTop: 14, color: text }]}>Chia tiền với bạn bè</ThemedText>
                
                {/* Selected Friends */}
                {selectedFriends.length > 0 && (
                  <View style={styles.selectedFriendsContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {selectedFriends.map((friend) => (
                        <View key={friend.user_id} style={styles.selectedFriendItem}>
                          <View style={[styles.friendAvatar, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
                            {friend.avatar_url ? (
                              <Image source={{ uri: friend.avatar_url }} style={styles.friendAvatarImage} />
                            ) : (
                              <Ionicons name="person" size={20} color={subtleText} />
                            )}
                          </View>
                          <ThemedText style={[styles.friendName, { color: text }]} numberOfLines={1}>
                            {friend.display_name || "Bạn"}
                          </ThemedText>
                          <Pressable
                            onPress={() => setSelectedFriends(prev => prev.filter(f => f.user_id !== friend.user_id))}
                            style={styles.removeFriendButton}
                          >
                            <Ionicons name="close-circle" size={16} color="#ef4444" />
                          </Pressable>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Add Friends Button */}
                <Pressable onPress={() => setShowFriendPicker(true)} style={[styles.addFriendButton, { borderColor: accentColor }]}>
                  <Ionicons name="person-add" size={20} color={accentColor} />
                  <ThemedText style={[styles.addFriendButtonText, { color: accentColor }]}>
                    {selectedFriends.length > 0 ? "Thêm bạn khác" : "Thêm bạn bè"}
                  </ThemedText>
                </Pressable>

                {/* Split Amount Display */}
                {selectedFriends.length > 0 && amountNumber > 0 && (
                  <View style={[styles.splitInfoContainer, { backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#f0f9ff', borderColor: isDark ? '#1e40af' : '#bae6fd' }]}>
                    <ThemedText style={[styles.splitInfoText, { color: isDark ? '#93c5fd' : '#0369a1' }]}>
                      Tổng: {amountNumber.toLocaleString('vi-VN')}đ ÷ {selectedFriends.length + 1} người = {splitAmount.toLocaleString('vi-VN')}đ/người
                    </ThemedText>
                  </View>
                )}
              </>
            )}

            {/* Friend Picker Modal */}
            {showFriendPicker && (
              <View style={[styles.friendPickerModal, { backgroundColor: modalOverlayBg }]}>
                <View style={[styles.friendPickerContent, { backgroundColor: modalBg }]}>
                  <View style={styles.friendPickerHeader}>
                    <ThemedText style={[styles.friendPickerTitle, { color: text }]}>Chọn bạn bè</ThemedText>
                    <Pressable onPress={() => setShowFriendPicker(false)}>
                      <Ionicons name="close" size={24} color={subtleText} />
                    </Pressable>
                  </View>

                  <View style={[styles.friendSearchContainer, { backgroundColor: isDark ? '#374151' : '#f9fafb' }]}>
                    <Ionicons name="search" size={20} color={subtleText} />
                    <TextInput
                      style={[styles.friendSearchInput, { color: text }]}
                      placeholder="Tìm kiếm bạn bè..."
                      placeholderTextColor={subtleText}
                      value={friendSearchQuery}
                      onChangeText={setFriendSearchQuery}
                    />
                  </View>

                  <FlatList
                    data={filteredFriends}
                    keyExtractor={(item) => item.user_id}
                    style={styles.friendsList}
                    renderItem={({ item }) => {
                      const isSelected = selectedFriends.some(f => f.user_id === item.user_id);
                      return (
                        <Pressable
                          style={[
                            styles.friendItem, 
                            { backgroundColor: isSelected ? selectedBg : 'transparent' }
                          ]}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedFriends(prev => prev.filter(f => f.user_id !== item.user_id));
                            } else {
                              setSelectedFriends(prev => [...prev, item]);
                            }
                          }}
                        >
                          <View style={[styles.friendAvatar, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
                            {item.avatar_url ? (
                              <Image source={{ uri: item.avatar_url }} style={styles.friendAvatarImage} />
                            ) : (
                              <Ionicons name="person" size={24} color={subtleText} />
                            )}
                          </View>
                          <View style={styles.friendInfo}>
                            <ThemedText style={[styles.friendDisplayName, { color: text }]}>
                              {item.display_name || "Bạn"}
                            </ThemedText>
                            {item.email && (
                              <ThemedText style={[styles.friendEmail, { color: subtleText }]}>
                                {item.email}
                              </ThemedText>
                            )}
                          </View>
                          <View style={[
                            styles.friendCheckbox, 
                            { borderColor: isSelected ? accentColor : borderColor, backgroundColor: isSelected ? accentColor : 'transparent' }
                          ]}>
                            {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                          </View>
                        </Pressable>
                      );
                    }}
                    ListEmptyComponent={
                      <View style={styles.emptyFriends}>
                        <Ionicons name="people-outline" size={48} color={borderColor} />
                        <ThemedText style={[styles.emptyFriendsText, { color: subtleText }]}>
                          {friendSearchQuery ? "Không tìm thấy bạn bè" : "Chưa có bạn bè nào"}
                        </ThemedText>
                      </View>
                    }
                  />

                  <Pressable
                    onPress={() => setShowFriendPicker(false)}
                    style={[styles.friendPickerDoneButton, { backgroundColor: accentColor }]}
                  >
                    <ThemedText style={styles.friendPickerDoneText}>
                      Xong ({selectedFriends.length})
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Save */}
            <Pressable onPress={save} disabled={saving} style={[styles.btn, { backgroundColor: accentColor }, saving && { opacity: 0.6 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.btnText}>Lưu giao dịch</ThemedText>}
            </Pressable>

            <Pressable onPress={() => router.back()} disabled={saving} style={[styles.btnGhost, { borderColor: borderColor }]}>
              <ThemedText style={[styles.btnGhostText, { color: text }]}>Hủy</ThemedText>
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
    borderWidth: 1,
  },

  selectBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
    gap: 8,
  },
  selectItem: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },

  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  inputWrap: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
  },
  input: { fontSize: 15 },

  btn: {
    marginTop: 16,
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "900" },

  btnGhost: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  btnGhostText: { fontWeight: "900", opacity: 0.9 },

  webDatePicker: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  webDatePickerContent: {
    borderRadius: 16,
    padding: 20,
    width: "90%",
    maxWidth: 400,
  },

  // Split with Friends Styles
  selectedFriendsContainer: {
    marginBottom: 12,
  },
  selectedFriendItem: {
    alignItems: "center",
    marginRight: 12,
    width: 80,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  friendAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  friendName: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  removeFriendButton: {
    position: "absolute",
    top: -4,
    right: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
  },
  addFriendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    marginBottom: 12,
  },
  addFriendButtonText: {
    fontWeight: "700",
  },
  splitInfoContainer: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  splitInfoText: {
    fontWeight: "600",
    textAlign: "center",
  },

  // Friend Picker Modal Styles
  friendPickerModal: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  friendPickerContent: {
    borderRadius: 16,
    padding: 20,
    width: "90%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  friendPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  friendPickerTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  friendSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    gap: 8,
  },
  friendSearchInput: {
    flex: 1,
    fontSize: 15,
  },
  friendsList: {
    maxHeight: 300,
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  friendDisplayName: {
    fontSize: 16,
    fontWeight: "700",
  },
  friendEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  friendCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyFriends: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyFriendsText: {
    marginTop: 12,
    textAlign: "center",
  },
  friendPickerDoneButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  friendPickerDoneText: {
    color: "#fff",
    fontWeight: "700",
  },
});
