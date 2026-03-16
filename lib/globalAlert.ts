type AlertType = "success" | "error" | "warning" | "info";

type AlertButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

type AlertOptions = {
  type?: AlertType;
  title: string;
  message: string;
  buttons?: AlertButton[];
};

// Global alert function - sẽ được set từ App component
let globalAlertFunction: ((options: AlertOptions) => void) | null = null;

// Set global alert function
export const setGlobalAlert = (alertFn: (options: AlertOptions) => void) => {
  globalAlertFunction = alertFn;
};

// Main alert function
export const showAlert = (options: AlertOptions) => {
  if (globalAlertFunction) {
    globalAlertFunction(options);
  } else {
    // Fallback to native alert if global alert not available
    const { Alert } = require('react-native');
    const buttons = options.buttons?.map(btn => ({
      text: btn.text,
      style: btn.style,
      onPress: btn.onPress,
    })) || [{ text: 'OK' }];
    
    Alert.alert(options.title, options.message, buttons);
  }
};

// Shorthand functions
export const showSuccess = (title: string, message: string, buttons?: AlertButton[]) => {
  showAlert({ type: "success", title, message, buttons });
};

export const showError = (title: string, message: string, buttons?: AlertButton[]) => {
  showAlert({ type: "error", title, message, buttons });
};

export const showWarning = (title: string, message: string, buttons?: AlertButton[]) => {
  showAlert({ type: "warning", title, message, buttons });
};

export const showInfo = (title: string, message: string, buttons?: AlertButton[]) => {
  showAlert({ type: "info", title, message, buttons });
};

// Confirm dialog
export const showConfirm = (
  title: string, 
  message: string, 
  onConfirm: () => void,
  onCancel?: () => void,
  confirmText: string = "Xác nhận",
  cancelText: string = "Hủy"
) => {
  showAlert({
    type: "warning",
    title,
    message,
    buttons: [
      {
        text: cancelText,
        style: "cancel",
        onPress: onCancel,
      },
      {
        text: confirmText,
        style: "destructive",
        onPress: onConfirm,
      },
    ],
  });
};