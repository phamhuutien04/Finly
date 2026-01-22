import React from 'react';
import { StyleSheet, View, Pressable, FlatList } from 'react-native';
import { Link } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type TxType = 'income' | 'expense';

type Transaction = {
  id: string;
  title: string;
  category: string;
  type: TxType;
  amount: number; // VND
  time: string; // "Hôm nay • 08:30"
};

const transactions: Transaction[] = [
  { id: '1', title: 'Trà sữa', category: 'Ăn uống', type: 'expense', amount: 35000, time: 'Hôm nay • 09:10' },
  { id: '2', title: 'Lương', category: 'Thu nhập', type: 'income', amount: 6500000, time: 'Hôm qua • 18:22' },
  { id: '3', title: 'Grab', category: 'Di chuyển', type: 'expense', amount: 52000, time: 'Hôm qua • 12:01' },
  { id: '4', title: 'Mua sách', category: 'Học tập', type: 'expense', amount: 120000, time: '2 ngày trước • 20:15' },
];

const formatVND = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

function getMonthLabel() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  return `Tháng ${m}/${y}`;
}

export default function HomeScreen() {
  // Demo tổng hợp (bạn thay bằng data thật sau)
  const income = 6500000;
  const expense = 35000 + 52000 + 120000;
  const balance = income - expense;

  return (
    <ThemedView style={styles.screen}>
      {/* Header */}
      <ThemedView style={styles.header}>
        <View style={{ flex: 1 }}>
          <ThemedText type="title">Tổng quan</ThemedText>
          <ThemedText style={styles.muted}>{getMonthLabel()}</ThemedText>
        </View>

        {/* Nút đi tới screen thêm giao dịch (bạn tạo route sau) */}
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

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => <TransactionRow tx={item} />}
        showsVerticalScrollIndicator={false}
      />
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
  tone: 'primary' | 'success' | 'danger';
}) {
  return (
    <ThemedView style={[styles.card, tone === 'primary' && styles.cardPrimary, tone === 'success' && styles.cardSuccess, tone === 'danger' && styles.cardDanger]}>
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

function TransactionRow({ tx }: { tx: Transaction }) {
  const isIncome = tx.type === 'income';
  return (
    <ThemedView style={styles.txRow}>
      <View style={styles.txIcon}>
        <ThemedText style={{ fontSize: 16 }}>{isIncome ? '⬆️' : '⬇️'}</ThemedText>
      </View>

      <View style={{ flex: 1 }}>
        <ThemedText style={styles.txTitle}>{tx.title}</ThemedText>
        <ThemedText style={styles.muted}>{tx.category} • {tx.time}</ThemedText>
      </View>

      <ThemedText style={[styles.txAmount, isIncome ? styles.incomeText : styles.expenseText]}>
        {isIncome ? '+' : '-'} {formatVND(tx.amount)}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },

  muted: {
    opacity: 0.7,
    marginTop: 2,
  },

  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.35)',
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },

  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },

  card: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)',
  },
  cardPrimary: {},
  cardSuccess: {},
  cardDanger: {},

  cardLabel: {
    fontSize: 12,
    opacity: 0.75,
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 14,
    fontWeight: '800',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginTop: 6,
    marginBottom: 10,
  },

  linkText: {
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.85,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },

  actionCard: {
    width: '48%',
    borderRadius: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)',
  },
  actionEmoji: {
    fontSize: 20,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  actionSub: {
    fontSize: 12,
    opacity: 0.75,
  },

  sep: {
    height: 10,
  },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)',
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)',
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  incomeText: {
    opacity: 0.9,
  },
  expenseText: {
    opacity: 0.9,
  },
});
