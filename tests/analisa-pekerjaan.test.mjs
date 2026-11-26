import assert from "node:assert/strict";
import test from "node:test";
import { Chess } from "chess.js";
import { ID_DRAF_IMPOR, buatAdapterPekerjaan, buatIdDrafImpor, buatPenyimpananPekerjaan, simpanDrafImpor, snapshotLaporanAman } from "../src/halaman/Analisa/pekerjaan.js";
import { buatManajerLaporan } from "../src/halaman/Analisa/manajerLaporan.js";
import { catatFitur, daftarRiwayat } from "../src/halaman/Analisa/riwayatFitur.js";
import { tangkapGalatDiuji } from "./bantuGalat.mjs";

function adapterMemori(records = []) {
  const isi = new Map(records.map((record) => [record.id, structuredClone(record)]));
  const daftar = new Map(records.map((record) => [record.id, {
    id: record.id, jenis: record.jenis, judul: record.judul, status: record.status,
    format: record.sumber?.format, adaHasil: Boolean(record.snapshot), waktu: record.waktu,
  }]));
  return {
    isi, daftarData: daftar,
    async daftar() { return structuredClone([...daftar.values()]); },
    async ambil(id) { return structuredClone(isi.get(id) ?? null); },
    async simpan(record, metadata) { isi.set(record.id, structuredClone(record)); daftar.set(record.id, structuredClone(metadata)); },
    async hapus(id) { isi.delete(id); daftar.delete(id); },
  };
}

const report = (id, judul, waktu = Date.now()) => ({
  id, jenis: "laporan", judul, status: "selesai", sumber: { format: "pgn", string: "1. e4 e5 *" }, waktu,
});

test("feature history persists, updates recency, and retains older work without duplicates", async () => {
  const adapter = adapterMemori();
  const store = buatPenyimpananPekerjaan(adapter);
  store.simpan(report("laporan:lain", "Citra vs Bayu", 2));
  store.simpan(report("laporan:lama", "Alice vs Bob", 3));
  store.simpan({ id: "draf:lama", jenis: "draf", judul: "1. e4", status: "draf", waktu: 4, isi: { tipe: "pgn", pgn: "1. e4" } });
  catatFitur("papan", null, store, 5);
  catatFitur("constructor", null, store, 6);
  catatFitur("akun", null, store, 7);
  catatFitur("impor", null, store, 8);
  catatFitur("impor", "draf:lama", store, 9);
  catatFitur("bermain", "laporan:lama", store, 10);
  catatFitur("akun", null, store, 11);
  await store.tungguTulis();

  const reopened = buatPenyimpananPekerjaan(adapter);
  await reopened.init();
  const rows = daftarRiwayat(reopened.snapshot().daftar);
  assert.deepEqual(rows.map((row) => row.item.id), ["fitur:bermain:laporan:lama", "fitur:impor:draf:lama", "laporan:lain"]);
  assert.equal(rows[0].pekerjaan.judul, "Alice vs Bob");
  assert.equal(rows[1].pekerjaan.judul, "1. e4");
  assert.equal((await reopened.ambil("laporan:lama")).judul, "Alice vs Bob");
  assert.equal((await reopened.ambil("draf:lama")).isi.pgn, "1. e4");
  assert.equal(reopened.snapshot().daftar.some((item) => item.id === "fitur:papan"), false);
  // Fitur bilah samping (mis. Akun) tidak dicatat ke File Terbaru.
  assert.equal(reopened.snapshot().daftar.some((item) => item.id === "fitur:akun"), false);

  // A newly opened generic feature remains visible until its selected draft is known.
  catatFitur("impor", null, reopened, 12);
  assert.equal(daftarRiwayat(reopened.snapshot().daftar)[0].item.id, "fitur:impor");
  catatFitur("impor", "draf:lama", reopened, 13);
  assert.equal(daftarRiwayat(reopened.snapshot().daftar).filter((row) => row.fitur === "impor").length, 1);
  await reopened.tungguTulis();
});

