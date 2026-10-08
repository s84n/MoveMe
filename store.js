// IndexedDB-Speicher mit In-Memory-Cache. Schlüssel: "YYYY-MM-DD|activityId" -> { done, value? }
const DB_NAME = 'moveme';
const STORE = 'entries';
const cache = new Map();
let db;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function init() {
  db = await open();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (c) { cache.set(c.key, c.value); c.continue(); } else resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export const key = (date, id) => `${date}|${id}`;
export const get = (date, id) => cache.get(key(date, id)) || { done: false };

export function set(date, id, entry) {
  const k = key(date, id);
  if (!entry.done && !entry.value) {
    cache.delete(k);
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(k);
  } else {
    cache.set(k, entry);
    db.transaction(STORE, 'readwrite').objectStore(STORE).put(entry, k);
  }
}

export const all = () => cache;

export function exportJson() {
  return JSON.stringify({ app: 'moveme', version: 1, entries: Object.fromEntries(cache) }, null, 2);
}

export async function importJson(text) {
  const data = JSON.parse(text);
  if (data.app !== 'moveme' || typeof data.entries !== 'object') throw new Error('Ungültige Datei');
  const tx = db.transaction(STORE, 'readwrite');
  const os = tx.objectStore(STORE);
  os.clear();
  cache.clear();
  for (const [k, v] of Object.entries(data.entries)) { cache.set(k, v); os.put(v, k); }
  await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}
