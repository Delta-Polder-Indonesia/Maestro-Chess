import assert from "node:assert/strict";
import test from "node:test";
import { indexedDB, IDBDatabase, IDBKeyRange, IDBObjectStore } from "fake-indexeddb";
import { storageMemori } from "./bantuStorage.mjs";

const namaDb = "maestro_chess_database_v1";
const snapshotKey = "maestro-analisa-db-snapshot-v2";
const dasar = { koleksiId: "chessCom:alice", platform: "chessCom", username: "Alice", pgn: "1. e4 e5 *", timestamp: 100 };
const backup = Array.from({ length: 105 }, (_, i) => ({ ...dasar, id: `fallback-${i}`, disimpanPada: 1000 }));
backup.push({ ...dasar, id: "existing-newer", pgn: "fallback old", disimpanPada: 1000 });
backup.push({ ...dasar, id: "fallback-newer", pgn: "fallback new", disimpanPada: 3000 });
const storage = storageMemori([[snapshotKey, JSON.stringify({
  koleksi: [{ id: "chessCom:alice", platform: "chessCom", username: "Alice", terakhirDisinkronkan: 1000 }],
  partai: backup,
})]]);
globalThis.localStorage = storage;
globalThis.IDBKeyRange = IDBKeyRange;

// Database lama yang sudah mempunyai partai tidak boleh ditimpa oleh
// pemulihan cadangan yang berisi versi lebih lama dari ID yang sama.
const db = await new Promise((resolve, reject) => {
  const req = indexedDB.open(namaDb, 2);
  req.onupgradeneeded = () => {
    const s = req.result.createObjectStore("partai", { keyPath: "id" });
    for (const [nama, jalur] of [
      ["platform", "platform"], ["username", "username"], ["kombinasi", ["platform", "username"]],
      ["timestamp", "timestamp"], ["platformWaktu", ["platform", "timestamp"]],
      ["usernameWaktu", ["username", "timestamp"]], ["kombinasiWaktu", ["platform", "username", "timestamp"]],
      ["koleksiWaktu", ["koleksiId", "timestamp"]],
    ]) s.createIndex(nama, jalur);
    req.result.createObjectStore("koleksi", { keyPath: "id" });
  };
  req.onerror = () => reject(req.error);
  req.onsuccess = () => resolve(req.result);
});
await new Promise((resolve, reject) => {
  const tx = db.transaction(["partai", "koleksi"], "readwrite");
  tx.objectStore("partai").put({ ...dasar, id: "existing-newer", pgn: "indexeddb new", disimpanPada: 2000 });
  tx.objectStore("partai").put({ ...dasar, id: "fallback-newer", pgn: "indexeddb old", disimpanPada: 2000 });
  tx.objectStore("partai").put({ ...dasar, id: "existing-only", pgn: "existing", disimpanPada: 2000 });
  tx.objectStore("koleksi").put({ id: "chessCom:alice", platform: "chessCom", username: "Alice", terakhirDisinkronkan: 2000 });
  tx.oncomplete = resolve;
  tx.onerror = () => reject(tx.error);
});
db.close();
globalThis.window = { indexedDB: { open() { throw new DOMException("blocked", "SecurityError"); } } };
const basis = await import("../src/halaman/Analisa/basisData.js");

test("an inaccessible existing IndexedDB prevents a false claim of account deletion", async () => {
  const sebelum = storage.getItem(snapshotKey);
  assert.equal(await basis.hapusKoleksi("chessCom:alice"), false);
  assert.equal(storage.getItem(snapshotKey), sebelum);
});

test("failed migration retains the fallback; recovery merges every game without replacing newer IndexedDB data", async (t) => {
  globalThis.window.indexedDB = indexedDB;
  const asli = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (stores, mode, ...args) {
    if (mode === "readwrite") throw new DOMException("full", "QuotaExceededError");
    return asli.call(this, stores, mode, ...args);
  };
  t.after(() => { IDBDatabase.prototype.transaction = asli; });
  const sebelum = storage.getItem(snapshotKey);
  const sementara = await basis.ambilDaftarPartai({ koleksiId: "chessCom:alice", limit: 0 });
  assert.equal(sementara.total, 107);
  assert.equal(storage.getItem(snapshotKey), sebelum);
  assert.equal(await basis.hapusKoleksi("chessCom:alice"), false);
  IDBDatabase.prototype.transaction = asli;

  const pulih = await basis.ambilDaftarPartai({ koleksiId: "chessCom:alice", limit: 0 });
  assert.equal(pulih.total, 108);
  assert.equal(pulih.partai.find((p) => p.id === "existing-newer").pgn, "indexeddb new");
  assert.equal(pulih.partai.find((p) => p.id === "fallback-newer").pgn, "fallback new");
  assert.ok(pulih.partai.some((p) => p.id === "fallback-104"));
  assert.ok(pulih.partai.some((p) => p.id === "existing-only"));
  assert.equal((await basis.ambilSemuaKoleksi())[0].jumlahPartai, 108);
  assert.equal(storage.getItem(snapshotKey), null);
});


test("migration never erases a newer snapshot written by another browser tab", async (t) => {
  const koleksi = [{ id: "chessCom:alice", platform: "chessCom", username: "Alice" }];
  const a = { ...dasar, id: "tab-a", disimpanPada: 5000 };
  const b = { ...dasar, id: "tab-b", disimpanPada: 6000 };
  storage.setItem(snapshotKey, JSON.stringify({ koleksi, partai: [a] }));
  const modul = await import(`../src/halaman/Analisa/database/migrasi.js?race=${Date.now()}`);
  const asli = IDBObjectStore.prototype.get;
  let disisipkan = false;
  IDBObjectStore.prototype.get = function (...args) {
    if (!disisipkan && this.name === "partai") {
      disisipkan = true;
      storage.setItem(snapshotKey, JSON.stringify({ koleksi, partai: [a, b] }));
    }
    return asli.apply(this, args);
  };
  t.after(() => { IDBObjectStore.prototype.get = asli; });
  assert.ok(await modul.bukaDB());
  assert.equal(JSON.parse(storage.getItem(snapshotKey)).partai.length, 2);
  IDBObjectStore.prototype.get = asli;
  const reload = await import(`../src/halaman/Analisa/database/migrasi.js?other-tab=${Date.now()}`);
  assert.ok(await reload.bukaDB());
  assert.equal(storage.getItem(snapshotKey), null);
  assert.ok(await basis.ambilPartai("tab-a"));
  assert.ok(await basis.ambilPartai("tab-b"));
});
