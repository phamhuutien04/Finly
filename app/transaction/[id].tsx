import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { supabase } from "@/lib/supabase";

const { width: screenWidth } = Dimensions.get("window");
const isSmallScreen = screenWidth < 375;

type Transaction = {
  id: number;
  user_id: string;
  category_id: number;
  type: "income" | "expense";
  amount: number;
  note: string;
  transaction_date: string;
  created_at: string;
  is_split: boolean;
  split_total_amount: number;
  split_participants: number;
  category?: {
    name: string;
    emoji: string;
  };
  creator?: {
    display_name: string;
    avatar_url: string;
  };
  participants?: Array<{
    user_id: string;
    amount: number;
    display_name: string;
    avatar_url: string;
  }>;
};

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [transaction, setTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    if (id) {
      loadTransaction();
    }
  }, [id]);

  const loadTransaction = async () => {
    try {
      setLoading(true);

      // Load transaction details
      const { data: txData, error: txError } = await supabase
        .from("transactions")
        .select(`
          *,
          category:categories (name, emoji)
        `)
        .eq("id", id)
        .single();

      if (txError) throw txError;

      // Load creator info
      const { data: creatorData } = await supabase
        .from("user_profiles")
        .select("display_name, avatar_url")
        .eq("user_id", txData.user_id)
        .single();

      // Load participants if split transaction
      let participants = [];
      if (txData.is_split) {
        const { data: participantsData } = await supabase
          .from("split_transaction_participants")
          .select("user_id, amount")
          .eq("transaction_id", id);

        if (participantsData) {
          participants = await Promise.all(
            participantsData.map(async (p: any) => {
              const { data: profile } = await supabase
                .from("user_profiles")
                .select("display_name, avatar_url")
                .eq("user_id", p.user_id)
                .single();

              return {
                ...p,
                display_name: profile?.display_name || "Unknown",
                avatar_url: profile?.avatar_url || null,
              };
            })
          );
        }
      }

      setTransaction({
        ...txData,
        creator: creatorData || undefined,
        participants,
      });
    } catch (error: any) {
      console.error("Error loading transaction:", error);
      Alert.alert("Lỗi", "Không thể tải thông tin giao dịch");
    } finally {
      setLoading(false);
    }
  };

  const formatVND = (n: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <Stack.Screen options={{ title: "Đang tải..." }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </SafeAreaView>
    );
  }

  if (!transaction) {
    return (
      <SafeAreaView style={styles.screen}>
        <Stack.Screen options={{ title: "Không tìm thấy" }} />
        <View style={styles.errorContainer}>
          <Ionicons name="receipt-outline" size={64} color="#d1d5db" />
          <ThemedText style={styles.errorText}>Không tìm thấy giao dịch</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: "Chi tiết giao dịch" }} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Amount Card */}
        <View style={styles.amountCard}>
          <View style={styles.categoryIcon}>
            {transaction.category?.emoji ? (
              <ThemedText style={styles.emoji}>{transaction.category.emoji}</ThemedText>
            ) : (
              <Ionicons name="receipt" size={32} color="#6366f1" />
            )}
          </View>

          <ThemedText style={styles.categoryName}>
            {transaction.category?.name || "Khác"}
          </ThemedText>

          <ThemedText
            style={[
              styles.amount,
              transaction.type === "income" ? styles.amountIncome : styles.amountExpense,
            ]}
          >
            {transaction.type === "income" ? "+" : "-"} {formatVND(transaction.amount)}
          </ThemedText>

          {transaction.note && (
            <ThemedText style={styles.note}>{transaction.note}</ThemedText>
          )}
        </View>

        {/* Details */}
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={20} color="#6b7280" />
            <ThemedText style={styles.detailLabel}>Ngày giao dịch</ThemedText>
            <ThemedText style={styles.detailValue}>
              {formatDate(transaction.transaction_date)}
            </ThemedText>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={20} color="#6b7280" />
            <ThemedText style={styles.detailLabel}>Người tạo</ThemedText>
            <ThemedText style={styles.detailValue}>
              {transaction.creator?.display_name || "Bạn"}
            </ThemedText>
          </View>

          <View style={styles.detailRow}>
            <Ionicons
              name={transaction.type === "income" ? "arrow-down" : "arrow-up"}
              size={20}
              color="#6b7280"
            />
            <ThemedText style={styles.detailLabel}>Loại</ThemedText>
            <ThemedText style={styles.detailValue}>
              {transaction.type === "income" ? "Thu nhập" : "Chi tiêu"}
            </ThemedText>
          </View>
        </View>

        {/* Split Participants */}
        {transaction.is_split && transaction.participants && transaction.participants.length > 0 && (
          <View style={styles.participantsCard}>
            <ThemedText style={styles.sectionTitle}>
              Người tham gia ({transaction.participants.length})
            </ThemedText>

            {transaction.participants.map((participant, index) => (
              <View key={index} style={styles.participantRow}>
                {participant.avatar_url ? (
                  <Image
                    source={{ uri: participant.avatar_url }}
                    style={styles.participantAvatar}
                  />
                ) : (
                  <View style={[styles.participantAvatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={20} color="#9ca3af" />
                  </View>
                )}

                <ThemedText style={styles.participantName}>
                  {participant.display_name}
                </ThemedText>

                <ThemedText style={styles.participantAmount}>
                  {formatVND(participant.amount)}
                </ThemedText>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fafafa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: "#9ca3af",
  },
  scrollContent: {
    padding: isSmallScreen ? 16 : 20,
    gap: 16,
  },

  // Amount Card
  amountCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  categoryIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emoji: {
    fontSize: 40,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#6b7280",
    marginBottom: 8,
  },
  amount: {
    fontSize: 36,
    fontWeight: "900",
    marginBottom: 8,
  },
  amountIncome: {
    color: "#22c55e",
  },
  amountExpense: {
    color: "#ef4444",
  },
  note: {
    fontSize: 15,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 22,
  },

  // Details Card
  detailsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailLabel: {
    flex: 1,
    fontSize: 15,
    color: "#6b7280",
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "700",
  },

  // Participants
  participantsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#f3f4f6",
  },
  avatarPlaceholder: {
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  participantName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  participantAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6366f1",
  },
});