test("loading metadata cannot overwrite newer edits made before initialization completes", async () => {
  const adapter = adapterMemori([report("same", "Old", 1), report("kept", "Existing", 2)]);
  const baca = adapter.daftar.bind(adapter);
  let release;
  adapter.daftar = async () => { await new Promise((resolve) => { release = resolve; }); return baca(); };
  const store = buatPenyimpananPekerjaan(adapter);
  const init = store.init();
  store.simpan(report("same", "New", 10));
  release();
  await init;
  await store.tungguTulis();
  assert.deepEqual(store.snapshot().daftar.map((item) => item.judul), ["New", "Existing"]);
  assert.equal((await store.ambil("same")).judul, "New");
  assert.equal(adapter.isi.get("kept").judul, "Existing");
  assert.equal(adapter.isi.get("same").judul, "New");
  assert.equal(store.snapshot().menyimpan, false);
});

test("rapid writes are serialized and coalesced without losing the latest edit", async () => {
  const adapter = adapterMemori();
  const tulis = adapter.simpan.bind(adapter);
  const written = [];
  let releaseFirst;
  let firstStarted;
  const started = new Promise((resolve) => { firstStarted = resolve; });
  adapter.simpan = async (record, metadata) => {
    written.push(record.judul);
    if (written.length === 1) {
      firstStarted();
      await new Promise((resolve) => { releaseFirst = resolve; });
    }
    await tulis(record, metadata);
  };
  const store = buatPenyimpananPekerjaan(adapter);
  store.simpan(report("a", "First", 1));
  await started;
  store.simpan(report("a", "Second", 2));
  store.simpan(report("a", "Latest", 3));
  assert.equal(store.snapshot().menyimpan, true);
  releaseFirst();
  await store.tungguTulis();
  assert.deepEqual(written, ["First", "Latest"]);
  assert.equal(adapter.isi.get("a").judul, "Latest");
  assert.equal(adapter.daftarData.get("a").judul, "Latest");
  assert.equal(store.snapshot().menyimpan, false);
});

test("read/write failure is surfaced while in-memory work remains accessible", async (t) => {
  const galat = tangkapGalatDiuji(t, [
    "Gagal membaca daftar pekerjaan Analisa:",
    "Gagal menyimpan atau menghapus pekerjaan Analisa:",
  ]);
  const blocked = { open() { throw new Error("blocked"); } };
  const store = buatPenyimpananPekerjaan(buatAdapterPekerjaan(blocked));
  await store.init();
  assert.equal(store.snapshot().siap, true);
  assert.equal(store.snapshot().tersedia, false);
  store.simpan(report("memory", "Still here"));
  await store.tungguTulis();
  assert.equal((await store.ambil("memory")).judul, "Still here");
  assert.equal(store.snapshot().daftar[0].judul, "Still here");
  assert.equal(store.snapshot().tersedia, false);
  for (const pesan of [
    "Gagal membaca daftar pekerjaan Analisa:",
    "Gagal menyimpan atau menghapus pekerjaan Analisa:",
  ]) {
    assert.ok(galat.some(([pesanTercatat]) => pesanTercatat === pesan), `expected console error: ${pesan}`);
  }
});

function gameDari(moves) {
  const chess = new Chess();
  const result = [{ fen: chess.fen(), color: chess.turn(), previousStaticEvals: [["cp", "0"]] }];
  for (const san of moves) {
    const move = chess.move(san);
    result.push({ fen: chess.fen(), color: chess.turn(), san: move.san, previousStaticEvals: [["cp", "0"]] });
  }
  return result;
}

const kosong = () => ({ moveNumber: -1, moves: [], arrows: {} });

