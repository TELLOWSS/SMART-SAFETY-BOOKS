type DocRef = { kind: 'doc'; path: string[]; id: string };
type CollectionRef = { kind: 'collection'; path: string[] };
type QueryConstraint =
  | { type: 'where'; field: string; op: '=='; value: unknown }
  | { type: 'orderBy'; field: string; direction: 'asc' | 'desc' }
  | { type: 'limit'; count: number };
type QueryRef = { kind: 'query'; collection: CollectionRef; constraints: QueryConstraint[] };

type LocalDocSnapshot = {
  id: string;
  exists: () => boolean;
  data: () => any;
};

type LocalQueryDoc = {
  id: string;
  data: () => any;
};

type LocalQuerySnapshot = {
  docs: LocalQueryDoc[];
  forEach: (fn: (doc: LocalQueryDoc) => void) => void;
};

type Listener = {
  queryRef: QueryRef;
  next: (snapshot: LocalQuerySnapshot) => void;
  error?: (error: unknown) => void;
};

type NotificationRecord = {
  __key: string;
  userId: string;
  id: string;
  data: any;
};

const DB_NAME = 'ssb_offline_db';
const DB_VERSION = 1;
const STORE_LOGS = 'logs';
const STORE_SETTINGS = 'settings';
const STORE_NOTIFICATIONS = 'notifications';
const listeners: Listener[] = [];

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const normalizePath = (parts: string[]) => parts.filter(Boolean);

let dbPromise: Promise<IDBDatabase> | null = null;

const openDatabase = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_LOGS)) {
        db.createObjectStore(STORE_LOGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_NOTIFICATIONS)) {
        const store = db.createObjectStore(STORE_NOTIFICATIONS, { keyPath: '__key' });
        store.createIndex('userId', 'userId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB 열기 실패'));
  });

  return dbPromise;
};

