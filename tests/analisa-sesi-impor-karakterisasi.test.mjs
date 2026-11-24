import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import TestRenderer from "react-test-renderer";
import { IDBFactory } from "fake-indexeddb";
import * as konteksAsli from "../src/halaman/Analisa/konteks/importKonteks.js";
import * as pekerjaanAsli from "../src/modul/pekerjaan/index.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const kunciTitipan = "maestro-analisa-impor-awal";
const namaField = ["data", "pageState", "progress", "analyzeController", "analyzingMove", "langkahSementara"];

function pasangStorage(tes, awal = []) {
  const sebelumnya = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const data = new Map(awal);
  const operasi = [];
  const storage = {
    data, operasi,
    getItem(key) { operasi.push(["get", key]); return data.get(key) ?? null; },
    setItem(key, value) { operasi.push(["set", key, String(value)]); data.set(key, String(value)); },
    removeItem(key) { operasi.push(["remove", key]); data.delete(key); },
  };
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, writable: true, value: storage });
  tes.after(() => {
    if (sebelumnya) Object.defineProperty(globalThis, "sessionStorage", sebelumnya);
    else delete globalThis.sessionStorage;
  });
  return storage;
}

function pekerjaanTiruan() {
  let nomor = 0;
  let snapshot = { daftar: [], aktif: { id: null } };
  let kegagalan = null;
  const operasi = [];
  function periksa(nama) { if (kegagalan?.pada === nama) throw kegagalan.error; }
  return {
    operasi,
    setSnapshot(nilai) { snapshot = nilai; },
    setKegagalan(nilai) { kegagalan = nilai; },
    get nomor() { return nomor; },
    ekspor: {
      KUNCI_FITUR: {}, ID_DRAF_IMPOR: "draf:impor", buatIdDrafImpor: () => "draf:uji",
      buatIdPekerjaan() { operasi.push("buat-id"); periksa("buat-id"); return `laporan:uji-${++nomor}`; },
      simpanLaporanAktif() { operasi.push("simpan-laporan"); periksa("simpan-laporan"); },
      pekerjaan: { snapshot() { operasi.push("snapshot"); periksa("snapshot"); return snapshot; } },
    },
  };
}

function siapkanProvider(tes, pekerjaan, tiruan = {}) {
  const muat = buatPemuatJsx({ "src/modul/pekerjaan/index.js": pekerjaan.ekspor, ...tiruan });
  const provider = muat("src/halaman/Analisa/konteks/import.jsx");
  const konteks = muat("src/halaman/Analisa/konteks/importKonteks.js");
  let nilai;
  let renderer;
  function Probe({ versi }) {
    nilai = konteks.useImport();
    assert.strictEqual(nilai, React.useContext(konteks.ImportContext));
    return React.createElement("span", { "data-uji": "anak-impor" }, versi);
  }
  const pohon = (versi) => React.createElement(provider.ImportProvider, null, React.createElement(Probe, { versi }));
  tes.after(() => { if (renderer) act(() => renderer.unmount()); });
  return {
    muat, provider, konteks,
    get nilai() { return nilai; },
    get renderer() { return renderer; },
    async mount(versi = "satu") {
      await act(async () => { renderer = TestRenderer.create(pohon(versi)); await flush(); });
    },
    async update(versi = "dua") {
      await act(async () => { renderer.update(pohon(versi)); await flush(); });
    },
    async unmount() {
      if (renderer) { await act(async () => { renderer.unmount(); await flush(); }); renderer = null; }
    },
  };
}

