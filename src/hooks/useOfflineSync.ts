import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  getPendingSyncItems,
  markAsSynced,
  removeSyncedItems,
  getSyncQueueCount,
  addToSyncQueue,
  OfflineQueueItem,
} from '@/lib/indexedDB';

interface SyncState {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: Date | null;
  syncError: string | null;
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    pendingCount: 0,
    lastSyncAt: null,
    syncError: null,
  });

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await getSyncQueueCount();
      setSyncState(prev => ({ ...prev, pendingCount: count }));
    } catch (error) {
      console.error('Failed to get sync queue count:', error);
    }
  }, []);

  // Sync a single item to Supabase
  const syncItem = async (item: OfflineQueueItem): Promise<boolean> => {
    try {
      // Use type assertion for dynamic table access
      const table = supabase.from(item.table as 'projects');
      
      switch (item.operation) {
        case 'insert': {
          const { error } = await table.insert(item.data as never);
          if (error) throw error;
          break;
        }
        case 'update': {
          const { id, ...updateData } = item.data;
          const { error } = await table
            .update(updateData as never)
            .eq('id', id as string);
          if (error) throw error;
          break;
        }
        case 'delete': {
          const { error } = await table
            .delete()
            .eq('id', item.data.id as string);
          if (error) throw error;
          break;
        }
      }

      await markAsSynced(item.id);
      return true;
    } catch (error) {
      console.error(`Failed to sync item ${item.id}:`, error);
      return false;
    }
  };

  // Sync all pending items
  const syncAll = useCallback(async () => {
    if (!isOnline || syncState.isSyncing) return;

    setSyncState(prev => ({ ...prev, isSyncing: true, syncError: null }));

    try {
      const pendingItems = await getPendingSyncItems();
      
      if (pendingItems.length === 0) {
        setSyncState(prev => ({ 
          ...prev, 
          isSyncing: false, 
          lastSyncAt: new Date() 
        }));
        return;
      }

      // Sort by timestamp to maintain order
      pendingItems.sort((a, b) => a.timestamp - b.timestamp);

      let successCount = 0;
      let failCount = 0;

      for (const item of pendingItems) {
        const success = await syncItem(item);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      // Clean up synced items
      await removeSyncedItems();
      await updatePendingCount();

      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: new Date(),
        syncError: failCount > 0 ? `${failCount} items failed to sync` : null,
      }));

      if (successCount > 0) {
        toast.success(`Synced ${successCount} offline changes`);
      }
      if (failCount > 0) {
        toast.error(`${failCount} changes failed to sync`);
      }
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        syncError: 'Sync failed',
      }));
    }
  }, [isOnline, syncState.isSyncing, updatePendingCount]);

  // Queue an operation for offline sync
  const queueOperation = useCallback(async (
    table: string,
    operation: 'insert' | 'update' | 'delete',
    data: Record<string, unknown>
  ) => {
    await addToSyncQueue({ table, operation, data });
    await updatePendingCount();
  }, [updatePendingCount]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      syncAll();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial count
    updatePendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncAll, updatePendingCount]);

  return {
    isOnline,
    syncState,
    syncAll,
    queueOperation,
    updatePendingCount,
  };
}
