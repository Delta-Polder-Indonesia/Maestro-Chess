import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import TestRenderer from "react-test-renderer";
import * as asli from "../src/halaman/Analisa/konteks/mesinKonteks.js";
import * as daftarEngine from "../src/lib/engineCatur.js";
import { EngineAnalisis } from "../src/halaman/Analisa/mesin/engine.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";
import { storageMemori } from "./bantuStorage.mjs";

const { act } = TestRenderer;
const pathKonteks = "src/halaman/Analisa/konteks/mesinKonteks.js";
const pathProvider = "src/halaman/Analisa/konteks/mesin.jsx";
const pesanTanpaProvider = "useMesin() harus dipakai di dalam <MesinProvider>";
const bidangProvider = [
  "idEngine", "gantiEngine", "status", "galat", "siapkan", "setop", "opsi", "opsiBawaan", "ubahOpsi", "ambilMesin", "didukung",
];

function tunda() {
  let selesai;
  let gagal;
  const janji = new Promise((resolve, reject) => { selesai = resolve; gagal = reject; });
  return { janji, selesai, gagal };
}

function lingkungan(tes, { simpanan = [], didukung = true, hashBawaan = 32, server = false, engineAsli = false, globals = {}, tambahan = {} } = {}) {
  const kunciGlobal = new Set(["localStorage", "window", "document", ...Object.keys(globals)]);
  const sebelumnya = Object.fromEntries([...kunciGlobal].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const renderers = new Set();
  const penyimpanan = storageMemori(simpanan);
  const operasi = [];
  for (const metode of ["getItem", "setItem", "removeItem"]) {
    const asliStorage = penyimpanan[metode];
    penyimpanan[metode] = function (...argumen) {
      operasi.push([metode, ...argumen]);
      return asliStorage.apply(this, argumen);
    };
  }
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: penyimpanan });
  if (server) delete globalThis.window;
  else Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: { innerHeight: 640, addEventListener() {}, removeEventListener() {} } });
  Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: {} });
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  tes.after(() => {
    for (const renderer of renderers) act(() => renderer.unmount());
    for (const [key, descriptor] of Object.entries(sebelumnya)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  });

  const mesinDibuat = [];
  let pemeriksaanWasm = 0;
  class MesinTiruan {
    constructor(opsi) { this.konstruksi = opsi; this.pending = []; this.dihancurkan = 0; this.dihentikan = 0; this.opsiTerapan = []; mesinDibuat.push(this); }
    siapkan() { const d = tunda(); this.pending.push(d); return d.janji; }
    hancurkan() { this.dihancurkan++; }
    setop() { this.dihentikan++; }
    terapkanOpsi(opsi) { this.opsiTerapan.push(opsi); }
  }
  const muat = buatPemuatJsx({
    "src/modul/analisis/mesin.js": {
      ...daftarEngine,
      hashUntukEngine: () => hashBawaan,
      wasmSupported: () => { pemeriksaanWasm++; return didukung; },
    },
    "src/halaman/Analisa/mesin/engine.js": { EngineAnalisis: engineAsli ? EngineAnalisis : MesinTiruan },
    ...tambahan,
  });
  const konteks = muat(pathKonteks);
  const provider = muat(pathProvider);
  function mount(onMount) {
    let nilai;
    let nilaiLangsung;
    let hasilMount;
    let renderCount = 0;
    function Probe() {
      renderCount++;
      nilai = konteks.useMesin();
      nilaiLangsung = React.useContext(konteks.KonteksMesin);
      React.useEffect(() => { if (onMount) hasilMount = onMount(nilai); }, []);
      return React.createElement("span", { "data-uji": "probe-mesin" });
    }
    let renderer;
    act(() => { renderer = TestRenderer.create(React.createElement(provider.MesinProvider, null, React.createElement(Probe))); });
    renderers.add(renderer);
    return {
      get nilai() { return nilai; }, get nilaiLangsung() { return nilaiLangsung; }, get hasilMount() { return hasilMount; },
      get renders() { return renderCount; }, get renderer() { return renderer; },
      unmount() { if (renderer) { act(() => renderer.unmount()); renderers.delete(renderer); renderer = null; } },
    };
  }
  return { konteks, provider, muat, mount, penyimpanan, operasi, mesinDibuat, renderers, get pemeriksaanWasm() { return pemeriksaanWasm; } };
}

