import React from 'react';
import {
    Animated,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface BudgetAlertProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  isOverBudget: boolean;
}

export default function BudgetAlert({ 
  visible, 
  onClose, 
  title, 
  message, 
  isOverBudget 
}: BudgetAlertProps) {
  const scaleValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      scaleValue.setValue(0);
    }
  }, [visible, scaleValue]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.alertContainer,
            { transform: [{ scale: scaleValue }] }
          ]}
        >
          <ThemedView style={[
            styles.alertCard,
            isOverBudget ? styles.dangerCard : styles.warningCard
          ]}>
            {/* Icon */}
            <View style={[
              styles.iconContainer,
              isOverBudget ? styles.dangerIcon : styles.warningIcon
            ]}>
              <Text style={styles.iconText}>
                {isOverBudget ? '🚨' : '⚠️'}
              </Text>
            </View>

            {/* Title */}
            <ThemedText style={[
              styles.title,
              isOverBudget ? styles.dangerText : styles.warningText
            ]}>
              {title}
            </ThemedText>

            {/* Message */}
            <ThemedText style={styles.message}>
              {message}
            </ThemedText>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    { 
                      width: '100%',
                      backgroundColor: isOverBudget ? '#ef4444' : '#f59e0b'
                    }
                  ]} 
                />
              </View>
            </View>

            {/* Button */}
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.button,
                isOverBudget ? styles.dangerButton : styles.warningButton,
                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
              ]}
            >
              <Text style={styles.buttonText}>
                {isOverBudget ? '😰 Đã hiểu' : '👍 OK'}
              </Text>
            </Pressable>
          </ThemedView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertContainer: {
    width: '100%',
    maxWidth: 340,
  },
  alertCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 2,
  },
  warningCard: {
    backgroundColor: '#fffbeb',
    borderColor: '#f59e0b',
  },
  dangerCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
  },
  warningIcon: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  dangerIcon: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  iconText: {
    fontSize: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  warningText: {
    color: '#d97706',
  },
  dangerText: {
    color: '#dc2626',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
    opacity: 0.8,
    fontWeight: '500',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 24,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  warningButton: {
    backgroundColor: '#f59e0b',
  },
  dangerButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});