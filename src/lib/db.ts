// Мінімальна обгортка над IndexedDB (без залежностей).
export const STORES = ['tasks', 'categories', 'habits', 'goals', 'journal', 'sessions', 'energy', 'templates', 'countdowns', 'days', 'kv', 'backups'] as const;
export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;
export let dbAvailable = true;

export const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { dbAvailable = false; return reject(new Error('IndexedDB недоступна')); }
    const req = indexedDB.open('day-planner', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => { dbAvailable = false; reject(req.error); };
    req.onblocked = () => reject(new Error('IndexedDB заблоковано'));
  });
  return dbPromise;
};

const run = async <T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T> => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const r = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve((r ? (r as IDBRequest).result : undefined) as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
};

export const getAll = <T>(store: StoreName) => run<T[]>(store, 'readonly', (s) => s.getAll());
export const getOne = <T>(store: StoreName, id: string) => run<T | undefined>(store, 'readonly', (s) => s.get(id));
export const put = (store: StoreName, v: unknown) => run<void>(store, 'readwrite', (s) => { s.put(v); });
export const putMany = (store: StoreName, vs: unknown[]) => run<void>(store, 'readwrite', (s) => { for (const v of vs) s.put(v); });
export const del = (store: StoreName, id: string) => run<void>(store, 'readwrite', (s) => { s.delete(id); });
export const clearStore = (store: StoreName) => run<void>(store, 'readwrite', (s) => { s.clear(); });
export const replaceAll = async (store: StoreName, vs: unknown[]) => {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    s.clear();
    for (const v of vs) s.put(v);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
};
