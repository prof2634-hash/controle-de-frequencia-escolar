/* Banco de dados local usando IndexedDB - offline, sem servidor */
const DB = (() => {
  const DB_NAME = "frequencia_escolar";
  const DB_VERSION = 1;
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains("turmas")) {
          d.createObjectStore("turmas", { keyPath: "id" });
        }
        if (!d.objectStoreNames.contains("alunos")) {
          const s = d.createObjectStore("alunos", { keyPath: "id" });
          s.createIndex("turmaId", "turmaId", { unique: false });
        }
        if (!d.objectStoreNames.contains("chamadas")) {
          const s = d.createObjectStore("chamadas", { keyPath: "id" });
          s.createIndex("turmaId", "turmaId", { unique: false });
        }
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function tx(store, mode) {
    return db.transaction(store, mode).objectStore(store);
  }

  async function getAll(store) {
    await open();
    return new Promise((resolve, reject) => {
      const r = tx(store, "readonly").getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
  }

  async function put(store, value) {
    await open();
    return new Promise((resolve, reject) => {
      const r = tx(store, "readwrite").put(value);
      r.onsuccess = () => resolve(value);
      r.onerror = () => reject(r.error);
    });
  }

  async function remove(store, id) {
    await open();
    return new Promise((resolve, reject) => {
      const r = tx(store, "readwrite").delete(id);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  }

  async function get(store, id) {
    await open();
    return new Promise((resolve, reject) => {
      const r = tx(store, "readonly").get(id);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  async function clearAll() {
    await open();
    return Promise.all(["turmas", "alunos", "chamadas"].map(s =>
      new Promise((resolve, reject) => {
        const r = tx(s, "readwrite").clear();
        r.onsuccess = () => resolve();
        r.onerror = () => reject(r.error);
      })
    ));
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  return { open, getAll, put, get, remove, clearAll, uid };
})();
