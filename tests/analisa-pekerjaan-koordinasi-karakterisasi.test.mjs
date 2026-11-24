import assert from "node:assert/strict";
import React from "react";
import TestRenderer from "react-test-renderer";
import test from "node:test";
import { buatManajerLaporan } from "../src/halaman/Analisa/manajerLaporan.js";
import { buatPenyimpananPekerjaan, judulPekerjaan, sumberPekerjaan } from "../src/halaman/Analisa/pekerjaan.js";
import { catatFitur, daftarRiwayat, KUNCI_FITUR } from "../src/halaman/Analisa/riwayatFitur.js";
import { useMuatPartai } from "../src/halaman/Analisa/komponen/game/useMuatPartai.js";

const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const noop = () => {};

function tertunda() {
  let resolve;
  const promise = new Promise((selesai) => { resolve = selesai; });
  return { promise, resolve };
}

function adapterMemori() {
  const isi = new Map();
  const metadata = new Map();
  return {
    isi, metadata,
    async daftar() { return structuredClone([...metadata.values()]); },
    async ambil(id) { return structuredClone(isi.get(id) ?? null); },
    async simpan(record, meta) { isi.set(record.id, structuredClone(record)); metadata.set(meta.id, structuredClone(meta)); },
    async hapus(id) { isi.delete(id); metadata.delete(id); },
  };
}

function data(id, white = "Alice", moves = "e4 e5") {
  return { pekerjaanId: id, format: "pgn", string: `[White "${white}"]\n[Black "Bob"]\n\n1. ${moves} *` };
}

test("manager interrupts an old report and ignores its late metadata, completion and failure", async () => {
  const store = buatPenyimpananPekerjaan(adapterMemori());
  let papan = { data: data("laporan:a"), game: [], pageState: "loading" };
  const manager = buatManajerLaporan(() => papan, store);
  manager.mulai({ data: papan.data, depth: 8 });
  manager.metadata("laporan:a", { players: [{ name: "Alice" }, { name: "Bob" }] });
  assert.equal((await store.ambil("laporan:a")).status, "berjalan");
  assert.deepEqual(store.snapshot().aktif, { id: "laporan:a", digunakan: true, berjalan: true });

  papan = { ...papan, data: data("laporan:b", "Citra", "d4 d5") };
  manager.mulai({ data: papan.data, depth: 10 });
  assert.equal((await store.ambil("laporan:a")).status, "terputus");
  assert.equal((await store.ambil("laporan:b")).status, "berjalan");
  manager.metadata("laporan:a", { players: [{ name: "Stale" }, { name: "Result" }] });
  manager.gagal("laporan:a");
  manager.selesai({ id: "laporan:a", metadata: { players: [{ name: "Stale" }] }, moves: [{ fen: "stale" }], pageState: "analyze", depth: 8 });
  assert.equal((await store.ambil("laporan:a")).judul, "Alice vs Bob");
  assert.equal((await store.ambil("laporan:b")).status, "berjalan");
  assert.deepEqual(store.snapshot().aktif, { id: "laporan:b", digunakan: true, berjalan: true });

  manager.gagal("laporan:b");
  assert.equal((await store.ambil("laporan:b")).status, "terputus");
  assert.deepEqual(store.snapshot().aktif, { id: "laporan:b", digunakan: true, berjalan: false });
  manager.selesai({ id: "laporan:b", metadata: {}, moves: [{ fen: "late" }], pageState: "analyze", depth: 10 });
  assert.equal((await store.ambil("laporan:b")).status, "terputus");
  manager.tutup();
  await store.tungguTulis();
  assert.deepEqual(store.snapshot().aktif, { id: null, digunakan: false, berjalan: false });
  assert.equal((await store.ambil("laporan:a")).status, "terputus");
  assert.equal((await store.ambil("laporan:b")).status, "terputus");
});

test("closing an active running report marks only that report interrupted and keeps its pointer", async () => {
  const adapter = adapterMemori();
  const store = buatPenyimpananPekerjaan(adapter);
  const papan = { data: data("laporan:tutup"), game: [], pageState: "loading" };
  const manager = buatManajerLaporan(() => papan, store);
  manager.mulai({ data: papan.data, depth: 6 });
  manager.tutup();
  await store.tungguTulis();
  assert.equal((await store.ambil("laporan:tutup")).status, "terputus");
  assert.equal(store.snapshot().terakhirId, "laporan:tutup");
  assert.deepEqual(store.snapshot().aktif, { id: null, digunakan: false, berjalan: false });
  assert.equal(adapter.isi.get("laporan:tutup").status, "terputus");
  assert.equal(adapter.isi.get("meta:laporan-aktif").laporanId, "laporan:tutup");
  manager.gagal("laporan:tutup");
  assert.equal((await store.ambil("laporan:tutup")).status, "terputus");
});

function Harness({ work, input, siapkan, snapshot }) {
  const [controller, setController] = React.useState(() => new AbortController());
  const [pageState, setPageState] = React.useState("default");
  const [players, setPlayers] = React.useState([]);
  const [game, setGame] = React.useState([]);
  const [errors, setErrors] = React.useState([]);
  const [moveNumber, setMoveNumber] = React.useState(0);
  const [white, setWhite] = React.useState(true);
  const [tab, setTab] = React.useState("summary");
  const [customLine, setCustomLine] = React.useState({ moveNumber: -1, moves: [], arrows: {} });
  const [arrows, setArrows] = React.useState({ 0: [] });
  const [time, setTime] = React.useState(0);
  const [result, setResult] = React.useState("");
  const boardSoundsRef = React.useRef(false);
  useMuatPartai({
    data: input, depth: 6, boardSoundsRef, t: (key) => key, siapkan, pekerjaanLaporan: work,
    analyzeController: controller, setAnalyzeController: setController, setPageState, setPlayers, setGame, setErrors,
    setTab, setProgress: noop, setLangkahSementara: noop, setTime, setResult,
    setAnimation: noop, setArrows, setCustomLine, setAnalyzingMove: noop, setMoveNumber, setWhite, setPlaying: noop,
  });
  snapshot.current = { data: input, controller, pageState, players, game, errors, moveNumber, white, tab, customLine, arrows, time, result, depth: 6 };
  return null;
}