test("switching reports cannot attach an old board to new data; restored results and variations survive", async () => {
  const store = buatPenyimpananPekerjaan(adapterMemori());
  await store.init();
  const gameA = gameDari(["e4", "e5"]);
  const gameB = gameDari(["d4", "d5"]);
  const variation = gameDari(["e4", "e5", "Nf3"])[3];
  let papan = {
    data: { format: "pgn", string: "1. e4 e5 *", pekerjaanId: "a" },
    game: gameB, moveNumber: 0, white: true, time: 0, result: "*", tab: "summary",
    customLine: kosong(), arrows: { 0: [], 1: [], 2: [] }, pageState: "analyze", depth: 6,
  };
  const manager = buatManajerLaporan(() => papan, store);
  manager.mulai({ data: papan.data, depth: 6 });
  assert.equal((await store.ambil("a")).snapshot, null);
  const metadataA = { players: [{ name: "Alice", elo: "1500" }, { name: "Bob", elo: "1600" }], time: 0, result: "*" };
  manager.selesai({ id: "a", metadata: metadataA, moves: gameA, pageState: "analyze", depth: 6, pertahankan: false });
  // Callback selesai terjadi sebelum React memasang game A: jangan simpan B.
  manager.simpan();
  assert.deepEqual((await store.ambil("a")).snapshot.game, gameA);
  papan = {
    ...papan, game: gameA, moveNumber: 2, white: false, tab: "moves",
    customLine: { moveNumber: 0, moves: [variation], arrows: { 0: [[{ col: 1, row: 1 }, { col: 2, row: 2 }]] } },
    arrows: { 0: [], 1: [], 2: [[{ col: 3, row: 3 }, { col: 4, row: 4 }]] },
  };
  manager.simpan();
  const savedA = await store.ambil("a");
  assert.equal(savedA.snapshot.moveNumber, 2);
  assert.equal(savedA.snapshot.white, false);
  assert.equal(savedA.snapshot.customLine.moves[0].san, "Nf3");
  assert.equal(savedA.judul, "Alice vs Bob");

  papan = { ...papan, data: { format: "pgn", string: "1. d4 d5 *", pekerjaanId: "b" } };
  manager.mulai({ data: papan.data, depth: 6 });
  assert.equal((await store.ambil("b")).snapshot, null);
  manager.simpan();
  assert.equal((await store.ambil("b")).snapshot, null);
  const metadataB = { players: [{ name: "Carol" }, { name: "Dan" }], time: 0, result: "*" };
  manager.selesai({ id: "b", metadata: metadataB, moves: gameB, pageState: "analyze", depth: 6, pertahankan: false });
  papan = { ...papan, game: gameB, moveNumber: 0, white: true, tab: "summary", customLine: kosong(), arrows: { 0: [], 1: [], 2: [] } };
  manager.simpan();

  const restored = snapshotLaporanAman(savedA.snapshot);
  assert.ok(restored);
  papan = { ...papan, data: { ...savedA.sumber, pekerjaanId: "a" } };
  manager.pulih(papan.data, savedA, restored);
  manager.simpan(); // render still has B; A's saved position must not be overwritten
  assert.equal((await store.ambil("a")).snapshot.moveNumber, 2);
  assert.equal((await store.ambil("a")).snapshot.customLine.moves[0].san, "Nf3");
  papan = { ...papan, ...restored, data: papan.data, depth: 6 };
  manager.simpan();
  manager.mulai({ data: papan.data, depth: 7 });
  assert.equal((await store.ambil("a")).status, "berjalan");
  manager.gagal("a");
  const interrupted = await store.ambil("a");
  assert.equal(interrupted.status, "terputus");
  assert.equal(interrupted.snapshot.moveNumber, 2);
  assert.equal(interrupted.snapshot.customLine.moves[0].san, "Nf3");
  await store.tungguTulis();
  assert.deepEqual(new Set(store.snapshot().daftar.map((item) => item.id)), new Set(["a", "b"]));
});

