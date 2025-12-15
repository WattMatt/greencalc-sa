// IndexedDB utility for offline data storage

const DB_NAME = 'solar-tariff-pro-offline';
const DB_VERSION = 1;

export interface OfflineQueueItem {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: number;
  synced: boolean;
}

export interface CachedData {
  key: string;
  data: unknown;
  timestamp: number;
  expiresAt?: number;
}

let dbInstance: IDBDatabase | null = null;

export async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store for offline operation queue
      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        syncStore.createIndex('synced', 'synced', { unique: false });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Store for cached data
      if (!db.objectStoreNames.contains('cache')) {
        const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
        cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Sync Queue Operations
export async function addToSyncQueue(item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'synced'>): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const queueItem: OfflineQueueItem = {
    ...item,
    id,
    timestamp: Date.now(),
    synced: false,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('syncQueue', 'readwrite');
    const store = transaction.objectStore('syncQueue');
    const request = store.add(queueItem);

    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingSyncItems(): Promise<OfflineQueueItem[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('syncQueue', 'readonly');
    const store = transaction.objectStore('syncQueue');
    const index = store.index('synced');
    const request = index.getAll(IDBKeyRange.only(false));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function markAsSynced(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('syncQueue', 'readwrite');
    const store = transaction.objectStore('syncQueue');
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const item = getRequest.result;
      if (item) {
        item.synced = true;
        const putRequest = store.put(item);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function removeSyncedItems(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('syncQueue', 'readwrite');
    const store = transaction.objectStore('syncQueue');
    const index = store.index('synced');
    const request = index.openCursor(IDBKeyRange.only(true));

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Cache Operations
export async function cacheData(key: string, data: unknown, ttlMs?: number): Promise<void> {
  const db = await openDB();
  const cacheItem: CachedData = {
    key,
    data,
    timestamp: Date.now(),
    expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('cache', 'readwrite');
    const store = transaction.objectStore('cache');
    const request = store.put(cacheItem);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('cache', 'readonly');
    const store = transaction.objectStore('cache');
    const request = store.get(key);

    request.onsuccess = () => {
      const item = request.result as CachedData | undefined;
      if (!item) {
        resolve(null);
        return;
      }

      // Check expiration
      if (item.expiresAt && item.expiresAt < Date.now()) {
        // Data expired, remove it
        clearCachedData(key);
        resolve(null);
        return;
      }

      resolve(item.data as T);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearCachedData(key: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('cache', 'readwrite');
    const store = transaction.objectStore('cache');
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllCache(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('cache', 'readwrite');
    const store = transaction.objectStore('cache');
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get sync queue count for UI
export async function getSyncQueueCount(): Promise<number> {
  const items = await getPendingSyncItems();
  return items.length;
}
