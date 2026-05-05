import { useAppColorScheme } from '@/contexts/ThemeContext';
import React from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

type AlertButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

type CustomAlertProps = {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  type?: 'success' | 'error' | 'info' | 'warning';
  buttons?: AlertButton[];
};

export default function CustomAlert({
  visible,
  title,
  message,
  onClose,
  type = 'info',
  buttons,
}: CustomAlertProps) {
  const scheme = useAppColorScheme();
  const isDark = scheme === 'dark';
  
  // Theme colors
  const alertBg = isDark ? '#1f2937' : '#ffffff';
  const titleColor = isDark ? '#f9fafb' : '#1f2937';
  const messageColor = isDark ? '#9ca3af' : '#64748b';
  const cancelBg = isDark ? '#374151' : '#f3f4f6';
  const cancelTextColor = isDark ? '#d1d5db' : '#6b7280';
  
  // Default button if no buttons provided
  const defaultButtons: AlertButton[] = buttons || [
    { text: 'OK', style: 'default', onPress: onClose }
  ];
  
  const handleButtonPress = (button: AlertButton) => {
    if (button.onPress) {
      button.onPress();
    }
    onClose();
  };
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.alertBox, { backgroundColor: alertBg }]}>
          <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
          <Text style={[styles.message, { color: messageColor }]}>{message}</Text>
          
          <View style={[
            styles.buttonContainer,
            defaultButtons.length > 1 && styles.buttonContainerRow
          ]}>
            {defaultButtons.map((button, index) => {
              const isCancel = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    isCancel && { backgroundColor: cancelBg },
                    isDestructive && styles.buttonError,
                    !isCancel && !isDestructive && (
                      type === 'success' ? styles.buttonSuccess :
                      type === 'error' ? styles.buttonError :
                      styles.buttonDefault
                    ),
                    defaultButtons.length > 1 && styles.buttonFlex
                  ]}
                  onPress={() => handleButtonPress(button)}
                >
                  <Text style={[
                    styles.buttonText,
                    isCancel && { color: cancelTextColor }
                  ]}>
                    {button.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertBox: {
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    alignItems: 'flex-end',
  },
  buttonContainerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    backgroundColor: '#10B981',
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  buttonFlex: {
    flex: 1,
  },
  buttonDefault: {
    backgroundColor: '#6366f1',
  },
  buttonSuccess: {
    backgroundColor: '#10B981',
  },
  buttonError: {
    backgroundColor: '#EF4444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