test("the original context exposes its named API and stable neutral default pairs outside a provider", () => {
  assert.deepEqual(Object.keys(konteksAsli).sort(), ["ImportContext", "useImport"]);
  let lewatHook;
  let langsung;
  function Probe() {
    lewatHook = konteksAsli.useImport();
    langsung = React.useContext(konteksAsli.ImportContext);
    return null;
  }
  assert.equal(renderToString(React.createElement(Probe)), "");
  assert.strictEqual(lewatHook, langsung);
  assert.deepEqual(Object.keys(langsung), namaField);
  assert.deepEqual(langsung.data[0], { format: "fen", string: "" });
  assert.equal(langsung.pageState[0], "default");
  assert.equal(langsung.progress[0], 0);
  assert.ok(langsung.analyzeController[0] instanceof AbortController);
  assert.equal(langsung.analyzeController[0].signal.aborted, false);
  assert.equal(langsung.analyzingMove[0], false);
  assert.deepEqual(langsung.langkahSementara[0], []);
  const setter = langsung.data[1];
  for (const nama of namaField) {
    assert.strictEqual(langsung[nama][1], setter, nama);
    assert.equal(langsung[nama][1](() => { throw new Error("no-op tidak boleh memanggil updater"); }), undefined);
  }
  const awal = langsung;
  const controller = langsung.analyzeController[0];
  renderToString(React.createElement(Probe));
  assert.strictEqual(langsung, awal);
  assert.strictEqual(langsung.analyzeController[0], controller);
  assert.equal(Object.isFrozen(langsung), false);
  assert.equal(Object.isFrozen(langsung.data[0]), false);
});

test("the original provider has one named export, initial values and one lazy ID without storage writes", async (tes) => {
  const storage = pasangStorage(tes);
  const pekerjaan = pekerjaanTiruan();
  const impor = siapkanProvider(tes, pekerjaan);
  assert.deepEqual(Object.keys(impor.provider), ["ImportProvider"]);
  await impor.mount();
  const nilai = impor.nilai;
  assert.deepEqual(Object.keys(nilai), namaField);
  assert.deepEqual(nilai.data[0], { format: "fen", string: "", pekerjaanId: "laporan:uji-1", awalPekerjaan: true });
  assert.equal(nilai.pageState[0], "default");
  assert.equal(nilai.progress[0], 0);
  assert.ok(nilai.analyzeController[0] instanceof AbortController);
  assert.equal(nilai.analyzeController[0].signal.aborted, false);
  assert.equal(nilai.analyzingMove[0], false);
  assert.deepEqual(nilai.langkahSementara[0], []);
  for (const nama of namaField) assert.equal(typeof nilai[nama][1], "function", nama);
  assert.equal(impor.renderer.root.findByProps({ "data-uji": "anak-impor" }).children[0], "satu");
  assert.deepEqual(pekerjaan.operasi, ["buat-id"]);
  assert.deepEqual(storage.operasi, [["get", kunciTitipan]]);
});

test("presence of a handoff is read once per mount without consuming it", async (tes) => {
  const storage = pasangStorage(tes, [[kunciTitipan, "1. d4 d5 *"]]);
  const pekerjaan = pekerjaanTiruan();
  const impor = siapkanProvider(tes, pekerjaan);
  await impor.mount();
  assert.equal(impor.nilai.pageState[0], "loading");
  assert.equal(storage.data.get(kunciTitipan), "1. d4 d5 *");
  const controller = impor.nilai.analyzeController[0];
  storage.data.delete(kunciTitipan);
  await act(async () => { impor.nilai.progress[1](25); await flush(); });
  await impor.update();
  assert.equal(impor.nilai.pageState[0], "loading");
  assert.deepEqual(storage.operasi, [["get", kunciTitipan]]);
  await impor.unmount();
  await impor.mount();
  assert.equal(impor.nilai.pageState[0], "default");
  assert.equal(impor.nilai.data[0].pekerjaanId, "laporan:uji-2");
  assert.notStrictEqual(impor.nilai.analyzeController[0], controller);
  assert.deepEqual(storage.operasi, [["get", kunciTitipan], ["get", kunciTitipan]]);
});