function tanpaLog(fn) {
  const sebelumnya = console.error;
  console.error = () => {};
  try { return fn(); } finally { console.error = sebelumnya; }
}

test("the original engine context exposes only two named exports and defaults to null", (tes) => {
  assert.deepEqual(Object.keys(asli).sort(), ["KonteksMesin", "useMesin"]);
  assert.equal(Object.hasOwn(asli, "default"), false);
  assert.equal(typeof asli.useMesin, "function");
  let nilai = "belum dibaca";
  function Probe() { nilai = React.useContext(asli.KonteksMesin); return null; }
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(Probe)); });
  tes.after(() => act(() => renderer.unmount()));
  assert.equal(nilai, null);
});

test("useMesin outside the provider throws the existing exact message", () => {
  function Probe() { asli.useMesin(); return null; }
  tanpaLog(() => assert.throws(() => act(() => TestRenderer.create(React.createElement(Probe))), { message: pesanTanpaProvider }));
});

test("useMesin rejects all falsy context values but returns truthy values without validation or copying", () => {
  function Probe({ terima }) { terima(asli.useMesin()); return null; }
  for (const nilai of [null, undefined, false, 0, "", NaN]) {
    tanpaLog(() => assert.throws(() => act(() => TestRenderer.create(
      React.createElement(asli.KonteksMesin.Provider, { value: nilai }, React.createElement(Probe, { terima() {} }))
    )), { message: pesanTanpaProvider }));
  }
  for (const nilai of [true, 1, "mesin", [], {}, () => "engine"]) {
    let diterima;
    let renderer;
    act(() => { renderer = TestRenderer.create(React.createElement(asli.KonteksMesin.Provider, { value: nilai }, React.createElement(Probe, { terima: (x) => { diterima = x; } }))); });
    assert.strictEqual(diterima, nilai);
    act(() => renderer.unmount());
  }
});

test("nested engine contexts use the nearest provider and update consumers without crossing boundaries", (tes) => {
  const nilai = {};
  const hitung = { luar: 0, dalam: 0 };
  const Probe = React.memo(function Probe({ nama }) { hitung[nama]++; nilai[nama] = asli.useMesin(); return null; });
  const pertama = { id: "luar-1" };
  const kedua = { id: "luar-2" };
  const dalam = { id: "dalam" };
  const pohon = (luar) => React.createElement(asli.KonteksMesin.Provider, { value: luar },
    React.createElement(Probe, { nama: "luar" }),
    React.createElement(asli.KonteksMesin.Provider, { value: dalam }, React.createElement(Probe, { nama: "dalam" })));
  let renderer;
  act(() => { renderer = TestRenderer.create(pohon(pertama)); });
  tes.after(() => act(() => renderer.unmount()));
  assert.strictEqual(nilai.luar, pertama);
  assert.strictEqual(nilai.dalam, dalam);
  act(() => renderer.update(pohon(kedua)));
  assert.strictEqual(nilai.luar, kedua);
  assert.strictEqual(nilai.dalam, dalam);
  assert.deepEqual(hitung, { luar: 2, dalam: 1 });
  act(() => renderer.update(pohon(kedua)));
  assert.deepEqual(hitung, { luar: 2, dalam: 1 });
});

test("the original named provider and hook expose the same value with lazy engine creation", (tes) => {
  const ling = lingkungan(tes);
  assert.deepEqual(Object.keys(ling.provider), ["MesinProvider"]);
  assert.deepEqual(Object.keys(ling.konteks).sort(), ["KonteksMesin", "useMesin"]);
  const app = ling.mount();
  assert.strictEqual(app.nilai, app.nilaiLangsung);
  assert.deepEqual(Object.keys(app.nilai), bidangProvider);
  assert.equal(app.nilai.idEngine, daftarEngine.ENGINE_BAKU);
  assert.equal(app.nilai.status, "mati");
  assert.equal(app.nilai.galat, "");
  assert.equal(app.nilai.didukung, true);
  assert.deepEqual(app.nilai.opsi, { hash: 32, threads: 1, skill: null, movetime: null, mode: "kedalaman", nodes: 250000 });
  assert.deepEqual(app.nilai.opsiBawaan, { hash: 32, skill: null, movetime: null, mode: "kedalaman", nodes: 250000 });
  for (const nama of ["gantiEngine", "siapkan", "setop", "ubahOpsi", "ambilMesin"]) assert.equal(typeof app.nilai[nama], "function", nama);
  assert.equal(app.nilai.ambilMesin(), null);
  assert.equal(ling.mesinDibuat.length, 0);
  assert.equal(ling.operasi.some(([metode]) => metode !== "getItem"), false);
  act(() => app.nilai.setop());
  assert.equal(ling.mesinDibuat.length, 0);
});

