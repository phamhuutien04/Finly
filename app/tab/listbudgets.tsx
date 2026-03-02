import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

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
  category?: { name: string | null } | null;
};

export default function BudgetListScreen() {
  const router = useRouter();
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

  useEffect(() => {
    fetchBudgets();
    fetchExpenseCategories();
  }, []);

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return Alert.alert('Lỗi', 'Vui lòng đăng nhập');

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
      Alert.alert('Lỗi', 'Không tải được danh sách: ' + err.message);
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
    setAmount(budget.amount.toString());
    setPeriod(budget.period as 'monthly' | 'weekly' | 'custom');
    setStartDate(budget.start_date ? new Date(budget.start_date) : new Date());
    setEndDate(budget.end_date ? new Date(budget.end_date) : new Date());
    setModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingBudget) return;
    if (!amount || Number(amount) <= 0) return Alert.alert('Lỗi', 'Số tiền phải lớn hơn 0');
    if (!selectedCategoryId) return Alert.alert('Lỗi', 'Vui lòng chọn hạng mục');
    if (startDate > endDate) return Alert.alert('Lỗi', 'Ngày bắt đầu phải trước ngày kết thúc');

    setSaving(true);

    const payload = {
      category_id: selectedCategoryId,
      amount: Number(amount),
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
      Alert.alert('Thành công', 'Đã cập nhật ngân sách');
    } catch (err: any) {
      Alert.alert('Lỗi', 'Không cập nhật được: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Hàm xóa với confirm dialog cho cả web và mobile
  const confirmDelete = (budgetId: string) => {
    if (Platform.OS === 'web') {
      // Dùng window.confirm cho web
      const confirmed = window.confirm('Bạn có chắc muốn xóa ngân sách này? Không thể khôi phục.');
      if (confirmed) {
        handleDelete(budgetId);
      }
    } else {
      // Dùng Alert.alert cho mobile
      Alert.alert(
        'Xác nhận xóa',
        'Bạn có chắc muốn xóa ngân sách này? Không thể khôi phục.',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Xóa',
            style: 'destructive',
            onPress: () => handleDelete(budgetId),
          },
        ]
      );
    }
  };

  // Hàm xóa thực tế
  const handleDelete = async (budgetId: string) => {
    try {
      // Refresh session trước khi xóa (rất quan trọng cho web)
      await supabase.auth.refreshSession();

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        Alert.alert('Lỗi', 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
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
          Alert.alert(
            'Lỗi quyền',
            'Không có quyền xóa. Vui lòng kiểm tra policy DELETE trong Supabase:\n' +
            'USING: auth.uid() = user_id'
          );
        } else {
          Alert.alert('Lỗi', error.message || 'Không xóa được');
        }
        return;
      }

      fetchBudgets();
      Alert.alert('Thành công', 'Đã xóa ngân sách');
    } catch (err: any) {
      console.error('[Lỗi xóa]', err);
      Alert.alert('Lỗi', err.message || 'Có lỗi xảy ra khi xóa');
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

    return (
      <ThemedView style={styles.card}>
        <View style={styles.cardContent}>
          <ThemedText style={styles.category}>
            {item.category?.name || 'Không có hạng mục'}
          </ThemedText>
          <ThemedText style={styles.amount}>
            Giới hạn: {new Intl.NumberFormat('vi-VN').format(item.amount)} ₫
          </ThemedText>
          <ThemedText style={styles.period}>
            Chu kỳ: {item.period === 'monthly' ? 'Theo Tháng' : item.period === 'weekly' ? 'Theo Tuần' : 'Tùy chỉnh'}
          </ThemedText>
          <ThemedText style={styles.date}>
            Thời gian: {start} → {end}
          </ThemedText>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.editButton} onPress={() => openEditModal(item)}>
            <Text style={styles.buttonText}>Sửa</Text>
          </Pressable>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => confirmDelete(item.id)}
          >
            <Text style={styles.buttonText}>Xóa</Text>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Danh sách Ngân sách</ThemedText>
      <ThemedText style={styles.subtitle}>Quản lý ngân sách chi tiêu</ThemedText>

      <Pressable
        style={styles.addNewButton}
        onPress={() => router.push('/budget/new')}
      >
        <Text style={styles.addNewText}>+ Tạo ngân sách mới</Text>
      </Pressable>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={{ marginTop: 12, color: '#666' }}>Đang tải...</Text>
        </View>
      ) : budgets.length === 0 ? (
        <View style={styles.center}>
          <ThemedText style={{ fontSize: 18, opacity: 0.7, textAlign: 'center' }}>
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
          <ThemedView style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Chỉnh sửa Ngân sách</ThemedText>

            <ScrollView style={{ maxHeight: 500 }}>
              <Text style={styles.modalLabel}>Hạng mục chi tiêu</Text>
              <View style={styles.modalGrid}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.modalItem,
                      selectedCategoryId === cat.id && styles.modalItemSelected,
                    ]}
                    onPress={() => setSelectedCategoryId(cat.id)}
                  >
                    <Text style={[
                      styles.modalItemText,
                      selectedCategoryId === cat.id && { color: '#fff' },
                    ]}>
                      {cat.name || 'Không tên'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Giới hạn (VND)</Text>
              <TextInput
                style={styles.modalInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="Ví dụ: 5000000"
              />

              <Text style={styles.modalLabel}>Chu kỳ</Text>
              <View style={styles.modalRow}>
                {(['monthly', 'weekly', 'custom'] as const).map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.modalBtn,
                      period === p && styles.modalBtnActive,
                    ]}
                    onPress={() => {
                      setPeriod(p);
                      updateDateRange();
                    }}
                  >
                    <Text style={period === p ? { color: '#fff' } : { color: '#333' }}>
                      {p === 'monthly' ? 'Tháng' : p === 'weekly' ? 'Tuần' : 'Tùy chỉnh'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Từ ngày</Text>
              <TouchableOpacity style={styles.modalDateBtn} onPress={() => setShowStartPicker(true)}>
                <Text>{startDate.toLocaleDateString('vi-VN')}</Text>
              </TouchableOpacity>

              {showStartPicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display="default"
                  onChange={(_, date) => {
                    setShowStartPicker(Platform.OS === 'ios');
                    if (date) setStartDate(date);
                  }}
                />
              )}

              <Text style={styles.modalLabel}>Đến ngày</Text>
              <TouchableOpacity style={styles.modalDateBtn} onPress={() => setShowEndPicker(true)}>
                <Text>{endDate.toLocaleDateString('vi-VN')}</Text>
              </TouchableOpacity>

              {showEndPicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display="default"
                  onChange={(_, date) => {
                    setShowEndPicker(Platform.OS === 'ios');
                    if (date) setEndDate(date);
                  }}
                />
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Hủy</Text>
              </Pressable>

              <Pressable
                style={styles.modalSave}
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
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  subtitle: { fontSize: 15, opacity: 0.7, marginBottom: 20 },
  addNewButton: {
    backgroundColor: '#3b82f6',
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
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardContent: { marginBottom: 12 },
  category: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  amount: { fontSize: 15, fontWeight: '600', color: '#ef4444', marginBottom: 4 },
  period: { fontSize: 14, color: '#555', marginBottom: 4 },
  date: { fontSize: 14, color: '#777' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  editButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  deleteButton: {
    backgroundColor: '#ef4444',
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
    backgroundColor: '#fff',
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
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  modalItemSelected: {
    backgroundColor: '#3b82f6',
  },
  modalItemText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  modalRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnActive: {
    backgroundColor: '#3b82f6',
  },
  modalDateBtn: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#fafafa',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#6b7280',
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSave: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});