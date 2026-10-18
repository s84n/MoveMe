// IndexedDB-Speicher mit In-Memory-Cache. Schlüssel: "YYYY-MM-DD|activityId" -> { done, value? }
// Zusätzlich liegt eine Spiegelkopie in localStorage, falls ein IndexedDB-Schreibvorgang verloren geht.
const DB_NAME = 'moveme';
const STORE = 'entries';
const MIRROR = 'moveme-entries';
const cache = new Map();
let db = null;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      const conn = req.result;
      // Verbindung kann vom Browser geschlossen werden (z. B. nach langem Hintergrund) -> beim nächsten Zugriff neu öffnen
      conn.onclose = () => { if (db === conn) db = null; };
      conn.onversionchange = () => { conn.close(); if (db === conn) db = null; };
      resolve(conn);
    };
    req.onerror = () => reject(req.error);
  });
}

async function conn() {
  if (!db) db = await open();
  return db;
}

// Schreibt in einer eigenen Transaktion und wartet auf den Abschluss; bei Fehler einmal mit neuer Verbindung wiederholen
async function write(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      const tx = (await conn()).transaction(STORE, 'readwrite', { durability: 'strict' });
      fn(tx.objectStore(STORE));
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = tx.onabort = () => rej(tx.error); });
      return;
    } catch (err) {
      db = null;
      if (attempt >= 1) throw err;
    }
  }
}

function saveMirror() {
  try { localStorage.setItem(MIRROR, JSON.stringify(Object.fromEntries(cache))); } catch { /* voll oder gesperrt */ }
}

function loadMirror() {
  try { return JSON.parse(localStorage.getItem(MIRROR) || '{}'); } catch { return {}; }
}

export async function init() {
  // Dauerhaften Speicher anfragen, damit Chrome die Daten nicht bei Platzbedarf räumt
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch { /* egal */ }
  const c = await conn();
  await new Promise((resolve, reject) => {
    const req = c.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) { cache.set(cur.key, cur.value); cur.continue(); } else resolve();
    };
    req.onerror = () => reject(req.error);
  });
  // Einträge, die nur in der Spiegelkopie stehen, zurück in die Datenbank holen
  const missing = Object.entries(loadMirror()).filter(([k]) => !cache.has(k));
  for (const [k, v] of missing) cache.set(k, v);
  if (missing.length) await write((os) => { for (const [k, v] of missing) os.put(v, k); }).catch(() => {});
  saveMirror();
}

export const key = (date, id) => `${date}|${id}`;
export const get = (date, id) => cache.get(key(date, id)) || { done: false };

export function set(date, id, entry) {
  const k = key(date, id);
  const remove = !entry.done && !entry.value;
  if (remove) cache.delete(k); else cache.set(k, entry);
  saveMirror();
  return write((os) => (remove ? os.delete(k) : os.put(entry, k)));
}

export const all = () => cache;

export async function storageInfo() {
  let persisted = null;
  try { persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null; } catch { /* egal */ }
  return { persisted, count: cache.size };
}

export function exportJson() {
  return JSON.stringify({ app: 'moveme', version: 1, entries: Object.fromEntries(cache) }, null, 2);
}

export async function importJson(text) {
  const data = JSON.parse(text);
  if (data.app !== 'moveme' || typeof data.entries !== 'object') throw new Error('Ungültige Datei');
  await write((os) => {
    os.clear();
    for (const [k, v] of Object.entries(data.entries)) os.put(v, k);
  });
  cache.clear();
  for (const [k, v] of Object.entries(data.entries)) cache.set(k, v);
  saveMirror();
}