test("saved engine and options are restored and clamped without writing storage on mount", (tes) => {
  const ling = lingkungan(tes, { hashBawaan: 48, simpanan: [
    ["maestro-analisa-engine", "stockfish-16"], ["maestro-analisa-hash", "256.4"],
    ["maestro-analisa-skill", "-5"], ["maestro-analisa-movetime", "250.5"],
    ["maestro-analisa-threads", "12"],
  ] });
  const app = ling.mount();
  assert.equal(app.nilai.idEngine, "stockfish-16");
  assert.deepEqual(app.nilai.opsi, { hash: 128, threads: 1, skill: 0, movetime: 1000, mode: "waktu", nodes: 250000 });
  assert.deepEqual(app.nilai.opsiBawaan, { hash: 48, skill: null, movetime: null, mode: "kedalaman", nodes: 250000 });
  assert.equal(ling.operasi.some(([metode]) => metode !== "getItem"), false);
  assert.equal(ling.penyimpanan.getItem("maestro-analisa-threads"), "12");
});

test("WASM capability is evaluated once in a browser even after state updates", (tes) => {
  const browser = lingkungan(tes, { didukung: false });
  const app = browser.mount();
  assert.equal(app.nilai.didukung, false);
  assert.equal(browser.pemeriksaanWasm, 1);
  act(() => app.nilai.ubahOpsi({ hash: 64 }));
  assert.equal(app.nilai.didukung, false);
  assert.equal(browser.pemeriksaanWasm, 1);
  app.unmount();
});

test("server-side initialization does not call the browser WASM capability probe", (tes) => {
  const ling = lingkungan(tes, { server: true, didukung: false });
  const app = ling.mount();
  assert.equal(app.nilai.didukung, true);
  assert.equal(ling.pemeriksaanWasm, 0);
});

test("a child mount effect prepares the saved engine before the provider's visible state is restored", async (tes) => {
  const ling = lingkungan(tes, { simpanan: [["maestro-analisa-engine", "stockfish-16"]] });
  let idTerlihatSaatEfek;
  const app = ling.mount((nilai) => { idTerlihatSaatEfek = nilai.idEngine; return nilai.siapkan(); });
  assert.equal(idTerlihatSaatEfek, daftarEngine.ENGINE_BAKU);
  assert.equal(app.nilai.idEngine, "stockfish-16");
  assert.equal(ling.mesinDibuat.length, 1);
  assert.equal(ling.mesinDibuat[0].konstruksi.idEngine, "stockfish-16");
  await act(async () => { ling.mesinDibuat[0].pending[0].selesai(); await app.hasilMount; });
  assert.equal(app.nilai.status, "siap");
});

test("repeated preparation shares one engine instance and stable commands while context values update", async (tes) => {
  const ling = lingkungan(tes);
  const app = ling.mount();
  const awal = app.nilai;
  const fungsi = Object.fromEntries(["gantiEngine", "siapkan", "setop", "ubahOpsi", "ambilMesin"].map((nama) => [nama, awal[nama]]));
  let satu;
  let dua;
  act(() => { satu = awal.siapkan(); dua = awal.siapkan(); });
  assert.equal(ling.mesinDibuat.length, 1);
  const mesin = ling.mesinDibuat[0];
  assert.strictEqual(app.nilai.ambilMesin(), mesin);
  assert.equal(mesin.pending.length, 2);
  assert.equal(app.nilai.status, "memuat");
  assert.notStrictEqual(app.nilai, awal);
  assert.strictEqual(app.nilai.opsiBawaan, awal.opsiBawaan);
  for (const [nama, fn] of Object.entries(fungsi)) assert.strictEqual(app.nilai[nama], fn, nama);
  let hasil;
  await act(async () => { mesin.pending.forEach((p) => p.selesai()); hasil = await Promise.all([satu, dua]); });
  assert.deepEqual(hasil, [mesin, mesin]);
  assert.equal(app.nilai.status, "siap");
  act(() => app.nilai.setop());
  assert.equal(mesin.dihentikan, 1);
});

