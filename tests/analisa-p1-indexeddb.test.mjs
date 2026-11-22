import assert from "node:assert/strict";
import test from "node:test";
import { indexedDB, IDBDatabase, IDBKeyRange, IDBObjectStore } from "fake-indexeddb";
import { storageMemori } from "./bantuStorage.mjs";

const prefix = "maestro-analisa-db-";
const storage = storageMemori();
globalThis.localStorage = storage;
globalThis.window = { indexedDB };
globalThis.IDBKeyRange = IDBKeyRange;
const basis = await import("../src/halaman/Analisa/basisData.js");
const { muatPartaiChessCom, muatPartaiLichess } = await import("../src/halaman/Analisa/akun/muatPartaiAkun.js");
const { mulaiPenghapusanAkun } = await import("../src/halaman/Analisa/akun/koordinasiAkun.js");
const { hapusDariDaftar } = await import("../src/halaman/Analisa/akun/daftarAkun.js");
const pgn = '[White "Alice"]\n[Black "Bob"]\n\n1. e4 e5 *';
const game = (id) => ({ id, pgn, whiteName: "Alice", blackName: "Bob", timestamp: 1 });
const isAbort = (error) => error?.name === "AbortError";

test("IndexedDB success reports committed records only", async () => {
  const hasil = await basis.simpanBanyakPartai([game("one"), game("two")], { platform: "chessCom", username: "Alice" });
  assert.deepEqual(hasil, { tersimpan: 2, total: 2, sementara: 0, media: "indexedDB" });
  assert.equal((await basis.ambilDaftarPartai({ koleksiId: "chessCom:alice" })).total, 2);
});

test("a synchronous failure after the first put aborts the whole IndexedDB transaction", async (t) => {
  const asli = IDBObjectStore.prototype.put;
  let panggilan = 0;
  IDBObjectStore.prototype.put = function (...args) {
    if (this.name === "partai" && ++panggilan === 2) throw new DOMException("full", "QuotaExceededError");
    return asli.apply(this, args);
  };
  t.after(() => { IDBObjectStore.prototype.put = asli; });
  const hasil = await basis.simpanBanyakPartai([game("partial-one"), game("partial-two")], { platform: "chessCom", username: "Alice" });
  assert.deepEqual(hasil, { tersimpan: 0, total: 0, sementara: 0, media: "gagal" });
  assert.equal(await basis.ambilPartai("partial-one"), null);
  assert.equal(await basis.ambilPartai("partial-two"), null);
});

test("a collection metadata failure in an IndexedDB callback also rolls back all game writes", async (t) => {
  const asli = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (...args) {
    if (this.name === "koleksi") throw new DOMException("full", "QuotaExceededError");
    return asli.apply(this, args);
  };
  t.after(() => { IDBObjectStore.prototype.put = asli; });
  const hasil = await basis.simpanBanyakPartai([game("failed-metadata")], { platform: "chessCom", username: "Alice" });
  assert.equal(hasil.tersimpan, 0);
  assert.equal(hasil.media, "gagal");
  assert.equal(await basis.ambilPartai("failed-metadata"), null);
});

test("collection deletion aborts rather than committing only its metadata when cursor setup fails", async (t) => {
  const asli = IDBObjectStore.prototype.openCursor;
  IDBObjectStore.prototype.openCursor = function (...args) {
    if (this.name === "partai") throw new DOMException("cursor failed", "InvalidStateError");
    return asli.apply(this, args);
  };
  t.after(() => { IDBObjectStore.prototype.openCursor = asli; });
  assert.equal(await basis.hapusKoleksi("chessCom:alice"), false);
  assert.equal((await basis.ambilSemuaKoleksi()).some((k) => k.id === "chessCom:alice"), true);
  assert.ok(await basis.ambilPartai("one"));
});

