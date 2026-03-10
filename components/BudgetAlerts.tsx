import { BudgetAlert, checkBudgetAndNotify } from '@/lib/budgetNotification';
import { supabase } from '@/lib/supabase';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

// Get screen dimensions for responsive design
const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;
const isMediumScreen = screenWidth >= 375 && screenWidth < 414;

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
            {/* Background gradient */}
            <View style={alert.percentage >= 100 ? styles.dangerGradient : styles.warningGradient} />
            
            {/* Decorative circle */}
            <View style={styles.decorativeCircle} />

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
    marginVertical: isSmallScreen ? 8 : isMediumScreen ? 10 : 12,
  },
  loadingContainer: {
    padding: isSmallScreen ? 16 : isMediumScreen ? 18 : 20,
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: isSmallScreen ? 16 : isMediumScreen ? 18 : 20,
    gap: isSmallScreen ? 12 : isMediumScreen ? 14 : 16,
  },
  alertCard: {
    width: isSmallScreen ? 260 : isMediumScreen ? 280 : 300,
    padding: isSmallScreen ? 20 : isMediumScreen ? 22 : 24,
    borderRadius: isSmallScreen ? 20 : isMediumScreen ? 22 : 24,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  warningCard: {
    backgroundColor: '#ffffff',
  },
  dangerCard: {
    backgroundColor: '#ffffff',
  },
  // Gradient backgrounds
  warningGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fef3c7',
    opacity: 0.2,
  },
  dangerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fee2e2',
    opacity: 0.2,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isSmallScreen ? 10 : isMediumScreen ? 11 : 12,
    position: 'relative',
    zIndex: 10,
  },
  alertIcon: {
    fontSize: isSmallScreen ? 28 : isMediumScreen ? 30 : 32,
  },
  dismissButton: {
    padding: isSmallScreen ? 6 : isMediumScreen ? 7 : 8,
    borderRadius: isSmallScreen ? 14 : isMediumScreen ? 15 : 16,
    backgroundColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dismissText: {
    fontSize: isSmallScreen ? 12 : isMediumScreen ? 13 : 14,
    color: '#6b7280',
    fontWeight: '800',
  },
  alertTitle: {
    fontSize: isSmallScreen ? 18 : isMediumScreen ? 19 : 20,
    fontWeight: '900',
    marginBottom: isSmallScreen ? 5 : isMediumScreen ? 5 : 6,
    letterSpacing: -0.5,
    position: 'relative',
    zIndex: 10,
  },
  categoryName: {
    fontSize: isSmallScreen ? 14 : isMediumScreen ? 15 : 16,
    fontWeight: '700',
    marginBottom: isSmallScreen ? 14 : isMediumScreen ? 15 : 16,
    opacity: 0.8,
    position: 'relative',
    zIndex: 10,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isSmallScreen ? 8 : isMediumScreen ? 10 : 12,
    marginBottom: isSmallScreen ? 14 : isMediumScreen ? 15 : 16,
    position: 'relative',
    zIndex: 10,
  },
  progressBar: {
    flex: 1,
    height: isSmallScreen ? 8 : isMediumScreen ? 9 : 10,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  percentageText: {
    fontSize: isSmallScreen ? 12 : isMediumScreen ? 13 : 14,
    fontWeight: '900',
    minWidth: isSmallScreen ? 35 : isMediumScreen ? 38 : 40,
    textAlign: 'right',
    letterSpacing: -0.3,
  },
  amountContainer: {
    marginBottom: isSmallScreen ? 10 : isMediumScreen ? 11 : 12,
    position: 'relative',
    zIndex: 10,
  },
  spentAmount: {
    fontSize: isSmallScreen ? 13 : isMediumScreen ? 14 : 15,
    fontWeight: '800',
    marginBottom: isSmallScreen ? 3 : isMediumScreen ? 3 : 4,
    letterSpacing: -0.2,
  },
  budgetAmount: {
    fontSize: isSmallScreen ? 12 : isMediumScreen ? 12 : 13,
    opacity: 0.7,
    fontWeight: '600',
  },
  periodText: {
    fontSize: isSmallScreen ? 11 : isMediumScreen ? 11 : 12,
    opacity: 0.6,
    fontWeight: '600',
    position: 'relative',
    zIndex: 10,
  },
  // Decorative elements
  decorativeCircle: {
    position: 'absolute',
    top: isSmallScreen ? -15 : isMediumScreen ? -18 : -20,
    right: isSmallScreen ? -15 : isMediumScreen ? -18 : -20,
    width: isSmallScreen ? 50 : isMediumScreen ? 55 : 60,
    height: isSmallScreen ? 50 : isMediumScreen ? 55 : 60,
    borderRadius: isSmallScreen ? 25 : isMediumScreen ? 27.5 : 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 1,
  },
});