test("switching creates a replacement even for the same ID and invalid IDs use the old fallback", (tes) => {
  const ling = lingkungan(tes);
  const app = ling.mount();
  act(() => app.nilai.gantiEngine(daftarEngine.ENGINE_BAKU));
  assert.equal(ling.mesinDibuat.length, 1);
  assert.strictEqual(app.nilai.ambilMesin(), ling.mesinDibuat[0]);
  act(() => app.nilai.gantiEngine(daftarEngine.ENGINE_BAKU));
  assert.equal(ling.mesinDibuat.length, 2);
  assert.equal(ling.mesinDibuat[0].dihancurkan, 1);
  assert.equal(ling.mesinDibuat[1].pending.length, 0);
  act(() => app.nilai.gantiEngine("id-tidak-dikenal"));
  assert.equal(ling.mesinDibuat[1].dihancurkan, 1);
  assert.equal(app.nilai.idEngine, daftarEngine.ENGINE_BAKU);
  assert.equal(app.nilai.status, "mati");
  assert.equal(ling.penyimpanan.getItem("maestro-analisa-engine"), daftarEngine.ENGINE_BAKU);
  app.unmount();
  assert.equal(ling.mesinDibuat[2].dihancurkan, 1);
});

test("option updates clamp values, keep one thread, and preserve existing storage semantics", (tes) => {
  const ling = lingkungan(tes);
  const app = ling.mount();
  act(() => app.nilai.ubahOpsi({ hash: 200.6, skill: 25.5, movetime: 42, threads: 8 }));
  assert.deepEqual(app.nilai.opsi, { hash: 128, threads: 1, skill: 20, movetime: 1000, mode: "kedalaman", nodes: 250000 });
  assert.equal(ling.penyimpanan.getItem("maestro-analisa-hash"), "128");
  assert.equal(ling.penyimpanan.getItem("maestro-analisa-skill"), "20");
  assert.equal(ling.penyimpanan.getItem("maestro-analisa-movetime"), "1000");
  assert.equal(ling.penyimpanan.getItem("maestro-analisa-threads"), null);
  assert.equal(ling.mesinDibuat.length, 0);
  act(() => app.nilai.ubahOpsi({ hash: NaN, skill: "bukan-angka", movetime: "" }));
  assert.deepEqual(app.nilai.opsi, { hash: 128, threads: 1, skill: 20, movetime: null, mode: "kedalaman", nodes: 250000 });
  assert.equal(ling.penyimpanan.getItem("maestro-analisa-skill"), "20");
  assert.equal(ling.penyimpanan.getItem("maestro-analisa-movetime"), "");
  act(() => app.nilai.ubahOpsi({ hash: -4.4, skill: null, movetime: 60000.8 }));
  assert.deepEqual(app.nilai.opsi, { hash: 16, threads: 1, skill: null, movetime: 60000, mode: "kedalaman", nodes: 250000 });
  assert.equal(ling.penyimpanan.getItem("maestro-analisa-skill"), "");
  assert.equal(ling.penyimpanan.getItem("maestro-analisa-movetime"), "60000");
});

test("inherited skill and movetime properties are currently accepted and persisted", (tes) => {
  const ling = lingkungan(tes);
  const app = ling.mount();
  const perubahan = Object.create({ skill: 7.6, movetime: 2345.6 });
  act(() => app.nilai.ubahOpsi(perubahan));
  assert.deepEqual(app.nilai.opsi, { hash: 32, threads: 1, skill: 8, movetime: 2346, mode: "kedalaman", nodes: 250000 });
  assert.equal(ling.penyimpanan.getItem("maestro-analisa-skill"), "8");
  assert.equal(ling.penyimpanan.getItem("maestro-analisa-movetime"), "2346");
});