test("real board loading coordinates cancellation and late engine readiness with separate report records", async (tes) => {
  const originalFetch = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  Object.defineProperty(globalThis, "fetch", { configurable: true, writable: true, value: async () => ({ ok: true, json: async () => ({}) }) });
  tes.after(() => {
    if (originalFetch) Object.defineProperty(globalThis, "fetch", originalFetch);
    else delete globalThis.fetch;
  });
  const adapter = adapterMemori();
  const store = buatPenyimpananPekerjaan(adapter);
  const snapshot = { current: {} };
  const work = buatManajerLaporan(() => snapshot.current, store);
  const old = tertunda();
  const canceled = tertunda();
  const engine = {
    calls: [], gameBaru: noop, setop: noop,
    async cari(fen, options) {
      this.calls.push({ fen, depth: options.kedalaman });
      return { staticEval: ["cp", "0"], bestMove: undefined, daftarKandidat: [] };
    },
  };
  let requests = 0;
  const siapkan = () => {
    requests++;
    if (requests === 1) return old.promise;
    if (requests === 3) return canceled.promise;
    return Promise.resolve(engine);
  };
  let props = { work, input: data("laporan:a", "Lama"), siapkan, snapshot };
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness, props)); await flush(); });
  assert.equal(snapshot.current.pageState, "loading");
  assert.equal((await store.ambil("laporan:a")).status, "berjalan");

  props = { ...props, input: data("laporan:b", "Baru", "d4 d5") };
  await act(async () => { renderer.update(React.createElement(Harness, props)); await flush(); });
  assert.equal((await store.ambil("laporan:a")).status, "terputus");
  assert.equal((await store.ambil("laporan:b")).status, "selesai");
  assert.equal(snapshot.current.players[0].name, "Baru");
  assert.equal(engine.calls.length, 3);
  const selesaiB = structuredClone(await store.ambil("laporan:b"));
  await act(async () => { old.resolve(engine); await flush(); });
  assert.equal(engine.calls.length, 3);
  assert.deepEqual(await store.ambil("laporan:b"), selesaiB);
  assert.equal((await store.ambil("laporan:a")).status, "terputus");

  props = { ...props, input: data("laporan:c", "Batal") };
  await act(async () => { renderer.update(React.createElement(Harness, props)); await flush(); });
  assert.equal((await store.ambil("laporan:c")).status, "berjalan");
  await act(async () => { snapshot.current.controller.abort(); await flush(); });
  assert.equal((await store.ambil("laporan:c")).status, "terputus");
  await act(async () => { canceled.resolve(engine); await flush(); });
  assert.equal(engine.calls.length, 3);
  assert.equal((await store.ambil("laporan:b")).status, "selesai");
  assert.equal((await store.ambil("laporan:c")).status, "terputus");
  await act(async () => { renderer.unmount(); await flush(); });
  await store.tungguTulis();
  assert.deepEqual(new Set(adapter.isi.keys()), new Set(["laporan:a", "laporan:b", "laporan:c", "meta:laporan-aktif"]));
});

test("history validates target prefixes and combines legacy jobs without duplicate targeted rows", async () => {
  const adapter = adapterMemori();
  const store = buatPenyimpananPekerjaan(adapter);
  assert.equal(Object.isFrozen(KUNCI_FITUR), true);
  store.simpan({ id: "laporan:1", jenis: "laporan", judul: "Satu", status: "selesai", waktu: 1 });
  store.simpan({ id: "draf:1", jenis: "draf", judul: "Draf", status: "draf", waktu: 2, isi: { tipe: "pgn" } });
  catatFitur("constructor", "laporan:1", store, 3);
  catatFitur("bermain", "draf:1", store, 4);
  catatFitur("impor", "draf:1", store, 5);
  catatFitur("bermain", "laporan:1", store, 6);
  await store.tungguTulis();
  assert.equal(store.snapshot().daftar.some((item) => item.id === "fitur:constructor:laporan:1"), false);
  assert.equal((await store.ambil("fitur:bermain")).targetId, null);
  assert.deepEqual(daftarRiwayat(store.snapshot().daftar).map((row) => row.item.id), [
    "fitur:bermain:laporan:1", "fitur:impor:draf:1",
  ]);
  assert.equal(daftarRiwayat(store.snapshot().daftar)[0].pekerjaan.judul, "Satu");
  assert.deepEqual(daftarRiwayat(null), []);
});

test("source and title helpers retain their fallback and trimming rules", () => {
  assert.deepEqual(sumberPekerjaan({ format: "pgn", string: 123 }), { format: "pgn", string: "123" });
  assert.deepEqual(sumberPekerjaan({ format: "other", string: null }), { format: "fen", string: "" });
  assert.deepEqual(sumberPekerjaan(null), { format: "fen", string: "" });
  assert.equal(judulPekerjaan([{ name: "  Alice  " }, { name: " " }]), "Alice vs ?");
  assert.equal(judulPekerjaan([{ name: " " }, { name: " Bob " }]), "? vs Bob");
  assert.equal(judulPekerjaan(null), "");
});