test("empty handoffs and blocked sessionStorage reads keep the default page state", async (tes) => {
  const storage = pasangStorage(tes, [[kunciTitipan, ""]]);
  const pekerjaan = pekerjaanTiruan();
  const impor = siapkanProvider(tes, pekerjaan);
  await impor.mount();
  assert.equal(impor.nilai.pageState[0], "default");
  assert.equal(storage.data.has(kunciTitipan), true);
  await impor.unmount();
  storage.getItem = (key) => { storage.operasi.push(["get-gagal", key]); throw new Error("akses ditolak"); };
  await impor.mount();
  assert.equal(impor.nilai.pageState[0], "default");
  await impor.unmount();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new Error("getter ditolak"); } });
  await impor.mount();
  assert.equal(impor.nilai.pageState[0], "default");
  assert.equal(storage.operasi.some(([nama]) => nama === "remove" || nama === "set"), false);
});

test("separate provider mounts own their data and AbortController, unlike the shared default context", async (tes) => {
  pasangStorage(tes);
  const pekerjaan = pekerjaanTiruan();
  const muat = buatPemuatJsx({ "src/modul/pekerjaan/index.js": pekerjaan.ekspor });
  const { ImportProvider } = muat("src/halaman/Analisa/konteks/import.jsx");
  const { ImportContext, useImport } = muat("src/halaman/Analisa/konteks/importKonteks.js");
  const nilai = {};
  function Probe({ nama }) { nilai[nama] = useImport(); assert.strictEqual(nilai[nama], React.useContext(ImportContext)); return null; }
  renderToString(React.createElement(Probe, { nama: "default" }));
  let renderer;
  tes.after(() => { if (renderer) act(() => renderer.unmount()); });
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(React.Fragment, null,
      React.createElement(ImportProvider, null, React.createElement(Probe, { nama: "satu" })),
      React.createElement(ImportProvider, null, React.createElement(Probe, { nama: "dua" }))));
    await flush();
  });
  assert.equal(nilai.satu.data[0].pekerjaanId, "laporan:uji-1");
  assert.equal(nilai.dua.data[0].pekerjaanId, "laporan:uji-2");
  assert.notStrictEqual(nilai.satu.data[0], nilai.dua.data[0]);
  assert.notStrictEqual(nilai.satu.analyzeController[0], nilai.dua.analyzeController[0]);
  assert.notStrictEqual(nilai.satu.analyzeController[0], nilai.default.analyzeController[0]);
  nilai.satu.analyzeController[0].abort();
  assert.equal(nilai.satu.analyzeController[0].signal.aborted, true);
  assert.equal(nilai.dua.analyzeController[0].signal.aborted, false);
  assert.equal(nilai.default.analyzeController[0].signal.aborted, false);
  await act(async () => { nilai.satu.progress[1](41); nilai.satu.pageState[1]("custom"); await flush(); });
  assert.equal(nilai.satu.progress[0], 41);
  assert.equal(nilai.satu.pageState[0], "custom");
  assert.equal(nilai.dua.progress[0], 0);
  assert.equal(nilai.dua.pageState[0], "default");
  const controllerLama = nilai.satu.analyzeController[0];
  await act(async () => {
    renderer.unmount();
    renderer = TestRenderer.create(React.createElement(ImportProvider, null, React.createElement(Probe, { nama: "baru" })));
    await flush();
  });
  assert.equal(nilai.baru.data[0].pekerjaanId, "laporan:uji-3");
  assert.notStrictEqual(nilai.baru.analyzeController[0], controllerLama);
  assert.equal(nilai.baru.analyzeController[0].signal.aborted, false);
  assert.equal(nilai.baru.progress[0], 0);
});