test("search mode and node limit persist, clamp, and ignore unknown modes", (tes) => {
  const ling = lingkungan(tes);
  const app = ling.mount();
  assert.equal(app.nilai.opsi.mode, "kedalaman");
  assert.equal(app.nilai.opsi.nodes, 250000);
  act(() => app.nilai.ubahOpsi({ mode: "node", nodes: 500000 }));
  assert.equal(app.nilai.opsi.mode, "node");
  assert.equal(app.nilai.opsi.nodes, 500000);
  assert.equal(ling.penyimpanan.getItem("maestro-analisa-mode"), "node");
  assert.equal(ling.penyimpanan.getItem("maestro-analisa-nodes"), "500000");
  act(() => app.nilai.ubahOpsi({ mode: "tidak-ada", nodes: 99 }));
  assert.equal(app.nilai.opsi.mode, "node");
  assert.equal(app.nilai.opsi.nodes, 10000);
  act(() => app.nilai.ubahOpsi({ mode: "waktu", nodes: 999999999 }));
  assert.equal(app.nilai.opsi.mode, "waktu");
  assert.equal(app.nilai.opsi.nodes, 10000000);
});

test("a saved search mode is restored and a legacy time limit implies time mode", (tes) => {
  const modeTersimpan = lingkungan(tes, { simpanan: [["maestro-analisa-mode", "node"], ["maestro-analisa-nodes", "100000"]] });
  const appMode = modeTersimpan.mount();
  assert.equal(appMode.nilai.opsi.mode, "node");
  assert.equal(appMode.nilai.opsi.nodes, 100000);
  const legacy = lingkungan(tes, { simpanan: [["maestro-analisa-movetime", "4000"]] });
  const appLegacy = legacy.mount();
  assert.equal(appLegacy.nilai.opsi.mode, "waktu");
});

test("option changes are passed to the existing engine without creating or starting another one", (tes) => {
  const ling = lingkungan(tes);
  const app = ling.mount();
  act(() => app.nilai.gantiEngine("stockfish-16"));
  const mesin = ling.mesinDibuat[0];
  act(() => app.nilai.ubahOpsi({ hash: 64, skill: 9, movetime: 3000 }));
  assert.equal(ling.mesinDibuat.length, 1);
  assert.equal(mesin.pending.length, 0);
  assert.deepEqual(mesin.opsiTerapan, [{ hash: 64, threads: 1, skill: 9, movetime: 3000, mode: "kedalaman", nodes: 250000 }]);
  assert.strictEqual(app.nilai.ambilMesin(), mesin);
});

test("blocked storage leaves changed engine and options usable in memory", (tes) => {
  const ling = lingkungan(tes);
  const app = ling.mount();
  ling.penyimpanan.gagalTulis = true;
  tanpaLog(() => act(() => { app.nilai.gantiEngine("stockfish-19-lite"); app.nilai.ubahOpsi({ hash: 64, skill: 5, movetime: 2200 }); }));
  assert.equal(app.nilai.idEngine, "stockfish-19-lite");
  assert.deepEqual(app.nilai.opsi, { hash: 64, threads: 1, skill: 5, movetime: 2200, mode: "kedalaman", nodes: 250000 });
  assert.equal(ling.penyimpanan.getItem("maestro-analisa-engine"), null);
  assert.equal(ling.penyimpanan.getItem("maestro-analisa-hash"), null);
  assert.equal(ling.mesinDibuat[0].dihancurkan, 0);
});

test("an old startup that resolves after a selection change rejects without overwriting the new status", async (tes) => {
  const ling = lingkungan(tes);
  const app = ling.mount();
  let lama;
  act(() => { lama = app.nilai.siapkan(); });
  const ditolak = assert.rejects(lama, { message: "engine diganti" });
  const pertama = ling.mesinDibuat[0];
  act(() => app.nilai.gantiEngine("stockfish-16"));
  const kedua = ling.mesinDibuat[1];
  assert.equal(pertama.dihancurkan, 1);
  assert.equal(app.nilai.idEngine, "stockfish-16");
  assert.equal(app.nilai.status, "mati");
  await act(async () => { pertama.pending[0].selesai(); await ditolak; });
  assert.strictEqual(app.nilai.ambilMesin(), kedua);
  assert.equal(app.nilai.status, "mati");
  assert.equal(app.nilai.galat, "");
});