test("new blank work does not capture the prior report while React swaps the board", async () => {
  const store = buatPenyimpananPekerjaan(adapterMemori());
  await store.init();
  const oldGame = gameDari(["e4"]);
  const newGame = gameDari([]);
  let papan = {
    data: { format: "fen", string: "", pekerjaanId: "new", awalPekerjaan: true }, game: oldGame, moveNumber: 1,
    white: false, time: 0, result: "", tab: "moves", customLine: { moveNumber: 0, moves: [oldGame[1]], arrows: { 0: [] } },
    arrows: { 0: [], 1: [] }, pageState: "analyze", depth: 6,
  };
  const manager = buatManajerLaporan(() => papan, store);
  manager.mulai({ data: papan.data, depth: 6 });
  manager.simpan();
  assert.equal(await store.ambil("new"), null);
  manager.siapKosong("new", newGame);
  papan = { ...papan, game: newGame, moveNumber: 0, white: true, customLine: kosong(), arrows: { 0: [] }, pageState: "default" };
  manager.simpan();
  assert.equal(await store.ambil("new"), null);
  papan = { ...papan, customLine: { moveNumber: 0, moves: [oldGame[1]], arrows: { 0: [] } }, pageState: "analyzeCustom" };
  manager.simpan();
  assert.equal((await store.ambil("new")).snapshot.customLine.moves.length, 1);
});

test("invalid snapshots are rejected and unfinished manual evaluations are labelled", () => {
  const game = gameDari(["e4"]);
  const snapshot = {
    versi: 1, game, moveNumber: 100, white: false, pageState: "analyze", arrows: {},
    customLine: { moveNumber: 0, moves: [{ fen: game[1].fen }], arrows: {} },
    players: [{ name: "" }, { name: "Bob" }],
  };
  const result = snapshotLaporanAman(snapshot);
  assert.equal(result.moveNumber, 1);
  assert.equal(result.customLine.moves[0].statusEvaluasi, "dibatalkan");
  assert.deepEqual(result.arrows, { 0: [], 1: [] });
  assert.deepEqual(result.customLine.arrows, { 0: [] });
  assert.equal(snapshotLaporanAman({ ...snapshot, game: [{ fen: "broken" }] }), null);
  assert.equal(snapshotLaporanAman({ ...snapshot, versi: 2 }), null);
});

test("an explicitly new blank board is resumable and does not become a stale result when filled", async () => {
  const store = buatPenyimpananPekerjaan(adapterMemori());
  await store.init();
  const game = gameDari([]);
  let papan = {
    data: { format: "fen", string: "", pekerjaanId: "new" }, game,
    moveNumber: 0, white: true, time: 0, result: "", tab: "moves", customLine: kosong(),
    arrows: { 0: [] }, pageState: "default", depth: 6,
  };
  const manager = buatManajerLaporan(() => papan, store);
  manager.mulai({ data: papan.data, depth: 6 });
  manager.siapKosong("new", game);
  manager.simpan();
  const empty = await store.ambil("new");
  assert.equal(empty.status, "baru");
  assert.equal(snapshotLaporanAman(empty.snapshot).pageState, "default");
  papan = { ...papan, data: { format: "pgn", string: "1. e4 e5 *", pekerjaanId: "new" } };
  manager.mulai({ data: papan.data, depth: 6 });
  const running = await store.ambil("new");
  assert.equal(running.status, "berjalan");
  assert.equal(running.snapshot, null);
  assert.equal(running.sumber.string, "1. e4 e5 *");
});

test("an IndexedDB open that never responds times out, and late connections are closed", async (t) => {
  const galat = tangkapGalatDiuji(t, "Gagal membaca daftar pekerjaan Analisa:");
  const request = {};
  let closed = false;
  const adapter = buatAdapterPekerjaan({ open: () => request }, 15);
  const store = buatPenyimpananPekerjaan(adapter);
  await store.init();
  assert.equal(store.snapshot().siap, true);
  assert.equal(store.snapshot().tersedia, false);
  assert.equal(galat.length, 1);
  assert.match(String(galat[0][1]), /Penyimpanan tidak merespons/);
  request.result = { close() { closed = true; } };
  request.onsuccess();
  assert.equal(closed, true);
});

