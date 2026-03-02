import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  ActivityIndicator,
  TextInput,
  Alert,
  RefreshControl,
  Image,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { supabase } from "@/lib/supabase";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

type TxType = "income" | "expense" | "all";

type TransactionUI = {
  id: string;
  title: string;
  category: string;
  type: TxType;
  amount: number;
  time: string;
  date: string;
  dateObject: Date | null;
  iconEmoji?: string | null;
  iconUri?: string | null;
};

const formatVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

function formatDateLabel(date: Date | null) {
  if (!date) return "Chọn ngày";
  return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${date.getFullYear()}`;
}

// Web DatePicker Component - Đơn giản
const WebDatePicker = ({ value, onChange }: { value: Date; onChange: (date: Date) => void }) => {
  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateStr = e.target.value;
    if (dateStr) {
      const newDate = new Date(dateStr + 'T00:00:00');
      onChange(newDate);
    }
  };

  return (
    <input
      type="date"
      value={formatDateForInput(value)}
      onChange={handleChange}
      style={{
        padding: '12px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        backgroundColor: '#f1f5f9',
        fontSize: '16px',
        width: '100%',
        marginTop: '8px',
      }}
    />
  );
};

export default function AllTransactionsScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [txs, setTxs] = useState<TransactionUI[]>([]);
  const [filteredTxs, setFilteredTxs] = useState<TransactionUI[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<TxType>("all");

  // CHỈ 1 NGÀY DUY NHẤT
  const [showPicker, setShowPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Load tất cả transactions
  const loadTransactions = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const { data: txData, error } = await supabase
        .from("transactions")
        .select(`
          id,
          amount,
          type,
          note,
          occurred_at,
          created_at,
          category:categories ( name, emoji, icon_uri, icon_preset_id )
        `)
        .eq("user_id", user.id)
        .order("occurred_at", { ascending: false });

      if (error) throw error;

      const mapped: TransactionUI[] = (txData ?? []).map((r: any) => {
        const amt = Number(r.amount ?? 0);
        const cat = r.category ?? {};
        const catName = cat.name?.trim() || cat.icon_preset_id?.trim() || "Khác";
        const title = r.note?.trim() || catName;
        const timeIso = r.occurred_at || r.created_at || "";
        
        let dateObj: Date | null = null;
        let dateStr = "Không rõ";
        let timeStr = "";
        
        if (timeIso) {
          try {
            dateObj = new Date(timeIso);
            if (!isNaN(dateObj.getTime())) {
              dateStr = `${dateObj.getDate().toString().padStart(2, "0")}/${(dateObj.getMonth() + 1)
                .toString()
                .padStart(2, "0")}/${dateObj.getFullYear()}`;
              timeStr = `${dateObj.getHours().toString().padStart(2, "0")}:${dateObj.getMinutes().toString().padStart(2, "0")}`;
            }
          } catch (e) {
            console.error("Error parsing date:", e);
          }
        }

        return {
          id: String(r.id),
          title,
          category: catName,
          type: r.type,
          amount: amt,
          time: timeStr ? `${dateStr} • ${timeStr}` : dateStr,
          date: dateStr,
          dateObject: dateObj,
          iconEmoji: cat.emoji ?? null,
          iconUri: cat.icon_uri ?? null,
        };
      });

      setTxs(mapped);
    } catch (e: any) {
      Alert.alert("Lỗi", "Không tải được giao dịch.");
    } finally {
      setLoading(false);
    }
  };

  // Filter transactions theo ngày được chọn
  useEffect(() => {
    if (!txs.length) return;
    
    let result = [...txs];

    if (filterType !== "all") {
      result = result.filter((tx) => tx.type === filterType);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (tx) =>
          tx.title.toLowerCase().includes(query) ||
          tx.category.toLowerCase().includes(query)
      );
    }

    // Lọc theo ngày được chọn
    if (selectedDate) {
      const selected = new Date(selectedDate);
      selected.setHours(0, 0, 0, 0);
      
      result = result.filter((tx) => {
        if (!tx.dateObject) return false;
        const txDate = new Date(tx.dateObject);
        txDate.setHours(0, 0, 0, 0);
        return txDate.getTime() === selected.getTime();
      });
    }

    setFilteredTxs(result);
  }, [txs, filterType, searchQuery, selectedDate]);

  // Load khi mount
  useEffect(() => {
    loadTransactions();
  }, []);

  // Quick filters
  const selectToday = () => {
    setSelectedDate(new Date());
    setShowPicker(false);
  };

  const clearDate = () => {
    setSelectedDate(null);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  // Xử lý khi chọn ngày - Android/iOS
  const onDateChange = (event: any, date?: Date) => {
    setShowPicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  // Xử lý khi chọn ngày - Web
  const onDateChangeWeb = (date: Date) => {
    setSelectedDate(date);
    setShowPicker(false);
  };

  // Tính tổng
  const calculateTotal = () => {
    return filteredTxs.reduce((sum, tx) => {
      if (tx.type === "income") return sum + tx.amount;
      if (tx.type === "expense") return sum - tx.amount;
      return sum;
    }, 0);
  };

  const calculateIncome = () => {
    return filteredTxs
      .filter(tx => tx.type === "income")
      .reduce((sum, tx) => sum + tx.amount, 0);
  };

  const calculateExpense = () => {
    return filteredTxs
      .filter(tx => tx.type === "expense")
      .reduce((sum, tx) => sum + tx.amount, 0);
  };

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Tất cả giao dịch</ThemedText>
        <ThemedText style={styles.subtitle}>
          {filteredTxs.length} giao dịch
          {selectedDate && " (đã lọc)"}
        </ThemedText>
        
        {filteredTxs.length > 0 && (
          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <ThemedText style={styles.summaryLabel}>Tổng thu</ThemedText>
                <ThemedText style={[styles.summaryValue, styles.incomeColor]}>
                  {formatVND(calculateIncome())}
                </ThemedText>
              </View>
              <View style={styles.summaryItem}>
                <ThemedText style={styles.summaryLabel}>Tổng chi</ThemedText>
                <ThemedText style={[styles.summaryValue, styles.expenseColor]}>
                  {formatVND(calculateExpense())}
                </ThemedText>
              </View>
              <View style={styles.summaryItem}>
                <ThemedText style={styles.summaryLabel}>Số dư</ThemedText>
                <ThemedText style={[
                  styles.summaryValue,
                  calculateTotal() >= 0 ? styles.incomeColor : styles.expenseColor
                ]}>
                  {formatVND(calculateTotal())}
                </ThemedText>
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={styles.filterContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm theo ghi chú hoặc danh mục..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94a3b8"
        />

        <View style={styles.quickFilterContainer}>
          <Pressable
            style={[
              styles.quickFilterButton,
              selectedDate && styles.quickFilterButtonActive,
            ]}
            onPress={selectToday}
          >
            <ThemedText style={[
              styles.quickFilterText,
              selectedDate && styles.quickFilterTextActive,
            ]}>
              Hôm nay
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.typeFilter}>
          {(["all", "income", "expense"] as TxType[]).map((type) => (
            <Pressable
              key={type}
              style={[
                styles.typeButton,
                filterType === type && styles.typeButtonActive,
              ]}
              onPress={() => setFilterType(type)}
            >
              <ThemedText
                style={[
                  styles.typeButtonText,
                  filterType === type && styles.typeButtonTextActive,
                ]}
              >
                {type === "all" ? "Tất cả" : type === "income" ? "Thu" : "Chi"}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {/* PHẦN CHỌN NGÀY ĐƠN GIẢN */}
        <View style={styles.dateFilter}>
          <ThemedText style={styles.dateFilterTitle}>Lọc theo ngày:</ThemedText>
          
          <Pressable 
            style={[
              styles.dateButton,
              selectedDate && styles.dateButtonActive
            ]} 
            onPress={() => setShowPicker(true)}
          >
            <ThemedText style={styles.dateButtonText}>
              {selectedDate ? formatDateLabel(selectedDate) : "Chọn ngày"}
            </ThemedText>
          </Pressable>

          {selectedDate && (
            <Pressable style={styles.clearButton} onPress={clearDate}>
              <ThemedText style={styles.clearButtonText}>Xóa lọc ngày</ThemedText>
            </Pressable>
          )}
        </View>
      </View>

      {/* DatePicker - ĐƠN GIẢN CHO MỌI NỀN TẢNG */}
      {showPicker && Platform.OS === 'web' && (
        <WebDatePicker
          value={selectedDate || new Date()}
          onChange={onDateChangeWeb}
        />
      )}

      {showPicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={selectedDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onDateChange}
        />
      )}

      <FlatList
        data={filteredTxs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366f1" />
              <ThemedText style={styles.loadingText}>Đang tải giao dịch...</ThemedText>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <ThemedText style={styles.emptyTitle}>Không tìm thấy giao dịch</ThemedText>
              <ThemedText style={styles.emptyDescription}>
                {searchQuery || selectedDate || filterType !== "all"
                  ? "Thử thay đổi bộ lọc tìm kiếm"
                  : "Hãy thêm giao dịch đầu tiên của bạn"}
              </ThemedText>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable 
            style={styles.txCard}
            // onPress={() => router.push(`/transaction/${item.id}`)}
          >
            <View style={styles.txIconWrapper}>
              {item.iconUri ? (
                <Image source={{ uri: item.iconUri }} style={styles.txIconImage} />
              ) : (
                <ThemedText style={styles.txEmoji}>
                  {item.iconEmoji ?? (item.type === "income" ? "💰" : "💸")}
                </ThemedText>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <ThemedText style={styles.txCardTitle} numberOfLines={1}>
                {item.title}
              </ThemedText>
              <ThemedText style={styles.txCardMeta}>
                {item.category} • {item.time}
              </ThemedText>
            </View>

            <ThemedText
              style={[
                styles.txAmount,
                { color: item.type === "income" ? "#10b981" : "#ef4444" },
              ]}
            >
              {item.type === "income" ? "+" : "-"} {formatVND(item.amount)}
            </ThemedText>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fafafa",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
    marginBottom: 12,
  },
  summaryContainer: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "800",
  },
  incomeColor: {
    color: "#10b981",
  },
  expenseColor: {
    color: "#ef4444",
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  searchInput: {
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  quickFilterContainer: {
    flexDirection: "row",
    marginBottom: 12,
  },
  quickFilterButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  quickFilterButtonActive: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  },
  quickFilterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  quickFilterTextActive: {
    color: "#ffffff",
  },
  typeFilter: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
  },
  typeButtonActive: {
    backgroundColor: "#6366f1",
  },
  typeButtonText: {
    color: "#64748b",
    fontWeight: "600",
    fontSize: 14,
  },
  typeButtonTextActive: {
    color: "#ffffff",
  },
  dateFilter: {
    gap: 12,
  },
  dateFilterTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  dateButton: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  dateButtonActive: {
    borderColor: "#6366f1",
    backgroundColor: "#eef2ff",
  },
  dateButtonText: {
    color: "#0f172a",
    fontWeight: "600",
    fontSize: 16,
  },
  clearButton: {
    backgroundColor: "#ef4444",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  clearButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },
  txCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  txIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  txIconImage: {
    width: 32,
    height: 32,
    borderRadius: 12,
  },
  txEmoji: {
    fontSize: 26,
  },
  txCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  txCardMeta: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "600",
  },
  txAmount: {
    fontSize: 17,
    fontWeight: "800",
  },
  loadingContainer: {
    paddingVertical: 80,
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    color: "#64748b",
    fontSize: 14,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 20,
  },
});