test("stale engine errors are ignored while the active engine reports failure through the shared context", (tes) => {
  const ling = lingkungan(tes);
  const app = ling.mount();
  act(() => { app.nilai.gantiEngine("stockfish-16"); app.nilai.gantiEngine("stockfish-19-lite"); });
  const [lama, aktif] = ling.mesinDibuat;
  tanpaLog(() => act(() => lama.konstruksi.onError(new Error("lama"))));
  assert.equal(app.nilai.status, "mati");
  assert.equal(app.nilai.galat, "");
  tanpaLog(() => act(() => aktif.konstruksi.onError(new Error("worker rusak"))));
  assert.equal(app.nilai.status, "gagal");
  assert.equal(app.nilai.galat, "worker rusak");
  assert.strictEqual(app.nilai.ambilMesin(), aktif);
});

test("failed preparation reports its error and retry uses the same wrapper", async (tes) => {
  const ling = lingkungan(tes);
  const app = ling.mount();
  let pertama;
  act(() => { pertama = app.nilai.siapkan(); });
  const error = new Error("startup gagal");
  const ditolak = assert.rejects(pertama, (terjadi) => terjadi === error);
  const mesin = ling.mesinDibuat[0];
  await act(async () => { mesin.pending[0].gagal(error); await ditolak; });
  assert.equal(app.nilai.status, "gagal");
  assert.equal(app.nilai.galat, "startup gagal");
  let kedua;
  act(() => { kedua = app.nilai.siapkan(); });
  assert.equal(ling.mesinDibuat.length, 1);
  assert.equal(app.nilai.status, "memuat");
  await act(async () => { mesin.pending[1].selesai(); assert.strictEqual(await kedua, mesin); });
  assert.equal(app.nilai.status, "siap");
  assert.equal(app.nilai.galat, "");
  app.unmount();
  assert.equal(mesin.dihancurkan, 1);
});

test("separate provider mounts isolate their state and remount restores saved options", (tes) => {
  const ling = lingkungan(tes);
  const satu = ling.mount();
  const dua = ling.mount();
  assert.notStrictEqual(satu.nilai, dua.nilai);
  assert.notStrictEqual(satu.nilai.ambilMesin, dua.nilai.ambilMesin);
  act(() => { satu.nilai.gantiEngine("stockfish-16"); satu.nilai.ubahOpsi({ hash: 64 }); });
  assert.equal(satu.nilai.idEngine, "stockfish-16");
  assert.equal(satu.nilai.opsi.hash, 64);
  assert.equal(dua.nilai.idEngine, daftarEngine.ENGINE_BAKU);
  assert.equal(dua.nilai.opsi.hash, 32);
  assert.equal(dua.nilai.ambilMesin(), null);
  const mesin = ling.mesinDibuat[0];
  satu.unmount();
  assert.equal(mesin.dihancurkan, 1);
  const baru = ling.mount();
  assert.equal(baru.nilai.idEngine, "stockfish-16");
  assert.equal(baru.nilai.opsi.hash, 64);
  assert.equal(baru.nilai.ambilMesin(), null);
  assert.equal(dua.nilai.idEngine, daftarEngine.ENGINE_BAKU);
});

test("the real engine wrapper starts one fake Worker lazily and terminates it on provider unmount", async (tes) => {
  const workers = [];
  class WorkerTiruan {
    constructor(url) { this.url = url; this.perintah = []; this.dihentikan = false; workers.push(this); }
    postMessage(perintah) { this.perintah.push(perintah); }
    terminate() { this.dihentikan = true; }
    emit(data) { this.onmessage?.({ data }); }
  }
  const ling = lingkungan(tes, { engineAsli: true, globals: { Worker: WorkerTiruan } });
  const app = ling.mount();
  assert.equal(workers.length, 0);
  act(() => app.nilai.gantiEngine("stockfish-16"));
  assert.equal(workers.length, 0);
  let satu;
  let dua;
  act(() => { satu = app.nilai.siapkan(); dua = app.nilai.siapkan(); });
  assert.equal(workers.length, 1);
  assert.match(workers[0].url, /stockfish-nnue-16-single\.js$/);
  assert.ok(workers[0].perintah.includes("setoption name Use NNUE value true"));
  await act(async () => {
    workers[0].emit("readyok");
    const hasil = await Promise.all([satu, dua]);
    assert.strictEqual(hasil[0], hasil[1]);
    assert.strictEqual(hasil[0], app.nilai.ambilMesin());
  });
  assert.equal(app.nilai.status, "siap");
  app.unmount();
  assert.equal(workers[0].dihentikan, true);
});