test("non-data state setters are stable, unnormalized and do not persist or abort the replaced controller", async (tes) => {
  const storage = pasangStorage(tes);
  const pekerjaan = pekerjaanTiruan();
  const impor = siapkanProvider(tes, pekerjaan);
  await impor.mount();
  const awal = impor.nilai;
  const setters = Object.fromEntries(namaField.map((nama) => [nama, awal[nama][1]]));
  const controllerLama = awal.analyzeController[0];
  await impor.update("render ulang");
  assert.strictEqual(impor.nilai, awal, "context di-memo saat nilainya tidak berubah");
  const controllerBaru = new AbortController();
  const langkah = [{ fen: "as-is", extra: true }];
  await act(async () => {
    setters.pageState("state-lama-bebas");
    setters.progress(143.25);
    setters.analyzeController(controllerBaru);
    setters.analyzingMove("truthy-as-is");
    setters.langkahSementara(langkah);
    await flush();
  });
  assert.notStrictEqual(impor.nilai, awal);
  assert.equal(impor.nilai.pageState[0], "state-lama-bebas");
  assert.equal(impor.nilai.progress[0], 143.25);
  assert.strictEqual(impor.nilai.analyzeController[0], controllerBaru);
  assert.equal(controllerLama.signal.aborted, false);
  assert.equal(impor.nilai.analyzingMove[0], "truthy-as-is");
  assert.strictEqual(impor.nilai.langkahSementara[0], langkah);
  for (const nama of namaField) assert.strictEqual(impor.nilai[nama][1], setters[nama], nama);
  assert.deepEqual(pekerjaan.operasi, ["buat-id"]);
  assert.deepEqual(storage.operasi, [["get", kunciTitipan]]);
});

test("setData saves the current report, allocates an ID, then reuses an active empty board", async (tes) => {
  pasangStorage(tes);
  const pekerjaan = pekerjaanTiruan();
  const impor = siapkanProvider(tes, pekerjaan);
  await impor.mount();
  const idAwal = impor.nilai.data[0].pekerjaanId;
  pekerjaan.setSnapshot({ daftar: [{ id: idAwal, status: "baru" }], aktif: { id: idAwal } });
  pekerjaan.operasi.length = 0;
  const input = { format: "pgn", string: "1. e4 e5 *", tambahan: { asli: true } };
  const setter = impor.nilai.data[1];
  let kembali;
  await act(async () => { kembali = setter(input); await flush(); });
  assert.equal(kembali, undefined);
  assert.deepEqual(pekerjaan.operasi, ["simpan-laporan", "buat-id", "snapshot"]);
  assert.deepEqual(impor.nilai.data[0], { ...input, pekerjaanId: idAwal });
  assert.notStrictEqual(impor.nilai.data[0], input);
  assert.strictEqual(impor.nilai.data[0].tambahan, input.tambahan);
  assert.equal(Object.hasOwn(input, "pekerjaanId"), false);
  assert.equal(Object.hasOwn(impor.nilai.data[0], "awalPekerjaan"), false);
  assert.equal(pekerjaan.nomor, 2, "ID baru tetap dibuat meskipun akhirnya tidak dipakai");
  assert.strictEqual(impor.nilai.data[1], setter);
});

test("a completed or different active job does not reuse the initial board ID", async (tes) => {
  pasangStorage(tes);
  for (const kasus of [
    { daftar: [{ id: "laporan:uji-1", status: "selesai" }], aktif: { id: "laporan:uji-1" } },
    { daftar: [{ id: "laporan:lain", status: "baru" }], aktif: { id: "laporan:lain" } },
    { daftar: [{ id: "laporan:uji-1", status: "baru" }], aktif: { id: "laporan:lain" } },
    { daftar: [], aktif: { id: null } },
  ]) {
    const pekerjaan = pekerjaanTiruan();
    const impor = siapkanProvider(tes, pekerjaan);
    await impor.mount();
    pekerjaan.setSnapshot(kasus);
    pekerjaan.operasi.length = 0;
    await act(async () => { impor.nilai.data[1]({ format: "pgn", string: "1. e4 *" }); await flush(); });
    assert.equal(impor.nilai.data[0].pekerjaanId, "laporan:uji-2");
    assert.deepEqual(pekerjaan.operasi, ["simpan-laporan", "buat-id", "snapshot"]);
    await impor.unmount();
  }
});

