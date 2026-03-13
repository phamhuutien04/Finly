import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { supabase } from "@/lib/supabase";

const { width } = Dimensions.get("window");

type CategoryType = "expense" | "income";

type CategoryRow = {
  id: number;
  user_id?: string | null;
  name?: string | null;
  type?: CategoryType | string | null;
  emoji?: string | null;
  icon_uri?: string | null;
  icon_preset_id?: string | null;
  created_at?: string | null;
  total_amount?: number | null;
};

type IconFromDb = { id: string; uri: string; label: string };

const normalizeType = (t: any): CategoryType => (t === "income" ? "income" : "expense");

const formatVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

export default function CategoriesScreen() {
  const [activeType, setActiveType] = useState<CategoryType>("expense");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedDay, setSelectedDay] = useState(currentDay);
  const [filterMode, setFilterMode] = useState<"today" | "month" | "year" | "custom">("month");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [formType, setFormType] = useState<CategoryType>("expense");
  const [iconUri, setIconUri] = useState<string>("");
  const [uploadedIconUrl, setUploadedIconUrl] = useState<string>("");
  const [iconPresetId, setIconPresetId] = useState<string>("");

  const router = useRouter();

  const getUserId = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  };

  const getDateRangeISO = () => {
    let start: Date;
    let end: Date = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);

    if (filterMode === "today") {
      start = new Date(selectedYear, selectedMonth - 1, selectedDay, 0, 0, 0);
      end = new Date(selectedYear, selectedMonth - 1, selectedDay, 23, 59, 59, 999);
    } else if (filterMode === "month") {
      start = new Date(selectedYear, selectedMonth - 1, 1);
    } else if (filterMode === "year") {
      start = new Date(selectedYear, 0, 1);
      end = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
    } else {
      start = new Date(selectedYear, selectedMonth - 1, 1);
    }

    return { startISO: start.toISOString(), endISO: end.toISOString() };
  };

  const fetchCategories = async () => {
    setLoading(true);
    const uid = await getUserId();
    const selectCols = "id, user_id, name, type, emoji, icon_uri, icon_preset_id, created_at";

    try {
      let query = supabase.from("categories").select(selectCols);
      if (uid) query = query.eq("user_id", uid);

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;

      const { startISO, endISO } = getDateRangeISO();
      const { data: txData } = await supabase
        .from("transactions")
        .select("category_id, type, amount")
        .eq("user_id", uid)
        .gte("transaction_date", startISO)
        .lt("transaction_date", endISO);

      const categoryTotals: Record<number, number> = {};
      let income = 0;
      let expense = 0;

      txData?.forEach((t) => {
        const amt = Number(t.amount ?? 0);
        if (t.type === "income") income += amt;
        else expense += amt;

        const catId = t.category_id;
        if (catId) {
          categoryTotals[catId] = (categoryTotals[catId] || 0) + (t.type === "income" ? amt : -amt);
        }
      });

      setTotalIncome(income);
      setTotalExpense(expense);

      const categoriesWithTotals = data?.map((c) => ({
        ...c,
        total_amount: categoryTotals[c.id] ?? 0,
      })) ?? [];

      setCategories(categoriesWithTotals);
    } catch (e: any) {
      Alert.alert("Lỗi tải dữ liệu", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();

    // Realtime subscription cho categories và transactions
    const setupRealtimeSubscriptions = async () => {
      const userId = await getUserId();
      if (!userId) return;

      console.log('🔄 Setting up realtime subscriptions for categories page');

      // Subscribe to categories và transactions changes
      const categoriesChannel = supabase
        .channel('categories_page_updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'categories',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            console.log('📂 New category added:', payload.new);
            const newCategory = payload.new as CategoryRow;
            setCategories(prev => [{ ...newCategory, total_amount: 0 }, ...prev]);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'categories',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            console.log('📂 Category updated:', payload.new);
            const updatedCategory = payload.new as CategoryRow;
            setCategories(prev => prev.map(cat => 
              cat.id === updatedCategory.id 
                ? { ...updatedCategory, total_amount: cat.total_amount }
                : cat
            ));
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'categories',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            console.log('📂 Category deleted:', payload.old);
            const deletedCategory = payload.old as CategoryRow;
            setCategories(prev => prev.filter(cat => cat.id !== deletedCategory.id));
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            console.log('📊 Transaction changed, updating category totals:', payload.eventType);
            // Reload để cập nhật total amounts cho categories
            fetchCategories();
          }
        )
        .subscribe((status) => {
          console.log('📡 Categories realtime status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Categories page realtime connected');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Categories page realtime error');
          }
        });

      return categoriesChannel;
    };

    let realtimeChannel: any = null;
    setupRealtimeSubscriptions().then(channel => {
      realtimeChannel = channel;
    });

    return () => {
      if (realtimeChannel) {
        console.log('🧹 Cleaning up categories realtime subscriptions');
        realtimeChannel.unsubscribe();
      }
    };
  }, [selectedYear, selectedMonth, selectedDay, filterMode]);

  const hasTypeCol = useMemo(() => categories.some((c) => c.type != null), [categories]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    let arr = categories;
    if (hasTypeCol) arr = arr.filter((c) => normalizeType(c.type) === activeType);
    return arr.filter((c) => (c.name ?? "").toLowerCase().includes(kw));
  }, [categories, activeType, q, hasTypeCol]);

  const iconLibraryFromDb: IconFromDb[] = useMemo(() => {
    const map = new Map<string, IconFromDb>();
    for (const c of categories) {
      const pid = c.icon_preset_id?.trim();
      const uri = c.icon_uri?.trim();
      if (!pid || !uri || uri.startsWith("blob:")) continue;
      const key = `${pid}__${uri}`;
      if (!map.has(key)) {
        map.set(key, { id: pid, uri, label: (c.name?.trim() || pid).toString() });
      }
    }
    return Array.from(map.values());
  }, [categories]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setEmoji("");
    setFormType(activeType);
    setIconUri("");
    setUploadedIconUrl("");
    setIconPresetId("");
    setOpen(true);
  };

  const openEdit = (c: CategoryRow) => {
    setEditing(c);
    setName(c.name ?? "");
    setEmoji(c.emoji ?? "");
    setFormType(normalizeType(c.type));
    setIconUri(c.icon_uri ?? "");
    setUploadedIconUrl(c.icon_uri ?? "");
    setIconPresetId(c.icon_preset_id ?? "");
    setOpen(true);
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Thiếu quyền", "Bạn cần cho phép truy cập thư viện ảnh.");
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!res.canceled && res.assets?.[0]?.uri) {
      setIconUri(res.assets[0].uri);
      setUploadedIconUrl("");
      setIconPresetId("");
    }
  };

  const uploadImageToStorage = async (localUri: string): Promise<string | null> => {
    try {
      const response = await fetch(localUri);
      const blob = await response.blob();
      const fileName = `category-${Date.now()}.jpg`;
      const filePath = `icons/${fileName}`;

      const { error } = await supabase.storage
        .from("category-icons")
        .upload(filePath, blob, { contentType: "image/jpeg", upsert: true });

      if (error) throw error;

      const { data } = supabase.storage.from("category-icons").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (e: any) {
      Alert.alert("Lỗi upload", e.message || "Kiểm tra bucket 'category-icons'");
      return null;
    }
  };

  const chooseFromDbLibrary = (it: IconFromDb) => {
    setIconPresetId(it.id);
    setIconUri(it.uri);
    setUploadedIconUrl(it.uri);
  };

  const clearIcon = () => {
    setIconUri("");
    setUploadedIconUrl("");
    setIconPresetId("");
  };

  const onSave = async () => {
    if (saving) return;
    const n = name.trim();
    const e = emoji.trim();

    if (!n) {
      Alert.alert("Thiếu tên", "Bạn nhập tên danh mục nhé.");
      return;
    }

    const uid = await getUserId();
    let finalIconUri = uploadedIconUrl || iconUri;

    if (iconUri && (iconUri.startsWith("file://") || iconUri.startsWith("blob:"))) {
      const uploadedUrl = await uploadImageToStorage(iconUri);
      if (uploadedUrl) {
        finalIconUri = uploadedUrl;
      } else {
        return;
      }
    }

    const payload: any = {
      name: n,
      type: formType,
      emoji: e || null,
      icon_uri: finalIconUri || null,
      icon_preset_id: iconPresetId || null,
    };
    if (uid) payload.user_id = uid;

    try {
      setSaving(true);
      if (editing) {
        const { error } = await supabase.from("categories").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert([payload]);
        if (error) throw error;
      }

      setOpen(false);
      await fetchCategories();
      Alert.alert("Thành công", editing ? "Đã sửa danh mục" : "Đã thêm danh mục mới");
    } catch (e: any) {
      Alert.alert("Lỗi lưu", e.message || "Kiểm tra kết nối");
    } finally {
      setSaving(false);
    }
  };

  const setFilterToday = () => {
    setFilterMode("today");
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);
    setSelectedDay(currentDay);
  };

  const setFilterThisMonth = () => {
    setFilterMode("month");
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);
  };

  const setFilterThisYear = () => {
    setFilterMode("year");
    setSelectedYear(currentYear);
  };

  return (
    <ThemedView style={styles.screen}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.columnWrap}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.title}>Danh mục</ThemedText>
                <ThemedText style={styles.subtitle}>Quản lý danh mục thu chi</ThemedText>
              </View>

              <Pressable
                onPress={openCreate}
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <ThemedText style={styles.addButtonText}>+</ThemedText>
              </Pressable>
            </View>

            <View style={styles.statsCard}>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <ThemedText style={styles.statLabel}>Thu nhập</ThemedText>
                  <ThemedText style={[styles.statValue, { color: "#10b981" }]}>
                    {formatVND(totalIncome)}
                  </ThemedText>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statBox}>
                  <ThemedText style={styles.statLabel}>Chi tiêu</ThemedText>
                  <ThemedText style={[styles.statValue, { color: "#ef4444" }]}>
                    {formatVND(totalExpense)}
                  </ThemedText>
                </View>
              </View>
            </View>

            <View style={styles.quickFilters}>
              <Pressable
                onPress={setFilterToday}
                style={[styles.filterChip, filterMode === "today" && styles.filterChipActive]}
              >
                <ThemedText
                  style={[styles.filterChipText, filterMode === "today" && styles.filterChipTextActive]}
                >
                  Hôm nay
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={setFilterThisMonth}
                style={[styles.filterChip, filterMode === "month" && styles.filterChipActive]}
              >
                <ThemedText
                  style={[styles.filterChipText, filterMode === "month" && styles.filterChipTextActive]}
                >
                  Tháng này
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={setFilterThisYear}
                style={[styles.filterChip, filterMode === "year" && styles.filterChipActive]}
              >
                <ThemedText
                  style={[styles.filterChipText, filterMode === "year" && styles.filterChipTextActive]}
                >
                  Năm nay
                </ThemedText>
              </Pressable>
            </View>

            {hasTypeCol && (
              <View style={styles.typeToggle}>
                <Pressable
                  onPress={() => setActiveType("expense")}
                  style={[
                    styles.toggleBtn,
                    activeType === "expense" && styles.toggleBtnActiveExpense,
                  ]}
                >
                  <ThemedText style={styles.toggleText}>Chi tiêu</ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => setActiveType("income")}
                  style={[
                    styles.toggleBtn,
                    activeType === "income" && styles.toggleBtnActiveIncome,
                  ]}
                >
                  <ThemedText style={styles.toggleText}>Thu nhập</ThemedText>
                </Pressable>
              </View>
            )}

            <View style={styles.searchContainer}>
              <ThemedText style={styles.searchIcon}>🔍</ThemedText>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Tìm danh mục..."
                placeholderTextColor="#9ca3af"
                style={styles.searchInput}
              />
            </View>

            <ThemedText style={styles.sectionTitle}>
              {filtered.length} danh mục
            </ThemedText>
          </>
        }
        renderItem={({ item }) => <CategoryCard item={item} onEdit={openEdit} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color="#666" />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <ThemedText style={styles.emptyIcon}>📂</ThemedText>
              <ThemedText style={styles.emptyTitle}>Chưa có danh mục</ThemedText>
              <ThemedText style={styles.emptyDesc}>Nhấn nút + để tạo danh mục đầu tiên</ThemedText>
            </View>
          )
        }
      />

      <Modal visible={open} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>
              {editing ? "Sửa danh mục" : "Thêm danh mục"}
            </ThemedText>

            {hasTypeCol && (
              <View style={styles.modalTypeToggle}>
                <Pressable
                  disabled={!!editing}
                  onPress={() => setFormType("expense")}
                  style={[
                    styles.modalTypeBtn,
                    formType === "expense" && styles.modalTypeBtnActiveExpense,
                    editing && { opacity: 0.6 },
                  ]}
                >
                  <ThemedText style={styles.modalTypeText}>Chi tiêu</ThemedText>
                </Pressable>

                <Pressable
                  disabled={!!editing}
                  onPress={() => setFormType("income")}
                  style={[
                    styles.modalTypeBtn,
                    formType === "income" && styles.modalTypeBtnActiveIncome,
                    editing && { opacity: 0.6 },
                  ]}
                >
                  <ThemedText style={styles.modalTypeText}>Thu nhập</ThemedText>
                </Pressable>
              </View>
            )}

            <View style={styles.inputContainer}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Tên danh mục"
                placeholderTextColor="#9ca3af"
                style={styles.modalInput}
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                value={emoji}
                onChangeText={setEmoji}
                placeholder="Emoji (tùy chọn)"
                placeholderTextColor="#9ca3af"
                style={styles.modalInput}
              />
            </View>

            <View style={styles.iconSection}>
              <View style={styles.iconHeader}>
                <ThemedText style={styles.iconLabel}>Icon</ThemedText>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable onPress={pickFromLibrary} style={styles.iconBtn}>
                    <ThemedText style={styles.iconBtnText}>Chọn ảnh</ThemedText>
                  </Pressable>
                  <Pressable onPress={clearIcon} style={styles.iconBtnGhost}>
                    <ThemedText style={styles.iconBtnText}>Xóa</ThemedText>
                  </Pressable>
                </View>
              </View>

              {iconUri && (
                <View style={styles.iconPreview}>
                  <Image source={{ uri: iconUri }} style={styles.iconPreviewImage} />
                </View>
              )}

              {iconLibraryFromDb.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.iconLibrary}
                >
                  {iconLibraryFromDb.map((it) => {
                    const active = iconPresetId === it.id && iconUri === it.uri;
                    return (
                      <Pressable
                        key={`${it.id}__${it.uri}`}
                        onPress={() => chooseFromDbLibrary(it)}
                        style={[styles.iconLibraryItem, active && styles.iconLibraryItemActive]}
                      >
                        <Image source={{ uri: it.uri }} style={styles.iconLibraryImage} />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setOpen(false)}
                style={styles.modalBtnCancel}
                disabled={saving}
              >
                <ThemedText style={styles.modalBtnCancelText}>Hủy</ThemedText>
              </Pressable>

              <Pressable
                onPress={onSave}
                style={[styles.modalBtnSave, saving && { opacity: 0.7 }]}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.modalBtnSaveText}>Lưu</ThemedText>
                )}
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

