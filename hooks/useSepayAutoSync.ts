// Hook để tự động đồng bộ giao dịch từ Sepay mỗi 15 giây
import { getUserSepayApiKey, syncSepayTransactions } from '@/lib/sepayService';
import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

const SYNC_INTERVAL = 15000; // 15 giây

export function useSepayAutoSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStats, setSyncStats] = useState({ synced: 0, skipped: 0, errors: 0 });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);

  // Hàm đồng bộ
  const performSync = async () => {
    // Kiểm tra xem có API key không
    const apiKey = await getUserSepayApiKey();
    if (!apiKey) {
      console.log('⏭️  No Sepay API key found, skipping auto-sync');
      return;
    }

    // Tránh sync đồng thời
    if (isSyncing) {
      console.log('⏭️  Already syncing, skipping...');
      return;
    }

    setIsSyncing(true);
    console.log('🔄 Auto-syncing Sepay transactions...');

    try {
      const result = await syncSepayTransactions();
      
      if (result.success) {
        setLastSyncTime(new Date());
        setSyncStats({
          synced: result.synced,
          skipped: result.skipped,
          errors: result.errors,
        });

        if (result.synced > 0) {
          console.log(`✅ Auto-sync completed: ${result.synced} new transactions`);
        } else {
          console.log('✅ Auto-sync completed: No new transactions');
        }
      } else {
        console.error('❌ Auto-sync failed:', result.message);
      }
    } catch (error) {
      console.error('❌ Auto-sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Setup interval
  useEffect(() => {
    // Tắt auto-sync trên web do CORS, chỉ chạy trên mobile
    if (Platform.OS === 'web') {
      console.log('⏭️  Auto-sync disabled on web (CORS restriction from Sepay API)');
      console.log('💡 Use manual sync button in Settings or run on mobile');
      return;
    }

    // Kiểm tra xem có API key không trước khi bắt đầu
    const initAutoSync = async () => {
      const apiKey = await getUserSepayApiKey();
      if (!apiKey) {
        console.log('⏭️  No Sepay API key configured, auto-sync disabled');
        return;
      }

      console.log(`🚀 Starting Sepay auto-sync service on ${Platform.OS} (every 15s)`);

      // Sync ngay lập tức khi mount
      performSync();

      // Setup interval để sync định kỳ
      intervalRef.current = setInterval(() => {
        performSync();
      }, SYNC_INTERVAL);
    };

    initAutoSync();

    // Cleanup khi unmount
    return () => {
      if (intervalRef.current) {
        console.log('🛑 Stopping Sepay auto-sync service');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Xử lý khi app chuyển background/foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // Khi app chuyển từ background về foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 App came to foreground, syncing immediately...');
        performSync();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return {
    isSyncing,
    lastSyncTime,
    syncStats,
    manualSync: performSync,
  };
}
