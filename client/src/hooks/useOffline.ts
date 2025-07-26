import { useState, useEffect } from 'react';
import { offlineDB, initOfflineDB } from '../lib/offlineDB';
import { syncService, getSyncStatus, manualSync, getPendingSyncCount } from '../lib/syncService';

export const useOffline = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isOfflineDBReady, setIsOfflineDBReady] = useState(false);

  useEffect(() => {
    // Initialize offline database
    const initDB = async () => {
      try {
        await initOfflineDB();
        setIsOfflineDBReady(true);
        console.log('OfflineDB initialized successfully');
      } catch (error) {
        console.error('Failed to initialize OfflineDB:', error);
      }
    };

    initDB();

    // Start periodic sync
    syncService.startPeriodicSync();

    // Cleanup on unmount
    return () => {
      syncService.stopPeriodicSync();
    };
  }, []);

  useEffect(() => {
    // Only set up sync functionality after database is ready
    if (!isOfflineDBReady) return;

    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      
      if (online) {
        // Trigger sync when coming back online
        handleManualSync();
      }
    };

    const updateSyncStatus = () => {
      const status = getSyncStatus();
      setSyncInProgress(status.syncInProgress);
    };

    const updatePendingCount = async () => {
      try {
        const count = await getPendingSyncCount();
        setPendingSyncCount(count);
      } catch (error) {
        console.warn('Failed to get pending sync count:', error);
        setPendingSyncCount(0);
      }
    };

    // Listen for online/offline events
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Update sync status periodically
    const syncStatusInterval = setInterval(updateSyncStatus, 1000);
    const pendingCountInterval = setInterval(updatePendingCount, 5000);

    // Initial updates
    updateSyncStatus();
    updatePendingCount();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      clearInterval(syncStatusInterval);
      clearInterval(pendingCountInterval);
    };
  }, [isOfflineDBReady]);

  const handleManualSync = async () => {
    if (!isOnline || syncInProgress || !isOfflineDBReady) return;

    setSyncInProgress(true);
    try {
      const result = await manualSync();
      console.log('Manual sync result:', result);
      
      if (result.success) {
        console.log(`Successfully synced ${result.syncedItems} items`);
      } else {
        console.error('Sync failed:', result.errors);
      }
    } catch (error) {
      console.error('Manual sync error:', error);
    } finally {
      setSyncInProgress(false);
    }
  };

  const addTransactionOffline = async (transaction: {
    amount: number;
    description: string;
    category: string;
    account: string;
    type: 'income' | 'expense';
    date: string;
  }) => {
    if (!isOfflineDBReady) {
      throw new Error('Offline database not ready');
    }

    const transactionWithTimestamps = {
      ...transaction,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const localId = await offlineDB.addTransaction(transactionWithTimestamps);
    setPendingSyncCount(prev => prev + 1);
    
    return localId;
  };

  const updateTransactionOffline = async (id: string, updates: any) => {
    if (!isOfflineDBReady) {
      throw new Error('Offline database not ready');
    }

    await offlineDB.updateTransaction(id, updates);
    setPendingSyncCount(prev => prev + 1);
  };

  const deleteTransactionOffline = async (id: string) => {
    if (!isOfflineDBReady) {
      throw new Error('Offline database not ready');
    }

    await offlineDB.deleteTransaction(id);
    setPendingSyncCount(prev => prev + 1);
  };

  const getTransactionsOffline = async (filters?: any) => {
    if (!isOfflineDBReady) {
      throw new Error('Offline database not ready');
    }

    return await offlineDB.getTransactions(filters);
  };

  const getAccountsOffline = async () => {
    if (!isOfflineDBReady) {
      throw new Error('Offline database not ready');
    }

    return await offlineDB.getAccounts();
  };

  const getCategoriesOffline = async (type?: 'income' | 'expense') => {
    if (!isOfflineDBReady) {
      throw new Error('Offline database not ready');
    }

    return await offlineDB.getCategories(type);
  };

  const getAnalyticsOffline = async () => {
    if (!isOfflineDBReady) {
      throw new Error('Offline database not ready');
    }

    return await offlineDB.getAnalytics();
  };

  const exportOfflineData = async () => {
    if (!isOfflineDBReady) {
      throw new Error('Offline database not ready');
    }

    return await offlineDB.exportData();
  };

  const importOfflineData = async (data: any) => {
    if (!isOfflineDBReady) {
      throw new Error('Offline database not ready');
    }

    await offlineDB.importData(data);
  };

  return {
    // Status
    isOnline,
    syncInProgress,
    pendingSyncCount,
    isOfflineDBReady,
    
    // Actions
    handleManualSync,
    
    // Offline operations
    addTransactionOffline,
    updateTransactionOffline,
    deleteTransactionOffline,
    getTransactionsOffline,
    getAccountsOffline,
    getCategoriesOffline,
    getAnalyticsOffline,
    exportOfflineData,
    importOfflineData,
  };
}; 