test("setData preserves explicit IDs including empty, zero and false; nullish IDs use a generated ID", async (tes) => {
  pasangStorage(tes);
  const pekerjaan = pekerjaanTiruan();
  const impor = siapkanProvider(tes, pekerjaan);
  await impor.mount();
  const masukan = ["laporan:tersimpan", "", 0, false, null, undefined];
  for (const [index, id] of masukan.entries()) {
    pekerjaan.operasi.length = 0;
    const input = { format: "pgn", string: `game-${index}`, pekerjaanId: id };
    await act(async () => { impor.nilai.data[1](input); await flush(); });
    assert.deepEqual(pekerjaan.operasi, ["simpan-laporan", "buat-id", "snapshot"]);
    assert.equal(impor.nilai.data[0].pekerjaanId, id ?? `laporan:uji-${index + 2}`);
    assert.equal(impor.nilai.data[0].string, `game-${index}`);
    assert.strictEqual(input.pekerjaanId, id);
  }
  assert.equal(pekerjaan.nomor, 7);
});

test("functional setData updaters receive current data; unchanged or falsy values still perform prior side effects", async (tes) => {
  pasangStorage(tes);
  const pekerjaan = pekerjaanTiruan();
  const impor = siapkanProvider(tes, pekerjaan);
  await impor.mount();
  const mula = impor.nilai.data[0];
  let diterima;
  pekerjaan.operasi.length = 0;
  await act(async () => {
    impor.nilai.data[1]((sebelum) => { diterima = sebelum; return { ...sebelum, string: "terubah" }; });
    await flush();
  });
  assert.strictEqual(diterima, mula);
  assert.equal(impor.nilai.data[0].string, "terubah");
  assert.equal(impor.nilai.data[0].pekerjaanId, mula.pekerjaanId);
  assert.deepEqual(pekerjaan.operasi, ["simpan-laporan", "buat-id", "snapshot"]);
  for (const perubahan of [(sebelum) => sebelum, () => null, undefined, false, 0, ""]) {
    const data = impor.nilai.data[0];
    const nilai = impor.nilai;
    pekerjaan.operasi.length = 0;
    await act(async () => { impor.nilai.data[1](perubahan); await flush(); });
    assert.strictEqual(impor.nilai.data[0], data);
    assert.strictEqual(impor.nilai, nilai);
    assert.deepEqual(pekerjaan.operasi, ["simpan-laporan", "buat-id", "snapshot"]);
  }
  assert.equal(pekerjaan.nomor, 8);
});

test("batched data updates use the work snapshot captured for each call", async (tes) => {
  pasangStorage(tes);
  const pekerjaan = pekerjaanTiruan();
  const impor = siapkanProvider(tes, pekerjaan);
  await impor.mount();
  const idAwal = impor.nilai.data[0].pekerjaanId;
  const awal = { daftar: [{ id: idAwal, status: "baru" }], aktif: { id: idAwal } };
  pekerjaan.setSnapshot(awal);
  pekerjaan.operasi.length = 0;
  const diterima = [];
  await act(async () => {
    const setter = impor.nilai.data[1];
    setter((data) => { diterima.push(data.pekerjaanId); return { format: "pgn", string: "pertama" }; });
    pekerjaan.setSnapshot({ daftar: [{ id: "laporan:lain", status: "baru" }], aktif: { id: "laporan:lain" } });
    setter((data) => { diterima.push(data.pekerjaanId); return { format: "pgn", string: "kedua" }; });
    pekerjaan.setSnapshot(awal);
    await flush();
  });
  assert.deepEqual(diterima, [idAwal, idAwal]);
  assert.equal(impor.nilai.data[0].string, "kedua");
  assert.equal(impor.nilai.data[0].pekerjaanId, "laporan:uji-3");
  assert.deepEqual(pekerjaan.operasi, ["simpan-laporan", "buat-id", "snapshot", "simpan-laporan", "buat-id", "snapshot"]);
});

