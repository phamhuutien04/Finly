import { Link, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from "react-native";

import { supabase } from "@/lib/supabase";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

type TxType = "income" | "expense";

type TransactionUI = {
  id: string;
  title: string;
  category: string;
  type: TxType;
  amount: number; // VND
  time: string; // "Hôm nay • 08:30"
  iconEmoji?: string | null;
  iconUri?: string | null;
};

type CategoryJoinRow = {
  // categories của bạn có thể chỉ có emoji/icon_uri/icon_preset_id
  name?: string | null;
  icon?: string | null; // nếu bạn có cột icon (emoji) cũ
  emoji?: string | null;
  icon_uri?: string | null;
  icon_preset_id?: string | null;
} | null;

type TransactionRowDB = {
  id: string | number;
  amount: number | null;
  type: TxType;
  note: string | null;

  // cột ngày: có thể là transaction_date hoặc occurred_at
  transaction_date?: string | null;
  occurred_at?: string | null;

  category: CategoryJoinRow;
};

type AccountRowDB = { current_balance: number | null };

const formatVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

function getMonthLabel() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  return `Tháng ${m}/${y}`;
}

function getMonthRangeISO() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatTimeLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();

  const hhmm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (sameDay) return `Hôm nay • ${hhmm}`;
  if (isYesterday) return `Hôm qua • ${hhmm}`;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} • ${hhmm}`;
}

export default function HomeScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [txs, setTxs] = useState<TransactionUI[]>([]);
  const [balance, setBalance] = useState(0);
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);

  const monthLabel = useMemo(() => getMonthLabel(), []);
  const monthRange = useMemo(() => getMonthRangeISO(), []);

  const getUserId = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session?.user?.id ?? null;
  };

  const loadBalance = async (userId: string) => {
    const { data: accRows, error: accErr } = await supabase
      .from("accounts")
      .select("current_balance")
      .eq("user_id", userId)
      .returns<AccountRowDB[]>();

    if (accErr) throw accErr;

    return (accRows ?? []).reduce((sum, r) => sum + Number(r.current_balance ?? 0), 0);
  };

  /**
   * ✅ Load transactions with fallback date column:
   * - try transaction_date first
   * - if PGRST204 (column not found) => fallback occurred_at
   */
  const loadTransactions = async (userId: string) => {
    const baseSelect = `
      id,
      amount,
      type,
      note,
      category:categories ( name, icon, emoji, icon_uri, icon_preset_id )
    `;

    // Try 1: transaction_date
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          ${baseSelect},
          transaction_date
        `
        )
        .eq("user_id", userId)
        .gte("transaction_date", monthRange.startISO)
        .lt("transaction_date", monthRange.endISO)
        .order("transaction_date", { ascending: false })
        .limit(20)
        .returns<TransactionRowDB[]>();

      if (error) throw error;
      return { rows: data ?? [], dateCol: "transaction_date" as const };
    } catch (e: any) {
      const msg = (e?.message ?? "").toLowerCase();
      const code = e?.code ?? "";
      const isMissingCol =
        code === "PGRST204" || (msg.includes("could not find") && msg.includes("transaction_date"));

      if (!isMissingCol) throw e;

      // Try 2: occurred_at
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          ${baseSelect},
          occurred_at
        `
        )
        .eq("user_id", userId)
        .gte("occurred_at", monthRange.startISO)
        .lt("occurred_at", monthRange.endISO)
        .order("occurred_at", { ascending: false })
        .limit(20)
        .returns<TransactionRowDB[]>();

      if (error) throw error;
      return { rows: data ?? [], dateCol: "occurred_at" as const };
    }
  };

  const mapTransactions = (rows: TransactionRowDB[], dateCol: "transaction_date" | "occurred_at") => {
    let inc = 0;
    let exp = 0;

    const mapped: TransactionUI[] = rows.map((r) => {
      const amt = Number(r.amount ?? 0);
      if (r.type === "income") inc += amt;
      else exp += amt;

      const cat = r.category;

      // name fallback:
      const catName =
        (cat?.name && cat.name.trim()) ||
        (cat?.icon_preset_id && cat.icon_preset_id.trim()) ||
        "Khác";

      // icon fallback:
      const iconEmoji = (cat?.emoji ?? cat?.icon ?? null) as string | null;
      const iconUri = (cat?.icon_uri ?? null) as string | null;

      const title = r.note && r.note.trim().length > 0 ? r.note.trim() : catName;

      const iso = (dateCol === "transaction_date" ? r.transaction_date : r.occurred_at) ?? "";
      const timeLabel = iso ? formatTimeLabel(iso) : "";

      return {
        id: String(r.id),
        title,
        category: catName,
        type: r.type,
        amount: amt,
        time: timeLabel,
        iconEmoji,
        iconUri,
      };
    });

    return { mapped, inc, exp };
  };

  const loadAll = async () => {
    const userId = await getUserId();
    if (!userId) {
      router.replace("/auth/login");
      return;
    }

    const bal = await loadBalance(userId);
    const { rows, dateCol } = await loadTransactions(userId);
    const { mapped, inc, exp } = mapTransactions(rows, dateCol);

    setBalance(bal);
    setTxs(mapped);
    setIncome(inc);
    setExpense(exp);
  };

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);
        await loadAll();
      } catch (e: any) {
        console.log("Home load error:", e?.message ?? e);
        Alert.alert("Lỗi", e?.message ?? "Không tải được dữ liệu.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) router.replace("/auth/login");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router, monthRange.startISO, monthRange.endISO]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await loadAll();
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message ?? "Không tải được dữ liệu.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      {/* Header */}
      <ThemedView style={styles.header}>
        <View style={{ flex: 1 }}>
          <ThemedText type="title">Tổng quan</ThemedText>
          <ThemedText style={styles.muted}>{monthLabel}</ThemedText>
        </View>

        {/* Add transaction */}
        <Link href="/modal" asChild>
          <Pressable style={styles.addBtn}>
            <ThemedText style={styles.addBtnText}>+ Thêm</ThemedText>
          </Pressable>
        </Link>
      </ThemedView>

      {/* Summary cards */}
      <View style={styles.row}>
        <SummaryCard label="Số dư" value={formatVND(balance)} tone="primary" />
        <SummaryCard label="Thu nhập" value={formatVND(income)} tone="success" />
        <SummaryCard label="Chi tiêu" value={formatVND(expense)} tone="danger" />
      </View>

      {/* Quick actions */}
      <ThemedView style={styles.sectionHeader}>
        <ThemedText type="subtitle">Thao tác nhanh</ThemedText>
      </ThemedView>

      <View style={styles.grid}>
        <QuickAction title="Thêm thu" subtitle="Ghi khoản thu" emoji="💰" href="/modal" />
        <QuickAction title="Thêm chi" subtitle="Ghi khoản chi" emoji="🧾" href="/modal" />
        <QuickAction title="Báo cáo" subtitle="Xem biểu đồ" emoji="📊" href="/explore" />
        <QuickAction title="Ngân sách" subtitle="Theo dõi limit" emoji="🎯" href="/explore" />
      </View>

      {/* Recent transactions */}
      <ThemedView style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <ThemedText type="subtitle">Giao dịch gần đây</ThemedText>
          <ThemedText style={styles.muted}>Cập nhật mới nhất</ThemedText>
        </View>

        <Link href="/explore" asChild>
          <Pressable hitSlop={10}>
            <ThemedText style={styles.linkText}>Xem tất cả</ThemedText>
          </Pressable>
        </Link>
      </ThemedView>

      {loading ? (
        <View style={{ paddingTop: 24 }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={txs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => <TransactionRow tx={item} />}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <ThemedText style={{ opacity: 0.7, textAlign: "center", marginTop: 10 }}>
              Chưa có giao dịch trong tháng này.
            </ThemedText>
          }
        />
      )}
    </ThemedView>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "success" | "danger";
}) {
  return (
    <ThemedView
      style={[
        styles.card,
        tone === "primary" && styles.cardPrimary,
        tone === "success" && styles.cardSuccess,
        tone === "danger" && styles.cardDanger,
      ]}
    >
      <ThemedText style={styles.cardLabel}>{label}</ThemedText>
      <ThemedText style={styles.cardValue}>{value}</ThemedText>
    </ThemedView>
  );
}

function QuickAction({
  title,
  subtitle,
  emoji,
  href,
}: {
  title: string;
  subtitle: string;
  emoji: string;
  href: string;
}) {
  return (
    <Link href={href as any} asChild>
      <Pressable style={styles.actionCard}>
        <ThemedText style={styles.actionEmoji}>{emoji}</ThemedText>
        <ThemedText style={styles.actionTitle}>{title}</ThemedText>
        <ThemedText style={styles.actionSub}>{subtitle}</ThemedText>
      </Pressable>
    </Link>
  );
}

function TransactionRow({ tx }: { tx: TransactionUI }) {
  const isIncome = tx.type === "income";

  return (
    <ThemedView style={styles.txRow}>
      {/* icon */}
      <View style={styles.txIcon}>
        {tx.iconUri ? (
          <Image source={{ uri: tx.iconUri }} style={{ width: 18, height: 18, borderRadius: 6 }} />
        ) : (
          <ThemedText style={{ fontSize: 16 }}>{tx.iconEmoji ?? (isIncome ? "⬆️" : "⬇️")}</ThemedText>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <ThemedText style={styles.txTitle}>{tx.title}</ThemedText>
        <ThemedText style={styles.muted}>
          {tx.category}
          {tx.time ? ` • ${tx.time}` : ""}
        </ThemedText>
      </View>

      <ThemedText style={[styles.txAmount, isIncome ? styles.incomeText : styles.expenseText]}>
        {isIncome ? "+" : "-"} {formatVND(tx.amount)}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },

  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  muted: { opacity: 0.7, marginTop: 2 },

  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.35)",
  },
  addBtnText: { fontSize: 14, fontWeight: "700" },

  row: { flexDirection: "row", gap: 10, marginBottom: 14 },

  card: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
  },
  cardPrimary: {},
  cardSuccess: {},
  cardDanger: {},

  cardLabel: { fontSize: 12, opacity: 0.75, marginBottom: 6 },
  cardValue: { fontSize: 14, fontWeight: "800" },

  sectionHeader: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 6, marginBottom: 10 },
  linkText: { fontSize: 13, fontWeight: "700", opacity: 0.85 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },

  actionCard: {
    width: "48%",
    borderRadius: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
  },
  actionEmoji: { fontSize: 20, marginBottom: 8 },
  actionTitle: { fontSize: 14, fontWeight: "800", marginBottom: 2 },
  actionSub: { fontSize: 12, opacity: 0.75 },

  sep: { height: 10 },

  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
  },
  txTitle: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  txAmount: { fontSize: 13, fontWeight: "800" },
  incomeText: { opacity: 0.9 },
  expenseText: { opacity: 0.9 },
});
