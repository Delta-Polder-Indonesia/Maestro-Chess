import assert from "node:assert/strict";
import test from "node:test";
import { storageMemori } from "./bantuStorage.mjs";

const prefix = "maestro-analisa-db-";
const lamaAlice = { id: "lama-alice", koleksiId: "chessCom:alice", username: "Alice", platform: "chessCom", pgn: "1. e4 *", timestamp: 1 };
const lamaBob = { id: "lama-bob", koleksiId: "chessCom:bob", username: "Bob", platform: "chessCom", pgn: "1. d4 *", timestamp: 2 };
const storage = storageMemori([
  [`${prefix}koleksi`, JSON.stringify([{ id: "chessCom:alice" }, { id: "chessCom:bob" }])],
  [`${prefix}partai`, JSON.stringify([lamaAlice, lamaBob])],
]);
globalThis.localStorage = storage;
const { simpanBanyakPartai, ambilDaftarPartai, hapusKoleksi, hapusPartai, bersihkanBasisData } = await import("../src/halaman/Analisa/basisData.js");
const games = (count, base) => Array.from({ length: count }, (_, i) => ({
  id: `${base}-${i}`, pgn: `[White "Alice"]\n[Black "Bob${i}"]\n\n1. e4 e5 *`,
  whiteName: "Alice", blackName: `Bob${i}`, timestamp: 1000 + i,
}));

test("fallback migrates old data atomically and persists more than 100 games after reload", async () => {
  const hasil = await simpanBanyakPartai(games(105, "game"), { platform: "chessCom", username: "Alice" });
  assert.deepEqual(hasil, { tersimpan: 105, total: 106, sementara: 0, media: "localStorage" });
  assert.equal(storage.getItem(`${prefix}partai`), null);
  assert.equal(storage.getItem(`${prefix}koleksi`), null);
  const snapshot = JSON.parse(storage.getItem(`${prefix}snapshot-v2`));
  assert.equal(snapshot.partai.length, 107);
  const reload = await import(`../src/halaman/Analisa/database/migrasi.js?reload=${Date.now()}`);
  assert.equal(reload.memoriPartai.size, 107);
  assert.ok(reload.memoriPartai.has("lama-bob"));
});

test("quota failure never replaces the last good snapshot or claims temporary games are durable", async () => {
  const sebelumnya = storage.getItem(`${prefix}snapshot-v2`);
  storage.gagalTulis = true;
  const hasil = await simpanBanyakPartai(games(3, "temporary"), { platform: "chessCom", username: "Alice" });
  assert.deepEqual(hasil, { tersimpan: 0, total: 109, sementara: 3, media: "memori" });
  assert.equal(storage.getItem(`${prefix}snapshot-v2`), sebelumnya);
  assert.equal((await ambilDaftarPartai({ koleksiId: "chessCom:alice" })).total, 109);
  assert.equal(await hapusKoleksi("chessCom:alice"), false);
  assert.equal(storage.getItem(`${prefix}snapshot-v2`), sebelumnya);
  assert.equal((await ambilDaftarPartai({ koleksiId: "chessCom:alice" })).total, 109);
  storage.gagalTulis = false;
});

test("deletion removes persisted and temporary games without deleting other accounts", async () => {
  assert.equal(await hapusKoleksi("chessCom:alice"), true);
  const snapshot = JSON.parse(storage.getItem(`${prefix}snapshot-v2`));
  assert.deepEqual(snapshot.partai.map((p) => p.id), ["lama-bob"]);
  assert.deepEqual(snapshot.koleksi.map((k) => k.id), ["chessCom:bob"]);
  const reload = await import(`../src/halaman/Analisa/database/migrasi.js?afterDelete=${Date.now()}`);
  assert.deepEqual([...reload.memoriPartai.keys()], ["lama-bob"]);
  assert.equal((await ambilDaftarPartai({ koleksiId: "chessCom:alice" })).total, 0);
});

test("a SecurityError from the storage getter does not crash module loading or fallback writes", async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  t.after(() => Object.defineProperty(globalThis, "localStorage", descriptor));
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new DOMException("blocked", "SecurityError"); } });
  const fallback = await import(`../src/halaman/Analisa/database/migrasi.js?blocked=${Date.now()}`);
  assert.equal(await fallback.bukaDB(), null);
  assert.equal(fallback.simpanFallbackKeStorage(), false);
  assert.equal(fallback.hapusFallbackKoleksi("chessCom:alice"), false);
});

test("a snapshot with malformed records is not silently discarded or overwritten", async (t) => {
  const asli = globalThis.localStorage;
  const rusak = JSON.stringify({ koleksi: [], partai: [{ pgn: "recoverable" }] });
  globalThis.localStorage = storageMemori([[`${prefix}snapshot-v2`, rusak]]);
  t.after(() => { globalThis.localStorage = asli; });
  const fallback = await import(`../src/halaman/Analisa/database/migrasi.js?malformed=${Date.now()}`);
  assert.equal(fallback.simpanFallbackKeStorage(), false);
  assert.equal(fallback.hapusFallbackKoleksi("chessCom:alice"), false);
  assert.equal(globalThis.localStorage.getItem(`${prefix}snapshot-v2`), rusak);
});

test("unreadable existing fallback data is never overwritten", async (t) => {
  const asli = globalThis.localStorage;
  const rusak = storageMemori([[`${prefix}snapshot-v2`, "{broken"]]);
  globalThis.localStorage = rusak;
  t.after(() => { globalThis.localStorage = asli; });
  const fallback = await import(`../src/halaman/Analisa/database/migrasi.js?corrupt=${Date.now()}`);
  fallback.memoriPartai.set("new", { id: "new" });
  assert.equal(fallback.simpanFallbackKeStorage(), false);
  assert.equal(rusak.getItem(`${prefix}snapshot-v2`), "{broken");
  assert.equal(fallback.hapusFallbackKoleksi("chessCom:alice"), false);
});

test("fallback deletion and clearing report failure when the snapshot cannot be updated", async (t) => {
  await simpanBanyakPartai(games(1, "delete-failure"), { platform: "chessCom", username: "Alice" });
  const sebelum = storage.getItem(`${prefix}snapshot-v2`);
  storage.gagalTulis = true;
  assert.equal(await hapusPartai("delete-failure-0"), false);
  storage.gagalTulis = false;
  storage.gagalHapus = true;
  t.after(() => { storage.gagalTulis = false; storage.gagalHapus = false; });
  assert.equal(await bersihkanBasisData(), false);
  assert.equal(storage.getItem(`${prefix}snapshot-v2`), sebelum);
});
