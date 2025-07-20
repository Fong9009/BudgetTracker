import { offlineDB } from './offlineDB';
import { queryClient } from './queryClient';

interface SyncResult {
  success: boolean;
  syncedItems: number;
  errors: string[];
}

class SyncService {
  private isOnline = navigator.onLine;
  private syncInProgress = false;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupOnlineOfflineListeners();
  }

  private setupOnlineOfflineListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('SyncService: Online - starting sync');
      this.syncData();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('SyncService: Offline - pausing sync');
    });
  }

  async syncData(): Promise<SyncResult> {
    if (!this.isOnline || this.syncInProgress) {
      return { success: false, syncedItems: 0, errors: ['Not online or sync in progress'] };
    }

    this.syncInProgress = true;
    const errors: string[] = [];
    let syncedItems = 0;

    try {
      console.log('SyncService: Starting data synchronization...');
      
      // Get sync queue
      const syncQueue = await offlineDB.getSyncQueue();
      console.log(`SyncService: Found ${syncQueue.length} items to sync`);

      for (const item of syncQueue) {
        try {
          await this.processSyncItem(item);
          await offlineDB.removeFromSyncQueue(item.id);
          syncedItems++;
          console.log(`SyncService: Successfully synced ${item.operation} on ${item.table}`);
        } catch (error) {
          const errorMsg = `Failed to sync ${item.operation} on ${item.table}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
          
          // Increment retry count
          item.retries++;
          if (item.retries < 3) {
            // Keep in queue for retry
            await offlineDB.removeFromSyncQueue(item.id);
            await offlineDB.addToSyncQueue(item.operation, item.table, item.data);
          } else {
            // Remove from queue after max retries
            await offlineDB.removeFromSyncQueue(item.id);
            errors.push(`Max retries exceeded for ${item.operation} on ${item.table}`);
          }
        }
      }

      // Refresh React Query cache after sync
      await this.refreshCache();

      console.log(`SyncService: Sync completed. ${syncedItems} items synced, ${errors.length} errors`);
      
      return {
        success: errors.length === 0,
        syncedItems,
        errors
      };

    } catch (error) {
      console.error('SyncService: Sync failed:', error);
      return {
        success: false,
        syncedItems,
        errors: [`Sync failed: ${error}`]
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  private async processSyncItem(item: any): Promise<void> {
    const { operation, table, data } = item;

    switch (operation) {
      case 'CREATE':
        await this.createItem(table, data);
        break;
      case 'UPDATE':
        await this.updateItem(table, data);
        break;
      case 'DELETE':
        await this.deleteItem(table, data);
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  private async createItem(table: string, data: any): Promise<void> {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('No authentication token');

    const response = await fetch(`/api/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create ${table}: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Update local ID with server ID
    if (data.localId && result.id) {
      await offlineDB.markAsSynced(table, data.localId);
      // Update the local record with server ID
      const localData = await offlineDB.getLocalData(table, data.localId);
      if (localData) {
        localData.id = result.id;
        localData.synced = true;
        await offlineDB.updateLocalData(table, result.id, localData);
      }
    }
  }

  private async updateItem(table: string, data: any): Promise<void> {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('No authentication token');

    const response = await fetch(`/api/${table}/${data.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update ${table}: ${response.statusText}`);
    }

    await offlineDB.markAsSynced(table, data.id);
  }

  private async deleteItem(table: string, data: any): Promise<void> {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('No authentication token');

    const response = await fetch(`/api/${table}/${data.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete ${table}: ${response.statusText}`);
    }

    // Item already deleted from local DB during sync queue processing
  }

  private async refreshCache(): Promise<void> {
    // Invalidate and refetch React Query cache
    await queryClient.invalidateQueries({ queryKey: ['transactions'] });
    await queryClient.invalidateQueries({ queryKey: ['accounts'] });
    await queryClient.invalidateQueries({ queryKey: ['categories'] });
    await queryClient.invalidateQueries({ queryKey: ['analytics'] });
  }

  // Start periodic sync (every 5 minutes when online)
  startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.syncData();
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  // Stop periodic sync
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Manual sync trigger
  async manualSync(): Promise<SyncResult> {
    return await this.syncData();
  }

  // Get sync status
  getSyncStatus(): { isOnline: boolean; syncInProgress: boolean } {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
    };
  }

  // Get pending sync count
  async getPendingSyncCount(): Promise<number> {
    const syncQueue = await offlineDB.getSyncQueue();
    return syncQueue.length;
  }
}

// Singleton instance
export const syncService = new SyncService();

// Helper functions for offlineDB
export const addToSyncQueue = async (operation: 'CREATE' | 'UPDATE' | 'DELETE', table: 'transactions' | 'accounts' | 'categories', data: any) => {
  await offlineDB.addToSyncQueue(operation, table, data);
};

export const getSyncStatus = () => syncService.getSyncStatus();
export const manualSync = () => syncService.manualSync();
export const getPendingSyncCount = () => syncService.getPendingSyncCount(); 