function CategoryCard({ item, onEdit }: { item: CategoryRow; onEdit: (c: CategoryRow) => void }) {
  const isIncome = normalizeType(item.type) === "income";

  // Đảm bảo amount luôn là số hợp lệ, tránh NaN/undefined/null
  const amount = Number(item.total_amount ?? 0);

  // Xác định màu dựa trên giá trị amount
  const amountColor =
    amount > 0
      ? "#10b981"   // xanh lá - thu nhập hoặc danh mục có tổng dương
      : amount < 0
        ? "#ef4444" // đỏ - chi tiêu hoặc danh mục có tổng âm
        : "#9ca3af"; // xám - bằng 0 hoặc chưa có giao dịch

  return (
    <Pressable
      onPress={() => onEdit(item)}
      style={({ pressed }) => [
        styles.categoryCard,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.categoryContent}>
        {/* Icon hoặc Emoji */}
        <View style={styles.categoryIconContainer}>
          {item.icon_uri && !item.icon_uri.startsWith("blob:") ? (
            <Image source={{ uri: item.icon_uri }} style={styles.categoryIcon} />
          ) : item.emoji ? (
            <ThemedText style={styles.categoryEmoji}>{item.emoji}</ThemedText>
          ) : (
            <ThemedText style={styles.categoryEmoji}>🏷️</ThemedText>
          )}
        </View>

        {/* Tên danh mục */}
        <ThemedText style={styles.categoryName} numberOfLines={1}>
          {item.name ?? `#${item.id}`}
        </ThemedText>

        {/* Badge Thu / Chi */}
        <View
          style={[
            styles.categoryBadge,
            {
              backgroundColor: isIncome
                ? "rgba(16, 185, 129, 0.12)" 
                : "rgba(239, 68, 68, 0.12)",
            },
          ]}
        >
          <ThemedText style={styles.categoryBadgeText}>
            {isIncome ? "Thu" : "Chi"}
          </ThemedText>
        </View>

        {/* Số tiền + màu + dấu + */}
        <ThemedText style={[styles.categoryAmount, { color: amountColor }]}>
          {amount > 0 ? "+" : amount < 0 ? "-" : ""}
          {formatVND(Math.abs(amount))}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  addButtonText: {
    fontSize: 32,
    color: "white",
    fontWeight: "bold",
  },

  statsCard: {
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.1)",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    fontWeight: "600",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(0,0,0,0.12)",
    marginHorizontal: 16,
  },

  quickFilters: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.12)",
    alignItems: "center",
  },
  filterChipActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.8,
  },
  filterChipTextActive: {
    color: "white",
    opacity: 1,
  },

  typeToggle: {
    flexDirection: "row",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.12)",
    marginBottom: 20,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  toggleBtnActiveExpense: {
    backgroundColor: "rgba(239,68,68,0.15)",
  },
  toggleBtnActiveIncome: {
    backgroundColor: "rgba(16,185,129,0.15)",
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.12)",
    marginBottom: 16,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
    opacity: 0.6,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#000",
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    opacity: 0.7,
    marginBottom: 12,
  },

  columnWrap: {
    gap: 12,
  },

  categoryCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.1)",
    overflow: "hidden",
  },
  categoryContent: {
    padding: 16,
  },
  categoryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  categoryEmoji: {
    fontSize: 32,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  categoryAmount: {
    fontSize: 15,
    fontWeight: "700",
  },

  emptyContainer: {
    paddingVertical: 80,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.6,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: "center",
  },

  // ── Modal ───────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 24,
  },

  modalTypeToggle: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  modalTypeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.12)",
    alignItems: "center",
  },
  modalTypeBtnActiveExpense: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderColor: "rgba(239,68,68,0.4)",
  },
  modalTypeBtnActiveIncome: {
    backgroundColor: "rgba(16,185,129,0.15)",
    borderColor: "rgba(16,185,129,0.4)",
  },
  modalTypeText: {
    fontSize: 14,
    fontWeight: "600",
  },

  inputContainer: {
    marginBottom: 16,
  },
  modalInput: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.12)",
    fontSize: 16,
  },

  iconSection: {
    marginBottom: 24,
  },
  iconHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  iconLabel: {
    fontSize: 14,
    fontWeight: "600",
    opacity: 0.8,
  },
  iconBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(59,130,246,0.15)",
  },
  iconBtnGhost: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.2)",
  },
  iconBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  iconPreview: {
    alignSelf: "flex-start",
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.12)",
    marginBottom: 12,
  },
  iconPreviewImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  iconLibrary: {
    flexDirection: "row",
    gap: 12,
  },
  iconLibraryItem: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconLibraryItemActive: {
    borderColor: "#3b82f6",
    borderWidth: 2,
  },
  iconLibraryImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },

  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.08)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
    alignItems: "center",
  },
  modalBtnCancelText: {
    fontSize: 16,
    fontWeight: "600",
    opacity: 0.9,
  },
  modalBtnSave: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#3b82f6",
    alignItems: "center",
  },
  modalBtnSaveText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});