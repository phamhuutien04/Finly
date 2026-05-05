// src/screens/AnalyticsScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View
} from 'react-native';


import { Colors } from '@/constants/theme';
import { useAppColorScheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Victory setup
let V: any;
if (Platform.OS === 'web') {
  V = require('victory');
} else {
  const m = require('victory-native');
  V = { ...m, ...(m?.default ?? {}) };
}

const { VictoryPie, VictoryAxis, VictoryChart, VictoryBar, VictoryGroup } = V;

// ──────────────────────────────────────────────
// TYPES
type Category = {
  id: number;
  name: string;
  type: 'income' | 'expense';
  emoji: string | null;
  icon_uri: string | null;
  icon_preset_id: string | null;
  created_at: string;
};

type Transaction = {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  note: string | null;
  occurred_at: string;
  category_id: number;
  category?: Partial<Category>;
};

type MonthlySummary = {
  month: string; // "YYYY-MM"
  income: number;
  expense: number;
};

interface PieDatum {
  x: string;
  y: number;
  percent: number;
  fill: string;
}

// ──────────────────────────────────────────────
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const YEARS = Array.from({ length: 11 }, (_, i) => String(2020 + i)); // 2020-2030

const PIE_COLORS = [
  '#4F46E5', '#22C55E', '#F97316', '#EF4444', '#06B6D4',
  '#A855F7', '#F59E0B', '#10B981', '#6366F1', '#EC4899',
];

const fmtMoney = (value: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value) + ' ₫';

// ──────────────────────────────────────────────
export default function AnalyticsScreen() {
  const scheme = useAppColorScheme();
  const theme = Colors[scheme ?? 'light'];

  // Dùng màu giống trang index
  const bg = scheme === 'dark' ? '#111827' : '#fff';
  const card = scheme === 'dark' ? '#1f2937' : '#ffffff';
  const text = scheme === 'dark' ? '#ECEDEE' : '#11181C';
  const subtleText = scheme === 'dark' ? '#9ca3af' : '#64748b';
  const borderColor = scheme === 'dark' ? '#374151' : '#e5e7eb';
  
  // Màu accent cho button - dùng màu xanh indigo
  const accentColor = '#6366f1';
  
  // Màu cho input/button - tối hơn một chút so với card trong dark mode
  const inputBg = scheme === 'dark' ? '#1f2937' : '#f9fafb';

  // Mặc định tháng/năm hiện tại
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentYear = now.getFullYear().toString();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categoriesMap, setCategoriesMap] = useState<Record<number, Category>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const currentYearMonth = `${selectedYear}-${selectedMonth}`;

  // ──────────────────────────────────────────────
  // Fetch dữ liệu
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Chưa đăng nhập');

        const userId = user.id;

        // Categories
        const { data: cats, error: catErr } = await supabase
          .from('categories')
          .select('*')
          .eq('user_id', userId)
          .order('name');

        if (catErr) throw catErr;

        const catMap: Record<number, Category> = {};
        cats?.forEach(c => { catMap[c.id] = c; });
        setCategoriesMap(catMap);

        // Transactions
        const { data: txs, error: txErr } = await supabase
          .from('transactions')
          .select(`
            id, type, amount, occurred_at, category_id, note,
            category:categories (id, name, type, emoji, icon_uri, icon_preset_id)
          `)
          .eq('user_id', userId)
          .order('occurred_at', { ascending: false })
          .limit(2000);

        if (txErr) throw txErr;

        setAllTransactions((txs as Transaction[]) || []);
      } catch (err: any) {
        setError(err.message || 'Lỗi tải dữ liệu');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Realtime subscription cho analytics
    const setupRealtimeSubscriptions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('🔄 Setting up realtime subscriptions for analytics page');

      // Subscribe to transactions và categories changes
      const analyticsChannel = supabase
        .channel('analytics_page_updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            console.log('📊 New transaction for analytics:', payload.new);
            const newTx = payload.new as any;
            
            // Lấy thông tin category cho transaction mới
            const { data: categoryData } = await supabase
              .from('categories')
              .select('id, name, type, emoji, icon_uri, icon_preset_id')
              .eq('id', newTx.category_id)
              .single();

            const newTransaction: Transaction = {
              ...newTx,
              category: categoryData || undefined
            };

            // Thêm vào đầu danh sách transactions
            setAllTransactions(prev => [newTransaction, ...prev.slice(0, 1999)]);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('📊 Transaction updated for analytics:', payload.new);
            const updatedTx = payload.new as any;
            
            setAllTransactions(prev => prev.map(tx => 
              tx.id === updatedTx.id 
                ? { ...tx, ...updatedTx }
                : tx
            ));
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('📊 Transaction deleted for analytics:', payload.old);
            const deletedTx = payload.old as any;
            
            setAllTransactions(prev => prev.filter(tx => tx.id !== deletedTx.id));
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'categories',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('📂 New category for analytics:', payload.new);
            const newCategory = payload.new as Category;
            
            setCategoriesMap(prev => ({
              ...prev,
              [newCategory.id]: newCategory
            }));
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'categories',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('📂 Category updated for analytics:', payload.new);
            const updatedCategory = payload.new as Category;
            
            setCategoriesMap(prev => ({
              ...prev,
              [updatedCategory.id]: updatedCategory
            }));
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'categories',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('📂 Category deleted for analytics:', payload.old);
            const deletedCategory = payload.old as Category;
            
            setCategoriesMap(prev => {
              const newMap = { ...prev };
              delete newMap[deletedCategory.id];
              return newMap;
            });
          }
        )
        .subscribe((status) => {
          console.log('📡 Analytics realtime status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Analytics page realtime connected');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Analytics page realtime error');
          }
        });

      return analyticsChannel;
    };

    let realtimeChannel: any = null;
    setupRealtimeSubscriptions().then(channel => {
      realtimeChannel = channel;
    });

    return () => {
      if (realtimeChannel) {
        console.log('🧹 Cleaning up analytics realtime subscriptions');
        realtimeChannel.unsubscribe();
      }
    };
  }, []);

  // ──────────────────────────────────────────────
  const currentTransactions = useMemo(() => {
    return allTransactions.filter(t => {
      const date = new Date(t.occurred_at);
      const y = date.getFullYear().toString();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}` === currentYearMonth;
    });
  }, [allTransactions, currentYearMonth]);

  const income = useMemo(() =>
    currentTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0),
  [currentTransactions]);

  const expense = useMemo(() =>
    currentTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0),
  [currentTransactions]);

  const balance = income - expense;

  // ──────────────────────────────────────────────
  const monthlyComparison = useMemo(() => {
    const map = new Map<string, MonthlySummary>();

    allTransactions.forEach(t => {
      const date = new Date(t.occurred_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!map.has(monthKey)) {
        map.set(monthKey, { month: monthKey, income: 0, expense: 0 });
      }

      const entry = map.get(monthKey)!;
      if (t.type === 'income') entry.income += Number(t.amount);
      else if (t.type === 'expense') entry.expense += Number(t.amount);
    });

    return Array.from(map.values())
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 12);
  }, [allTransactions]);

  // ──────────────────────────────────────────────
  const expensePieData = useMemo(() => {
    const map = new Map<string, number>();

    currentTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const catName = categoriesMap[t.category_id]?.name || 'Khác';
        map.set(catName, (map.get(catName) || 0) + Number(t.amount));
      });

    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);

    return Array.from(map.entries())
      .map(([name, amount], idx) => ({
        x: name,
        y: amount,
        percent: total > 0 ? Math.round((amount / total) * 100) : 0,
        fill: PIE_COLORS[idx % PIE_COLORS.length],
      }))
      .sort((a, b) => b.y - a.y);
  }, [currentTransactions, categoriesMap]);

  // ──────────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    return currentTransactions
      .filter(t => {
        if (filterType !== 'all' && t.type !== filterType) return false;
        if (selectedCategoryId !== null && t.category_id !== selectedCategoryId) return false;
        return true;
      })
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
  }, [currentTransactions, filterType, selectedCategoryId]);

  // ──────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: bg }}>
        <ActivityIndicator size="large" color={accentColor} />
        <Text style={{ marginTop: 16, color: text }}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: bg }}>
        <Text style={{ color: '#ef4444', fontSize: 18, textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  if (!VictoryPie || !VictoryAxis || !VictoryChart || !VictoryBar) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: bg }}>
        <Text style={{ color: text, fontWeight: '900' }}>Không tải được biểu đồ</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      <Text style={{ fontSize: 28, fontWeight: '900', color: text, marginBottom: 16 }}>
        Thống kê
      </Text>

      {/* Chọn tháng & năm */}
      <View style={{ backgroundColor: card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: borderColor }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: text, marginBottom: 12 }}>
          Chọn thời gian
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: text + 'AA', marginBottom: 6 }}>Tháng</Text>
            <Pressable 
              onPress={() => setShowMonthPicker(true)}
              style={{ 
                borderWidth: 1, 
                borderColor: accentColor, 
                borderRadius: 12, 
                backgroundColor: inputBg,
                padding: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: text, fontSize: 16, fontWeight: '600' }}>{selectedMonth}</Text>
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: text + 'AA', marginBottom: 6 }}>Năm</Text>
            <Pressable 
              onPress={() => setShowYearPicker(true)}
              style={{ 
                borderWidth: 1, 
                borderColor: accentColor, 
                borderRadius: 12, 
                backgroundColor: inputBg,
                padding: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: text, fontSize: 16, fontWeight: '600' }}>{selectedYear}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Modal chọn tháng */}
      <Modal visible={showMonthPicker} transparent animationType="fade">
        <Pressable 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setShowMonthPicker(false)}
        >
          <View style={{ backgroundColor: card, borderRadius: 20, padding: 20, width: '80%', maxWidth: 300 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: text, marginBottom: 16, textAlign: 'center' }}>
              Chọn tháng
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {MONTHS.map(m => (
                <Pressable
                  key={m}
                  onPress={() => {
                    setSelectedMonth(m);
                    setShowMonthPicker(false);
                  }}
                  style={{
                    width: '30%',
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: selectedMonth === m ? accentColor : inputBg,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: selectedMonth === m ? '#fff' : text, fontWeight: '700' }}>
                    {m}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Modal chọn năm */}
      <Modal visible={showYearPicker} transparent animationType="fade">
        <Pressable 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setShowYearPicker(false)}
        >
          <View style={{ backgroundColor: card, borderRadius: 20, padding: 20, width: '80%', maxWidth: 300, maxHeight: '70%' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: text, marginBottom: 16, textAlign: 'center' }}>
              Chọn năm
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 10 }}>
                {YEARS.map(y => (
                  <Pressable
                    key={y}
                    onPress={() => {
                      setSelectedYear(y);
                      setShowYearPicker(false);
                    }}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: selectedYear === y ? accentColor : inputBg,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: selectedYear === y ? '#fff' : text, fontWeight: '700', fontSize: 16 }}>
                      {y}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Cards */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <View style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: card, borderWidth: 1, borderColor: borderColor }}>
          <Text style={{ color: text + 'AA' }}>Thu nhập</Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: accentColor }}>{fmtMoney(income)}</Text>
        </View>
        <View style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: card, borderWidth: 1, borderColor: borderColor }}>
          <Text style={{ color: text + 'AA' }}>Chi tiêu</Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#ef4444' }}>{fmtMoney(expense)}</Text>
        </View>
      </View>

      <View style={{ padding: 16, borderRadius: 16, backgroundColor: card, borderWidth: 1, borderColor: borderColor, marginBottom: 24 }}>
        <Text style={{ color: text + 'AA' }}>Số dư</Text>
        <Text style={{ fontSize: 26, fontWeight: '900', color: balance >= 0 ? accentColor : '#ef4444' }}>
          {fmtMoney(balance)}
        </Text>
      </View>

      {/* So sánh thu/chi các tháng */}
      {monthlyComparison.length > 0 && (
        <View style={{ padding: 16, borderRadius: 16, backgroundColor: card, borderWidth: 1, borderColor: borderColor, marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: text, marginBottom: 12 }}>
            So sánh thu/chi giữa các tháng
          </Text>

          <VictoryChart
            width={SCREEN_WIDTH - 64}
            height={280}
            padding={{ top: 20, bottom: 70, left: 50, right: 15 }}
            domainPadding={{ x: 15 }}
          >
            <VictoryAxis
              tickFormat={(t: string) => t}
              style={{
                tickLabels: { fill: text + 'AA', fontSize: 8, angle: -45, textAnchor: 'end' },
                axis: { stroke: text + '44' },
              }}
            />
            <VictoryAxis
              dependentAxis
              tickFormat={(t: number) => `${Math.round(t / 1000000)}M`}
              style={{
                tickLabels: { fill: text + 'AA', fontSize: 8 },
                grid: { stroke: text + '22' },
                axis: { stroke: text + '44' },
              }}
            />
            <VictoryGroup offset={14}>
              <VictoryBar
                data={monthlyComparison.map(m => ({ x: m.month, y: m.income }))}
                cornerRadius={{ top: 3 }}
                style={{ data: { fill: accentColor } }}
                barWidth={12}
              />
              <VictoryBar
                data={monthlyComparison.map(m => ({ x: m.month, y: m.expense }))}
                cornerRadius={{ top: 3 }}
                style={{ data: { fill: '#ef4444' } }}
                barWidth={12}
              />
            </VictoryGroup>
          </VictoryChart>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: accentColor }} />
              <Text style={{ color: text + 'CC' }}>Thu nhập</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: '#ef4444' }} />
              <Text style={{ color: text + 'CC' }}>Chi tiêu</Text>
            </View>
          </View>
        </View>
      )}

      {/* Pie chi tiêu */}
      {expense > 0 && expensePieData.length > 0 && (
        <View style={{ padding: 16, borderRadius: 16, backgroundColor: card, borderWidth: 1, borderColor: borderColor, marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: text, marginBottom: 12 }}>
            Phân bổ chi tiêu theo danh mục
          </Text>

          <View style={{ alignItems: 'center' }}>
            <VictoryPie
              data={expensePieData}
              innerRadius={55}
              padAngle={2}
              width={SCREEN_WIDTH - 64}
              height={240}
              labels={(({ datum }: { datum: PieDatum }) => datum.percent > 5 ? `${datum.percent}%` : '')}
              labelRadius={75}
              style={{
                data: { fill: ({ datum }: { datum: PieDatum }) => datum.fill },
                labels: { fill: text, fontSize: 11, fontWeight: 'bold' },
              }}
            />
          </View>

          <View style={{ marginTop: 16, gap: 10 }}>
            {expensePieData.map((item, idx) => (
              <View
                key={idx}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: `${text}11`,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: item.fill }} />
                  <Text style={{ color: text, fontWeight: '600' }}>{item.x}</Text>
                </View>
                <Text style={{ color: text, fontWeight: '700' }}>{fmtMoney(item.y)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Bộ lọc */}
      <View style={{ padding: 16, borderRadius: 16, backgroundColor: card, borderWidth: 1, borderColor: borderColor, marginBottom: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '900', color: text, marginBottom: 12 }}>
          Lọc giao dịch
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          {['all', 'income', 'expense'].map(type => (
            <Pressable
              key={type}
              onPress={() => setFilterType(type as any)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: filterType === type ? accentColor : borderColor,
                backgroundColor: filterType === type ? accentColor : 'transparent',
              }}
            >
              <Text style={{ fontWeight: '700', color: filterType === type ? '#fff' : text }}>
                {type === 'all' ? 'Tất cả' : type === 'income' ? 'Thu nhập' : 'Chi tiêu'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Pressable
            onPress={() => setSelectedCategoryId(null)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 999,
              borderWidth: 1.5,
              borderColor: selectedCategoryId === null ? accentColor : borderColor,
              backgroundColor: selectedCategoryId === null ? accentColor : 'transparent',
            }}
          >
            <Text style={{ fontWeight: '700', color: selectedCategoryId === null ? '#fff' : text }}>
              Tất cả danh mục
            </Text>
          </Pressable>

          {Object.values(categoriesMap).map(cat => (
            <Pressable
              key={cat.id}
              onPress={() => setSelectedCategoryId(cat.id)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: selectedCategoryId === cat.id ? accentColor : borderColor,
                backgroundColor: selectedCategoryId === cat.id ? accentColor : 'transparent',
              }}
            >
              <Text style={{ fontWeight: '700', color: selectedCategoryId === cat.id ? '#fff' : text }}>
                {cat.emoji ? `${cat.emoji} ` : ''}{cat.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Danh sách giao dịch - hiển thị ảnh icon_uri + emoji fallback */}
      <View style={{ padding: 16, borderRadius: 16, backgroundColor: card, borderWidth: 1, borderColor: borderColor }}>
        <Text style={{ fontSize: 18, fontWeight: '900', color: text, marginBottom: 12 }}>
          Giao dịch tháng {selectedMonth}/{selectedYear} ({filteredTransactions.length})
        </Text>

        {filteredTransactions.length === 0 ? (
          <Text style={{ color: text + '88', textAlign: 'center', paddingVertical: 40, fontSize: 16 }}>
            Không có giao dịch nào trong tháng này
          </Text>
        ) : (
          filteredTransactions.map(tx => {
            const category = categoriesMap[tx.category_id];
            return (
              <View
                key={tx.id}
                style={{
                  flexDirection: 'row',
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: inputBg,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: borderColor,
                }}
              >
                <View style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  {category?.icon_uri ? (
                    <Image
                      source={{ uri: category.icon_uri }}
                      style={{ width: 36, height: 36, borderRadius: 18 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={{ fontSize: 28 }}>
                      {category?.emoji || '💰'}
                    </Text>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: text }}>
                      {category?.name || 'Không phân loại'}
                    </Text>
                    <Text
                      style={{
                        fontSize: 17,
                        fontWeight: '900',
                        color: tx.type === 'income' ? accentColor : '#ef4444',
                      }}
                    >
                      {tx.type === 'income' ? '+' : '-'} {fmtMoney(Number(tx.amount))}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ color: text + '88', fontSize: 13 }}>
                      {new Date(tx.occurred_at).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </Text>
                    <Text style={{ color: text + '88', fontSize: 13, flexShrink: 1, textAlign: 'right' }}>
                      {tx.note?.trim() ? tx.note.trim() : '(không có ghi chú)'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}