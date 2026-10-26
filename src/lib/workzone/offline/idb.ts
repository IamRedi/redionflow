import type { EntityCacheEntry, SyncLogEntry, UploadBlobEntry, WorkzonePendingAction } from "./types";

const DB_NAME = "workzone-offline";
const DB_VERSION = 1;

type StoreName = "outbox" | "entityCache" | "uploadBlobs" | "syncLog";

function upgrade(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains("outbox")) {
    const outbox = db.createObjectStore("outbox", { keyPath: "id" });
    outbox.createIndex("by_status", "status");
    outbox.createIndex("by_clientCreatedAt", "clientCreatedAt");
  }

  if (!db.objectStoreNames.contains("entityCache")) {
    const cache = db.createObjectStore("entityCache", { keyPath: "cacheKey" });
    cache.createIndex("by_entityType", "entityType");
    cache.createIndex("by_cachedAt", "cachedAt");
  }

  if (!db.objectStoreNames.contains("uploadBlobs")) {
    const blobs = db.createObjectStore("uploadBlobs", { keyPath: "id" });
    blobs.createIndex("by_actionId", "actionId");
  }

  if (!db.objectStoreNames.contains("syncLog")) {
    const log = db.createObjectStore("syncLog", { keyPath: "id" });
    log.createIndex("by_occurredAt", "occurredAt");
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => upgrade((event.target as IDBOpenDBRequest).result);
    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
    request.onblocked = () => reject(new Error("IndexedDB upgrade blocked by open tab."));
  });
}

let _db: Promise<IDBDatabase> | null = null;

export function getDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this environment."));
  }
  if (!_db) {
    _db = openDatabase().catch((error) => {
      _db = null;
      throw error;
    });
  }
  return _db;
}

// ---------------------------------------------------------------------------
// Low-level transaction helpers
// ---------------------------------------------------------------------------

function readwrite(db: IDBDatabase, store: StoreName): IDBObjectStore {
  return db.transaction([store], "readwrite").objectStore(store);
}

function readonly(db: IDBDatabase, store: StoreName): IDBObjectStore {
  return db.transaction([store], "readonly").objectStore(store);
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------

export async function dbPutOutbox(action: WorkzonePendingAction): Promise<void> {
  const db = await getDb();
  await wrap(readwrite(db, "outbox").put(action));
}

export async function dbGetOutbox(id: string): Promise<WorkzonePendingAction | undefined> {
  const db = await getDb();
  return wrap(readonly(db, "outbox").get(id));
}

export async function dbGetAllOutbox(): Promise<WorkzonePendingAction[]> {
  const db = await getDb();
  return wrap(readonly(db, "outbox").getAll());
}

export async function dbGetOutboxByStatus(
  status: WorkzonePendingAction["status"],
): Promise<WorkzonePendingAction[]> {
  const db = await getDb();
  const store = readonly(db, "outbox");
  const index = store.index("by_status");
  return wrap(index.getAll(status));
}

export async function dbDeleteOutbox(id: string): Promise<void> {
  const db = await getDb();
  await wrap(readwrite(db, "outbox").delete(id));
}

// ---------------------------------------------------------------------------
// Entity cache
// ---------------------------------------------------------------------------

export async function dbPutEntityCache(entry: EntityCacheEntry): Promise<void> {
  const db = await getDb();
  await wrap(readwrite(db, "entityCache").put(entry));
}

export async function dbGetEntityCache(cacheKey: string): Promise<EntityCacheEntry | undefined> {
  const db = await getDb();
  return wrap(readonly(db, "entityCache").get(cacheKey));
}

// ---------------------------------------------------------------------------
// Upload blobs (Phase 5)
// ---------------------------------------------------------------------------

export async function dbPutUploadBlob(entry: UploadBlobEntry): Promise<void> {
  const db = await getDb();
  await wrap(readwrite(db, "uploadBlobs").put(entry));
}

export async function dbGetUploadBlob(id: string): Promise<UploadBlobEntry | undefined> {
  const db = await getDb();
  return wrap(readonly(db, "uploadBlobs").get(id));
}

export async function dbDeleteUploadBlob(id: string): Promise<void> {
  const db = await getDb();
  await wrap(readwrite(db, "uploadBlobs").delete(id));
}

// ---------------------------------------------------------------------------
// Sync log
// ---------------------------------------------------------------------------

export async function dbPutSyncLog(entry: SyncLogEntry): Promise<void> {
  const db = await getDb();
  await wrap(readwrite(db, "syncLog").put(entry));
}

export async function dbGetRecentSyncLog(limit = 20): Promise<SyncLogEntry[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const store = readonly(db, "syncLog");
    const index = store.index("by_occurredAt");
    const results: SyncLogEntry[] = [];
    const request = index.openCursor(null, "prev");
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || results.length >= limit) {
        resolve(results);
        return;
      }
      results.push(cursor.value as SyncLogEntry);
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}