const runTx = async <T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T> | T) => {
  const db = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
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

const getDocData = async (path: string[]) => {
  if (path.length === 2 && path[0] === 'logs') {
    const row = await runTx(STORE_LOGS, 'readonly', (store) => reqToPromise<any>(store.get(path[1])));
    return row?.data;
  }

  if (path.length === 2 && path[0] === 'settings') {
    const row = await runTx(STORE_SETTINGS, 'readonly', (store) => reqToPromise<any>(store.get(path[1])));
    return row?.data;
  }

  if (path.length === 4 && path[0] === 'users' && path[2] === 'notifications') {
    const key = `${path[1]}::${path[3]}`;
    const row = await runTx(STORE_NOTIFICATIONS, 'readonly', (store) => reqToPromise<NotificationRecord | undefined>(store.get(key)));
    return row?.data;
  }

  return undefined;
};

const setDocData = async (path: string[], value: any) => {
  if (path.length === 2 && path[0] === 'logs') {
    await runTx(STORE_LOGS, 'readwrite', (store) => reqToPromise(store.put({ id: path[1], data: value })));
    return;
  }

  if (path.length === 2 && path[0] === 'settings') {
    await runTx(STORE_SETTINGS, 'readwrite', (store) => reqToPromise(store.put({ id: path[1], data: value })));
    return;
  }

  if (path.length === 4 && path[0] === 'users' && path[2] === 'notifications') {
    const key = `${path[1]}::${path[3]}`;
    await runTx(STORE_NOTIFICATIONS, 'readwrite', (store) => reqToPromise(store.put({
      __key: key,
      userId: path[1],
      id: path[3],
      data: value,
    } as NotificationRecord)));
    return;
  }

  throw new Error(`지원하지 않는 경로: ${path.join('/')}`);
};

const deleteDocData = async (path: string[]) => {
  if (path.length === 2 && path[0] === 'logs') {
    await runTx(STORE_LOGS, 'readwrite', (store) => reqToPromise(store.delete(path[1])));
    return;
  }

  if (path.length === 2 && path[0] === 'settings') {
    await runTx(STORE_SETTINGS, 'readwrite', (store) => reqToPromise(store.delete(path[1])));
    return;
  }

  if (path.length === 4 && path[0] === 'users' && path[2] === 'notifications') {
    const key = `${path[1]}::${path[3]}`;
    await runTx(STORE_NOTIFICATIONS, 'readwrite', (store) => reqToPromise(store.delete(key)));
    return;
  }

  throw new Error(`지원하지 않는 경로: ${path.join('/')}`);
};

const getCollectionEntries = async (path: string[]) => {
  if (path.length === 1 && path[0] === 'logs') {
    const rows = await runTx(STORE_LOGS, 'readonly', (store) => reqToPromise<any[]>(store.getAll()));
    return rows.map((row) => ({ id: row.id, data: row.data }));
  }

  if (path.length === 1 && path[0] === 'settings') {
    const rows = await runTx(STORE_SETTINGS, 'readonly', (store) => reqToPromise<any[]>(store.getAll()));
    return rows.map((row) => ({ id: row.id, data: row.data }));
  }

  if (path.length === 3 && path[0] === 'users' && path[2] === 'notifications') {
    const userId = path[1];
    const rows = await runTx(STORE_NOTIFICATIONS, 'readonly', (store) => {
      const index = store.index('userId');
      return reqToPromise<NotificationRecord[]>(index.getAll(userId));
    });
    return rows.map((row) => ({ id: row.id, data: row.data }));
  }

  return [];
};

const applyConstraints = (rows: Array<{ id: string; data: any }>, constraints: QueryConstraint[]) => {
  let nextRows = [...rows];

  constraints.forEach((constraint) => {
    if (constraint.type === 'where') {
      nextRows = nextRows.filter((row) => row.data?.[constraint.field] === constraint.value);
    }

    if (constraint.type === 'orderBy') {
      nextRows.sort((a, b) => {
        const av = a.data?.[constraint.field];
        const bv = b.data?.[constraint.field];
        if (av === bv) return 0;
        if (av === undefined || av === null) return 1;
        if (bv === undefined || bv === null) return -1;
        const result = av > bv ? 1 : -1;
        return constraint.direction === 'desc' ? -result : result;
      });
    }

    if (constraint.type === 'limit') {
      nextRows = nextRows.slice(0, constraint.count);
    }
  });

  return nextRows;
};

const toQuerySnapshot = (rows: Array<{ id: string; data: any }>): LocalQuerySnapshot => {
  const docs: LocalQueryDoc[] = rows.map((row) => ({
    id: row.id,
    data: () => row.data,
  }));

  return {
    docs,
    forEach: (fn) => docs.forEach(fn),
  };
};

const computeQuerySnapshot = async (queryRef: QueryRef) => {
  const rows = await getCollectionEntries(queryRef.collection.path);
  return toQuerySnapshot(applyConstraints(rows, queryRef.constraints));
};

const notifyListeners = async () => {
  await Promise.all(listeners.map(async (listener) => {
    try {
      const snapshot = await computeQuerySnapshot(listener.queryRef);
      listener.next(snapshot);
    } catch (error) {
      listener.error?.(error);
    }
  }));
};

export const db = { kind: 'local-db' };

export const collection = (_db: unknown, ...pathParts: string[]): CollectionRef => ({
  kind: 'collection',
  path: normalizePath(pathParts.join('/').split('/')),
});

export const doc = (first: unknown, ...pathParts: string[]): DocRef => {
  if (typeof first === 'object' && first !== null && (first as any).kind === 'collection') {
    const collectionRef = first as CollectionRef;
    const id = createId();
    return {
      kind: 'doc',
      id,
      path: [...collectionRef.path, id],
    };
  }

  if (pathParts.length > 0) {
    const path = normalizePath(pathParts.join('/').split('/'));
    return {
      kind: 'doc',
      id: path[path.length - 1] || '',
      path,
    };
  }

  const path = normalizePath(String(first).split('/'));
  return {
    kind: 'doc',
    id: path[path.length - 1] || '',
    path,
  };
};

export const where = (field: string, op: '==', value: unknown): QueryConstraint => ({
  type: 'where',
  field,
  op,
  value,
});

export const orderBy = (field: string, direction: 'asc' | 'desc' = 'asc'): QueryConstraint => ({
  type: 'orderBy',
  field,
  direction,
});

export const limit = (count: number): QueryConstraint => ({
  type: 'limit',
  count,
});

export const query = (collectionRef: CollectionRef, ...constraints: QueryConstraint[]): QueryRef => ({
  kind: 'query',
  collection: collectionRef,
  constraints,
});

export const serverTimestamp = () => Date.now();

export const getDocs = async (queryRef: QueryRef): Promise<LocalQuerySnapshot> => computeQuerySnapshot(queryRef);

export const onSnapshot = (
  queryRef: QueryRef,
  next: (snapshot: LocalQuerySnapshot) => void,
  error?: (error: unknown) => void,
) => {
  const listener: Listener = { queryRef, next, error };
  listeners.push(listener);

  computeQuerySnapshot(queryRef)
    .then(next)
    .catch((snapshotError) => error?.(snapshotError));

  return () => {
    const index = listeners.indexOf(listener);
    if (index >= 0) listeners.splice(index, 1);
  };
};

export const getDoc = async (docRef: DocRef): Promise<LocalDocSnapshot> => {
  const data = await getDocData(docRef.path);

  return {
    id: docRef.id,
    exists: () => data !== undefined,
    data: () => data,
  };
};

export const setDoc = async (docRef: DocRef, value: any, options?: { merge?: boolean }) => {
  const prev = options?.merge ? await getDocData(docRef.path) : undefined;
  const nextValue = options?.merge ? { ...(prev || {}), ...value } : value;
  await setDocData(docRef.path, nextValue);
  await notifyListeners();
};

export const updateDoc = async (docRef: DocRef, value: any) => {
  const prev = await getDocData(docRef.path);
  if (prev === undefined) {
    throw new Error('업데이트할 문서가 없습니다.');
  }
  await setDocData(docRef.path, { ...prev, ...value });
  await notifyListeners();
};

export const deleteDoc = async (docRef: DocRef) => {
  await deleteDocData(docRef.path);
  await notifyListeners();
};
