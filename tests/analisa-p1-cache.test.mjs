import assert from "node:assert/strict";
import test from "node:test";
import { storageMemori } from "./bantuStorage.mjs";

const storage = storageMemori([
  ["maestro-anticheat-cache-v6", JSON.stringify({ "game|d8|mp5": { metadata: { players: [{ name: "Alice" }, { name: "Old" }] } } })],
]);
globalThis.localStorage = storage;
const { analisisRiwayatAntiCheat, bersihkanCacheAntiCheat, ukuranCacheAntiCheat } = await import("../src/halaman/Analisa/akun/antiCheatRiwayat.js");

const partai = (lawan) => ({
  id: "same-game-id", pgn: `[White "Alice"]\n[Black "${lawan}"]\n\n1. e4 e5 *`,
  whiteName: "Alice", blackName: lawan, timestamp: 1,
});

test("cache is invalidated by PGN content and engine identity, and forced reruns really recalculate", async () => {
  let panggilan = 0;
  const inputs = [];
  const parserPgn = async (mesin, pgn) => {
    panggilan++;
    inputs.push({ engine: mesin.idEngine, pgn });
    return { metadata: { players: [{ name: "Alice" }, { name: /\[Black "(.*?)"\]/.exec(pgn)[1] }] }, moves: [] };
  };
  const base = { username: "Alice", kedalaman: 8, mesin: { idEngine: "engine-a" }, parserPgn, cariBuku: async () => ({}) };
  const jalankan = (overrides = {}) => analisisRiwayatAntiCheat({ ...base, partai: [partai("Before")], ...overrides });

  assert.equal((await jalankan()).dariCache, 0); // v6 must not be reused
  assert.equal((await jalankan()).dariCache, 1);
  assert.equal(panggilan, 1);
  assert.equal((await jalankan({ partai: [partai("After")] })).dariCache, 0);
  assert.match(inputs.at(-1).pgn, /After/);
  assert.equal((await jalankan({ partai: [partai("After")] })).dariCache, 1);
  assert.equal((await jalankan({ partai: [partai("After")], mesin: { idEngine: "engine-b" } })).dariCache, 0);
  assert.equal(inputs.at(-1).engine, "engine-b");
  assert.equal((await jalankan({ partai: [partai("After")], mesin: { idEngine: "engine-b" }, paksa: true })).dariCache, 0);
  assert.equal(panggilan, 4);
  // An anonymous engine cannot be distinguished safely, so never cache it.
  await jalankan({ mesin: {} });
  await jalankan({ mesin: {} });
  assert.equal(panggilan, 6);
});

test("clearing a detection cache removes all known and future legacy versions and reports blocked removal", () => {
  storage.setItem("maestro-anticheat-cache-v1", "sensitive Alice");
  storage.setItem("maestro-anticheat-cache-v99", "sensitive Alice");
  storage.setItem("unrelated", "keep");
  assert.ok(ukuranCacheAntiCheat() > 0);
  assert.equal(bersihkanCacheAntiCheat(), true);
  assert.equal(ukuranCacheAntiCheat(), 0);
  assert.deepEqual([...storage.values.keys()], ["unrelated"]);
  storage.setItem("maestro-anticheat-cache-v6", "sensitive Alice");
  storage.gagalHapus = true;
  assert.equal(bersihkanCacheAntiCheat(), false);
  assert.equal(storage.getItem("maestro-anticheat-cache-v6"), "sensitive Alice");
  storage.gagalHapus = false;
  assert.equal(bersihkanCacheAntiCheat(), true);
});

test("a late parser cannot repopulate cache after deletion in another tab, even if the account is re-added", async (t) => {
  const lamaWindow = globalThis.window;
  globalThis.window = {};
  t.after(() => { if (lamaWindow === undefined) delete globalThis.window; else globalThis.window = lamaWindow; });
  const koordinasi = await import("../src/halaman/Analisa/akun/koordinasiAkun.js");
  const operasi = koordinasi.daftarkanOperasiAkun("chessCom", "Alice");
  let selesai;
  let mulai;
  const dimulai = new Promise((resolve) => { mulai = resolve; });
  const janji = analisisRiwayatAntiCheat({
    partai: [partai("LateOtherTab")], username: "Alice", mesin: { idEngine: "engine-a" },
    sinyal: operasi.signal, cariBuku: async () => ({}),
    parserPgn: () => new Promise((resolve) => { selesai = resolve; mulai(); }),
  });
  await dimulai;
  await koordinasi.denganKunciAkun(() => {
    const penanda = koordinasi.tandaiPenghapusanAkun("chessCom", "Alice");
    assert.ok(penanda);
    assert.equal(bersihkanCacheAntiCheat(), true);
    assert.equal(penanda.selesai(true), true);
    assert.equal(koordinasi.aktifkanKembaliAkun("chessCom", "Alice"), true);
  });
  selesai({ metadata: { players: [{ name: "Alice" }, { name: "LateOtherTab" }] }, moves: [] });
  const hasil = await janji;
  operasi.selesai();
  assert.equal(hasil.dibatalkan, true);
  assert.equal(hasil.dianalisis, 0);
  assert.equal(ukuranCacheAntiCheat(), 0);
  assert.equal(storage.getItem("maestro-anticheat-cache-v7"), null);
});

test("a parser that finishes after cancellation cannot repopulate the detection cache", async () => {
  let selesai;
  let mulai;
  const dimulai = new Promise((resolve) => { mulai = resolve; });
  const controller = new AbortController();
  const janji = analisisRiwayatAntiCheat({
    partai: [partai("Late")], username: "Alice", mesin: { idEngine: "engine-a" },
    sinyal: controller.signal, cariBuku: async () => ({}),
    parserPgn: () => new Promise((resolve) => { selesai = resolve; mulai(); }),
  });
  await dimulai;
  controller.abort();
  assert.equal(bersihkanCacheAntiCheat(), true);
  selesai({ metadata: { players: [{ name: "Alice" }, { name: "Late" }] }, moves: [] });
  const hasil = await janji;
  assert.equal(hasil.dibatalkan, true);
  assert.equal(hasil.dianalisis, 0);
  assert.equal(ukuranCacheAntiCheat(), 0);
  assert.equal(storage.getItem("maestro-anticheat-cache-v7"), null);
});
