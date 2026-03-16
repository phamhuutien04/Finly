import { useCustomAlert } from "@/hooks/useCustomAlert";
import { setGlobalAlert } from "@/lib/globalAlert";
import React, { useEffect } from "react";

type GlobalAlertProviderProps = {
  children: React.ReactNode;
};

export default function GlobalAlertProvider({ children }: GlobalAlertProviderProps) {
  const { showAlert, AlertComponent } = useCustomAlert();

  useEffect(() => {
    // Set global alert function
    setGlobalAlert(showAlert);
    
    // Cleanup on unmount
    return () => {
      setGlobalAlert(() => {});
    };
  }, [showAlert]);

  return (
    <>
      {children}
      <AlertComponent />
    </>
  );
}