test("the real Loading component reads engine status through the original hook and cancels its own controller", async (tes) => {
  const timers = [];
  const ling = lingkungan(tes, {
    globals: {
      setInterval: (callback, ms) => { const timer = { callback, ms, dibersihkan: false }; timers.push(timer); return timer; },
      clearInterval: (timer) => { timer.dibersihkan = true; },
    },
    tambahan: {
      "src/lib/i18n.jsx": { useI18n: () => ({ t: (key) => key }) },
      "src/modul/sesi/impor.js": { useImport: () => ({ progress: [42, () => {}] }) },
      "src/halaman/Analisa/komponen/svg/lens.jsx": { default: () => null },
      "src/halaman/Analisa/komponen/loading/DualRingSpinner.jsx": { default: () => null },
      "src/halaman/Analisa/komponen/menu/loading/loadingBar.jsx": { default: () => null },
    },
  });
  const Loading = ling.muat("src/halaman/Analisa/komponen/menu/loading/loading.jsx").default;
  const controller = new AbortController();
  let nilai;
  function Probe() { nilai = ling.konteks.useMesin(); return React.createElement(Loading, { format: "pgn", analyzeController: controller }); }
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(ling.provider.MesinProvider, null, React.createElement(Probe))); });
  ling.renderers.add(renderer);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 300);
  const adaTeks = (text) => renderer.root.findAllByType("div").some((node) => node.children.includes(text));
  assert.ok(adaTeks("analisa.muat.menganalisa"));
  let siap;
  act(() => { siap = nilai.siapkan(); });
  assert.ok(adaTeks("analisa.status.memuat"));
  await act(async () => { ling.mesinDibuat[0].pending[0].selesai(); await siap; });
  assert.ok(adaTeks("analisa.muat.menganalisa"));
  act(() => renderer.root.findByType("button").props.onClick());
  assert.equal(controller.signal.aborted, true);
  act(() => renderer.unmount());
  ling.renderers.delete(renderer);
  assert.equal(timers[0].dibersihkan, true);
});

test("the real Analisa root gives navigation and workspace the same original engine context", (tes) => {
  const nilai = {};
  let hook;
  const Pass = ({ children }) => React.createElement(React.Fragment, null, children);
  const probe = (nama) => function Probe() { nilai[nama] = hook(); return React.createElement("span", { "data-uji": nama }); };
  const ling = lingkungan(tes, { tambahan: {
    "src/lib/i18n.jsx": { I18nProvider: Pass },
    "src/modul/sesi/analisaProvider.js": { default: Pass },
    "src/modul/sesi/index.js": { ConfigContextProvider: Pass, ErrorsContextProvider: Pass, TabKerjaProvider: Pass },
    "src/halaman/Analisa/komponen/errors/pageErrors.jsx": { default: () => null },
    "src/halaman/Analisa/komponen/nav/nav.jsx": { default: probe("nav") },
    "src/halaman/Analisa/komponen/areaKerja.jsx": { default: probe("area") },
    "src/halaman/Analisa/analisa.css": {},
  } });
  hook = ling.konteks.useMesin;
  const Analisa = ling.muat("src/halaman/Analisa/Analisa.jsx").default;
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(Analisa)); });
  ling.renderers.add(renderer);
  assert.strictEqual(nilai.nav, nilai.area);
  assert.equal(nilai.nav.idEngine, daftarEngine.ENGINE_BAKU);
  act(() => nilai.nav.gantiEngine("stockfish-16"));
  assert.strictEqual(nilai.nav, nilai.area);
  assert.equal(nilai.area.idEngine, "stockfish-16");
  assert.equal(ling.mesinDibuat.length, 1);
});
