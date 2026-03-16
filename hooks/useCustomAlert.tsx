import CustomAlert from "@/components/CustomAlert";
import React, { useCallback, useState } from "react";

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

export function useCustomAlert() {
  const [alertState, setAlertState] = useState<{
    visible: boolean;
    options: AlertOptions | null;
  }>({
    visible: false,
    options: null,
  });

  const showAlert = useCallback((options: AlertOptions) => {
    setAlertState({
      visible: true,
      options,
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertState({
      visible: false,
      options: null,
    });
  }, []);

  const AlertComponent = useCallback(() => {
    if (!alertState.options) return null;

    return (
      <CustomAlert
        visible={alertState.visible}
        type={alertState.options.type}
        title={alertState.options.title}
        message={alertState.options.message}
        buttons={alertState.options.buttons}
        onClose={hideAlert}
      />
    );
  }, [alertState, hideAlert]);

  return {
    showAlert,
    hideAlert,
    AlertComponent,
  };
}