import assert from "node:assert/strict";
import test from "node:test";
import { IDBDatabase, IDBFactory, forceCloseDatabase } from "fake-indexeddb";
import { buatAdapterPekerjaan, buatPenyimpananPekerjaan } from "../src/halaman/Analisa/pekerjaan.js";
import { tangkapGalatDiuji } from "./bantuGalat.mjs";

const NAMA = "maestro_chess_pekerjaan_v1";
const STORE = ["daftar", "isi"];

function buka(factory, upgrade) {
  return new Promise((resolve, reject) => {
    const request = factory.open(NAMA, 1);
    if (upgrade) request.onupgradeneeded = () => upgrade(request.result);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function isiLama(factory, daftar, isi) {
  const db = await buka(factory, (database) => {
    database.createObjectStore("daftar", { keyPath: "id" });
    database.createObjectStore("isi", { keyPath: "id" });
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    for (const record of daftar) tx.objectStore("daftar").put(record);
    for (const record of isi) tx.objectStore("isi").put(record);
    tx.oncomplete = resolve;
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
  db.close();
}

async function bacaMentah(factory) {
  const db = await buka(factory);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const daftar = tx.objectStore("daftar").getAll();
      const isi = tx.objectStore("isi").getAll();
      tx.oncomplete = () => resolve({ daftar: daftar.result, isi: isi.result });
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const laporan = (id, status = "berjalan", waktu = 1) => ({
  id, jenis: "laporan", judul: `Judul ${id}`, status,
  sumber: { format: "pgn", string: "1. e4 e5 *" }, waktu,
});

test("the adapter creates the existing database version, stores, key paths and no indexes", async () => {
  const factory = new IDBFactory();
  const adapter = buatAdapterPekerjaan(factory);
  assert.deepEqual(await adapter.daftar(), []);
  const db = await buka(factory);
  try {
    assert.equal(db.name, NAMA);
    assert.equal(db.version, 1);
    assert.deepEqual([...db.objectStoreNames].sort(), STORE);
    const tx = db.transaction(STORE, "readonly");
    for (const nama of STORE) {
      assert.equal(tx.objectStore(nama).keyPath, "id");
      assert.deepEqual([...tx.objectStore(nama).indexNames], []);
    }
    assert.deepEqual((await factory.databases()).map(({ name, version }) => ({ name, version })), [{ name: NAMA, version: 1 }]);
  } finally { db.close(); }
});

test("a pre-existing v1 fixture, including report and draft pointers, survives read, update and deletion", async () => {
  const factory = new IDBFactory();
  const metaA = { id: "laporan:lama", jenis: "laporan", judul: "Laporan lama", status: "berjalan", format: "pgn", adaHasil: true, waktu: 10 };
  const metaB = { id: "draf:lama", jenis: "draf", judul: "Draf lama", status: "draf", format: "fen", adaHasil: false, waktu: 20 };
  const pointerA = { id: "meta:laporan-aktif", jenis: "penunjuk", laporanId: "laporan:lama" };
  const pointerB = { id: "meta:draf-aktif", jenis: "penunjuk", drafId: "draf:lama" };
  const tidakDikenal = { id: "lama:lain", jenis: "tidak-dikenal", data: 12 };
  const isiA = { ...metaA, sumber: { format: "pgn", string: "1. e4 e5 *" }, snapshot: { versi: 1, game: [{ fen: "fixture-lama" }] }, kedalamanDiminta: 12 };
  const isiB = { ...metaB, isi: { tipe: "fen", pgn: "", fen: "fixture-fen", tautan: "" } };
  await isiLama(factory, [metaA, metaB, pointerA, pointerB, tidakDikenal], [isiA, isiB, pointerA, pointerB, tidakDikenal]);

  const store = buatPenyimpananPekerjaan(buatAdapterPekerjaan(factory));
  await store.init();
  assert.equal(store.snapshot().tersedia, true);
  assert.equal(store.snapshot().terakhirId, "laporan:lama");
  assert.equal(store.snapshot().terakhirDrafId, "draf:lama");
  assert.deepEqual(store.snapshot().daftar, [metaB, metaA]);
  assert.deepEqual(await store.ambil(metaA.id), isiA);
  assert.deepEqual(await store.ambil(metaB.id), isiB);

  store.simpan({ ...isiA, status: "terputus", waktu: 30 });
  await store.tungguTulis();
  assert.equal((await store.ambil(metaA.id)).status, "terputus");
  store.simpan({ ...isiA, status: "selesai", waktu: 40 });
  store.hapus(metaB.id);
  await store.tungguTulis();
  const raw = await bacaMentah(factory);
  assert.deepEqual(raw.daftar.find((record) => record.id === metaA.id), { ...metaA, status: "selesai", waktu: 40 });
  assert.deepEqual(raw.isi.find((record) => record.id === metaA.id), { ...isiA, status: "selesai", waktu: 40 });
  assert.equal(raw.daftar.some((record) => record.id === metaB.id), false);
  assert.equal(raw.isi.some((record) => record.id === metaB.id), false);
  for (const record of [pointerA, pointerB, tidakDikenal]) {
    assert.deepEqual(raw.daftar.find((item) => item.id === record.id), record);
    assert.deepEqual(raw.isi.find((item) => item.id === record.id), record);
  }
  const reload = buatPenyimpananPekerjaan(buatAdapterPekerjaan(factory));
  await reload.init();
  assert.deepEqual(reload.snapshot().daftar.map(({ id, status }) => [id, status]), [[metaA.id, "selesai"]]);
  assert.equal(await reload.ambil(metaB.id), null);
  assert.deepEqual(await reload.ambil(metaA.id), { ...isiA, status: "selesai", waktu: 40 });
});

test("record normalization writes the same metadata to daftar and the complete record to isi", async () => {
  const factory = new IDBFactory();
  const store = buatPenyimpananPekerjaan(buatAdapterPekerjaan(factory));
  const source = { id: "laporan:1", jenis: "laporan", judul: 123, status: 4, sumber: { format: "pgn", string: "1. e4 *" }, snapshot: { versi: 1 }, waktu: 1234, extra: [1, 2] };
  store.simpan(source);
  store.simpan({ id: "fitur:impor:draf:1", jenis: "fitur", fitur: "impor", targetId: "draf:1", waktu: 1200 });
  await store.tungguTulis();
  const raw = await bacaMentah(factory);
  const expected = { id: "laporan:1", jenis: "laporan", judul: "123", status: "4", format: "pgn", adaHasil: true, waktu: 1234 };
  assert.deepEqual(raw.daftar.find((item) => item.id === source.id), expected);
  assert.deepEqual(raw.isi.find((item) => item.id === source.id), { ...source, ...expected });
  assert.deepEqual(raw.daftar.find((item) => item.jenis === "fitur"), {
    id: "fitur:impor:draf:1", jenis: "fitur", judul: "", status: "", format: "", adaHasil: false, waktu: 1200, fitur: "impor", targetId: "draf:1",
  });
  assert.deepEqual(store.snapshot().daftar.map((item) => item.id), ["laporan:1", "fitur:impor:draf:1"]);
});

test("a DataCloneError rolls back the metadata and content in one fake IndexedDB transaction", async () => {
  const factory = new IDBFactory();
  const adapter = buatAdapterPekerjaan(factory);
  const metadata = { id: "laporan:atomik", judul: "Sebelum" };
  const record = { id: "laporan:atomik", teks: "Sebelum" };
  await adapter.simpan(record, metadata);
  await assert.rejects(adapter.simpan({ ...record, teks: "Sesudah", tidakDapatDisalin: () => {} }, { ...metadata, judul: "Sesudah" }),
    (error) => error.name === "DataCloneError");
  const raw = await bacaMentah(factory);
  assert.deepEqual(raw.daftar, [metadata]);
  assert.deepEqual(raw.isi, [record]);
});

test("concurrent operations share an open and a closed connection is reopened", async () => {
  const factory = new IDBFactory();
  const koneksi = [];
  const opens = [];
  const source = { open(name, version) {
    opens.push([name, version]);
    const request = factory.open(name, version);
    request.addEventListener("success", () => koneksi.push(request.result));
    return request;
  } };
  const adapter = buatAdapterPekerjaan(source);
  assert.deepEqual(await Promise.all([adapter.daftar(), adapter.ambil("tidak-ada")]), [[], null]);
  assert.deepEqual(opens, [[NAMA, 1]]);
  await new Promise((resolve) => {
    koneksi[0].addEventListener("close", resolve, { once: true });
    forceCloseDatabase(koneksi[0]);
  });
  assert.deepEqual(await adapter.daftar(), []);
  assert.deepEqual(opens, [[NAMA, 1], [NAMA, 1]]);
});

test("blocked open keeps memory usable, closes a late connection and leaves failure status sticky", async (tes) => {
  const errors = tangkapGalatDiuji(tes, "Gagal membaca daftar pekerjaan Analisa:");
  const factory = new IDBFactory();
  const late = {};
  let closes = 0;
  let opens = 0;
  const source = { open(name, version) {
    opens++;
    if (opens === 1) {
      queueMicrotask(() => late.onblocked());
      return late;
    }
    return factory.open(name, version);
  } };
  const store = buatPenyimpananPekerjaan(buatAdapterPekerjaan(source, 100));
  const init = store.init();
  assert.strictEqual(store.init(), init);
  await init;
  assert.equal(store.snapshot().siap, true);
  assert.equal(store.snapshot().tersedia, false);
  assert.match(String(errors[0][1]), /diblokir tab lain/);
  late.result = { close() { closes++; } };
  late.onsuccess();
  assert.equal(closes, 1);

  store.simpan(laporan("laporan:blokir"));
  assert.equal((await store.ambil("laporan:blokir")).status, "berjalan");
  await store.tungguTulis();
  assert.equal(opens, 2);
  assert.equal(store.snapshot().tersedia, false, "a later successful write does not reset the warning in this instance");
  assert.equal((await bacaMentah(factory)).isi[0].id, "laporan:blokir");
  const reopened = buatPenyimpananPekerjaan(buatAdapterPekerjaan(factory));
  await reopened.init();
  assert.equal(reopened.snapshot().tersedia, true);
  assert.equal((await reopened.ambil("laporan:blokir")).status, "berjalan");
});

test("quota failure keeps unsaved work in memory and does not automatically retry it after another write", async (tes) => {
  const errors = tangkapGalatDiuji(tes, "Gagal menyimpan atau menghapus pekerjaan Analisa:");
  const factory = new IDBFactory();
  const store = buatPenyimpananPekerjaan(buatAdapterPekerjaan(factory));
  await store.init();
  const original = IDBDatabase.prototype.transaction;
  let quota = true;
  IDBDatabase.prototype.transaction = function (names, mode, ...args) {
    if (this.name === NAMA && mode === "readwrite" && quota) throw new DOMException("Storage full", "QuotaExceededError");
    return original.call(this, names, mode, ...args);
  };
  tes.after(() => { IDBDatabase.prototype.transaction = original; });
  store.simpan(laporan("laporan:tidak-tersimpan"));
  await store.tungguTulis();
  assert.equal(store.snapshot().tersedia, false);
  assert.equal(store.snapshot().menyimpan, false);
  assert.equal((await store.ambil("laporan:tidak-tersimpan")).id, "laporan:tidak-tersimpan");
  assert.equal(errors[0][1].name, "QuotaExceededError");

  quota = false;
  store.simpan(laporan("laporan:lain"));
  await store.tungguTulis();
  assert.equal(store.snapshot().tersedia, false);
  const raw = await bacaMentah(factory);
  assert.deepEqual(raw.daftar.map((item) => item.id), ["laporan:lain"]);
  assert.deepEqual(raw.isi.map((item) => item.id), ["laporan:lain"]);
  const reload = buatPenyimpananPekerjaan(buatAdapterPekerjaan(factory));
  await reload.init();
  assert.equal(reload.snapshot().tersedia, true);
  assert.equal(await reload.ambil("laporan:tidak-tersimpan"), null);
  assert.equal((await reload.ambil("laporan:lain")).id, "laporan:lain");
});

test("failed deletion remains deleted in memory but the old persistent record survives reload", async (tes) => {
  const errors = tangkapGalatDiuji(tes, "Gagal menyimpan atau menghapus pekerjaan Analisa:");
  const factory = new IDBFactory();
  const adapter = buatAdapterPekerjaan(factory);
  const store = buatPenyimpananPekerjaan(adapter);
  store.simpan(laporan("laporan:hapus"));
  await store.tungguTulis();
  const original = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (names, mode, ...args) {
    if (this.name === NAMA && mode === "readwrite") throw new DOMException("Blocked", "SecurityError");
    return original.call(this, names, mode, ...args);
  };
  tes.after(() => { IDBDatabase.prototype.transaction = original; });
  store.hapus("laporan:hapus");
  await store.tungguTulis();
  assert.equal(await store.ambil("laporan:hapus"), null);
  assert.deepEqual(store.snapshot().daftar, []);
  assert.equal(store.snapshot().tersedia, false);
  assert.equal(errors[0][1].name, "SecurityError");
  const reload = buatPenyimpananPekerjaan(buatAdapterPekerjaan(factory));
  await reload.init();
  assert.equal((await reload.ambil("laporan:hapus")).status, "berjalan");
});

test("two independent stores use last-write-wins persistence without synchronizing their memory", async () => {
  const factory = new IDBFactory();
  const a = buatPenyimpananPekerjaan(buatAdapterPekerjaan(factory));
  const b = buatPenyimpananPekerjaan(buatAdapterPekerjaan(factory));
  await Promise.all([a.init(), b.init()]);
  let notificationsA = 0;
  const unsubscribe = a.langganan(() => { notificationsA++; });
  a.simpan({ ...laporan("laporan:sama"), judul: "Tab A" });
  await a.tungguTulis();
  const before = notificationsA;
  b.simpan({ ...laporan("laporan:sama"), judul: "Tab B" });
  await b.tungguTulis();
  assert.equal(notificationsA, before);
  assert.equal((await a.ambil("laporan:sama")).judul, "Tab A");
  assert.equal((await b.ambil("laporan:sama")).judul, "Tab B");
  const reload = buatPenyimpananPekerjaan(buatAdapterPekerjaan(factory));
  await reload.init();
  assert.equal((await reload.ambil("laporan:sama")).judul, "Tab B");
  unsubscribe();
});

test("a content read failure is not negatively cached and may be retried", async (tes) => {
  const errors = tangkapGalatDiuji(tes, "Gagal membaca pekerjaan Analisa:");
  const factory = new IDBFactory();
  const adapter = buatAdapterPekerjaan(factory);
  const initial = buatPenyimpananPekerjaan(adapter);
  initial.simpan(laporan("laporan:baca"));
  await initial.tungguTulis();
  let calls = 0;
  const failedOnce = { ...adapter, async ambil(id) {
    calls++;
    if (calls === 1) throw new DOMException("Read blocked", "SecurityError");
    return adapter.ambil(id);
  } };
  const store = buatPenyimpananPekerjaan(failedOnce);
  await store.init();
  assert.equal(await store.ambil("laporan:baca"), null);
  assert.equal(store.snapshot().tersedia, false);
  assert.equal((await store.ambil("laporan:baca")).id, "laporan:baca");
  assert.equal((await store.ambil("laporan:baca")).id, "laporan:baca");
  assert.equal(calls, 2);
  assert.equal(errors[0][1].name, "SecurityError");
  assert.equal(store.snapshot().tersedia, false);
});
