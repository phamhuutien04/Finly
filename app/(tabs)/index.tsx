import Ionicons from "@expo/vector-icons/Ionicons";
import { Link, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useBudgetAlert } from "@/hooks/useBudgetAlert";
import { useNotifications } from "@/hooks/useNotifications";
import { useSepayAutoSync } from "@/hooks/useSepayAutoSync";
import { setGlobalAlertFunction } from "@/lib/budgetNotification";
import { supabase } from "@/lib/supabase";

// Get screen dimensions for responsive design
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;
const isMediumScreen = screenWidth >= 375 && screenWidth < 414;
const isLargeScreen = screenWidth >= 414;

// Import BudgetAlerts conditionally
let BudgetAlerts: any = null;
try {
  BudgetAlerts = require("@/components/BudgetAlerts").default;
} catch (error) {
  console.log('BudgetAlerts component not available');
  BudgetAlerts = () => null; // Fallback component
}

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
  const { showAlert, AlertComponent } = useBudgetAlert();
  const { unreadCount } = useNotifications();
  
  // Tự động đồng bộ Sepay mỗi 15 giây
  const { isSyncing: isSyncingSepay, lastSyncTime, syncStats } = useSepayAutoSync();
  
  // Debug log
  useEffect(() => {
    console.log('📊 Sepay Auto-sync Status:', {
      isSyncing: isSyncingSepay,
      lastSyncTime: lastSyncTime?.toLocaleTimeString(),
      syncStats,
      platform: Platform.OS,
    });
  }, [isSyncingSepay, lastSyncTime, syncStats]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [txs, setTxs] = useState<TransactionUI[]>([]);
  const [balance, setBalance] = useState(0);
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);

  const monthLabel = useMemo(() => getMonthLabel(), []);

  // Set global alert function
  useEffect(() => {
    if (setGlobalAlertFunction && showAlert) {
      setGlobalAlertFunction(showAlert);
    }
  }, [showAlert]);

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
        .limit(5);

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

    // Realtime subscription cho transactions, categories, và budgets
    const setupRealtimeSubscriptions = async () => {
      const userId = await getUserId();
      if (!userId) return;

      console.log('🔄 Setting up realtime subscriptions for home page');

      // Subscribe to transactions, categories, and budgets changes
      const homeChannel = supabase
        .channel('home_data_updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${userId}`,
          },
          async (payload) => {
            console.log('📊 New transaction added:', payload.new);
            const newTx = payload.new as any;
            
            // Cập nhật balance ngay lập tức
            const amount = Number(newTx.amount || 0);
            if (newTx.type === 'income') {
              setIncome(prev => prev + amount);
              setBalance(prev => prev + amount);
            } else if (newTx.type === 'expense') {
              setExpense(prev => prev + amount);
              setBalance(prev => prev - amount);
            }

            // Lấy thông tin category cho transaction mới
            const { data: categoryData } = await supabase
              .from('categories')
              .select('name, emoji, icon_uri, icon_preset_id')
              .eq('id', newTx.category_id)
              .single();

            // Tạo transaction UI object
            const cat = categoryData || {} as any;
            const catName = cat.name?.trim() || cat.icon_preset_id?.trim() || "Khác";
            const title = newTx.note?.trim() || catName;
            const timeIso = newTx.created_at || newTx.transaction_date || newTx.occurred_at || "";
            const time = timeIso ? formatTimeLabel(timeIso) : "Không rõ";

            const newTxUI: TransactionUI = {
              id: String(newTx.id),
              title,
              category: catName,
              type: newTx.type,
              amount,
              time,
              iconEmoji: cat.emoji ?? null,
              iconUri: cat.icon_uri ?? null,
            };

            // Thêm vào đầu danh sách
            setTxs(prev => [newTxUI, ...prev.slice(0, 4)]); // Giữ tối đa 5 items
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${userId}`,
          },
          async (payload) => {
            console.log('📊 Transaction updated:', payload.new);
            const updatedTx = payload.new as any;
            const oldTx = payload.old as any;
            
            // Cập nhật balance (trừ cũ, cộng mới)
            const oldAmount = Number(oldTx.amount || 0);
            const newAmount = Number(updatedTx.amount || 0);
            
            if (oldTx.type === 'income') {
              setIncome(prev => prev - oldAmount);
              setBalance(prev => prev - oldAmount);
            } else if (oldTx.type === 'expense') {
              setExpense(prev => prev - oldAmount);
              setBalance(prev => prev + oldAmount);
            }
            
            if (updatedTx.type === 'income') {
              setIncome(prev => prev + newAmount);
              setBalance(prev => prev + newAmount);
            } else if (updatedTx.type === 'expense') {
              setExpense(prev => prev + newAmount);
              setBalance(prev => prev - newAmount);
            }

            // Cập nhật trong danh sách transactions
            setTxs(prev => prev.map(tx => {
              if (tx.id === String(updatedTx.id)) {
                return {
                  ...tx,
                  amount: newAmount,
                  type: updatedTx.type,
                  title: updatedTx.note?.trim() || tx.category,
                };
              }
              return tx;
            }));
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            console.log('📊 Transaction deleted:', payload.old);
            const deletedTx = payload.old as any;
            
            // Cập nhật balance
            const amount = Number(deletedTx.amount || 0);
            if (deletedTx.type === 'income') {
              setIncome(prev => prev - amount);
              setBalance(prev => prev - amount);
            } else if (deletedTx.type === 'expense') {
              setExpense(prev => prev - amount);
              setBalance(prev => prev + amount);
            }

            // Xóa khỏi danh sách
            setTxs(prev => prev.filter(tx => tx.id !== String(deletedTx.id)));
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'categories',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            console.log('📂 Category changed:', payload.eventType, payload.new || payload.old);
            // Chỉ reload khi có thay đổi category (ảnh hưởng đến hiển thị transactions)
            if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
              // Reload để cập nhật tên category trong transactions
              loadAll();
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'budgets',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            console.log('💰 Budget changed:', payload.eventType, payload.new || payload.old);
            // Reload data when budgets change (affects budget alerts)
            loadAll();
          }
        )
        .subscribe((status) => {
          console.log('📡 Home realtime status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Home page realtime connected');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Home page realtime error');
          } else if (status === 'CLOSED') {
            console.log('🔒 Home page realtime closed');
          }
        });

      return homeChannel;
    };

    let realtimeChannel: any = null;
    setupRealtimeSubscriptions().then(channel => {
      realtimeChannel = channel;
    });

    return () => {
      listener.subscription.unsubscribe();
      if (realtimeChannel) {
        console.log('🧹 Cleaning up home realtime subscriptions');
        realtimeChannel.unsubscribe();
      }
    };
  }, [router]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  // Export loadAll để có thể gọi từ bên ngoài
  React.useEffect(() => {
    // Lắng nghe custom event để reload
    const handleReloadHome = () => {
      console.log('🔄 Reloading home data...');
      loadAll();
    };

    // Có thể dùng EventEmitter hoặc custom event
    // Tạm thời dùng interval để check
    return () => {
      // Cleanup
    };
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: '#fafafa' }]}>
      <FlatList
        data={txs}
        keyExtractor={(item: TransactionUI) => item.id}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ThemedText style={styles.subtitle}>{monthLabel}</ThemedText>
                </View>
              </View>

              <View style={styles.headerButtons}>
                {/* Notification Button */}
                <Link href="/tab/notifications" asChild>
                  <Pressable 
                    style={({ pressed }: { pressed: boolean }) => [
                      styles.notificationButton,
                      pressed && { opacity: 0.7 }
                    ]}
                  >
                    <Ionicons name="notifications-outline" size={24} color="#374151" />
                    {/* Badge for unread notifications - only show if count > 0 */}
                    {unreadCount > 0 && (
                      <View style={styles.notificationBadge}>
                        <ThemedText style={styles.notificationBadgeText}>
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </ThemedText>
                      </View>
                    )}
                  </Pressable>
                </Link>

                {/* Add Transaction Button */}
                <Link href="/tab/modal" asChild>
                  <Pressable 
                    style={({ pressed }: { pressed: boolean }) => [
                      styles.addButton,
                      pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] }
                    ]}
                  >
                    <Ionicons name="add" size={28} color="#000" />
                  </Pressable>
                </Link>
              </View>
            </View>

            {/* Hero Balance Card */}
            <View style={styles.heroCard}>
              <View style={styles.heroContent}>
                <ThemedText style={styles.heroLabel}>Tổng tài sản</ThemedText>
                <View style={styles.amountContainer}>
                  <Text style={styles.heroAmount}>{formatVND(balance)}</Text>
                </View>
                
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
            </View>

            {/* Budget Alerts */}
            {BudgetAlerts && <BudgetAlerts />}

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <QuickAction 
                icon="📸" 
                label="Quét hóa đơn" 
                href="/scan-receipt"
                gradient={['#10b981', '#059669']}
              />
              <QuickAction 
                icon="🎯" 
                label="Ngân sách" 
                href="/tab/listbudgets"
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
              <Link href="/tab/modal" asChild>
                <Pressable style={styles.emptyButton}>
                  <ThemedText style={styles.emptyButtonText}>Thêm giao dịch đầu tiên</ThemedText>
                </Pressable>
              </Link>
            </View>
          )
        }
        renderItem={({ item, index }: { item: TransactionUI; index: number }) => (
          <TransactionCard tx={item} index={index} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
      
      {/* Custom Budget Alert */}
      {AlertComponent && <AlertComponent />}
    </View>
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
        style={({ pressed }: { pressed: boolean }) => [
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
      style={({ pressed }: { pressed: boolean }) => [
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
  
  scrollContent: {
    paddingHorizontal: isSmallScreen ? 16 : isMediumScreen ? 20 : 24,
    paddingTop: 16,
    paddingBottom: 100,
  },

  // Header - Responsive
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: isSmallScreen ? 20 : isMediumScreen ? 24 : 28,
    paddingTop: 8,
  },
  greeting: {
    fontSize: isSmallScreen ? 26 : isMediumScreen ? 30 : 32,
    fontWeight: '900',
    letterSpacing: -1.2,
    color: '#0f172a',
  },
  subtitle: {
    fontSize: isSmallScreen ? 13 : isMediumScreen ? 14 : 15,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationButton: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#fafafa',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  addButton: {
    width: isSmallScreen ? 48 : isMediumScreen ? 52 : 56,
    height: isSmallScreen ? 48 : isMediumScreen ? 52 : 56,
    borderRadius: isSmallScreen ? 24 : isMediumScreen ? 26 : 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  // Hero Card - Responsive
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: isSmallScreen ? 20 : isMediumScreen ? 24 : 28,
    padding: isSmallScreen ? 16 : isMediumScreen ? 20 : 24,
    marginBottom: isSmallScreen ? 16 : isMediumScreen ? 20 : 24,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    width: '100%',
    alignSelf: 'stretch',
  },
  heroContent: {
    position: 'relative',
  },
  amountContainer: {
    backgroundColor: '#ffffff',
    padding: isSmallScreen ? 12 : isMediumScreen ? 14 : 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    width: '100%',
    minHeight: isSmallScreen ? 60 : isMediumScreen ? 70 : 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: isSmallScreen ? 12 : isMediumScreen ? 13 : 14,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  heroAmount: {
    fontSize: isSmallScreen ? 24 : isMediumScreen ? 28 : 32,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -1,
    textAlign: 'center',
    backgroundColor: 'transparent',
    width: '100%',
    flexShrink: 1,
    lineHeight: isSmallScreen ? 30 : isMediumScreen ? 35 : 40,
    paddingVertical: 8,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  statsRow: {
    flexDirection: isSmallScreen ? 'column' : 'row',
    alignItems: 'center',
    gap: isSmallScreen ? 12 : 0,
  },
  statItem: {
    flex: isSmallScreen ? 0 : 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: isSmallScreen ? 8 : isMediumScreen ? 10 : 12,
    width: isSmallScreen ? '100%' : 'auto',
  },
  statIconContainer: {
    width: isSmallScreen ? 36 : isMediumScreen ? 40 : 44,
    height: isSmallScreen ? 36 : isMediumScreen ? 40 : 44,
    borderRadius: isSmallScreen ? 10 : isMediumScreen ? 12 : 14,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIcon: {
    fontSize: isSmallScreen ? 16 : isMediumScreen ? 18 : 20,
  },
  statLabel: {
    fontSize: isSmallScreen ? 11 : isMediumScreen ? 12 : 12,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 2,
  },
  statValue: {
    fontSize: isSmallScreen ? 14 : isMediumScreen ? 15 : 16,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.5,
    backgroundColor: 'transparent',
  },
  statDivider: {
    width: isSmallScreen ? '100%' : 1,
    height: isSmallScreen ? 1 : 40,
    backgroundColor: '#e2e8f0',
    marginHorizontal: isSmallScreen ? 0 : 12,
    marginVertical: isSmallScreen ? 8 : 0,
  },

  // Quick Actions - Single Budget Button
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: isSmallScreen ? 24 : isMediumScreen ? 28 : 32,
  },
  actionCard: {
    backgroundColor: '#ffffff',
    borderRadius: isSmallScreen ? 16 : isMediumScreen ? 18 : 20,
    paddingVertical: isSmallScreen ? 16 : isMediumScreen ? 18 : 20,
    paddingHorizontal: isSmallScreen ? 32 : isMediumScreen ? 36 : 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    minWidth: isSmallScreen ? 120 : isMediumScreen ? 140 : 160,
  },
  actionIconBg: {
    width: isSmallScreen ? 44 : isMediumScreen ? 48 : 52,
    height: isSmallScreen ? 44 : isMediumScreen ? 48 : 52,
    borderRadius: isSmallScreen ? 12 : isMediumScreen ? 14 : 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: isSmallScreen ? 8 : isMediumScreen ? 9 : 10,
  },
  actionIcon: {
    fontSize: isSmallScreen ? 20 : isMediumScreen ? 23 : 26,
  },
  actionLabel: {
    fontSize: isSmallScreen ? 13 : isMediumScreen ? 14 : 15,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
    textAlign: 'center',
  },

  // Transactions Header - Responsive
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isSmallScreen ? 12 : isMediumScreen ? 14 : 16,
  },
  txTitle: {
    fontSize: isSmallScreen ? 20 : isMediumScreen ? 22 : 24,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.8,
  },
  txSubtitle: {
    fontSize: isSmallScreen ? 12 : isMediumScreen ? 12 : 13,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '600',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: isSmallScreen ? 6 : isMediumScreen ? 7 : 8,
    paddingHorizontal: isSmallScreen ? 10 : isMediumScreen ? 11 : 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  viewAllText: {
    fontSize: isSmallScreen ? 13 : isMediumScreen ? 13 : 14,
    fontWeight: '700',
    color: '#6366f1',
  },
  viewAllArrow: {
    fontSize: isSmallScreen ? 14 : isMediumScreen ? 15 : 16,
    color: '#6366f1',
    fontWeight: '600',
  },

  // Transaction Card - Responsive
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isSmallScreen ? 10 : isMediumScreen ? 12 : 14,
    backgroundColor: '#ffffff',
    borderRadius: isSmallScreen ? 16 : isMediumScreen ? 18 : 20,
    padding: isSmallScreen ? 12 : isMediumScreen ? 14 : 16,
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
    width: isSmallScreen ? 44 : isMediumScreen ? 48 : 52,
    height: isSmallScreen ? 44 : isMediumScreen ? 48 : 52,
    borderRadius: isSmallScreen ? 12 : isMediumScreen ? 14 : 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  txIconImage: {
    width: isSmallScreen ? 24 : isMediumScreen ? 28 : 32,
    height: isSmallScreen ? 24 : isMediumScreen ? 28 : 32,
    borderRadius: isSmallScreen ? 8 : isMediumScreen ? 10 : 12,
  },
  txEmoji: {
    fontSize: isSmallScreen ? 20 : isMediumScreen ? 23 : 26,
  },
  txCardTitle: {
    fontSize: isSmallScreen ? 14 : isMediumScreen ? 15 : 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  txCardMeta: {
    fontSize: isSmallScreen ? 12 : isMediumScreen ? 12 : 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
  txAmountContainer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
  },
  txCardAmount: {
    fontSize: isSmallScreen ? 16 : isMediumScreen ? 17 : 18,
    fontWeight: '900',
  },
  txCardValue: {
    fontSize: isSmallScreen ? 14 : isMediumScreen ? 15 : 16,
    fontWeight: '800',
    letterSpacing: -0.4,
  },

  // Empty State - Responsive
  loadingContainer: {
    paddingVertical: isSmallScreen ? 60 : isMediumScreen ? 70 : 80,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: isSmallScreen ? 40 : isMediumScreen ? 50 : 60,
    paddingHorizontal: isSmallScreen ? 24 : isMediumScreen ? 28 : 32,
  },
  emptyIconContainer: {
    width: isSmallScreen ? 80 : isMediumScreen ? 90 : 100,
    height: isSmallScreen ? 80 : isMediumScreen ? 90 : 100,
    borderRadius: isSmallScreen ? 40 : isMediumScreen ? 45 : 50,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: isSmallScreen ? 20 : isMediumScreen ? 22 : 24,
    borderWidth: 3,
    borderColor: '#e2e8f0',
  },
  emptyIcon: {
    fontSize: isSmallScreen ? 36 : isMediumScreen ? 42 : 48,
  },
  emptyTitle: {
    fontSize: isSmallScreen ? 18 : isMediumScreen ? 20 : 22,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 8,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: isSmallScreen ? 14 : isMediumScreen ? 14 : 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: isSmallScreen ? 20 : isMediumScreen ? 21 : 22,
    marginBottom: isSmallScreen ? 24 : isMediumScreen ? 26 : 28,
    fontWeight: '500',
  },
  emptyButton: {
    backgroundColor: '#6366f1',
    paddingVertical: isSmallScreen ? 14 : isMediumScreen ? 15 : 16,
    paddingHorizontal: isSmallScreen ? 28 : isMediumScreen ? 30 : 32,
    borderRadius: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: isSmallScreen ? 14 : isMediumScreen ? 14 : 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});