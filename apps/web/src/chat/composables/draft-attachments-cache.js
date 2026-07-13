const DB_NAME = "linksee-chat-drafts";
const STORE_NAME = "attachments";
const DB_VERSION = 1;

function buildKey(userId, conversationId) {
  return `${String(userId || "guest").trim() || "guest"}:${String(conversationId || "").trim()}`;
}

function openDatabase() {
  if (!window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function withStore(mode, handler) {
  const database = await openDatabase();
  if (!database) return null;
  return new Promise((resolve) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const finish = (value) => resolve(value);
    handler(store, finish);
    transaction.onabort = () => finish(null);
    transaction.onerror = () => finish(null);
  }).finally(() => {
    database.close();
  });
}

export async function writeDraftAttachments(userId, conversationId, files = []) {
  const id = buildKey(userId, conversationId);
  const payload = await Promise.all(
    Array.from(files || []).filter((item) => item?.file).map(async (item) => ({
      id: String(item.id || ""),
      name: item.name || item.file.name || "attachment",
      mimeType: item.mimeType || item.file.type || "application/octet-stream",
      size: Number(item.size || item.file.size || 0),
      lastModified: Number(item.lastModified || item.file.lastModified || Date.now()),
      blob: item.file.slice(0, item.file.size, item.file.type || item.mimeType || "application/octet-stream"),
    })),
  );
  return withStore("readwrite", (store, finish) => {
    if (!payload.length) {
      const request = store.delete(id);
      request.onsuccess = () => finish(true);
      request.onerror = () => finish(false);
      return;
    }
    const request = store.put({ id, files: payload, cachedAt: new Date().toISOString() });
    request.onsuccess = () => finish(true);
    request.onerror = () => finish(false);
  });
}

export async function readDraftAttachments(userId, conversationId) {
  const id = buildKey(userId, conversationId);
  const row = await withStore("readonly", (store, finish) => {
    const request = store.get(id);
    request.onsuccess = () => finish(request.result || null);
    request.onerror = () => finish(null);
  });
  return Array.isArray(row?.files) ? row.files : [];
}
