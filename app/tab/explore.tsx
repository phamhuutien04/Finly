import CustomAlert from '@/components/CustomAlert';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Appearance,
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

// Simple hook to get color scheme that works on all platforms
function useColorScheme() {
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());
  
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });
    
    return () => subscription.remove();
  }, []);
  
  return colorScheme;
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
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Theme colors
  const screenBg = isDark ? '#111827' : '#F8F9FA';
  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const text = isDark ? '#f9fafb' : '#1F2937';
  const subtleText = isDark ? '#9ca3af' : '#6B7280';
  const borderColor = isDark ? '#374151' : '#E5E7EB';
  const inputBg = isDark ? '#1f2937' : '#F9FAFB';
  const accentColor = '#EF4444';
  const accentLight = isDark ? '#7f1d1d' : '#FEF2F2';
  const accentBorder = isDark ? '#991b1b' : '#FEE2E2';

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<PeriodType>('monthly');

  // Format number with thousand separators
  const formatNumber = (value: string) => {
    // Remove all non-digit characters
    const numbers = value.replace(/[^\d]/g, '');
    if (!numbers) return '';
    
    // Add thousand separators
    return parseInt(numbers, 10).toLocaleString('vi-VN');
  };

  const handleAmountChange = (text: string) => {
    const formatted = formatNumber(text);
    setAmount(formatted);
  };

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
      // Format amount with thousand separators
      setAmount(data.amount.toLocaleString('vi-VN'));
      setPeriod(data.period as PeriodType);
      setStartDate(new Date(data.start_date));
      setEndDate(new Date(data.end_date));
    } catch (err: any) {
      showAlert('Lỗi', err.message, 'error');
    }
  };

  const handleSave = async () => {
    // Parse amount by removing dots (thousand separators)
    const parsedAmount = amount.replace(/\./g, '');
    
    if (!parsedAmount || Number(parsedAmount) <= 0) {
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
      amount: Number(parsedAmount),
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
      // Không cần hiện thông báo, chỉ quay về trang trước
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
    <ThemedView style={[styles.container, { backgroundColor: screenBg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}>
        {/* Categories */}
        <View style={[styles.section, { backgroundColor: cardBg }]}>
          <ThemedText style={[styles.sectionTitle, { color: text }]}>Chọn hạng mục chi tiêu</ThemedText>
          
          {loadingCategories ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color={accentColor} />
              <ThemedText style={[styles.loadingText, { color: subtleText }]}>Đang tải...</ThemedText>
            </View>
          ) : categories.length === 0 ? (
            <View style={styles.centerEmpty}>
              <Text style={styles.emptyIcon}>📁</Text>
              <ThemedText style={[styles.emptyText, { color: subtleText }]}>Chưa có hạng mục nào</ThemedText>
              <ThemedText style={[styles.emptySubtext, { color: subtleText }]}>
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
                      { backgroundColor: accentLight, borderColor: accentBorder },
                      isSelected && { backgroundColor: accentColor, borderColor: '#DC2626' },
                    ]}
                    onPress={() => setSelectedCategoryId(cat.id)}
                  >
                    <Text style={[styles.categoryIcon, isSelected && { color: '#fff' }]}>
                    </Text>
                    <ThemedText
                      style={[
                        styles.categoryText,
                        { color: isDark ? '#f9fafb' : '#DC2626' },
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
        <View style={[styles.section, { backgroundColor: cardBg }]}>
          <ThemedText style={[styles.sectionTitle, { color: text }]}>Giới hạn chi tiêu</ThemedText>
          <View style={[styles.amountInputContainer, { borderColor: borderColor, backgroundColor: inputBg }]}>
            <Text style={[styles.currencyLabel, { backgroundColor: accentColor }]}>VNĐ</Text>
            <TextInput
              style={[styles.amountInput, { color: text }]}
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="numeric"
              placeholder="Nhập số tiền"
              placeholderTextColor={subtleText}
            />
          </View>
        </View>

        {/* Period Selection */}
        <View style={[styles.section, { backgroundColor: cardBg }]}>
          <ThemedText style={[styles.sectionTitle, { color: text }]}>Chu kỳ</ThemedText>
          
          <View style={styles.periodRow}>
            <TouchableOpacity
              style={[
                styles.periodBtn,
                { backgroundColor: inputBg, borderColor: borderColor },
                period === 'daily' && { backgroundColor: accentColor, borderColor: '#DC2626' },
              ]}
              onPress={() => handlePeriodChange('daily')}
            >
              <Text style={[styles.periodBtnText, { color: subtleText }, period === 'daily' && styles.periodBtnTextActive]}>
                Ngày
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.periodBtn,
                { backgroundColor: inputBg, borderColor: borderColor },
                period === 'weekly' && { backgroundColor: accentColor, borderColor: '#DC2626' },
              ]}
              onPress={() => handlePeriodChange('weekly')}
            >
              <Text style={[styles.periodBtnText, { color: subtleText }, period === 'weekly' && styles.periodBtnTextActive]}>
                Tuần
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.periodBtn,
                { backgroundColor: inputBg, borderColor: borderColor },
                period === 'monthly' && { backgroundColor: accentColor, borderColor: '#DC2626' },
              ]}
              onPress={() => handlePeriodChange('monthly')}
            >
              <Text style={[styles.periodBtnText, { color: subtleText }, period === 'monthly' && styles.periodBtnTextActive]}>
                Tháng
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.periodBtn,
                { backgroundColor: inputBg, borderColor: borderColor },
                period === 'custom' && { backgroundColor: accentColor, borderColor: '#DC2626' },
              ]}
              onPress={() => handlePeriodChange('custom')}
            >
              <Text style={[styles.periodBtnText, { color: subtleText }, period === 'custom' && styles.periodBtnTextActive]}>
                Tùy chỉnh
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Preset Options */}
        {period !== 'custom' && (
          <View style={[styles.section, { backgroundColor: cardBg }]}>
            <ThemedText style={[styles.sectionTitle, { color: text }]}>Chọn khoảng thời gian</ThemedText>
            
            <View style={styles.presetRow}>
              {(period === 'weekly' || period === 'monthly') && (
                <>
                  <TouchableOpacity
                    style={[
                      styles.presetBtn,
                      { backgroundColor: inputBg, borderColor: borderColor },
                      presetOption === `this_${period}` && { backgroundColor: accentColor, borderColor: '#DC2626' },
                    ]}
                    onPress={() => handlePresetChange(period === 'weekly' ? 'this_week' : 'this_month')}
                  >
                    <Text style={[
                      styles.presetBtnText,
                      { color: subtleText },
                      presetOption === `this_${period}` && styles.presetBtnTextActive
                    ]}>
                      {period === 'weekly' ? 'Tuần này' : 'Tháng này'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.presetBtn,
                      { backgroundColor: inputBg, borderColor: borderColor },
                      presetOption === `next_${period}` && { backgroundColor: accentColor, borderColor: '#DC2626' },
                    ]}
                    onPress={() => handlePresetChange(period === 'weekly' ? 'next_week' : 'next_month')}
                  >
                    <Text style={[
                      styles.presetBtnText,
                      { color: subtleText },
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
        <View style={[styles.section, { backgroundColor: cardBg }]}>
          <ThemedText style={[styles.sectionTitle, { color: text }]}>Khoảng thời gian</ThemedText>
          
          <View style={styles.dateRangeContainer}>
            <View style={styles.dateBox}>
              <Text style={[styles.dateLabel, { color: subtleText }]}>Từ ngày</Text>
              <TouchableOpacity 
                style={[styles.dateButton, { backgroundColor: inputBg, borderColor: borderColor }]}
                onPress={() => setShowStartPicker(true)}
              >
                <Text style={[styles.dateText, { color: text }]}>{formatDate(startDate)}</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.dateArrow, { color: accentColor }]}>→</Text>

            <View style={styles.dateBox}>
              <Text style={[styles.dateLabel, { color: subtleText }]}>Đến ngày</Text>
              <TouchableOpacity 
                style={[styles.dateButton, { backgroundColor: inputBg, borderColor: borderColor }]}
                onPress={() => setShowEndPicker(true)}
              >
                <Text style={[styles.dateText, { color: text }]}>{formatDate(endDate)}</Text>
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
              <View style={[styles.webDatePickerContent, { backgroundColor: cardBg }]}>
                <ThemedText style={[styles.sectionTitle, { marginBottom: 12, color: text }]}>Chọn ngày bắt đầu</ThemedText>
                
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
                    borderColor: borderColor,
                    marginBottom: 12,
                    width: '100%',
                    backgroundColor: inputBg,
                    color: text,
                  }}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setShowStartPicker(false)}
                    style={[styles.saveButton, { flex: 1, backgroundColor: accentColor }]}
                  >
                    <Text style={styles.saveButtonText}>Xác nhận</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowStartPicker(false)}
                    style={[styles.cancelButton, { flex: 1, borderColor: borderColor, backgroundColor: cardBg }]}
                  >
                    <Text style={[styles.cancelButtonText, { color: subtleText }]}>Hủy</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {Platform.OS === 'web' && showEndPicker && (
            <View style={styles.webDatePicker}>
              <View style={[styles.webDatePickerContent, { backgroundColor: cardBg }]}>
                <ThemedText style={[styles.sectionTitle, { marginBottom: 12, color: text }]}>Chọn ngày kết thúc</ThemedText>
                
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
                    borderColor: borderColor,
                    marginBottom: 12,
                    width: '100%',
                    backgroundColor: inputBg,
                    color: text,
                  }}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setShowEndPicker(false)}
                    style={[styles.saveButton, { flex: 1, backgroundColor: accentColor }]}
                  >
                    <Text style={styles.saveButtonText}>Xác nhận</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowEndPicker(false)}
                    style={[styles.cancelButton, { flex: 1, borderColor: borderColor, backgroundColor: cardBg }]}
                  >
                    <Text style={[styles.cancelButtonText, { color: subtleText }]}>Hủy</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Summary */}
        {selectedCategoryId && amount && (
          <View style={[styles.summarySection, { backgroundColor: accentLight, borderColor: accentBorder }]}>
            <ThemedText style={[styles.summaryTitle, { color: isDark ? '#f9fafb' : '#DC2626' }]}>Tóm tắt</ThemedText>
            
            <View style={[styles.summaryRow, { borderBottomColor: accentBorder }]}>
              <ThemedText style={[styles.summaryLabel, { color: subtleText }]}>Hạng mục:</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: text }]}>
                {categories.find(c => c.id === selectedCategoryId)?.name || 'Đã chọn'}
              </ThemedText>
            </View>

            <View style={[styles.summaryRow, { borderBottomColor: accentBorder }]}>
              <ThemedText style={[styles.summaryLabel, { color: subtleText }]}>Giới hạn:</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: text }]}>
                {amount} VNĐ
              </ThemedText>
            </View>

            <View style={[styles.summaryRow, { borderBottomColor: accentBorder }]}>
              <ThemedText style={[styles.summaryLabel, { color: subtleText }]}>Thời gian:</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: text }]}>
                {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} ngày
              </ThemedText>
            </View>

            <View style={[styles.summaryRow, { borderBottomColor: accentBorder }]}>
              <ThemedText style={[styles.summaryLabel, { color: subtleText }]}>Trung bình/ngày:</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: text }]}>
                {Math.round(Number(amount.replace(/\./g, '')) / Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))).toLocaleString('vi-VN')} VNĐ
              </ThemedText>
            </View>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: accentColor },
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
  },
  section: {
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
  },
  centerLoading: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
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
    marginTop: 8,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 13,
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
    borderWidth: 2,
  },
  categoryItemSelected: {
  },
  categoryIcon: {
    fontSize: 18,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  currencyLabel: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  amountInput: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
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
    borderRadius: 16,
    borderWidth: 2,
  },
  periodBtnActive: {
  },
  periodBtnText: {
    fontSize: 15,
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
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
  },
  presetBtnActive: {
  },
  presetBtnText: {
    fontSize: 14,
    fontWeight: '600',
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
    marginBottom: 8,
    fontWeight: '600',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateArrow: {
    fontSize: 24,
    marginTop: 24,
    fontWeight: 'bold',
  },
  summarySection: {
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 20,
    borderWidth: 2,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
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
  },

  cancelButtonText: {
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