test("transaction abort returns failure and cannot persist partial games", async (t) => {
  const asli = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (stores, mode, ...args) {
    const tx = asli.call(this, stores, mode, ...args);
    if (mode === "readwrite") queueMicrotask(() => tx.abort());
    return tx;
  };
  t.after(() => { IDBDatabase.prototype.transaction = asli; });
  const hasil = await basis.simpanBanyakPartai([game("aborted")], { platform: "chessCom", username: "Alice" });
  assert.equal(hasil.tersimpan, 0);
  assert.equal(hasil.media, "gagal");
  assert.equal(await basis.ambilPartai("aborted"), null);
});

test("successful account deletion also removes old fallback data while IndexedDB is active", async () => {
  storage.setItem(`${prefix}koleksi`, JSON.stringify([{ id: "chessCom:alice" }, { id: "chessCom:bob" }]));
  storage.setItem(`${prefix}partai`, JSON.stringify([
    { id: "backup-alice", koleksiId: "chessCom:alice", pgn: "1. e4 *" },
    { id: "backup-bob", koleksiId: "chessCom:bob", pgn: "1. d4 *" },
  ]));
  assert.equal(await basis.hapusKoleksi("chessCom:alice"), true);
  assert.equal((await basis.ambilDaftarPartai({ koleksiId: "chessCom:alice" })).total, 0);
  assert.equal(storage.getItem(`${prefix}koleksi`), null);
  assert.equal(storage.getItem(`${prefix}partai`), null);
  // Pemulihan menggabungkan cadangan ke IndexedDB sebelum penghapusan;
  // data akun lain tetap ada meski snapshot sudah tidak diperlukan.
  assert.equal(storage.getItem(`${prefix}snapshot-v2`), null);
  assert.equal(await basis.ambilPartai("backup-alice"), null);
  assert.ok(await basis.ambilPartai("backup-bob"));
});

test("failed IndexedDB deletion does not erase the fallback or report success", async (t) => {
  await basis.simpanBanyakPartai([game("bob-game")], { platform: "chessCom", username: "Bob" });
  const sebelumnya = storage.getItem(`${prefix}snapshot-v2`);
  const asli = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (stores, mode, ...args) {
    if (mode === "readwrite") throw new DOMException("full", "QuotaExceededError");
    return asli.call(this, stores, mode, ...args);
  };
  t.after(() => { IDBDatabase.prototype.transaction = asli; });
  assert.equal(await basis.hapusKoleksi("chessCom:bob"), false);
  assert.equal(storage.getItem(`${prefix}snapshot-v2`), sebelumnya);
  assert.equal((await basis.ambilDaftarPartai({ koleksiId: "chessCom:bob" })).total, 2);
});

test("account list remains intact when reading or writing the deletion fails", (t) => {
  const key = "maestro-analisa-daftar-akun";
  const akun = [{ platform: "chessCom", username: "Alice" }, { platform: "chessCom", username: "Bob" }];
  storage.setItem(key, JSON.stringify(akun));
  const consoleAsli = console.error;
  console.error = () => {};
  t.after(() => { console.error = consoleAsli; storage.gagalBaca = false; storage.gagalTulis = false; });
  storage.gagalTulis = true;
  assert.equal(hapusDariDaftar("chessCom", "Alice").tersimpan, false);
  storage.gagalTulis = false;
  assert.deepEqual(JSON.parse(storage.getItem(key)), akun);
  storage.gagalBaca = true;
  assert.equal(hapusDariDaftar("chessCom", "Alice").tersimpan, false);
  storage.gagalBaca = false;
  assert.deepEqual(JSON.parse(storage.getItem(key)), akun);
  assert.deepEqual(hapusDariDaftar("chessCom", "Alice"), { tersimpan: true, daftar: [akun[1]] });
});

test("a failed database write propagates separately from a successful Chess.com download", async (t) => {
  const asliFetch = globalThis.fetch;
  const asliTx = IDBDatabase.prototype.transaction;
  t.after(() => { globalThis.fetch = asliFetch; IDBDatabase.prototype.transaction = asliTx; });
  IDBDatabase.prototype.transaction = function (stores, mode, ...args) {
    if (mode === "readwrite") throw new DOMException("full", "QuotaExceededError");
    return asliTx.call(this, stores, mode, ...args);
  };
  globalThis.fetch = async (url) => url.endsWith("/archives")
    ? { ok: true, json: async () => ({ archives: ["https://api.chess.com/pub/player/alice/games/2026/11"] }) }
    : { ok: true, json: async () => ({ games: [{ pgn, url: "https://www.chess.com/game/live/987", white: { username: "Alice" }, black: { username: "Bob" } }] }) };
  const hasil = await muatPartaiChessCom("Alice", { paksa: true });
  assert.equal(hasil.partai.length, 1);
  assert.deepEqual(hasil.penyimpanan, { tersimpan: 0, total: 0, sementara: 0, media: "gagal" });
});