test("synchronous failures in the work calls propagate in order before any data update", async (tes) => {
  pasangStorage(tes);
  const pekerjaan = pekerjaanTiruan();
  const impor = siapkanProvider(tes, pekerjaan);
  await impor.mount();
  const data = impor.nilai.data[0];
  for (const [tahap, urutan] of [
    ["simpan-laporan", ["simpan-laporan"]],
    ["buat-id", ["simpan-laporan", "buat-id"]],
    ["snapshot", ["simpan-laporan", "buat-id", "snapshot"]],
  ]) {
    const error = new Error(`gagal ${tahap}`);
    pekerjaan.setKegagalan({ pada: tahap, error });
    pekerjaan.operasi.length = 0;
    act(() => assert.throws(() => impor.nilai.data[1]({ format: "pgn", string: "1. e4 *" }), (terjadi) => terjadi === error));
    assert.deepEqual(pekerjaan.operasi, urutan);
    assert.strictEqual(impor.nilai.data[0], data);
  }
  pekerjaan.setKegagalan(null);
});

test("the real Analyze provider forwards the same import pairs while keeping board context independent", async (tes) => {
  pasangStorage(tes);
  const pekerjaan = pekerjaanTiruan();
  const terjemah = (key) => key;
  const muat = buatPemuatJsx({
    "src/modul/pekerjaan/index.js": pekerjaan.ekspor,
    "src/lib/i18n.jsx": { useI18n: () => ({ t: terjemah }) },
    "src/modul/sesi/preferensi.js": { bacaAngka: (_kunci, fallback) => fallback },
  });
  const Provider = muat("src/halaman/Analisa/konteks/analyze.jsx").default;
  const { AnalyzeContext } = muat("src/halaman/Analisa/konteks/analyzeKonteks.js");
  const { useImport } = muat("src/halaman/Analisa/konteks/importKonteks.js");
  const { useBoard } = muat("src/halaman/Analisa/konteks/boardKonteks.js");
  let imp;
  let board;
  let analisis;
  function Probe() { imp = useImport(); board = useBoard(); analisis = React.useContext(AnalyzeContext); return null; }
  let renderer;
  tes.after(() => { if (renderer) act(() => renderer.unmount()); });
  await act(async () => { renderer = TestRenderer.create(React.createElement(Provider, null, React.createElement(Probe))); await flush(); });
  for (const nama of namaField) assert.strictEqual(analisis[nama], imp[nama], nama);
  const boardAwal = board;
  const analisisAwal = analisis;
  await act(async () => { imp.progress[1](54.5); imp.pageState[1]("loading"); await flush(); });
  assert.strictEqual(board, boardAwal);
  assert.notStrictEqual(analisis, analisisAwal);
  assert.strictEqual(analisis.progress, imp.progress);
  assert.strictEqual(analisis.pageState, imp.pageState);
  assert.equal(analisis.progress[0], 54.5);
  assert.equal(analisis.pageState[0], "loading");
  await act(async () => { imp.data[1]({ format: "pgn", string: "1. e4 *" }); await flush(); });
  assert.strictEqual(analisis.data, imp.data);
  assert.equal(analisis.data[0].string, "1. e4 *");
  assert.strictEqual(board, boardAwal);
});

