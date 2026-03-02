import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { supabase } from "@/lib/supabase";

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [transaction, setTransaction] = useState<any>(null);

  useEffect(() => {
    loadTransaction();
  }, [id]);

  const loadTransaction = async () => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select(`
          *,
          category:categories (*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setTransaction(data);
    } catch (error) {
      Alert.alert("Lỗi", "Không thể tải chi tiết giao dịch");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText>Chi tiết giao dịch: {id}</ThemedText>
      {/* Thêm UI chi tiết giao dịch ở đây */}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});