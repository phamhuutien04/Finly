import CustomAlert from '@/components/CustomAlert';
import { supabase } from '@/lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
// Chỉ import DateTimePicker khi không phải web
let DateTimePicker: any = null;
if (Platform.OS !== "web") {
  DateTimePicker = require("@react-native-community/datetimepicker").default;
}

import { ThemedText } from '@/components/themed-text';
import { useAppColorScheme } from '@/contexts/ThemeContext';

type Category = {
  id: number;
  name: string | null;
};

type Budget = {
  id: string;
  category_id: number | null;
  amount: number;
  period: string;
  start_date: string | null;
  end_date: string | null;
  category?: { name: string | null } | { name: string | null }[] | null;
};

export default function BudgetListScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  
  const colorScheme = useAppColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Theme colors
  const screenBg = isDark ? '#111827' : '#ffffff';
  const cardBg = isDark ? '#1f2937' : '#f8f9fa';
  const text = isDark ? '#f9fafb' : '#1f2937';
  const subtleText = isDark ? '#9ca3af' : '#777777';
  const borderColor = isDark ? '#374151' : '#eeeeee';
  const inputBg = isDark ? '#1f2937' : '#fafafa';
  const modalBg = isDark ? '#1f2937' : '#ffffff';
  const accentColor = '#3b82f6';
  const dangerColor = '#ef4444';
  
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Form state trong modal
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<'monthly' | 'weekly' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [saving, setSaving] = useState(false);

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

  // Custom Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'info'>('info');
  
  // Confirm delete state
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<string | null>(null);

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
      title: 'Ngân sách',
      headerTitle: 'Ngân sách',
    });
  }, [navigation]);

  useEffect(() => {
    fetchBudgets();
    fetchExpenseCategories();
  }, []);

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return showAlert('Lỗi', 'Vui lòng đăng nhập', 'error');

      const { data, error } = await supabase
        .from('budgets')
        .select(`
          id,
          category_id,
          amount,
          period,
          start_date,
          end_date,
          category:categories (name)
        `)
        .eq('user_id', user.id)
        .order('end_date', { ascending: false });

      if (error) throw error;
      setBudgets(data || []);
    } catch (err: any) {
      showAlert('Lỗi', 'Không tải được danh sách: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenseCategories = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;

      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('type', 'expense')
        .or(`user_id.eq.${uid},user_id.is.null`)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (err: any) {
      console.error('Lỗi tải danh mục chi tiêu:', err);
    }
  };

  const openEditModal = (budget: Budget) => {
    setEditingBudget(budget);
    setSelectedCategoryId(budget.category_id);
    // Format the amount with thousand separators
    setAmount(formatNumber(budget.amount.toString()));
    setPeriod(budget.period as 'monthly' | 'weekly' | 'custom');
    setStartDate(budget.start_date ? new Date(budget.start_date) : new Date());
    setEndDate(budget.end_date ? new Date(budget.end_date) : new Date());
    setModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingBudget) return;
    
    // Parse formatted amount (remove dots)
    const parsedAmount = Number(amount.replace(/\./g, ''));
    
    if (!amount || parsedAmount <= 0) return showAlert('Lỗi', 'Số tiền phải lớn hơn 0', 'error');
    if (!selectedCategoryId) return showAlert('Lỗi', 'Vui lòng chọn hạng mục', 'error');
    if (startDate > endDate) return showAlert('Lỗi', 'Ngày bắt đầu phải trước ngày kết thúc', 'error');

    setSaving(true);

    const payload = {
      category_id: selectedCategoryId,
      amount: parsedAmount,
      period,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    };

    try {
      const { error } = await supabase
        .from('budgets')
        .update(payload)
        .eq('id', editingBudget.id);

      if (error) throw error;

      setModalVisible(false);
      fetchBudgets();
      // Không cần hiện thông báo, chỉ đóng modal
    } catch (err: any) {
      showAlert('Lỗi', 'Không cập nhật được: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Hàm xóa với confirm dialog
  const confirmDelete = (budgetId: string) => {
    setBudgetToDelete(budgetId);
    setConfirmDeleteVisible(true);
  };

  // Xác nhận xóa
  const handleConfirmDelete = () => {
    setConfirmDeleteVisible(false);
    if (budgetToDelete) {
      handleDelete(budgetToDelete);
      setBudgetToDelete(null);
    }
  };

  // Hủy xóa
  const handleCancelDelete = () => {
    setConfirmDeleteVisible(false);
    setBudgetToDelete(null);
  };

  // Hàm xóa thực tế
  const handleDelete = async (budgetId: string) => {
    try {
      // Refresh session trước khi xóa (rất quan trọng cho web)
      await supabase.auth.refreshSession();

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        showAlert('Lỗi', 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.', 'error');
        return;
      }

      console.log('[DEBUG] Xóa ngân sách ID:', budgetId, 'User:', session.user.id);

      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', budgetId);

      if (error) {
        console.error('[Xóa thất bại]', error);
        if (error.code === '42501' || error.message.includes('permission denied')) {
          showAlert(
            'Lỗi quyền',
            'Không có quyền xóa. Vui lòng kiểm tra policy DELETE trong Supabase:\nUSING: auth.uid() = user_id',
            'error'
          );
        } else {
          showAlert('Lỗi', error.message || 'Không xóa được', 'error');
        }
        return;
      }

      fetchBudgets();
      // Không cần hiện thông báo, chỉ reload danh sách
    } catch (err: any) {
      console.error('[Lỗi xóa]', err);
      showAlert('Lỗi', err.message || 'Có lỗi xảy ra khi xóa', 'error');
    }
  };

  const updateDateRange = () => {
    const now = new Date();
    let newStart = new Date(now);
    let newEnd = new Date(now);

    if (period === 'monthly') {
      newStart = new Date(now.getFullYear(), now.getMonth(), 1);
      newEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (period === 'weekly') {
      const day = now.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      newStart.setDate(now.getDate() + diff);
      newEnd = new Date(newStart);
      newEnd.setDate(newStart.getDate() + 6);
    } else {
      newEnd.setDate(now.getDate() + 30);
    }

    setStartDate(newStart);
    setEndDate(newEnd);
  };

  const renderBudgetItem = ({ item }: { item: Budget }) => {
    const start = item.start_date ? new Date(item.start_date).toLocaleDateString('vi-VN') : 'N/A';
    const end = item.end_date ? new Date(item.end_date).toLocaleDateString('vi-VN') : 'N/A';
    
    // Xử lý category có thể là object hoặc array
    const categoryName = Array.isArray(item.category) 
      ? item.category[0]?.name || 'Không có hạng mục'
      : item.category?.name || 'Không có hạng mục';

    return (
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderColor }]}>
        <View style={styles.cardContent}>
          <ThemedText style={[styles.category, { color: text }]}>
            {categoryName}
          </ThemedText>
          <ThemedText style={[styles.amount, { color: dangerColor }]}>
            Giới hạn: {new Intl.NumberFormat('vi-VN').format(item.amount)} ₫
          </ThemedText>
          <ThemedText style={[styles.period, { color: subtleText }]}>
            Chu kỳ: {item.period === 'monthly' ? 'Theo Tháng' : item.period === 'weekly' ? 'Theo Tuần' : 'Tùy chỉnh'}
          </ThemedText>
          <ThemedText style={[styles.date, { color: subtleText }]}>
            Thời gian: {start} → {end}
          </ThemedText>
        </View>

        <View style={styles.actions}>
          <Pressable style={[styles.editButton, { backgroundColor: accentColor }]} onPress={() => openEditModal(item)}>
            <Text style={styles.buttonText}>Sửa</Text>
          </Pressable>
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: dangerColor }]}
            onPress={() => confirmDelete(item.id)}
          >
            <Text style={styles.buttonText}>Xóa</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: screenBg }]}>
      <ThemedText type="title" style={{ color: text }}>Danh sách Ngân sách</ThemedText>
      <ThemedText style={[styles.subtitle, { color: subtleText }]}>Quản lý ngân sách chi tiêu</ThemedText>

      <Pressable
        style={[styles.addNewButton, { backgroundColor: accentColor }]}
        onPress={() => router.push('/tab/explore')}
      >
        <Text style={styles.addNewText}>+ Tạo ngân sách mới</Text>
      </Pressable>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={{ marginTop: 12, color: subtleText }}>Đang tải...</Text>
        </View>
      ) : budgets.length === 0 ? (
        <View style={styles.center}>
          <ThemedText style={{ fontSize: 18, opacity: 0.7, textAlign: 'center', color: text }}>
            Chưa có ngân sách nào
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={budgets}
          keyExtractor={(item) => item.id}
          renderItem={renderBudgetItem}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        />
      )}

      {/* MODAL CHỈNH SỬA */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
            <ThemedText style={[styles.modalTitle, { color: text }]}>Chỉnh sửa Ngân sách</ThemedText>

            <ScrollView style={{ maxHeight: 500 }}>
              <Text style={[styles.modalLabel, { color: text }]}>Hạng mục chi tiêu</Text>
              <View style={styles.modalGrid}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.modalItem,
                      { backgroundColor: inputBg, borderColor: borderColor },
                      selectedCategoryId === cat.id && { backgroundColor: accentColor },
                    ]}
                    onPress={() => setSelectedCategoryId(cat.id)}
                  >
                    <Text style={[
                      styles.modalItemText,
                      { color: text },
                      selectedCategoryId === cat.id && { color: '#fff' },
                    ]}>
                      {cat.name || 'Không tên'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.modalLabel, { color: text }]}>Giới hạn (VND)</Text>
              <TextInput
                style={[styles.modalInput, { borderColor: borderColor, backgroundColor: inputBg, color: text }]}
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="numeric"
                placeholder="Ví dụ: 5.000.000"
                placeholderTextColor={subtleText}
              />

              <Text style={[styles.modalLabel, { color: text }]}>Chu kỳ</Text>
              <View style={styles.modalRow}>
                {(['monthly', 'weekly', 'custom'] as const).map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.modalBtn,
                      { backgroundColor: inputBg },
                      period === p && { backgroundColor: accentColor },
                    ]}
                    onPress={() => {
                      setPeriod(p);
                      updateDateRange();
                    }}
                  >
                    <Text style={period === p ? { color: '#fff' } : { color: text }}>
                      {p === 'monthly' ? 'Tháng' : p === 'weekly' ? 'Tuần' : 'Tùy chỉnh'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.modalLabel, { color: text }]}>Từ ngày</Text>
              <TouchableOpacity style={[styles.modalDateBtn, { borderColor: borderColor, backgroundColor: inputBg }]} onPress={() => setShowStartPicker(true)}>
                <Text style={{ color: text }}>{startDate.toLocaleDateString('vi-VN')}</Text>
              </TouchableOpacity>

              <Text style={[styles.modalLabel, { color: text }]}>Đến ngày</Text>
              <TouchableOpacity style={[styles.modalDateBtn, { borderColor: borderColor, backgroundColor: inputBg }]} onPress={() => setShowEndPicker(true)}>
                <Text style={{ color: text }}>{endDate.toLocaleDateString('vi-VN')}</Text>
              </TouchableOpacity>

          {/* Date Pickers - chỉ hiển thị trên mobile */}
          {Platform.OS !== 'web' && showStartPicker && DateTimePicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display="default"
              onChange={(_event: any, date?: Date) => {
                setShowStartPicker(Platform.OS === 'ios');
                if (date) setStartDate(date);
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
                if (date) setEndDate(date);
              }}
            />
          )}

          {/* Web Date Pickers */}
          {Platform.OS === 'web' && showStartPicker && (
            <View style={styles.webDatePicker}>
              <View style={[styles.webDatePickerContent, { backgroundColor: modalBg }]}>
                <Text style={[styles.modalLabel, { color: text }]}>Chọn ngày bắt đầu</Text>
                <input
                  type="date"
                  value={startDate.toISOString().split('T')[0]}
                  onChange={(e: any) => {
                    const newDate = new Date(e.target.value);
                    if (!isNaN(newDate.getTime())) {
                      setStartDate(newDate);
                    }
                  }}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: `1px solid ${borderColor}`,
                    fontSize: 16,
                    width: '100%',
                    marginBottom: 12,
                    backgroundColor: inputBg,
                    color: text,
                  }}
                />
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: accentColor }]}
                  onPress={() => setShowStartPicker(false)}
                >
                  <Text style={{ color: '#fff' }}>Xong</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {Platform.OS === 'web' && showEndPicker && (
            <View style={styles.webDatePicker}>
              <View style={[styles.webDatePickerContent, { backgroundColor: modalBg }]}>
                <Text style={[styles.modalLabel, { color: text }]}>Chọn ngày kết thúc</Text>
                <input
                  type="date"
                  value={endDate.toISOString().split('T')[0]}
                  onChange={(e: any) => {
                    const newDate = new Date(e.target.value);
                    if (!isNaN(newDate.getTime())) {
                      setEndDate(newDate);
                    }
                  }}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: `1px solid ${borderColor}`,
                    fontSize: 16,
                    width: '100%',
                    marginBottom: 12,
                    backgroundColor: inputBg,
                    color: text,
                  }}
                />
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: accentColor }]}
                  onPress={() => setShowEndPicker(false)}
                >
                  <Text style={{ color: '#fff' }}>Xong</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalCancel, { backgroundColor: isDark ? '#374151' : '#6b7280' }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Hủy</Text>
              </Pressable>

              <Pressable
                style={[styles.modalSave, { backgroundColor: accentColor }]}
                onPress={handleSaveEdit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalBtnText}>Lưu</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
        onClose={() => setAlertVisible(false)}
      />

      {/* Confirm Delete Dialog */}
      <Modal
        visible={confirmDeleteVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelDelete}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmBox, { backgroundColor: modalBg }]}>
            <Text style={[styles.confirmTitle, { color: text }]}>Xác nhận xóa</Text>
            <Text style={[styles.confirmMessage, { color: subtleText }]}>
              Bạn có chắc muốn xóa ngân sách này? Không thể khôi phục.
            </Text>
            
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmCancelBtn, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]}
                onPress={handleCancelDelete}
              >
                <Text style={[styles.confirmCancelText, { color: isDark ? '#f9fafb' : '#374151' }]}>Hủy</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.confirmDeleteBtn, { backgroundColor: dangerColor }]}
                onPress={handleConfirmDelete}
              >
                <Text style={styles.confirmDeleteText}>Xóa</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  subtitle: { fontSize: 15, opacity: 0.7, marginBottom: 20 },
  addNewButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  addNewText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardContent: { marginBottom: 12 },
  category: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  amount: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  period: { fontSize: 14, marginBottom: 4 },
  date: { fontSize: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  deleteButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 16,
    padding: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  modalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  modalItem: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalItemSelected: {
  },
  modalItemText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  modalRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnActive: {
  },
  modalDateBtn: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSave: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#fff',
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
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  
  // Confirm delete dialog styles
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmBox: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  confirmMessage: {
    fontSize: 15,
    marginBottom: 24,
    lineHeight: 22,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmDeleteText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});