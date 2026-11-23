import assert from "node:assert/strict";
import test from "node:test";
import { storageMemori } from "./bantuStorage.mjs";
import { hashPgn } from "../src/lib/pgnRingan.js";

const storage = storageMemori();
const pendengar = new Map();
globalThis.localStorage = storage;
globalThis.window = { addEventListener: (nama, callback) => pendengar.set(nama, callback) };
const koordinasi = await import("../src/halaman/Analisa/akun/koordinasiAkun.js");
const tabA = await import("../src/halaman/Analisa/database/migrasi.js?tab-a");
const tabB = await import("../src/halaman/Analisa/database/migrasi.js?tab-b");
const kunci = "maestro-analisa-db-snapshot-v2";

function simpan(tab, nama, id) {
  const koleksiId = `chessCom:${nama.toLowerCase()}`;
  tab.memoriKoleksi.set(koleksiId, { id: koleksiId, platform: "chessCom", username: nama });
  tab.memoriPartai.set(id, { id, koleksiId, platform: "chessCom", username: nama, pgn: "1. e4 *", timestamp: 1 });
  return tab.simpanFallbackKeStorage();
}

test("fallback merges changes from separate tabs rather than overwriting a newer snapshot", async () => {
  assert.equal(await koordinasi.denganKunciAkun(() => simpan(tabA, "Alice", "a")), true);
  assert.equal(await koordinasi.denganKunciAkun(() => simpan(tabB, "Bob", "b")), true);
  assert.deepEqual(JSON.parse(storage.getItem(kunci)).partai.map((p) => p.id).sort(), ["a", "b"]);
  assert.equal(tabA.sinkronkanFallback(), true);
  assert.deepEqual([...tabA.memoriPartai.keys()].sort(), ["a", "b"]);
});

test("temporary changes survive a different tab's write but never revive a deleted account", async () => {
  storage.gagalTulis = true;
  assert.equal(await koordinasi.denganKunciAkun(() => simpan(tabA, "Alice", "temporary-a")), false);
  storage.gagalTulis = false;
  assert.equal(await koordinasi.denganKunciAkun(() => simpan(tabB, "Bob", "b2")), true);
  assert.equal(tabA.sinkronkanFallback(), true);
  assert.ok(tabA.memoriPartai.has("temporary-a"));
  assert.ok(tabA.memoriPartai.has("b2"));

  const lama = koordinasi.daftarkanOperasiAkun("chessCom", "Alice");
  await koordinasi.denganKunciAkun(() => {
    const penanda = koordinasi.tandaiPenghapusanAkun("chessCom", "Alice");
    assert.ok(penanda);
    assert.equal(tabB.hapusFallbackKoleksi("chessCom:alice"), true);
    assert.equal(penanda.selesai(true), true);
  });
  // Pendengar tab lain membersihkan salinan memorinya begitu lock dilepas.
  await koordinasi.denganKunciAkun(() => {});
  assert.equal(tabA.memoriPartai.has("temporary-a"), false);
  await koordinasi.denganKunciAkun(() => assert.equal(koordinasi.aktifkanKembaliAkun("chessCom", "Alice"), true));
  lama.periksa();
  assert.equal(lama.signal.aborted, true); // even after explicit re-addition
  lama.selesai();
  assert.equal(tabA.sinkronkanFallback(), true);
  assert.equal(tabA.memoriPartai.has("a"), false);
  assert.equal(tabA.memoriPartai.has("temporary-a"), false);
  assert.equal(await koordinasi.denganKunciAkun(() => simpan(tabA, "Bob", "b3")), true);
  assert.deepEqual(JSON.parse(storage.getItem(kunci)).partai.map((p) => p.id).sort(), ["b", "b2", "b3"]);
});

test("a cross-tab deletion event clears legacy temporary data even if storage reads are blocked", async (t) => {
  const id = "chessCom:legacy";
  tabA.memoriKoleksi.set(id, { id });
  tabA.memoriPartai.set("legacy-temporary", { id: "legacy-temporary", koleksiId: id, pgn: "1. e4 *" });
  tabA.memoriPartai.set("other-temporary", { id: "other-temporary", koleksiId: "chessCom:bob", pgn: "1. d4 *" });
  storage.gagalBaca = true;
  t.after(() => { storage.gagalBaca = false; });
  const operasi = koordinasi.daftarkanOperasiAkun("chessCom", "Legacy");
  assert.equal(operasi.signal.aborted, false);
  pendengar.get("storage")({
    key: `maestro-analisa-generasi-akun-${hashPgn("chesscom:legacy")}`,
    newValue: JSON.stringify({ versi: "deleted-version", status: "terhapus" }),
  });
  assert.equal(operasi.signal.aborted, true);
  assert.equal(tabA.memoriPartai.has("legacy-temporary"), false);
  assert.equal(tabA.memoriKoleksi.has(id), false);
  assert.equal(tabA.memoriPartai.has("other-temporary"), true);
  operasi.selesai();
  storage.gagalBaca = false;
  await koordinasi.denganKunciAkun(() => {});
});

