import assert from "node:assert/strict";
import test from "node:test";
import { buatPenyimpananPekerjaan, ID_DRAF_IMPOR, simpanDrafImpor } from "../src/halaman/Analisa/pekerjaan.js";
import { tangkapGalatDiuji } from "./bantuGalat.mjs";

function tertunda() {
  let resolve;
  let reject;
  const promise = new Promise((sukses, gagal) => { resolve = sukses; reject = gagal; });
  return { promise, resolve, reject };
}

function adapterMemori(records = []) {
  const isi = new Map(records.map((record) => [record.id, structuredClone(record)]));
  const metadata = new Map(records.map((record) => [record.id, {
    id: record.id, jenis: record.jenis, judul: record.judul ?? "", status: record.status ?? "",
    format: record.sumber?.format ?? "", adaHasil: Boolean(record.snapshot), waktu: record.waktu ?? 0,
  }]));
  return {
    isi, metadata,
    async daftar() { return structuredClone([...metadata.values()]); },
    async ambil(id) { return structuredClone(isi.get(id) ?? null); },
    async simpan(record, meta) { isi.set(record.id, structuredClone(record)); metadata.set(meta.id, structuredClone(meta)); },
    async hapus(id) { isi.delete(id); metadata.delete(id); },
  };
}

const laporan = (id, judul, waktu) => ({ id, jenis: "laporan", judul, status: "berjalan", sumber: { format: "pgn", string: "1. e4 *" }, waktu });

test("invalid writes and empty deletes are ignored without initializing storage", async () => {
  const adapter = adapterMemori();
  let calls = 0;
  adapter.daftar = async () => { calls++; return []; };
  const store = buatPenyimpananPekerjaan(adapter);
  assert.deepEqual(store.snapshot(), {
    siap: false, tersedia: true, menyimpan: false, daftar: [], terakhirId: null, terakhirDrafId: null,
    aktif: { id: null, digunakan: false, berjalan: false },
  });
  store.simpan(null);
  store.simpan({ id: "", jenis: "laporan" });
  store.simpan({ id: "unknown", jenis: "penunjuk" });
  store.hapus("");
  store.tetapkanDrafAktif(null);
  await store.tungguTulis();
  assert.equal(calls, 0);
  assert.equal(store.snapshot().siap, false);
  assert.deepEqual(store.snapshot().daftar, []);
});

test("one writer serializes different jobs and coalesces updates and deletion per id", async () => {
  const adapter = adapterMemori([laporan("b", "Stored B", 0)]);
  const tulis = adapter.simpan.bind(adapter);
  const hapus = adapter.hapus.bind(adapter);
  const firstStarted = tertunda();
  const releaseFirst = tertunda();
  const events = [];
  adapter.simpan = async (record, metadata) => {
    events.push(`save:${record.id}:${record.judul}`);
    if (record.id === "a" && record.judul === "First") {
      firstStarted.resolve();
      await releaseFirst.promise;
    }
    await tulis(record, metadata);
  };
  adapter.hapus = async (id) => { events.push(`delete:${id}`); await hapus(id); };
  const store = buatPenyimpananPekerjaan(adapter);
  store.simpan(laporan("a", "First", 1));
  await firstStarted.promise;
  store.simpan(laporan("b", "Queued B", 2));
  store.simpan(laporan("a", "Second", 3));
  store.hapus("b");
  store.simpan(laporan("a", "Latest", 4));
  store.simpan(laporan("c", "Other", 5));
  assert.equal(store.snapshot().menyimpan, true);
  assert.equal((await store.ambil("a")).judul, "Latest");
  assert.equal(await store.ambil("b"), null);
  assert.deepEqual(store.snapshot().daftar.map((item) => item.id), ["c", "a"]);
  assert.deepEqual(events, ["save:a:First"]);

  releaseFirst.resolve();
  await store.tungguTulis();
  assert.deepEqual(events, ["save:a:First", "delete:b", "save:a:Latest", "save:c:Other"]);
  assert.equal(adapter.isi.get("a").judul, "Latest");
  assert.equal(adapter.isi.has("b"), false);
  assert.equal(adapter.isi.get("c").judul, "Other");
  assert.equal(store.snapshot().menyimpan, false);
});

