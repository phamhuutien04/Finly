import React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { ThemedText } from './themed-text';

export default function NotificationTest() {
  const testNotification = async () => {
    if (Platform.OS === 'web') {
      alert('Test chỉ hoạt động trên mobile');
      return;
    }

    try {
      const Notifications = require('expo-notifications');
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🧪 Test Thông Báo',
          body: 'Đây là thông báo test từ ứng dụng!',
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Gửi ngay
      });
      
      console.log('✅ Đã gửi test notification');
    } catch (error) {
      console.error('❌ Lỗi test notification:', error);
    }
  };

  const testBudgetAlert = async () => {
    if (Platform.OS === 'web') {
      alert('Test chỉ hoạt động trên mobile');
      return;
    }

    try {
      const Notifications = require('expo-notifications');
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚨 Vượt quá ngân sách!',
          body: 'Cafe: Đã chi 120,000đ/100,000đ (120%)',
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Gửi ngay
      });
      
      console.log('✅ Đã gửi test budget alert');
    } catch (error) {
      console.error('❌ Lỗi test budget alert:', error);
    }
  };

  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Pressable
        onPress={testNotification}
        style={{
          backgroundColor: '#3b82f6',
          padding: 12,
          borderRadius: 8,
          alignItems: 'center',
        }}
      >
        <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>
          🧪 Test Thông Báo Thường
        </ThemedText>
      </Pressable>
      
      <Pressable
        onPress={testBudgetAlert}
        style={{
          backgroundColor: '#ef4444',
          padding: 12,
          borderRadius: 8,
          alignItems: 'center',
        }}
      >
        <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>
          🚨 Test Cảnh Báo Ngân Sách
        </ThemedText>
      </Pressable>
    </View>
  );
}