import assert from "node:assert/strict";
import test from "node:test";
import { indexedDB, IDBDatabase, IDBKeyRange, IDBObjectStore } from "fake-indexeddb";
import { storageMemori } from "./bantuStorage.mjs";

const storage = storageMemori();
globalThis.localStorage = storage;
globalThis.window = { indexedDB };
globalThis.IDBKeyRange = IDBKeyRange;
const basis = await import("../src/halaman/Analisa/basisData.js");
const { bukaDB } = await import("../src/halaman/Analisa/database/migrasi.js");
const pgn = '[Event "Regression"]\n[White "Alice"]\n[Black "Bob"]\n\n1. e4 e5 *';
const game = (id) => ({ id, pgn, whiteName: "Alice", blackName: "Bob", timestamp: 1 });

const indeksDiharapkan = {
  platform: "platform",
  username: "username",
  kombinasi: ["platform", "username"],
  timestamp: "timestamp",
  platformWaktu: ["platform", "timestamp"],
  usernameWaktu: ["username", "timestamp"],
  kombinasiWaktu: ["platform", "username", "timestamp"],
  koleksiWaktu: ["koleksiId", "timestamp"],
};

test("database name, version, stores, key paths and indexes remain unchanged", async () => {
  const db = await bukaDB();
  assert.equal(db.name, "maestro_chess_database_v1");
  assert.equal(db.version, 3);
  assert.deepEqual([...db.objectStoreNames], ["koleksi", "partai"]);
  const tx = db.transaction(["partai", "koleksi"], "readonly");
  assert.equal(tx.objectStore("koleksi").keyPath, "id");
  const partai = tx.objectStore("partai");
  assert.equal(partai.keyPath, "id");
  assert.deepEqual([...partai.indexNames].sort(), Object.keys(indeksDiharapkan).sort());
  for (const [nama, keyPath] of Object.entries(indeksDiharapkan)) {
    assert.deepEqual(partai.index(nama).keyPath, keyPath, nama);
    assert.equal(partai.index(nama).unique, false, nama);
  }
});

test("committed writes notify before resolving and invalidate cached statistics", async (t) => {
  const koleksiId = "chessCom:alice";
  assert.deepEqual(await basis.hitungStatistikKoleksiRingan(koleksiId), { jumlah: 0, pemain: 0, event: 0, ukuran: 0 });
  const awal = basis.bacaRevisiBasis();
  const urutan = [];
  const transaksiAsli = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (stores, mode, ...args) {
    const tx = transaksiAsli.call(this, stores, mode, ...args);
    if (mode === "readwrite" && Array.isArray(stores) && stores.includes("partai") && stores.includes("koleksi")) {
      tx.addEventListener("complete", () => urutan.push("commit"));
    }
    return tx;
  };
  const berhentiGalat = basis.langgananRevisi(() => { urutan.push("listener-galat"); throw new Error("listener gagal"); });
  const berhenti = basis.langgananRevisi((nilai) => urutan.push(`revisi:${nilai}`));
  t.after(() => {
    IDBDatabase.prototype.transaction = transaksiAsli;
    berhentiGalat();
    berhenti();
  });

  const hasil = await basis.simpanBanyakPartai([game("committed")], { platform: "chessCom", username: "Alice" });
  urutan.push("selesai");
  IDBDatabase.prototype.transaction = transaksiAsli;
  berhentiGalat();
  berhenti();
  assert.deepEqual(hasil, { tersimpan: 1, total: 1, sementara: 0, media: "indexedDB" });
  assert.deepEqual(urutan, ["commit", "listener-galat", `revisi:${awal + 1}`, "selesai"]);
  assert.equal(basis.bacaRevisiBasis(), awal + 1);
  const tersimpan = await basis.ambilPartai("committed");
  assert.equal(tersimpan.koleksiId, koleksiId);
  assert.equal(tersimpan.pgn, pgn);
  assert.deepEqual(await basis.hitungStatistikKoleksiRingan(koleksiId), { jumlah: 1, pemain: 2, event: 1, ukuran: pgn.length });
});

