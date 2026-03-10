import BudgetAlert from '@/components/BudgetAlert';
import React, { useState } from 'react';

interface AlertData {
  title: string;
  message: string;
  isOverBudget: boolean;
}

export function useBudgetAlert() {
  const [alertData, setAlertData] = useState<AlertData | null>(null);

  const showAlert = (title: string, message: string, isOverBudget: boolean = false) => {
    setAlertData({ title, message, isOverBudget });
  };

  const hideAlert = () => {
    setAlertData(null);
  };

  const AlertComponent = () => (
    <BudgetAlert
      visible={!!alertData}
      onClose={hideAlert}
      title={alertData?.title || ''}
      message={alertData?.message || ''}
      isOverBudget={alertData?.isOverBudget || false}
    />
  );

  return {
    showAlert,
    hideAlert,
    AlertComponent,
  };
}