test("the real Loading component observes import progress and aborts the current controller", async (tes) => {
  pasangStorage(tes);
  const pekerjaan = pekerjaanTiruan();
  const setIntervalAsli = globalThis.setInterval;
  const clearIntervalAsli = globalThis.clearInterval;
  const timers = [];
  globalThis.setInterval = (callback, ms) => { const timer = { callback, ms, cleared: false }; timers.push(timer); return timer; };
  globalThis.clearInterval = (timer) => { timer.cleared = true; };
  tes.after(() => { globalThis.setInterval = setIntervalAsli; globalThis.clearInterval = clearIntervalAsli; });
  const muat = buatPemuatJsx({
    "src/modul/pekerjaan/index.js": pekerjaan.ekspor,
    "src/lib/i18n.jsx": { useI18n: () => ({ t: (key) => key }) },
    "src/modul/sesi/mesin.js": { useMesin: () => ({ status: "siap" }) },
    "src/halaman/Analisa/komponen/svg/lens.jsx": { default: () => null },
    "src/halaman/Analisa/komponen/loading/DualRingSpinner.jsx": { default: () => null },
    "src/halaman/Analisa/komponen/menu/loading/loadingBar.jsx": {
      default: ({ progress, transitionTime }) => React.createElement("div", { "data-uji": "bar-progres-uji", progress, transitionTime }),
    },
  });
  const { ImportProvider } = muat("src/halaman/Analisa/konteks/import.jsx");
  const { useImport } = muat("src/halaman/Analisa/konteks/importKonteks.js");
  const Loading = muat("src/halaman/Analisa/komponen/menu/loading/loading.jsx").default;
  let imp;
  function Probe() { imp = useImport(); return React.createElement(Loading, { format: "pgn", analyzeController: imp.analyzeController[0] }); }
  let renderer;
  tes.after(() => { if (renderer) act(() => renderer.unmount()); });
  await act(async () => { renderer = TestRenderer.create(React.createElement(ImportProvider, null, React.createElement(Probe))); await flush(); });
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 300);
  await act(async () => { imp.progress[1](42.25); await flush(); });
  assert.equal(renderer.root.findByProps({ "data-uji": "bar-progres-uji" }).props.progress, 42.25);
  assert.ok(renderer.root.findAllByType("span").some((node) => node.children.join("") === "42.3%"));
  assert.equal(imp.analyzeController[0].signal.aborted, false);
  act(() => renderer.root.findByType("button").props.onClick());
  assert.equal(imp.analyzeController[0].signal.aborted, true);
  assert.equal(imp.pageState[0], "default");
  await act(async () => { renderer.unmount(); renderer = null; await flush(); });
  assert.equal(timers[0].cleared, true);
});

test("the real Pekerjaan singleton persists the active empty report before the provider reuses its ID", async (tes) => {
  pasangStorage(tes);
  const sebelumnya = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  const idb = new IDBFactory();
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, writable: true, value: idb });
  tes.after(() => {
    if (sebelumnya) Object.defineProperty(globalThis, "indexedDB", sebelumnya);
    else delete globalThis.indexedDB;
  });
  await pekerjaanAsli.pekerjaan.init();
  const muat = buatPemuatJsx({ "src/modul/pekerjaan/index.js": pekerjaanAsli });
  const { ImportProvider } = muat("src/halaman/Analisa/konteks/import.jsx");
  const { useImport } = muat("src/halaman/Analisa/konteks/importKonteks.js");
  let nilai;
  function Probe() { nilai = useImport(); return null; }
  let renderer;
  tes.after(() => { if (renderer) act(() => renderer.unmount()); });
  await act(async () => { renderer = TestRenderer.create(React.createElement(ImportProvider, null, React.createElement(Probe))); await flush(); });
  const id = nilai.data[0].pekerjaanId;
  pekerjaanAsli.pekerjaan.tetapkanAktif({ id, digunakan: false });
  let baca = 0;
  const record = { id, jenis: "laporan", judul: "kosong", status: "baru", sumber: { format: "fen", string: "" }, waktu: 123 };
  const lepas = pekerjaanAsli.daftarkanPembacaLaporan(() => { baca++; return record; });
  tes.after(lepas);
  await act(async () => { nilai.data[1]({ format: "pgn", string: "1. e4 e5 *" }); await flush(); });
  await pekerjaanAsli.pekerjaan.tungguTulis();
  assert.equal(baca, 1);
  assert.deepEqual(nilai.data[0], { format: "pgn", string: "1. e4 e5 *", pekerjaanId: id });
  const tersimpan = await pekerjaanAsli.buatAdapterPekerjaan(idb).ambil(id);
  assert.equal(tersimpan.id, id);
  assert.equal(tersimpan.status, "baru");
  assert.deepEqual(tersimpan.sumber, { format: "fen", string: "" });
  assert.equal(pekerjaanAsli.pekerjaan.snapshot().aktif.id, id);
});
