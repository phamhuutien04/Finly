import CustomAlert from '@/components/CustomAlert';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  const navigation = useNavigation();
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

  // Custom Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'info'>('info');

  // Preset dates
  const [presetOption, setPresetOption] = useState<'this_week' | 'next_week' | 'this_month' | 'next_month' | 'custom'>('this_month');

  // Helper function to show custom alert
  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setAlertVisible(true);
  };

  // Set title cho header
  useEffect(() => {
    navigation.setOptions({
      title: id ? 'Chỉnh sửa ngân sách' : 'Đặt ngân sách mới',
      headerTitle: id ? 'Chỉnh sửa ngân sách' : 'Đặt ngân sách mới',
    });
  }, [navigation, id]);

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
        showAlert('Lỗi', 'Vui lòng đăng nhập', 'error');
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
      showAlert('Lỗi', err.message, 'error');
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
      if (!data) return showAlert('Lỗi', 'Không tìm thấy ngân sách', 'error');

      setSelectedCategoryId(data.category_id);
      setAmount(data.amount.toString());
      setPeriod(data.period as PeriodType);
      setStartDate(new Date(data.start_date));
      setEndDate(new Date(data.end_date));
    } catch (err: any) {
      showAlert('Lỗi', err.message, 'error');
    }
  };

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) {
      return showAlert('Lỗi', 'Số tiền phải lớn hơn 0', 'error');
    }
    if (!selectedCategoryId) {
      return showAlert('Lỗi', 'Vui lòng chọn hạng mục', 'error');
    }
    if (startDate > endDate) {
      return showAlert('Lỗi', 'Ngày bắt đầu phải trước ngày kết thúc', 'error');
    }

    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setSaving(false);
      return showAlert('Lỗi', 'Vui lòng đăng nhập', 'error');
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
      showAlert('Lỗi', result.error.message, 'error');
    } else {
      showAlert('Thành công', id ? 'Đã cập nhật ngân sách' : 'Đã tạo ngân sách', 'success');
      setTimeout(() => {
        router.back();
      }, 1500);
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}>
        {/* Categories */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Chọn hạng mục chi tiêu</ThemedText>
          
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
          <ThemedText style={styles.sectionTitle}>Giới hạn chi tiêu</ThemedText>
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
          <ThemedText style={styles.sectionTitle}>Chu kỳ</ThemedText>
          
          <View style={styles.periodRow}>
            <TouchableOpacity
              style={[
                styles.periodBtn,
                period === 'daily' && styles.periodBtnActive,
              ]}
              onPress={() => handlePeriodChange('daily')}
            >
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
              <Text style={[styles.periodBtnText, period === 'custom' && styles.periodBtnTextActive]}>
                Tùy chỉnh
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Preset Options */}
        {period !== 'custom' && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Chọn khoảng thời gian</ThemedText>
            
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
                      {period === 'weekly' ? 'Tuần này' : 'Tháng này'}
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
                      {period === 'weekly' ? 'Tuần sau' : 'Tháng sau'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}

        {/* Date Range */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Khoảng thời gian</ThemedText>
          
          <View style={styles.dateRangeContainer}>
            <View style={styles.dateBox}>
              <Text style={styles.dateLabel}>Từ ngày</Text>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => setShowStartPicker(true)}
              >
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
            <ThemedText style={styles.summaryTitle}>Tóm tắt</ThemedText>
            
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
              <Text style={styles.saveButtonIcon}></Text>
              <Text style={styles.saveButtonText}>
                {id ? 'Cập nhật ngân sách' : 'Tạo ngân sách'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
        onClose={() => setAlertVisible(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1F2937',
  },
  centerLoading: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 14,
  },
  centerEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 8,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 6,
    textAlign: 'center',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: '#FEE2E2',
  },
  categoryItemSelected: {
    backgroundColor: '#EF4444',
    borderColor: '#DC2626',
  },
  categoryIcon: {
    fontSize: 18,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  currencyLabel: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#EF4444',
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  amountInput: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
  },
  periodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  periodBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  periodBtnActive: {
    backgroundColor: '#EF4444',
    borderColor: '#DC2626',
  },
  periodBtnText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '600',
  },
  periodBtnTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 10,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  presetBtnActive: {
    backgroundColor: '#EF4444',
    borderColor: '#DC2626',
  },
  presetBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  presetBtnTextActive: {
    color: '#FFF',
    fontWeight: '700',
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
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '600',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  dateText: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  dateArrow: {
    fontSize: 24,
    color: '#EF4444',
    marginTop: 24,
    fontWeight: 'bold',
  },
  summarySection: {
    backgroundColor: '#FEF2F2',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#FEE2E2',
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#EF4444',
    paddingVertical: 18,
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonIcon: {
    fontSize: 22,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  
  cancelButton: {
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFF',
  },

  cancelButtonText: {
    color: '#6B7280',
    fontSize: 17,
    fontWeight: '700',
  },
  webDatePicker: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  webDatePickerContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
});