test("an aborted write neither persists data nor notifies a revision", async (t) => {
  const awal = basis.bacaRevisiBasis();
  const nilai = [];
  const berhenti = basis.langgananRevisi((revisi) => nilai.push(revisi));
  const putAsli = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (...args) {
    if (this.name === "partai") throw new DOMException("full", "QuotaExceededError");
    return putAsli.apply(this, args);
  };
  t.after(() => { IDBObjectStore.prototype.put = putAsli; berhenti(); });
  const hasil = await basis.simpanBanyakPartai([game("aborted")], { platform: "chessCom", username: "Alice" });
  IDBObjectStore.prototype.put = putAsli;
  assert.deepEqual(hasil, { tersimpan: 0, total: 0, sementara: 0, media: "gagal" });
  assert.equal(basis.bacaRevisiBasis(), awal);
  assert.deepEqual(nilai, []);
  assert.equal(await basis.ambilPartai("aborted"), null);
});

test("temporary fallback writes still notify and recover without changing the stored PGN", async (t) => {
  const awal = basis.bacaRevisiBasis();
  const nilai = [];
  const berhenti = basis.langgananRevisi((revisi) => nilai.push(revisi));
  const sebelum = storage.getItem("maestro-analisa-db-snapshot-v2");
  globalThis.window.indexedDB = undefined;
  storage.gagalTulis = true;
  t.after(() => { globalThis.window.indexedDB = indexedDB; storage.gagalTulis = false; berhenti(); });

  const hasil = await basis.simpanBanyakPartai([game("fallback")], { platform: "chessCom", username: "Bob" });
  assert.deepEqual(hasil, { tersimpan: 0, total: 1, sementara: 1, media: "memori" });
  assert.equal(storage.getItem("maestro-analisa-db-snapshot-v2"), sebelum);
  assert.deepEqual(nilai, [awal + 1]);
  assert.equal((await basis.ambilPartai("fallback")).pgn, pgn);

  storage.gagalTulis = false;
  globalThis.window.indexedDB = indexedDB;
  const dipulihkan = await basis.ambilPartai("fallback");
  assert.equal(dipulihkan.pgn, pgn);
  assert.equal(dipulihkan.koleksiId, "chessCom:bob");
  assert.equal(basis.bacaRevisiBasis(), awal + 1);
});

test("a committed deletion still notifies when fallback cleanup fails", async (t) => {
  const koleksiId = "chessCom:partial";
  await basis.simpanBanyakPartai([game("partial-delete")], { platform: "chessCom", username: "Partial" });
  const awal = basis.bacaRevisiBasis();
  const urutan = [];
  const transaksiAsli = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (stores, mode, ...args) {
    const tx = transaksiAsli.call(this, stores, mode, ...args);
    if (mode === "readwrite" && Array.isArray(stores) && stores.includes("partai") && stores.includes("koleksi")) {
      tx.addEventListener("complete", () => { urutan.push("commit"); storage.gagalBaca = true; });
    }
    return tx;
  };
  const berhenti = basis.langgananRevisi((nilai) => urutan.push(`revisi:${nilai}`));
  t.after(() => { IDBDatabase.prototype.transaction = transaksiAsli; storage.gagalBaca = false; berhenti(); });

  const berhasil = await basis.hapusKoleksi(koleksiId);
  urutan.push("selesai");
  IDBDatabase.prototype.transaction = transaksiAsli;
  storage.gagalBaca = false;
  berhenti();
  assert.equal(berhasil, false);
  assert.deepEqual(urutan, ["commit", `revisi:${awal + 1}`, "selesai"]);
  assert.equal(basis.bacaRevisiBasis(), awal + 1);
  assert.equal(await basis.ambilPartai("partial-delete"), null);
});
