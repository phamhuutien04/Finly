import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Chỉ import DateTimePicker khi không phải web
let DateTimePicker: any = null;
if (Platform.OS !== "web") {
  DateTimePicker = require("@react-native-community/datetimepicker").default;
}

type Category = {
  id: number;
  name: string | null;
  type: string | null;
};

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'custom';

export default function BudgetFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<PeriodType>('monthly');

  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);

  // Preset dates
  const [presetOption, setPresetOption] = useState<'this_week' | 'next_week' | 'this_month' | 'next_month' | 'custom'>('this_month');

  useEffect(() => {
    fetchExpenseCategories();
    if (id) {
      fetchBudget(Number(id));
    } else {
      updateDateRangeByPeriod(period);
    }
  }, [id]);

  // Cập nhật ngày theo period
  const updateDateRangeByPeriod = (selectedPeriod: PeriodType) => {
    const now = new Date();
    let newStart = new Date(now);
    let newEnd = new Date(now);

    switch (selectedPeriod) {
      case 'daily':
        // Hôm nay
        newStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        newEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        setPresetOption('custom');
        break;
      
      case 'weekly':
        // Tuần này (Thứ 2 - Chủ nhật)
        const day = now.getDay(); // 0: Chủ nhật, 1: Thứ 2, ...
        const diffToMonday = day === 0 ? -6 : 1 - day;
        newStart.setDate(now.getDate() + diffToMonday);
        newEnd = new Date(newStart);
        newEnd.setDate(newStart.getDate() + 6);
        setPresetOption('this_week');
        break;
      
      case 'monthly':
        // Tháng này
        newStart = new Date(now.getFullYear(), now.getMonth(), 1);
        newEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        setPresetOption('this_month');
        break;
      
      case 'custom':
        // Giữ nguyên hoặc set mặc định 30 ngày
        newEnd.setDate(now.getDate() + 30);
        setPresetOption('custom');
        break;
    }

    setStartDate(newStart);
    setEndDate(newEnd);
  };

  // Xử lý khi chọn period
  const handlePeriodChange = (newPeriod: PeriodType) => {
    setPeriod(newPeriod);
    updateDateRangeByPeriod(newPeriod);
  };

  // Xử lý khi chọn preset
  const handlePresetChange = (preset: 'this_week' | 'next_week' | 'this_month' | 'next_month' | 'custom') => {
    const now = new Date();
    let newStart = new Date(now);
    let newEnd = new Date(now);

    switch (preset) {
      case 'this_week':
        const day = now.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        newStart.setDate(now.getDate() + diffToMonday);
        newEnd = new Date(newStart);
        newEnd.setDate(newStart.getDate() + 6);
        setPeriod('weekly');
        break;
      
      case 'next_week':
        const nextWeek = new Date(now);
        nextWeek.setDate(now.getDate() + 7);
        const nextDay = nextWeek.getDay();
        const nextDiff = nextDay === 0 ? -6 : 1 - nextDay;
        newStart.setDate(nextWeek.getDate() + nextDiff);
        newEnd = new Date(newStart);
        newEnd.setDate(newStart.getDate() + 6);
        setPeriod('weekly');
        break;
      
      case 'this_month':
        newStart = new Date(now.getFullYear(), now.getMonth(), 1);
        newEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        setPeriod('monthly');
        break;
      
      case 'next_month':
        const nextMonth = now.getMonth() + 1;
        const nextYear = nextMonth > 11 ? now.getFullYear() + 1 : now.getFullYear();
        const month = nextMonth > 11 ? 0 : nextMonth;
        newStart = new Date(nextYear, month, 1);
        newEnd = new Date(nextYear, month + 1, 0, 23, 59, 59);
        setPeriod('monthly');
        break;
      
      case 'custom':
        setPeriod('custom');
        break;
    }

    setStartDate(newStart);
    setEndDate(newEnd);
    setPresetOption(preset);
  };

  const fetchExpenseCategories = async () => {
    setLoadingCategories(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;

      if (!uid) {
        Alert.alert('Lỗi', 'Vui lòng đăng nhập');
        return;
      }

      const { data, error } = await supabase
        .from('categories')
        .select('id, name, type')
        .eq('type', 'expense')
        .or(`user_id.eq.${uid},user_id.is.null`)
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchBudget = async (budgetId: number) => {
    try {
      const { data, error } = await supabase
        .from('budgets')
        .select('category_id, amount, period, start_date, end_date')
        .eq('id', budgetId)
        .single();

      if (error) throw error;
      if (!data) return Alert.alert('Không tìm thấy');

      setSelectedCategoryId(data.category_id);
      setAmount(data.amount.toString());
      setPeriod(data.period as PeriodType);
      setStartDate(new Date(data.start_date));
      setEndDate(new Date(data.end_date));
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    }
  };

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) {
      return Alert.alert('Lỗi', 'Số tiền phải lớn hơn 0');
    }
    if (!selectedCategoryId) {
      return Alert.alert('Lỗi', 'Vui lòng chọn hạng mục');
    }
    if (startDate > endDate) {
      return Alert.alert('Lỗi', 'Ngày bắt đầu phải trước ngày kết thúc');
    }

    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setSaving(false);
      return Alert.alert('Lỗi', 'Vui lòng đăng nhập');
    }

    // Chuyển đổi period: nếu là 'daily' thì lưu là 'custom' vào database
    const dbPeriod = period === 'daily' ? 'custom' : period;

    const payload = {
      user_id: session.user.id,
      category_id: selectedCategoryId,
      amount: Number(amount),
      period: dbPeriod,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    };

    let result;
    if (id) {
      result = await supabase.from('budgets').update(payload).eq('id', Number(id));
    } else {
      result = await supabase.from('budgets').insert([payload]);
    }

    setSaving(false);

    if (result.error) {
      Alert.alert('Lỗi', result.error.message);
    } else {
      Alert.alert('Thành công', id ? 'Đã cập nhật' : 'Đã tạo ngân sách');
      router.back();
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>
            {id ? '✏️ Chỉnh sửa ngân sách' : '💰 Đặt ngân sách mới'}
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>📋 Chọn hạng mục chi tiêu</ThemedText>
          
          {loadingCategories ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color="#ef4444" />
              <ThemedText style={styles.loadingText}>Đang tải...</ThemedText>
            </View>
          ) : categories.length === 0 ? (
            <View style={styles.centerEmpty}>
              <Text style={styles.emptyIcon}>📁</Text>
              <ThemedText style={styles.emptyText}>Chưa có hạng mục nào</ThemedText>
              <ThemedText style={styles.emptySubtext}>
                Tạo hạng mục chi tiêu trong mục "Danh mục"
              </ThemedText>
            </View>
          ) : (
            <View style={styles.categoryGrid}>
              {categories.map(cat => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryItem,
                      isSelected && styles.categoryItemSelected,
                    ]}
                    onPress={() => setSelectedCategoryId(cat.id)}
                  >
                    <Text style={[styles.categoryIcon, isSelected && { color: '#fff' }]}>
                    </Text>
                    <ThemedText
                      style={[
                        styles.categoryText,
                        isSelected && { color: '#fff' },
                      ]}
                      numberOfLines={1}
                    >
                      {cat.name || 'Không tên'}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Amount */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>💰 Giới hạn chi tiêu</ThemedText>
          <View style={styles.amountInputContainer}>
            <Text style={styles.currencyLabel}>VNĐ</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="Nhập số tiền"
              placeholderTextColor="#999"
            />
          </View>
        </View>

        {/* Period Selection */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>📅 Chu kỳ</ThemedText>
          
          <View style={styles.periodRow}>
            <TouchableOpacity
              style={[
                styles.periodBtn,
                period === 'daily' && styles.periodBtnActive,
              ]}
              onPress={() => handlePeriodChange('daily')}
            >
              <Text style={[styles.periodBtnIcon, period === 'daily' && styles.periodBtnTextActive]}>📅</Text>
              <Text style={[styles.periodBtnText, period === 'daily' && styles.periodBtnTextActive]}>
                Ngày
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.periodBtn,
                period === 'weekly' && styles.periodBtnActive,
              ]}
              onPress={() => handlePeriodChange('weekly')}
            >
              <Text style={[styles.periodBtnIcon, period === 'weekly' && styles.periodBtnTextActive]}>�</Text>
              <Text style={[styles.periodBtnText, period === 'weekly' && styles.periodBtnTextActive]}>
                Tuần
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.periodBtn,
                period === 'monthly' && styles.periodBtnActive,
              ]}
              onPress={() => handlePeriodChange('monthly')}
            >
              <Text style={[styles.periodBtnIcon, period === 'monthly' && styles.periodBtnTextActive]}>�</Text>
              <Text style={[styles.periodBtnText, period === 'monthly' && styles.periodBtnTextActive]}>
                Tháng
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.periodBtn,
                period === 'custom' && styles.periodBtnActive,
              ]}
              onPress={() => handlePeriodChange('custom')}
            >
              <Text style={[styles.periodBtnIcon, period === 'custom' && styles.periodBtnTextActive]}>⚙️</Text>
              <Text style={[styles.periodBtnText, period === 'custom' && styles.periodBtnTextActive]}>
                Tùy chỉnh
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Preset Options */}
        {period !== 'custom' && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>🎯 Chọn khoảng thời gian</ThemedText>
            
            <View style={styles.presetRow}>
              {(period === 'weekly' || period === 'monthly') && (
                <>
                  <TouchableOpacity
                    style={[
                      styles.presetBtn,
                      presetOption === `this_${period}` && styles.presetBtnActive,
                    ]}
                    onPress={() => handlePresetChange(period === 'weekly' ? 'this_week' : 'this_month')}
                  >
                    <Text style={[
                      styles.presetBtnText,
                      presetOption === `this_${period}` && styles.presetBtnTextActive
                    ]}>
                      {period === 'weekly' ? '📅 Tuần này' : '📅 Tháng này'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.presetBtn,
                      presetOption === `next_${period}` && styles.presetBtnActive,
                    ]}
                    onPress={() => handlePresetChange(period === 'weekly' ? 'next_week' : 'next_month')}
                  >
                    <Text style={[
                      styles.presetBtnText,
                      presetOption === `next_${period}` && styles.presetBtnTextActive
                    ]}>
                      {period === 'weekly' ? '📅 Tuần sau' : '📅 Tháng sau'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}

        {/* Date Range */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>📆 Khoảng thời gian</ThemedText>
          
          <View style={styles.dateRangeContainer}>
            <View style={styles.dateBox}>
              <Text style={styles.dateLabel}>Từ ngày</Text>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => setShowStartPicker(true)}
              >
                <Text style={styles.dateIcon}>📅</Text>
                <Text style={styles.dateText}>{formatDate(startDate)}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.dateArrow}>→</Text>

            <View style={styles.dateBox}>
              <Text style={styles.dateLabel}>Đến ngày</Text>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => setShowEndPicker(true)}
              >
                <Text style={styles.dateIcon}>📅</Text>
                <Text style={styles.dateText}>{formatDate(endDate)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date Pickers */}
          {Platform.OS !== 'web' && showStartPicker && DateTimePicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display="default"
              onChange={(_event: any, date?: Date) => {
                setShowStartPicker(Platform.OS === 'ios');
                if (date) {
                  setStartDate(date);
                  setPeriod('custom');
                  setPresetOption('custom');
                }
              }}
            />
          )}

          {Platform.OS !== 'web' && showEndPicker && DateTimePicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display="default"
              onChange={(_event: any, date?: Date) => {
                setShowEndPicker(Platform.OS === 'ios');
                if (date) {
                  setEndDate(date);
                  setPeriod('custom');
                  setPresetOption('custom');
                }
              }}
            />
          )}

          {/* Web Date Pickers */}
          {Platform.OS === 'web' && showStartPicker && (
            <View style={styles.webDatePicker}>
              <View style={styles.webDatePickerContent}>
                <ThemedText style={[styles.sectionTitle, { marginBottom: 12 }]}>Chọn ngày bắt đầu</ThemedText>
                
                <input
                  type="date"
                  value={startDate.toISOString().split('T')[0]}
                  onChange={(e: any) => {
                    const newDate = new Date(e.target.value);
                    if (!isNaN(newDate.getTime())) {
                      setStartDate(newDate);
                      setPeriod('custom');
                      setPresetOption('custom');
                    }
                  }}
                  style={{
                    fontSize: 15,
                    borderRadius: 14,
                    paddingLeft: 12,
                    paddingRight: 12,
                    paddingTop: 12,
                    paddingBottom: 12,
                    borderWidth: 1,
                    borderColor: '#E0E0E0',
                    marginBottom: 12,
                    width: '100%',
                  }}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setShowStartPicker(false)}
                    style={[styles.saveButton, { flex: 1, backgroundColor: '#ef4444' }]}
                  >
                    <Text style={styles.saveButtonText}>Xác nhận</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowStartPicker(false)}
                    style={[styles.cancelButton, { flex: 1 }]}
                  >
                    <Text style={styles.cancelButtonText}>Hủy</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {Platform.OS === 'web' && showEndPicker && (
            <View style={styles.webDatePicker}>
              <View style={styles.webDatePickerContent}>
                <ThemedText style={[styles.sectionTitle, { marginBottom: 12 }]}>Chọn ngày kết thúc</ThemedText>
                
                <input
                  type="date"
                  value={endDate.toISOString().split('T')[0]}
                  onChange={(e: any) => {
                    const newDate = new Date(e.target.value);
                    if (!isNaN(newDate.getTime())) {
                      setEndDate(newDate);
                      setPeriod('custom');
                      setPresetOption('custom');
                    }
                  }}
                  style={{
                    fontSize: 15,
                    borderRadius: 14,
                    paddingLeft: 12,
                    paddingRight: 12,
                    paddingTop: 12,
                    paddingBottom: 12,
                    borderWidth: 1,
                    borderColor: '#E0E0E0',
                    marginBottom: 12,
                    width: '100%',
                  }}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setShowEndPicker(false)}
                    style={[styles.saveButton, { flex: 1, backgroundColor: '#ef4444' }]}
                  >
                    <Text style={styles.saveButtonText}>Xác nhận</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowEndPicker(false)}
                    style={[styles.cancelButton, { flex: 1 }]}
                  >
                    <Text style={styles.cancelButtonText}>Hủy</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Summary */}
        {selectedCategoryId && amount && (
          <View style={styles.summarySection}>
            <ThemedText style={styles.summaryTitle}>📊 Tóm tắt</ThemedText>
            
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Hạng mục:</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {categories.find(c => c.id === selectedCategoryId)?.name || 'Đã chọn'}
              </ThemedText>
            </View>

            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Giới hạn:</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {Number(amount).toLocaleString()} VNĐ
              </ThemedText>
            </View>

            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Thời gian:</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} ngày
              </ThemedText>
            </View>

            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Trung bình/ngày:</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {Math.round(Number(amount) / Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))).toLocaleString()} VNĐ
              </ThemedText>
            </View>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            (saving || loadingCategories) && styles.saveButtonDisabled
          ]}
          onPress={handleSave}
          disabled={saving || loadingCategories}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={styles.saveButtonIcon}>💾</Text>
              <Text style={styles.saveButtonText}>
                {id ? 'Cập nhật ngân sách' : 'Tạo ngân sách'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingVertical: 8,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  centerLoading: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  centerEmpty: {
    padding: 30,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    color: '#CCC',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#CCC',
    marginTop: 4,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  categoryItemSelected: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  categoryIcon: {
    fontSize: 16,
    color: '#ef4444',
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#ef4444',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  currencyLabel: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F5F5F5',
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
  amountInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#333',
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  periodBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  periodBtnActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  periodBtnIcon: {
    fontSize: 20,
  },
  periodBtnText: {
    fontSize: 12,
    color: '#666',
  },
  periodBtnTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetBtnActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  presetBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  presetBtnTextActive: {
    color: '#FFF',
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dateBox: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dateIcon: {
    fontSize: 18,
  },
  dateText: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  dateArrow: {
    fontSize: 20,
    color: '#999',
    marginTop: 20,
  },
  summarySection: {
    backgroundColor: '#FFF9F9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE5E5',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonIcon: {
    fontSize: 20,
    color: '#FFF',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  cancelButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFF',
  },
  
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Web date picker styles
  webDatePicker: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  webDatePickerContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
});