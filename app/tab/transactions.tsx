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
  Modal,
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
  date: string; // "dd/mm/yyyy"
  dateObject: Date | null; // Lưu date object
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

export default function AllTransactionsScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [txs, setTxs] = useState<TransactionUI[]>([]);
  const [filteredTxs, setFilteredTxs] = useState<TransactionUI[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<TxType>("all");

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [quickFilter, setQuickFilter] = useState<string | null>(null);

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
        
        // Tạo date object từ ISO string
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

      console.log("Loaded transactions:", mapped.length);
      setTxs(mapped);
      applyFilters(mapped); // Áp dụng filter ngay sau khi load
    } catch (e: any) {
      Alert.alert("Lỗi", "Không tải được giao dịch.");
    } finally {
      setLoading(false);
    }
  };

  // Hàm áp dụng tất cả filters
  const applyFilters = (transactions: TransactionUI[]) => {
    console.log("Applying filters...");
    console.log("Start date:", startDate?.toISOString());
    console.log("End date:", endDate?.toISOString());
    
    let result = [...transactions];

    // Filter theo loại
    if (filterType !== "all") {
      result = result.filter((tx) => tx.type === filterType);
    }

    // Filter theo search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (tx) =>
          tx.title.toLowerCase().includes(query) ||
          tx.category.toLowerCase().includes(query)
      );
    }

    // Filter theo ngày bắt đầu
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      console.log("Start filter date (start of day):", start.toISOString());
      
      result = result.filter((tx) => {
        if (!tx.dateObject) return false;
        
        const txDate = new Date(tx.dateObject);
        txDate.setHours(0, 0, 0, 0);
        console.log(`Transaction ${tx.id} date:`, txDate.toISOString(), ">=", start.toISOString(), "?", txDate >= start);
        
        return txDate >= start;
      });
    }

    // Filter theo ngày kết thúc
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      console.log("End filter date (end of day):", end.toISOString());
      
      result = result.filter((tx) => {
        if (!tx.dateObject) return false;
        
        const txDate = new Date(tx.dateObject);
        txDate.setHours(0, 0, 0, 0);
        console.log(`Transaction ${tx.id} date:`, txDate.toISOString(), "<=", end.toISOString(), "?", txDate <= end);
        
        return txDate <= end;
      });
    }

    console.log("Filtered result count:", result.length);
    setFilteredTxs(result);
  };

  // Load khi mount
  useEffect(() => {
    loadTransactions();
  }, []);

  // Áp dụng filters khi các filter thay đổi
  useEffect(() => {
    if (txs.length > 0) {
      applyFilters(txs);
    }
  }, [txs, filterType, searchQuery, startDate, endDate]);

  // Quick filter functions
  const applyQuickFilter = (filter: string) => {
    setQuickFilter(filter);
    if (filter === "today") {
      const today = new Date();
      setStartDate(today);
      setEndDate(today);
    } else if (filter === "thisMonth") {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (filter === "lastMonth") {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (filter === "clear") {
      setQuickFilter(null);
      setStartDate(null);
      setEndDate(null);
    }
  };

  const clearStartDate = () => {
    setStartDate(null);
    setQuickFilter(null);
  };

  const clearEndDate = () => {
    setEndDate(null);
    setQuickFilter(null);
  };

  const clearAllFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setQuickFilter(null);
    setFilterType("all");
    setSearchQuery("");
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  // Xử lý DateTimePicker
  const onStartDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
    }
    
    if (selectedDate) {
      console.log("Selected start date:", selectedDate.toISOString());
      setStartDate(selectedDate);
      setQuickFilter(null);
    }
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndPicker(false);
    }
    
    if (selectedDate) {
      console.log("Selected end date:", selectedDate.toISOString());
      setEndDate(selectedDate);
      setQuickFilter(null);
    }
  };

  // Tính tổng số tiền
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

  // Hàm hiển thị DatePicker
  const renderDatePicker = () => {
    if (Platform.OS === 'ios') {
      return (
        <Modal
          visible={showStartPicker || showEndPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            setShowStartPicker(false);
            setShowEndPicker(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Pressable 
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowStartPicker(false);
                    setShowEndPicker(false);
                  }}
                >
                  <ThemedText style={styles.modalCancelText}>Hủy</ThemedText>
                </Pressable>
                <ThemedText style={styles.modalTitle}>
                  {showStartPicker ? "Chọn ngày bắt đầu" : "Chọn ngày kết thúc"}
                </ThemedText>
                <Pressable 
                  style={styles.modalDoneButton}
                  onPress={() => {
                    setShowStartPicker(false);
                    setShowEndPicker(false);
                  }}
                >
                  <ThemedText style={styles.modalDoneText}>Xong</ThemedText>
                </Pressable>
              </View>
              <DateTimePicker
                value={showStartPicker ? (startDate || new Date()) : (endDate || new Date())}
                mode="date"
                display="spinner"
                onChange={showStartPicker ? onStartDateChange : onEndDateChange}
                maximumDate={showStartPicker ? (endDate || new Date()) : new Date()}
                minimumDate={showStartPicker ? undefined : (startDate || undefined)}
                style={styles.datePicker}
              />
            </View>
          </View>
        </Modal>
      );
    } else {
      if (showStartPicker) {
        return (
          <DateTimePicker
            value={startDate || new Date()}
            mode="date"
            display="default"
            onChange={onStartDateChange}
            maximumDate={endDate || new Date()}
          />
        );
      }
      if (showEndPicker) {
        return (
          <DateTimePicker
            value={endDate || new Date()}
            mode="date"
            display="default"
            onChange={onEndDateChange}
            minimumDate={startDate || undefined}
            maximumDate={new Date()}
          />
        );
      }
      return null;
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Tất cả giao dịch</ThemedText>
        <ThemedText style={styles.subtitle}>
          {filteredTxs.length} giao dịch
          {(startDate || endDate || quickFilter) && " (đã lọc)"}
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
              quickFilter === "today" && styles.quickFilterButtonActive,
            ]}
            onPress={() => applyQuickFilter("today")}
          >
            <ThemedText style={[
              styles.quickFilterText,
              quickFilter === "today" && styles.quickFilterTextActive,
            ]}>
              Hôm nay
            </ThemedText>
          </Pressable>
          
          <Pressable
            style={[
              styles.quickFilterButton,
              quickFilter === "thisMonth" && styles.quickFilterButtonActive,
            ]}
            onPress={() => applyQuickFilter("thisMonth")}
          >
            <ThemedText style={[
              styles.quickFilterText,
              quickFilter === "thisMonth" && styles.quickFilterTextActive,
            ]}>
              Tháng này
            </ThemedText>
          </Pressable>
          
          <Pressable
            style={[
              styles.quickFilterButton,
              quickFilter === "lastMonth" && styles.quickFilterButtonActive,
            ]}
            onPress={() => applyQuickFilter("lastMonth")}
          >
            <ThemedText style={[
              styles.quickFilterText,
              quickFilter === "lastMonth" && styles.quickFilterTextActive,
            ]}>
              Tháng trước
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

        <View style={styles.dateFilter}>
          <ThemedText style={styles.dateFilterTitle}>Lọc theo ngày:</ThemedText>
          
          <View style={styles.dateInputRow}>
            <View style={styles.dateInputContainer}>
              <ThemedText style={styles.dateLabel}>Từ ngày</ThemedText>
              <View style={styles.dateInputWrapper}>
                <Pressable 
                  style={[
                    styles.dateInputButton,
                    startDate && styles.dateInputButtonActive
                  ]} 
                  onPress={() => setShowStartPicker(true)}
                >
                  <ThemedText style={styles.dateInputButtonText}>
                    {startDate ? formatDateLabel(startDate) : "Chọn ngày"}
                  </ThemedText>
                </Pressable>
                {startDate && (
                  <Pressable style={styles.clearDateButton} onPress={clearStartDate}>
                    <ThemedText style={styles.clearDateText}>✕</ThemedText>
                  </Pressable>
                )}
              </View>
            </View>

            <View style={styles.dateInputContainer}>
              <ThemedText style={styles.dateLabel}>Đến ngày</ThemedText>
              <View style={styles.dateInputWrapper}>
                <Pressable 
                  style={[
                    styles.dateInputButton,
                    endDate && styles.dateInputButtonActive
                  ]} 
                  onPress={() => setShowEndPicker(true)}
                >
                  <ThemedText style={styles.dateInputButtonText}>
                    {endDate ? formatDateLabel(endDate) : "Chọn ngày"}
                  </ThemedText>
                </Pressable>
                {endDate && (
                  <Pressable style={styles.clearDateButton} onPress={clearEndDate}>
                    <ThemedText style={styles.clearDateText}>✕</ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          </View>

          {(startDate || endDate) && (
            <View style={styles.selectedDateInfo}>
              <ThemedText style={styles.selectedDateText}>
                Đã chọn: {formatDateLabel(startDate)} - {formatDateLabel(endDate)}
              </ThemedText>
            </View>
          )}

          {(startDate || endDate || filterType !== "all" || searchQuery) && (
            <Pressable style={styles.clearAllButton} onPress={clearAllFilters}>
              <ThemedText style={styles.clearAllText}>Xóa tất cả bộ lọc</ThemedText>
            </Pressable>
          )}
        </View>
      </View>

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
                {searchQuery || startDate || endDate || filterType !== "all"
                  ? "Thử thay đổi bộ lọc tìm kiếm"
                  : "Hãy thêm giao dịch đầu tiên của bạn"}
              </ThemedText>
              {(searchQuery || startDate || endDate || filterType !== "all") && (
                <Pressable style={styles.clearEmptyButton} onPress={clearAllFilters}>
                  <ThemedText style={styles.clearEmptyText}>Xóa bộ lọc</ThemedText>
                </Pressable>
              )}
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable 
            style={styles.txCard}
            onPress={() => router.push(`/transaction/${item.id}`)}
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

      {renderDatePicker()}
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
    gap: 8,
    marginBottom: 12,
  },
  quickFilterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  quickFilterButtonActive: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  },
  quickFilterText: {
    fontSize: 12,
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
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
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
  dateInputRow: {
    flexDirection: "row",
    gap: 12,
  },
  dateInputContainer: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 6,
  },
  dateInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateInputButton: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  dateInputButtonActive: {
    borderColor: "#6366f1",
    backgroundColor: "#eef2ff",
  },
  dateInputButtonText: {
    color: "#0f172a",
    fontWeight: "600",
    fontSize: 14,
  },
  selectedDateInfo: {
    backgroundColor: "#f0f9ff",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  selectedDateText: {
    color: "#0369a1",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  clearDateButton: {
    backgroundColor: "#ef4444",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  clearDateText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
  clearAllButton: {
    backgroundColor: "#94a3b8",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  clearAllText: {
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
  clearEmptyButton: {
    backgroundColor: "#6366f1",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  clearEmptyText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
    textAlign: 'center',
  },
  modalCancelButton: {
    padding: 8,
  },
  modalCancelText: {
    color: '#64748b',
    fontSize: 16,
  },
  modalDoneButton: {
    padding: 8,
  },
  modalDoneText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '600',
  },
  datePicker: {
    height: 200,
    width: '100%',
  },
});