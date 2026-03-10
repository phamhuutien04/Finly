import { BudgetAlert, checkBudgetAndNotify } from '@/lib/budgetNotification';
import { supabase } from '@/lib/supabase';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export default function BudgetAlerts() {
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadBudgetAlerts();
  }, []);

  const loadBudgetAlerts = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const budgetAlerts = await checkBudgetAndNotify(session.user.id);
      setAlerts(budgetAlerts);
    } catch (error) {
      console.error('Lỗi tải cảnh báo ngân sách:', error);
    } finally {
      setLoading(false);
    }
  };

  const dismissAlert = (budgetId: string) => {
    setDismissed(prev => new Set([...prev, budgetId]));
  };

  const visibleAlerts = alerts.filter(alert => !dismissed.has(alert.budgetId));

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#ef4444" />
      </View>
    );
  }

  if (visibleAlerts.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {visibleAlerts.map((alert) => (
          <ThemedView key={alert.budgetId} style={[
            styles.alertCard,
            alert.percentage >= 100 ? styles.dangerCard : styles.warningCard
          ]}>
            <View style={styles.alertHeader}>
              <Text style={styles.alertIcon}>
                {alert.percentage >= 100 ? '🚨' : '⚠️'}
              </Text>
              <Pressable
                onPress={() => dismissAlert(alert.budgetId)}
                style={styles.dismissButton}
              >
                <Text style={styles.dismissText}>✕</Text>
              </Pressable>
            </View>

            <ThemedText style={styles.alertTitle}>
              {alert.percentage >= 100 ? 'Vượt ngân sách!' : 'Cảnh báo ngân sách'}
            </ThemedText>

            <ThemedText style={styles.categoryName}>
              {alert.categoryName}
            </ThemedText>

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    { 
                      width: `${Math.min(alert.percentage, 100)}%`,
                      backgroundColor: alert.percentage >= 100 ? '#ef4444' : '#f59e0b'
                    }
                  ]} 
                />
              </View>
              <ThemedText style={styles.percentageText}>
                {alert.percentage}%
              </ThemedText>
            </View>

            <View style={styles.amountContainer}>
              <ThemedText style={styles.spentAmount}>
                Đã chi: {alert.spentAmount.toLocaleString()}đ
              </ThemedText>
              <ThemedText style={styles.budgetAmount}>
                Ngân sách: {alert.budgetAmount.toLocaleString()}đ
              </ThemedText>
            </View>

            <ThemedText style={styles.periodText}>
              {getPeriodText(alert.period)} • {formatDateRange(alert.startDate, alert.endDate)}
            </ThemedText>
          </ThemedView>
        ))}
      </ScrollView>
    </View>
  );
}

function getPeriodText(period: string): string {
  switch (period) {
    case 'daily': return 'Hàng ngày';
    case 'weekly': return 'Hàng tuần';
    case 'monthly': return 'Hàng tháng';
    case 'custom': return 'Tùy chỉnh';
    default: return period;
  }
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  const end = new Date(endDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  return `${start} - ${end}`;
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  alertCard: {
    width: 280,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  warningCard: {
    backgroundColor: '#fffbeb',
    borderColor: '#f59e0b',
  },
  dangerCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertIcon: {
    fontSize: 24,
  },
  dismissButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  dismissText: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 12,
    fontWeight: 'bold',
    minWidth: 35,
    textAlign: 'right',
  },
  amountContainer: {
    marginBottom: 8,
  },
  spentAmount: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  budgetAmount: {
    fontSize: 12,
    opacity: 0.7,
  },
  periodText: {
    fontSize: 11,
    opacity: 0.6,
  },
});