test("a failed database write propagates separately from a successful Lichess download", async (t) => {
  const asliFetch = globalThis.fetch;
  const asliTx = IDBDatabase.prototype.transaction;
  t.after(() => { globalThis.fetch = asliFetch; IDBDatabase.prototype.transaction = asliTx; });
  IDBDatabase.prototype.transaction = function (stores, mode, ...args) {
    if (mode === "readwrite") throw new DOMException("full", "QuotaExceededError");
    return asliTx.call(this, stores, mode, ...args);
  };
  globalThis.fetch = async () => ({
    ok: true, body: null,
    text: async () => JSON.stringify({ id: "abcdefgh", pgn, players: { white: { user: { name: "Alice" } }, black: { user: { name: "Bob" } } } }),
  });
  const hasil = await muatPartaiLichess("Alice", { paksa: true });
  assert.equal(hasil.partai.length, 1);
  assert.equal(hasil.penyimpanan.tersimpan, 0);
  assert.equal(hasil.penyimpanan.media, "gagal");
});

test("account deletion removes legacy games that have no timestamp index entry", async () => {
  const { bukaDB } = await import("../src/halaman/Analisa/database/migrasi.js");
  const db = await bukaDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(["partai", "koleksi"], "readwrite");
    tx.objectStore("partai").put({ id: "without-timestamp", koleksiId: "chessCom:legacy", pgn });
    tx.objectStore("koleksi").put({ id: "chessCom:legacy" });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  assert.equal(await basis.hapusKoleksi("chessCom:legacy"), true);
  assert.equal(await basis.ambilPartai("without-timestamp"), null);
});

test("account deletion cancels late downloads and pending collection creation across workspace tabs", async (t) => {
  const asli = globalThis.fetch;
  t.after(() => { globalThis.fetch = asli; });
  let kirimRespons;
  let mulaiRespons;
  const responsDimulai = new Promise((resolve) => { mulaiRespons = resolve; });
  globalThis.fetch = async (url) => url.endsWith("/archives")
    ? { ok: true, json: async () => ({ archives: ["https://api.chess.com/pub/player/race/games/2026/11"] }) }
    : { ok: true, json: () => new Promise((resolve) => { kirimRespons = resolve; mulaiRespons(); }) };
  const unduh = muatPartaiChessCom("Race", { paksa: true });
  await responsDimulai;
  const koleksiTertunda = basis.pastikanKoleksi({ platform: "chessCom", username: "Race" });
  const selesai = mulaiPenghapusanAkun("chessCom", "race");
  assert.ok(selesai);
  assert.equal(await koleksiTertunda, null);
  assert.equal(await basis.hapusKoleksi("chessCom:race"), true);
  selesai();
  kirimRespons({ games: [{ pgn, url: "https://www.chess.com/game/live/999", white: { username: "Race" }, black: { username: "Bob" } }] });
  await assert.rejects(unduh, isAbort);
  assert.equal((await basis.ambilDaftarPartai({ koleksiId: "chessCom:race" })).total, 0);
  assert.equal((await basis.ambilSemuaKoleksi()).some((k) => k.id === "chessCom:race"), false);
});

test("clearing IndexedDB also removes an unreadable fallback so it cannot be restored later", async () => {
  const kunci = `${prefix}snapshot-v2`;
  storage.setItem(kunci, "{broken");
  assert.equal(await basis.bersihkanBasisData(), true);
  assert.equal(storage.getItem(kunci), null);
  assert.equal((await basis.ambilDaftarPartai({ limit: 0 })).total, 0);
});
