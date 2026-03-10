import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';
import { supabase } from './supabase';

// Global alert function để có thể gọi từ bất kỳ đâu
let globalShowAlert: ((title: string, message: string, isOverBudget: boolean) => void) | null = null;

export function setGlobalAlertFunction(showAlert: (title: string, message: string, isOverBudget: boolean) => void) {
  globalShowAlert = showAlert;
}

// Cấu hình thông báo
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface BudgetAlert {
  budgetId: string;
  categoryName: string;
  budgetAmount: number;
  spentAmount: number;
  percentage: number;
  period: string;
  startDate: string;
  endDate: string;
}

// Yêu cầu quyền thông báo
export async function requestNotificationPermissions() {
  if (Platform.OS === 'web') {
    return false; // Không cần thông báo trên web
  } else {
    // Mobile notification permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus === 'granted') {
      console.log('✅ Đã cấp quyền thông báo');
    } else {
      console.log('❌ Không có quyền thông báo');
    }
    
    return finalStatus === 'granted';
  }
}

// Kiểm tra ngân sách và gửi thông báo
export async function checkBudgetAndNotify(userId: string) {
  try {
    // Lấy tất cả ngân sách đang hoạt động
    const { data: budgets, error: budgetError } = await supabase
      .from('budgets')
      .select(`
        id,
        amount,
        period,
        start_date,
        end_date,
        category_id,
        category:categories (name)
      `)
      .eq('user_id', userId)
      .lte('start_date', new Date().toISOString().split('T')[0])
      .gte('end_date', new Date().toISOString().split('T')[0]);

    if (budgetError) throw budgetError;
    if (!budgets || budgets.length === 0) return [];

    const alerts: BudgetAlert[] = [];

    // Kiểm tra từng ngân sách
    for (const budget of budgets) {
      // Tính tổng chi tiêu trong khoảng thời gian ngân sách
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('category_id', budget.category_id  || 0) // Thêm fallback
        .eq('type', 'expense')
        .gte('transaction_date', budget.start_date)
        .lte('transaction_date', budget.end_date);

      if (txError) continue;

      const totalSpent = transactions?.reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;
      const percentage = (totalSpent / budget.amount) * 100;

      // Nếu vượt quá 80% hoặc 100% ngân sách
      if (percentage >= 80) {
        const categoryName = Array.isArray(budget.category) 
          ? (budget.category[0] as any)?.name || 'Không rõ'
          : (budget.category as any)?.name || 'Không rõ';

        const alert: BudgetAlert = {
          budgetId: budget.id,
          categoryName,
          budgetAmount: budget.amount,
          spentAmount: totalSpent,
          percentage: Math.round(percentage),
          period: budget.period,
          startDate: budget.start_date,
          endDate: budget.end_date,
        };

        alerts.push(alert);

        // Gửi thông báo
        await sendBudgetNotification(alert);
      }
    }

    return alerts;
  } catch (error) {
    console.error('Lỗi kiểm tra ngân sách:', error);
    return [];
  }
}

// Gửi thông báo ngân sách
async function sendBudgetNotification(alert: BudgetAlert) {
  const isOverBudget = alert.percentage >= 100;
  const title = isOverBudget ? '🚨 Vượt quá ngân sách!' : '⚠️ Cảnh báo ngân sách';
  
  let body: string;
  if (isOverBudget) {
    body = `${alert.categoryName}: Đã chi ${alert.spentAmount.toLocaleString()}đ/${alert.budgetAmount.toLocaleString()}đ (${alert.percentage}%)`;
  } else {
    body = `${alert.categoryName}: Đã chi ${alert.percentage}% ngân sách (${alert.spentAmount.toLocaleString()}đ/${alert.budgetAmount.toLocaleString()}đ)`;
  }

  console.log('📱 Gửi thông báo:', title, body);

  // Hiển thị cảnh báo đẹp nếu có global function
  if (globalShowAlert) {
    globalShowAlert(title, body, isOverBudget);
  } else {
    // Fallback về Alert cũ
    if (typeof Alert !== 'undefined') {
      Alert.alert(
        title, 
        body, 
        [
          { 
            text: 'Đã hiểu', 
            style: 'default',
            onPress: () => console.log('User đã xem cảnh báo ngân sách')
          }
        ],
        { 
          cancelable: true,
          userInterfaceStyle: 'light'
        }
      );
    }
  }

  // Chỉ gửi push notification trên mobile
  if (Platform.OS !== 'web') {
    try {
      console.log('📲 Đang gửi push notification...');
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          priority: isOverBudget ? Notifications.AndroidNotificationPriority.HIGH : Notifications.AndroidNotificationPriority.DEFAULT,
          categoryIdentifier: 'budget-alert',
          data: {
            budgetId: alert.budgetId,
            categoryName: alert.categoryName,
            percentage: alert.percentage,
          },
        },
        trigger: null, // Gửi ngay lập tức
      });
      
      console.log('✅ Đã gửi push notification thành công');
    } catch (error) {
      console.error('❌ Lỗi gửi push notification:', error);
    }
  }
}

// Kiểm tra ngân sách khi thêm giao dịch mới
export async function checkBudgetAfterTransaction(
  userId: string, 
  categoryId: number, 
  _amount: number, 
  transactionDate: string
) {
  try {
    // Tìm ngân sách liên quan đến category và thời gian
    const { data: budgets, error } = await supabase
      .from('budgets')
      .select(`
        id,
        amount,
        period,
        start_date,
        end_date,
        category_id,
        category:categories (name)
      `)
      .eq('user_id', userId)
      .eq('category_id', categoryId)
      .lte('start_date', transactionDate)
      .gte('end_date', transactionDate);

    if (error) {
      console.error('Lỗi truy vấn ngân sách:', error);
      return;
    }

    if (!budgets || budgets.length === 0) {
      console.log('Không có ngân sách nào cho category này');
      return;
    }

    for (const budget of budgets) {
      // Tính lại tổng chi tiêu trong khoảng thời gian ngân sách
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('category_id', categoryId)
        .eq('type', 'expense')
        .gte('transaction_date', budget.start_date)
        .lte('transaction_date', budget.end_date);

      if (txError) {
        console.error('Lỗi truy vấn giao dịch:', txError);
        continue;
      }

      const totalSpent = transactions?.reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;
      const percentage = (totalSpent / budget.amount) * 100;

      console.log(`Ngân sách ${budget.id}: ${totalSpent}/${budget.amount} (${percentage.toFixed(1)}%)`);

      // Nếu vượt quá ngưỡng cảnh báo (80% hoặc 100%)
      if (percentage >= 80) {
        const categoryName = Array.isArray(budget.category) 
          ? (budget.category[0] as any)?.name || 'Không rõ'
          : (budget.category as any)?.name || 'Không rõ';

        const alert: BudgetAlert = {
          budgetId: budget.id,
          categoryName,
          budgetAmount: budget.amount,
          spentAmount: totalSpent,
          percentage: Math.round(percentage),
          period: budget.period,
          startDate: budget.start_date,
          endDate: budget.end_date,
        };

        console.log('Gửi thông báo ngân sách:', alert);
        await sendBudgetNotification(alert);
      }
    }
  } catch (error) {
    console.error('Lỗi kiểm tra ngân sách sau giao dịch:', error);
  }
}

// Lên lịch kiểm tra ngân sách hàng ngày (bỏ function này vì không cần)
export async function scheduleDailyBudgetCheck() {
  // Không cần lên lịch hàng ngày, chỉ thông báo khi vượt ngân sách
  console.log('📅 Không cần lên lịch hàng ngày, chỉ thông báo khi vượt ngân sách');
}