test("a delayed deletion event does not discard new-generation temporary games or operations", async (t) => {
  const id = "chessCom:carol";
  const penandaKey = `maestro-analisa-generasi-akun-${hashPgn("chesscom:carol")}`;
  await koordinasi.denganKunciAkun(() => simpan(tabA, "Carol", "carol-old"));
  let eventLama;
  await koordinasi.denganKunciAkun(() => {
    const penanda = koordinasi.tandaiPenghapusanAkun("chessCom", "Carol");
    assert.equal(tabB.hapusFallbackKoleksi(id), true);
    assert.equal(penanda.selesai(true), true);
    eventLama = storage.getItem(penandaKey);
  });
  await koordinasi.denganKunciAkun(() => assert.equal(koordinasi.aktifkanKembaliAkun("chessCom", "Carol"), true));
  await koordinasi.denganKunciAkun(() => tabA.sinkronkanFallback());
  storage.gagalTulis = true;
  t.after(() => { storage.gagalTulis = false; });
  assert.equal(await koordinasi.denganKunciAkun(() => simpan(tabA, "Carol", "carol-new")), false);
  storage.gagalTulis = false;
  const operasi = koordinasi.daftarkanOperasiAkun("chessCom", "Carol");
  pendengar.get("storage")({ key: penandaKey, newValue: eventLama });
  assert.equal(operasi.signal.aborted, false);
  assert.equal(tabA.memoriPartai.has("carol-new"), true);
  operasi.selesai();
  await koordinasi.denganKunciAkun(() => {});
  assert.equal(tabA.memoriPartai.has("carol-new"), true);
});

test("the local fallback lock serializes operations and releases after failures", async () => {
  const urutan = [];
  let lepaskan;
  const tunggu = new Promise((resolve) => { lepaskan = resolve; });
  const pertama = koordinasi.denganKunciAkun(async () => { urutan.push("mulai"); await tunggu; urutan.push("akhir"); throw new Error("gagal"); });
  const kedua = koordinasi.denganKunciAkun(() => urutan.push("kedua"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(urutan, ["mulai"]);
  lepaskan();
  await assert.rejects(pertama, /gagal/);
  await kedua;
  assert.deepEqual(urutan, ["mulai", "akhir", "kedua"]);
});

test("account deletion cannot start or claim completion if its cross-tab marker cannot be saved", (t) => {
  t.after(() => { storage.gagalBaca = false; storage.gagalTulis = false; });
  storage.gagalBaca = true;
  assert.equal(koordinasi.tandaiPenghapusanAkun("chessCom", "blocked"), null);
  storage.gagalBaca = false;
  storage.gagalTulis = true;
  assert.equal(koordinasi.tandaiPenghapusanAkun("chessCom", "blocked"), null);
  storage.gagalTulis = false;
  const penanda = koordinasi.tandaiPenghapusanAkun("chessCom", "blocked");
  assert.ok(penanda);
  storage.gagalTulis = true;
  assert.equal(penanda.selesai(true), false);
});

test("a failed operation inside an acquired Web Lock is not retried", async (t) => {
  const lama = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks: {
    async request(_nama, _opsi, callback) { return callback(); },
  } } });
  t.after(() => { if (lama) Object.defineProperty(globalThis, "navigator", lama); else delete globalThis.navigator; });
  let panggilan = 0;
  await assert.rejects(koordinasi.denganKunciAkun(() => { panggilan++; throw new Error("aksi gagal"); }), /aksi gagal/);
  assert.equal(panggilan, 1);
  assert.equal(koordinasi.kunciLintasTabTersedia(), true);
});

test("a browser that exposes Web Locks but rejects the request falls back safely", async (t) => {
  const lama = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks: {
    request() { throw new DOMException("blocked", "SecurityError"); },
  } } });
  t.after(() => { if (lama) Object.defineProperty(globalThis, "navigator", lama); else delete globalThis.navigator; });
  assert.equal(await koordinasi.denganKunciAkun(() => "lokal"), "lokal");
  assert.equal(koordinasi.kunciLintasTabTersedia(), false);
  await assert.rejects(koordinasi.denganKunciAkun(() => {}, { wajib: true }), /Koordinasi antar-tab tidak tersedia/);
});

test("without Web Locks, a browser refuses account deletion and does not claim fallback writes are durable", async (t) => {
  await assert.rejects(koordinasi.denganKunciAkun(() => {}, { wajib: true }), /Koordinasi antar-tab tidak tersedia/);
  const asli = globalThis.document;
  globalThis.document = {};
  t.after(() => { if (asli === undefined) delete globalThis.document; else globalThis.document = asli; });
  const sebelum = storage.getItem(kunci);
  assert.equal(await koordinasi.denganKunciAkun(() => simpan(tabB, "Bob", "without-lock")), false);
  assert.equal(storage.getItem(kunci), sebelum);
  assert.ok(tabB.memoriPartai.has("without-lock"));
});
