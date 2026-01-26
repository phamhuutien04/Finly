import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { supabase } from "@/lib/supabase";

type TxType = "income" | "expense";

type BudgetRowDB = {
  id: string;
  category_id: string;
  amount_limit: number;
  start_date: string; // date
  end_date: string; // date
  category: { name: string | null; icon: string | null } | null;
};

type TxAggRowDB = {
  category_id: string;
  spent: number;
};

const formatVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

function getMonthLabel() {
  const d = new Date();
  return `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
}

function getMonthRangeISO() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

export default function ExploreScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);

  const [budgets, setBudgets] = useState<BudgetRowDB[]>([]);
  const [spentMap, setSpentMap] = useState<Record<string, number>>({}); // category_id -> spent

  const monthLabel = useMemo(() => getMonthLabel(), []);
  const monthRange = useMemo(() => getMonthRangeISO(), []);

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

        // 1) totals month
        const { data: txRows, error: txErr } = await supabase
          .from("transactions")
          .select("amount,type,category_id,transaction_date")
          .eq("user_id", user.id)
          .gte("transaction_date", monthRange.startISO)
          .lt("transaction_date", monthRange.endISO);

        if (txErr) throw txErr;

        let inc = 0;
        let exp = 0;
        const map: Record<string, number> = {};

        for (const r of txRows ?? []) {
          const amt = Number((r as any).amount ?? 0);
          const t = (r as any).type as TxType;
          const cid = String((r as any).category_id ?? "");

          if (t === "income") inc += amt;
          else {
            exp += amt;
            if (cid) map[cid] = (map[cid] ?? 0) + amt; // spent per category
          }
        }

        // 2) budgets + join category
        const { data: bRows, error: bErr } = await supabase
          .from("budgets")
          .select(
            `
            id,
            category_id,
            amount_limit,
            start_date,
            end_date,
            category:categories ( name, icon )
          `
          )
          .eq("user_id", user.id)
          .order("end_date", { ascending: true })
          .returns<BudgetRowDB[]>();

        if (bErr) throw bErr;

        if (!mounted) return;

        setIncome(inc);
        setExpense(exp);
        setSpentMap(map);
        setBudgets(bRows ?? []);
      } catch (e: any) {
        Alert.alert("Lỗi", e?.message ?? "Không tải được explore.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [router, monthRange.startISO, monthRange.endISO]);

  const balance = income - expense;

  return (
    <ThemedView style={styles.screen}>
      <ThemedText type="title">Báo cáo</ThemedText>
      <ThemedText style={{ opacity: 0.7, marginBottom: 12 }}>{monthLabel}</ThemedText>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <Box label="Số dư" value={formatVND(balance)} />
        <Box label="Thu nhập" value={formatVND(income)} />
        <Box label="Chi tiêu" value={formatVND(expense)} />
      </View>

      <ThemedText type="subtitle" style={{ marginTop: 6, marginBottom: 10 }}>
        Ngân sách
      </ThemedText>

      {loading ? (
        <View style={{ paddingTop: 18 }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={budgets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <BudgetCard
              name={(item.category?.icon ? item.category.icon + " " : "") + (item.category?.name ?? "Khác")}
              limit={Number(item.amount_limit ?? 0)}
              spent={Number(spentMap[item.category_id] ?? 0)}
              range={`${item.start_date} → ${item.end_date}`}
            />
          )}
          ListEmptyComponent={
            <ThemedText style={{ opacity: 0.7, textAlign: "center", marginTop: 8 }}>
              Chưa có budget nào (bảng budgets).
            </ThemedText>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </ThemedView>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView style={styles.box}>
      <ThemedText style={{ opacity: 0.75, fontSize: 12, fontWeight: "800" }}>{label}</ThemedText>
      <ThemedText style={{ fontSize: 14, fontWeight: "900", marginTop: 4 }}>{value}</ThemedText>
    </ThemedView>
  );
}

function BudgetCard({
  name,
  limit,
  spent,
  range,
}: {
  name: string;
  limit: number;
  spent: number;
  range: string;
}) {
  const pct = limit > 0 ? Math.min(1, spent / limit) : 0;
  const pctText = `${Math.round(pct * 100)}%`;

  return (
    <ThemedView style={styles.budgetCard}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <ThemedText style={{ fontWeight: "900" }}>{name}</ThemedText>
          <ThemedText style={{ opacity: 0.7, marginTop: 2 }}>{range}</ThemedText>
        </View>
        <ThemedText style={{ fontWeight: "900" }}>{pctText}</ThemedText>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
        <ThemedText style={{ opacity: 0.8, fontWeight: "800" }}>
          Đã chi: {formatVND(spent)}
        </ThemedText>
        <ThemedText style={{ opacity: 0.8, fontWeight: "800" }}>
          Limit: {formatVND(limit)}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },

  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  box: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
  },

  budgetCard: {
    borderRadius: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
  },

  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(127,127,127,0.18)",
    marginTop: 10,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
});
