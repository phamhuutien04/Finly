import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

export type Transaction = {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  type: 'income' | 'expense';
  note: string | null;
  transaction_date: string;
  created_at: string;
  is_split?: boolean;
  split_total_amount?: number;
  split_participants?: number;
  original_transaction_id?: string;
  category?: {
    name: string;
    emoji: string;
    icon_uri: string;
  };
};

export const useTransactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTransactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          category:categories(name, emoji, icon_uri)
        `)
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false })
        .limit(50);

      if (error) throw error;

      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const addTransaction = (newTransaction: Transaction) => {
    setTransactions(prev => [newTransaction, ...prev]);
  };

  const addMultipleTransactions = (newTransactions: Transaction[]) => {
    setTransactions(prev => [...newTransactions, ...prev]);
  };

  const refresh = async () => {
    setRefreshing(true);
    await fetchTransactions();
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  return {
    transactions,
    loading,
    refreshing,
    fetchTransactions,
    addTransaction,
    addMultipleTransactions,
    refresh,
  };
};