test("before initialization completes the final save/delete for each id wins without losing other jobs", async () => {
  const adapter = adapterMemori([laporan("a", "Old A", 1), laporan("b", "Old B", 2), laporan("c", "Unchanged", 3)]);
  const read = adapter.daftar.bind(adapter);
  const release = tertunda();
  const started = tertunda();
  const events = [];
  adapter.daftar = async () => { started.resolve(); await release.promise; return read(); };
  const tulis = adapter.simpan.bind(adapter);
  const hapus = adapter.hapus.bind(adapter);
  adapter.simpan = async (record, meta) => { events.push(`save:${record.id}:${record.judul}`); await tulis(record, meta); };
  adapter.hapus = async (id) => { events.push(`delete:${id}`); await hapus(id); };
  const store = buatPenyimpananPekerjaan(adapter);
  const init = store.init();
  await started.promise;
  store.simpan(laporan("a", "Canceled A", 10));
  store.hapus("a");
  store.hapus("b");
  store.simpan(laporan("b", "Final B", 11));
  release.resolve();
  await init;
  await store.tungguTulis();
  assert.deepEqual(events, ["delete:a", "save:b:Final B"]);
  assert.deepEqual(store.snapshot().daftar.map(({ id, judul }) => [id, judul]), [["b", "Final B"], ["c", "Unchanged"]]);
  assert.equal(adapter.isi.has("a"), false);
  assert.equal(adapter.isi.get("b").judul, "Final B");
  assert.equal(adapter.isi.get("c").judul, "Unchanged");
});

test("a delayed content read cannot resurrect a deleted job or overwrite a newer edit", async () => {
  const oldA = laporan("a", "Old A", 1);
  const oldB = laporan("b", "Old B", 2);
  const adapter = adapterMemori([oldA, oldB, laporan("c", "Other", 3)]);
  const readA = tertunda();
  const readB = tertunda();
  const startedA = tertunda();
  const startedB = tertunda();
  const original = adapter.ambil.bind(adapter);
  adapter.ambil = async (id) => {
    if (id === "a") { startedA.resolve(); return readA.promise; }
    if (id === "b") { startedB.resolve(); return readB.promise; }
    return original(id);
  };
  const store = buatPenyimpananPekerjaan(adapter);
  await store.init();
  const a = store.ambil("a");
  const b = store.ambil("b");
  await Promise.all([startedA.promise, startedB.promise]);
  store.simpan(laporan("a", "New A", 10));
  store.hapus("b");
  readA.resolve(oldA);
  readB.resolve(oldB);
  assert.equal((await a).judul, "New A");
  assert.equal(await b, null);
  assert.equal((await store.ambil("c")).judul, "Other");
  await store.tungguTulis();
  assert.equal(adapter.isi.get("a").judul, "New A");
  assert.equal(adapter.isi.has("b"), false);
});

test("a missing record is cached as null until this store explicitly saves it", async () => {
  const adapter = adapterMemori();
  const read = adapter.ambil.bind(adapter);
  let calls = 0;
  adapter.ambil = async (id) => { calls++; return read(id); };
  const store = buatPenyimpananPekerjaan(adapter);
  await store.init();
  assert.equal(await store.ambil("a"), null);
  await adapter.simpan(laporan("a", "Externally written", 1), { id: "a", jenis: "laporan" });
  assert.equal(await store.ambil("a"), null);
  assert.equal(calls, 1);
  store.simpan(laporan("a", "Locally written", 2));
  assert.equal((await store.ambil("a")).judul, "Locally written");
  await store.tungguTulis();
  assert.equal(adapter.isi.get("a").judul, "Locally written");
});

