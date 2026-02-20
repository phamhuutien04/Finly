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
  Animated,
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
  amount: number;
  time: string;
  iconEmoji?: string | null;
  iconUri?: string | null;
};

type CategoryJoinRow = {
  name?: string | null;
  emoji?: string | null;
  icon_uri?: string | null;
  icon_preset_id?: string | null;
} | null;

type TransactionRowDB = {
  id: string | number;
  amount: number | null;
  type: TxType;
  note: string | null;
  occurred_at?: string | null;
  transaction_date?: string | null;
  created_at: string;
  category: CategoryJoinRow;
};

const formatVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

function getMonthLabel() {
  const d = new Date();
  return `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatTimeLabel(iso: string) {
  if (!iso) return "Không rõ";
  const d = new Date(iso);
  const now = new Date();

  const hhmm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

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

  const getUserId = async () => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    return userId ?? null;
  };

  const loadAll = async () => {
    const userId = await getUserId();
    if (!userId) {
      router.replace("/auth/login");
      setLoading(false);
      return;
    }

    try {
      const { data: allTx, error: allErr } = await supabase
        .from("transactions")
        .select("type, amount")
        .eq("user_id", userId);

      if (allErr) throw allErr;

      let inc = 0;
      let exp = 0;
      allTx?.forEach(row => {
        const amt = Number(row.amount ?? 0);
        if (row.type === "income") inc += amt;
        else if (row.type === "expense") exp += amt;
      });

      setBalance(inc - exp);
      setIncome(inc);
      setExpense(exp);

      const { data: recentTx, error: recentErr } = await supabase
        .from("transactions")
        .select(`
          id,
          amount,
          type,
          note,
          created_at,
          transaction_date,
          occurred_at,
          category:categories ( name, emoji, icon_uri, icon_preset_id )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (recentErr) throw recentErr;

      const mapped: TransactionUI[] = (recentTx ?? []).map((r: any) => {
        const amt = Number(r.amount ?? 0);
        const cat = r.category ?? {};
        const catName = cat.name?.trim() || cat.icon_preset_id?.trim() || "Khác";
        const title = r.note?.trim() || catName;
        const timeIso = r.created_at || r.transaction_date || r.occurred_at || "";
        const time = timeIso ? formatTimeLabel(timeIso) : "Không rõ";

        return {
          id: String(r.id),
          title,
          category: catName,
          type: r.type,
          amount: amt,
          time,
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

  useEffect(() => {
    loadAll();

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session?.user) router.replace("/auth/login");
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  return (
    <ThemedView style={styles.screen}>
      {/* Gradient Background Overlay */}
      <View style={styles.gradientOverlay} />
      
      {/* Decorative Elements */}
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      <FlatList
        data={txs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#6366f1"
          />
        }
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.greeting}>Xin chào! 👋</ThemedText>
                <ThemedText style={styles.subtitle}>{monthLabel}</ThemedText>
              </View>

              <Link href="/modal" asChild>
                <Pressable 
                  style={({ pressed }) => [
                    styles.addButton,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] }
                  ]}
                >
                  <ThemedText style={styles.addButtonText}>+</ThemedText>
                </Pressable>
              </Link>
            </View>

            {/* Hero Balance Card */}
            <View style={styles.heroCard}>
              <View style={styles.heroGradient} />
              
              <View style={styles.heroContent}>
                <ThemedText style={styles.heroLabel}>Tổng tài sản</ThemedText>
                <ThemedText style={styles.heroAmount}>{formatVND(balance)}</ThemedText>
                
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <View style={styles.statIconContainer}>
                      <ThemedText style={styles.statIcon}>↗</ThemedText>
                    </View>
                    <View>
                      <ThemedText style={styles.statLabel}>Thu nhập</ThemedText>
                      <ThemedText style={styles.statValue}>{formatVND(income)}</ThemedText>
                    </View>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statItem}>
                    <View style={[styles.statIconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                      <ThemedText style={styles.statIcon}>↘</ThemedText>
                    </View>
                    <View>
                      <ThemedText style={styles.statLabel}>Chi tiêu</ThemedText>
                      <ThemedText style={styles.statValue}>{formatVND(expense)}</ThemedText>
                    </View>
                  </View>
                </View>
              </View>

              {/* Decorative Pattern */}
              <View style={styles.patternContainer}>
                <View style={styles.patternDot} />
                <View style={[styles.patternDot, { top: 20, left: 15 }]} />
                <View style={[styles.patternDot, { top: 10, left: 30 }]} />
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <QuickAction 
                icon="💰" 
                label="Thêm thu" 
                href="/modal"
                gradient={['#10b981', '#059669']}
              />
              <QuickAction 
                icon="💸" 
                label="Thêm chi" 
                href="/modal"
                gradient={['#ef4444', '#dc2626']}
              />
              <QuickAction 
                icon="📊" 
                label="Báo cáo" 
                href="/explore"
                gradient={['#3b82f6', '#2563eb']}
              />
              <QuickAction 
                icon="🎯" 
                label="Ngân sách" 
                href="/explore"
                gradient={['#8b5cf6', '#7c3aed']}
              />
            </View>

            {/* Transactions Header */}
            <View style={styles.txHeader}>
              <View>
                <ThemedText style={styles.txTitle}>Giao dịch</ThemedText>
                <ThemedText style={styles.txSubtitle}>
                  {txs.length} giao dịch gần đây
                </ThemedText>
              </View>
              
              <Link href="/tab/transactions" asChild>
                <Pressable style={styles.viewAllBtn}>
                  <ThemedText style={styles.viewAllText}>Tất cả</ThemedText>
                  <ThemedText style={styles.viewAllArrow}>→</ThemedText>
                </Pressable>
              </Link>
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366f1" />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <ThemedText style={styles.emptyIcon}>💳</ThemedText>
              </View>
              <ThemedText style={styles.emptyTitle}>Chưa có giao dịch</ThemedText>
              <ThemedText style={styles.emptyDescription}>
                Bắt đầu ghi chép thu chi của bạn ngay hôm nay
              </ThemedText>
              <Link href="/modal" asChild>
                <Pressable style={styles.emptyButton}>
                  <ThemedText style={styles.emptyButtonText}>Thêm giao dịch đầu tiên</ThemedText>
                </Pressable>
              </Link>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <TransactionCard tx={item} index={index} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </ThemedView>
  );
}

function QuickAction({ 
  icon, 
  label, 
  href,
  gradient 
}: { 
  icon: string; 
  label: string; 
  href: string;
  gradient: string[];
}) {
  return (
    <Link href={href as any} asChild>
      <Pressable 
        style={({ pressed }) => [
          styles.actionCard,
          pressed && { opacity: 0.9, transform: [{ scale: 0.95 }] }
        ]}
      >
        <View 
          style={[
            styles.actionIconBg,
            { backgroundColor: gradient[0] + '20' }
          ]}
        >
          <ThemedText style={styles.actionIcon}>{icon}</ThemedText>
        </View>
        <ThemedText style={styles.actionLabel}>{label}</ThemedText>
      </Pressable>
    </Link>
  );
}

function TransactionCard({ tx, index }: { tx: TransactionUI; index: number }) {
  const isIncome = tx.type === "income";
  
  return (
    <Pressable 
      style={({ pressed }) => [
        styles.txCard,
        pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
      ]}
    >
      {/* Color indicator */}
      <View 
        style={[
          styles.txIndicator,
          { backgroundColor: isIncome ? '#10b981' : '#ef4444' }
        ]} 
      />
      
      <View style={styles.txIconWrapper}>
        {tx.iconUri ? (
          <Image 
            source={{ uri: tx.iconUri }} 
            style={styles.txIconImage}
          />
        ) : (
          <ThemedText style={styles.txEmoji}>
            {tx.iconEmoji ?? (isIncome ? "💰" : "💸")}
          </ThemedText>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <ThemedText style={styles.txCardTitle}>{tx.title}</ThemedText>
        <ThemedText style={styles.txCardMeta}>
          {tx.category} • {tx.time}
        </ThemedText>
      </View>

      <View style={styles.txAmountContainer}>
        <ThemedText 
          style={[
            styles.txCardAmount,
            { color: isIncome ? '#10b981' : '#ef4444' }
          ]}
        >
          {isIncome ? '+' : '−'}
        </ThemedText>
        <ThemedText 
          style={[
            styles.txCardValue,
            { color: isIncome ? '#10b981' : '#ef4444' }
          ]}
        >
          {formatVND(tx.amount)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  
  // Decorative elements
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 400,
    backgroundColor: '#6366f1',
    opacity: 0.03,
  },
  decorCircle1: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#818cf8',
    opacity: 0.08,
  },
  decorCircle2: {
    position: 'absolute',
    top: 120,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#c084fc',
    opacity: 0.06,
  },
  
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    paddingTop: 8,
  },
  greeting: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1.2,
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '600',
  },
  addButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  addButtonText: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: '300',
    marginTop: -2,
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 28,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 200,
    height: 200,
    backgroundColor: '#6366f1',
    opacity: 0.05,
    borderRadius: 100,
    transform: [{ translateX: 60 }, { translateY: -60 }],
  },
  heroContent: {
    zIndex: 1,
  },
  heroLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  heroAmount: {
    fontSize: 42,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -2,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIcon: {
    fontSize: 20,
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 12,
  },
  
  // Decorative pattern
  patternContainer: {
    position: 'absolute',
    top: 24,
    right: 24,
    opacity: 0.4,
  },
  patternDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
    opacity: 0.2,
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  actionIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionIcon: {
    fontSize: 26,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },

  // Transactions Header
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  txTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.8,
  },
  txSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '600',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6366f1',
  },
  viewAllArrow: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '600',
  },

  // Transaction Card
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    overflow: 'hidden',
  },
  txIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  txIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  txCardMeta: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
  txAmountContainer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
  },
  txCardAmount: {
    fontSize: 18,
    fontWeight: '900',
  },
  txCardValue: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.4,
  },

  // Empty State
  loadingContainer: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: '#e2e8f0',
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  emptyDescription: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    fontWeight: '500',
  },
  emptyButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});