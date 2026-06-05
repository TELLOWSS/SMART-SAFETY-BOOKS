type StorageRef = { path: string };

const DB_NAME = 'ssb_offline_db';
const DB_VERSION = 1;
const STORE_ASSETS = 'assets';

let dbPromise: Promise<IDBDatabase> | null = null;

const openDatabase = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        db.createObjectStore(STORE_ASSETS, { keyPath: 'path' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB 열기 실패'));
  });

  return dbPromise;
};

const runTx = async <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T> | T) => {
  const db = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, mode);
    const store = tx.objectStore(STORE_ASSETS);
    Promise.resolve(fn(store))
      .then((result) => {
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error || new Error('IndexedDB 트랜잭션 실패'));
        tx.onabort = () => reject(tx.error || new Error('IndexedDB 트랜잭션 중단'));
      })
      .catch(reject);
  });
};

const reqToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB 요청 실패'));
  });

export const storage = { kind: 'local-storage' };

export const ref = (_storage: unknown, path: string): StorageRef => ({ path });

export const uploadString = async (storageRef: StorageRef, value: string, format: 'data_url') => {
  if (format !== 'data_url') {
    throw new Error('data_url 형식만 지원합니다.');
  }

  await runTx('readwrite', (store) => reqToPromise(store.put({ path: storageRef.path, value })));
};

export const getDownloadURL = async (storageRef: StorageRef) => {
  const row = await runTx('readonly', (store) => reqToPromise<{ path: string; value: string } | undefined>(store.get(storageRef.path)));
  return row?.value || '';
};