test("the active report pointer survives reload independently of recent-file ordering", async () => {
  const adapter = adapterMemori();
  const first = buatPenyimpananPekerjaan(adapter);
  await first.init();
  first.simpan(report("active", "Selected", 100));
  first.simpan(report("other", "Modified later", 200));
  first.tetapkanAktif({ id: "active", digunakan: true, berjalan: false });
  await first.tungguTulis();
  first.tetapkanAktif(null); // unmount must not erase the persisted selection
  const reopened = buatPenyimpananPekerjaan(adapter);
  await reopened.init();
  assert.equal(reopened.snapshot().terakhirId, "active");
  assert.deepEqual(reopened.snapshot().daftar.map((item) => item.id), ["other", "active"]);
});

test("a synchronous write error aborts the transaction instead of committing only metadata", async () => {
  let aborted = false;
  const tx = {
    objectStore(name) {
      return { put() { if (name === "isi") throw new Error("clone failed"); } };
    },
    abort() { aborted = true; },
  };
  const db = { transaction: () => tx, close() {} };
  const source = {
    open() {
      const request = {};
      queueMicrotask(() => { request.result = db; request.onsuccess(); });
      return request;
    },
  };
  const adapter = buatAdapterPekerjaan(source);
  await assert.rejects(adapter.simpan(report("broken", "Test"), { id: "broken" }), /clone failed/);
  assert.equal(aborted, true);
});

test("multiple import drafts and the selected empty draft remain separate across reloads", async () => {
  const adapter = adapterMemori();
  const store = buatPenyimpananPekerjaan(adapter);
  await store.init();
  const idA = ID_DRAF_IMPOR; // retain the original single-draft identifier
  const idB = buatIdDrafImpor();
  const emptyId = buatIdDrafImpor();
  assert.notEqual(idA, idB);
  assert.notEqual(idB, emptyId);
  simpanDrafImpor({ tipe: "pgn", pgn: "[White \"Alice\"]\n1. e4 *", fen: "", tautan: "" }, idA, store);
  simpanDrafImpor({ tipe: "fen", pgn: "other text", fen: "8/4k3/8/8/8/8/4P3/4K3 w - - 0 1", tautan: "" }, idB, store);
  store.tetapkanDrafAktif(idB);
  await store.tungguTulis();
  let reopened = buatPenyimpananPekerjaan(adapter);
  await reopened.init();
  assert.equal(reopened.snapshot().terakhirDrafId, idB);
  assert.equal(reopened.snapshot().daftar.filter((entry) => entry.jenis === "draf").length, 2);
  assert.match((await reopened.ambil(idA)).isi.pgn, /Alice/);
  assert.equal((await reopened.ambil(idB)).isi.tipe, "fen");
  assert.match(reopened.snapshot().daftar.find((entry) => entry.id === idB).judul, /^8\/4k3/);
  // A newly selected blank draft must stay blank rather than falling back to A/B.
  reopened.tetapkanDrafAktif(emptyId);
  await reopened.tungguTulis();
  reopened = buatPenyimpananPekerjaan(adapter);
  await reopened.init();
  assert.equal(reopened.snapshot().terakhirDrafId, emptyId);
  assert.equal(await reopened.ambil(emptyId), null);
  assert.ok(await reopened.ambil(idA));
  assert.ok(await reopened.ambil(idB));
  simpanDrafImpor({ tipe: "pgn", pgn: "", fen: "", tautan: "" }, idB, reopened);
  await reopened.tungguTulis();
  assert.equal(await reopened.ambil(idB), null);
  assert.ok(await reopened.ambil(idA));
});

test("selecting a draft during initialization takes precedence over the saved pointer", async () => {
  const adapter = adapterMemori();
  const first = buatPenyimpananPekerjaan(adapter);
  first.tetapkanDrafAktif("draf:old");
  await first.tungguTulis();
  const baca = adapter.daftar.bind(adapter);
  let release;
  adapter.daftar = async () => { await new Promise((resolve) => { release = resolve; }); return baca(); };
  const store = buatPenyimpananPekerjaan(adapter);
  const init = store.init();
  store.tetapkanDrafAktif("draf:new");
  release();
  await init;
  await store.tungguTulis();
  assert.equal(store.snapshot().terakhirDrafId, "draf:new");
});
