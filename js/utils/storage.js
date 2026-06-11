const DB_NAME = "TravelPlanner";
const STORE = "trips";
const LS_KEY = "Travel Planner:trips";

function idbReady() { return typeof indexedDB !== "undefined"; }

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const tripStorage = {
  async saveTrip(trip) {
    if (idbReady()) {
      try {
        const db = await openDb();
        await new Promise((res, rej) => {
          const tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).put(trip);
          tx.oncomplete = res; tx.onerror = () => rej(tx.error);
        });
        return trip;
      } catch (_) { /* fall through to LS */ }
    }
    const all = this._lsAll();
    const i = all.findIndex((t) => t.id === trip.id);
    if (i >= 0) all[i] = trip; else all.push(trip);
    localStorage.setItem(LS_KEY, JSON.stringify(all));
    return trip;
  },

  async allTrips() {
    if (idbReady()) {
      try {
        const db = await openDb();
        return await new Promise((res, rej) => {
          const tx = db.transaction(STORE, "readonly");
          const req = tx.objectStore(STORE).getAll();
          req.onsuccess = () => res(req.result || []);
          req.onerror = () => rej(req.error);
        });
      } catch (_) { /* fall through */ }
    }
    return this._lsAll();
  },

  async deleteTrip(id) {
    if (idbReady()) {
      try {
        const db = await openDb();
        await new Promise((res, rej) => {
          const tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).delete(id);
          tx.oncomplete = res; tx.onerror = () => rej(tx.error);
        });
        return;
      } catch (_) { /* fall through */ }
    }
    localStorage.setItem(LS_KEY, JSON.stringify(this._lsAll().filter((t) => t.id !== id)));
  },

  _lsAll() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
    catch { return []; }
  },
};