test("pointer changes during initialization beat old metadata independently for reports and drafts", async () => {
  const release = tertunda();
  const adapter = adapterMemori();
  adapter.daftar = async () => {
    await release.promise;
    return [
      { id: "meta:laporan-aktif", jenis: "penunjuk", laporanId: "laporan:lama" },
      { id: "meta:draf-aktif", jenis: "penunjuk", drafId: "draf:lama" },
    ];
  };
  const store = buatPenyimpananPekerjaan(adapter);
  const init = store.init();
  store.tetapkanAktif({ id: "laporan:baru", digunakan: true, berjalan: true });
  store.tetapkanDrafAktif("draf:baru");
  release.resolve();
  await init;
  await store.tungguTulis();
  assert.equal(store.snapshot().terakhirId, "laporan:baru");
  assert.equal(store.snapshot().terakhirDrafId, "draf:baru");
  assert.deepEqual(store.snapshot().aktif, { id: "laporan:baru", digunakan: true, berjalan: true });
  assert.deepEqual(adapter.metadata.get("meta:laporan-aktif"), { id: "meta:laporan-aktif", jenis: "penunjuk", laporanId: "laporan:baru" });
  assert.deepEqual(adapter.metadata.get("meta:draf-aktif"), { id: "meta:draf-aktif", jenis: "penunjuk", drafId: "draf:baru" });
  store.tetapkanAktif(null);
  assert.equal(store.snapshot().terakhirId, "laporan:baru");
  assert.equal(store.snapshot().terakhirDrafId, "draf:baru");
});

test("a failed write does not prevent later jobs from being saved, but the failure warning persists", async (tes) => {
  const errors = tangkapGalatDiuji(tes, "Gagal menyimpan atau menghapus pekerjaan Analisa:");
  const adapter = adapterMemori();
  const tulis = adapter.simpan.bind(adapter);
  const calls = [];
  adapter.simpan = async (record, meta) => {
    calls.push(record.id);
    if (record.id === "a") throw new Error("write A failed");
    await tulis(record, meta);
  };
  const store = buatPenyimpananPekerjaan(adapter);
  store.simpan(laporan("a", "A", 1));
  store.simpan(laporan("b", "B", 2));
  await store.tungguTulis();
  assert.deepEqual(calls, ["a", "b"]);
  assert.equal((await store.ambil("a")).judul, "A");
  assert.equal(adapter.isi.has("a"), false);
  assert.equal(adapter.isi.get("b").judul, "B");
  assert.equal(store.snapshot().tersedia, false);
  assert.equal(store.snapshot().menyimpan, false);
  assert.equal(errors.length, 1);
});

test("listener failure is isolated and unsubscribing stops future notifications", async (tes) => {
  const errors = tangkapGalatDiuji(tes, "Pelanggan penyimpanan pekerjaan gagal:");
  const store = buatPenyimpananPekerjaan(adapterMemori());
  let baik = 0;
  const buangBuruk = store.langganan(() => { throw new Error("listener failed"); });
  const buangBaik = store.langganan(() => { baik++; });
  const awal = store.snapshot();
  await store.init();
  assert.notStrictEqual(store.snapshot(), awal);
  assert.equal(baik, 1);
  assert.equal(errors.length, 1);
  buangBuruk();
  store.simpan(laporan("a", "A", 1));
  await store.tungguTulis();
  assert.equal(errors.length, 1);
  assert.ok(baik >= 3);
  buangBaik();
  const jumlah = baik;
  store.hapus("a");
  await store.tungguTulis();
  assert.equal(baik, jumlah);
});

test("draft serialization keeps raw fields, normalizes type/title, and deletes only an empty draft", () => {
  const events = [];
  const store = { simpan: (record) => events.push(["save", record]), hapus: (id) => events.push(["delete", id]) };
  const raw = "  Contoh\n\tpartai   dengan spasi  ";
  simpanDrafImpor({ tipe: "online", tautan: raw, pgn: " PGN ", fen: " FEN " }, "draf:a", store);
  const [kind, record] = events[0];
  assert.equal(kind, "save");
  assert.equal(record.id, "draf:a");
  assert.equal(record.jenis, "draf");
  assert.equal(record.status, "draf");
  assert.equal(record.judul, "Contoh partai dengan spasi");
  assert.deepEqual(record.isi, { tipe: "online", pgn: " PGN ", fen: " FEN ", tautan: raw });
  assert.equal(Number.isFinite(record.waktu), true);
  simpanDrafImpor({ tipe: "tidak-dikenal", pgn: " " }, undefined, store);
  assert.equal(events[1][1].id, ID_DRAF_IMPOR);
  assert.equal(events[1][1].isi.tipe, "pgn");
  assert.equal(events[1][1].judul, "");
  simpanDrafImpor({}, "draf:b", store);
  assert.deepEqual(events[2], ["delete", "draf:b"]);
});
