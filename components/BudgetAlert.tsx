import React from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    Pressable,
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
            {/* Background gradient */}
            <View style={isOverBudget ? styles.dangerGradient : styles.warningGradient} />
            
            {/* Decorative circles */}
            <View style={styles.decorativeCircle1} />
            <View style={styles.decorativeCircle2} />

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
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
              ]}
            >
              <View style={styles.buttonGradient} />
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: isSmallScreen ? 16 : isMediumScreen ? 20 : 24,
  },
  alertContainer: {
    width: '100%',
    maxWidth: isSmallScreen ? 320 : isMediumScreen ? 340 : 360,
  },
  alertCard: {
    borderRadius: isSmallScreen ? 24 : isMediumScreen ? 28 : 32,
    padding: isSmallScreen ? 24 : isMediumScreen ? 28 : 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
    borderWidth: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  warningCard: {
    backgroundColor: '#ffffff',
    borderColor: 'transparent',
  },
  dangerCard: {
    backgroundColor: '#ffffff',
    borderColor: 'transparent',
  },
  // Gradient backgrounds
  warningGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fef3c7',
    opacity: 0.3,
  },
  dangerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fee2e2',
    opacity: 0.3,
  },
  iconContainer: {
    width: isSmallScreen ? 80 : isMediumScreen ? 88 : 96,
    height: isSmallScreen ? 80 : isMediumScreen ? 88 : 96,
    borderRadius: isSmallScreen ? 40 : isMediumScreen ? 44 : 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isSmallScreen ? 20 : isMediumScreen ? 22 : 24,
    borderWidth: 4,
    position: 'relative',
    zIndex: 10,
  },
  warningIcon: {
    backgroundColor: '#ffffff',
    borderColor: '#f59e0b',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  dangerIcon: {
    backgroundColor: '#ffffff',
    borderColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  iconText: {
    fontSize: isSmallScreen ? 40 : isMediumScreen ? 44 : 48,
  },
  title: {
    fontSize: isSmallScreen ? 22 : isMediumScreen ? 24 : 26,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: isSmallScreen ? 12 : isMediumScreen ? 14 : 16,
    letterSpacing: -0.8,
    position: 'relative',
    zIndex: 10,
  },
  warningText: {
    color: '#d97706',
  },
  dangerText: {
    color: '#dc2626',
  },
  message: {
    fontSize: isSmallScreen ? 15 : isMediumScreen ? 16 : 17,
    textAlign: 'center',
    lineHeight: isSmallScreen ? 22 : isMediumScreen ? 24 : 26,
    marginBottom: isSmallScreen ? 24 : isMediumScreen ? 26 : 28,
    opacity: 0.85,
    fontWeight: '500',
    color: '#374151',
    position: 'relative',
    zIndex: 10,
  },
  progressContainer: {
    width: '100%',
    marginBottom: isSmallScreen ? 28 : isMediumScreen ? 30 : 32,
    position: 'relative',
    zIndex: 10,
  },
  progressBar: {
    height: isSmallScreen ? 10 : isMediumScreen ? 11 : 12,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  button: {
    width: '100%',
    paddingVertical: isSmallScreen ? 16 : isMediumScreen ? 18 : 20,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    position: 'relative',
    zIndex: 10,
    overflow: 'hidden',
  },
  warningButton: {
    backgroundColor: '#f59e0b',
  },
  dangerButton: {
    backgroundColor: '#ef4444',
  },
  buttonGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  buttonText: {
    color: '#fff',
    fontSize: isSmallScreen ? 16 : isMediumScreen ? 17 : 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    position: 'relative',
    zIndex: 10,
  },
  // Decorative elements
  decorativeCircle1: {
    position: 'absolute',
    top: isSmallScreen ? -30 : isMediumScreen ? -35 : -40,
    right: isSmallScreen ? -30 : isMediumScreen ? -35 : -40,
    width: isSmallScreen ? 100 : isMediumScreen ? 110 : 120,
    height: isSmallScreen ? 100 : isMediumScreen ? 110 : 120,
    borderRadius: isSmallScreen ? 50 : isMediumScreen ? 55 : 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 1,
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: isSmallScreen ? -20 : isMediumScreen ? -25 : -30,
    left: isSmallScreen ? -20 : isMediumScreen ? -25 : -30,
    width: isSmallScreen ? 60 : isMediumScreen ? 70 : 80,
    height: isSmallScreen ? 60 : isMediumScreen ? 70 : 80,
    borderRadius: isSmallScreen ? 30 : isMediumScreen ? 35 : 40,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 1,
  },
});