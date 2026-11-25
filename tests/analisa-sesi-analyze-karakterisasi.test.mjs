import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import TestRenderer from "react-test-renderer";
import * as asli from "../src/halaman/Analisa/konteks/analyzeKonteks.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const { act } = TestRenderer;
const pathKonteks = "src/halaman/Analisa/konteks/analyzeKonteks.js";
const pathProvider = "src/halaman/Analisa/konteks/analyze.jsx";
const pathBoard = "src/halaman/Analisa/konteks/boardKonteks.js";
const pathImpor = "src/halaman/Analisa/konteks/importKonteks.js";
const boardFields = ["game", "players", "moveNumber", "forward", "white", "animation", "playing", "time", "materialAdvantage", "result", "tab", "customLine", "returnedToNormalGame", "depth"];
const imporFields = ["data", "pageState", "progress", "langkahSementara", "analyzeController", "analyzingMove"];
const defaultFields = ["data", "pageState", "game", "players", "moveNumber", "forward", "animation", "white", "playing", "time", "materialAdvantage", "result", "progress", "langkahSementara", "tab", "analyzeController", "customLine", "returnedToNormalGame", "analyzingMove", "akun", "depth", "gameController"];
const providerFields = ["data", "pageState", "game", "players", "moveNumber", "forward", "white", "animation", "playing", "time", "materialAdvantage", "result", "progress", "langkahSementara", "tab", "analyzeController", "customLine", "returnedToNormalGame", "analyzingMove", "akun", "depth", "gameController"];

function lingkungan(tes, { lokal = [], sesi = [], tambahan = {} } = {}) {
  const sebelumnya = Object.fromEntries(["localStorage", "sessionStorage"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const operasi = [];
  const renderers = new Set();
  function buatStorage(nama, awal) {
    const data = new Map(awal);
    return {
      data,
      getItem(key) { operasi.push([nama, "get", key]); return data.get(key) ?? null; },
      setItem(key, value) { operasi.push([nama, "set", key, String(value)]); data.set(key, String(value)); },
      removeItem(key) { operasi.push([nama, "remove", key]); data.delete(key); },
    };
  }
  const local = buatStorage("local", lokal);
  const session = buatStorage("session", sesi);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: local });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, writable: true, value: session });
  tes.after(() => {
    for (const renderer of renderers) act(() => renderer.unmount());
    for (const key of ["localStorage", "sessionStorage"]) {
      if (sebelumnya[key]) Object.defineProperty(globalThis, key, sebelumnya[key]);
      else delete globalThis[key];
    }
  });

  let id = 0;
  const terjemah = (key) => { operasi.push(["i18n", "t", key]); return `id:${key}`; };
  const pekerjaan = {
    buatIdPekerjaan() { operasi.push(["pekerjaan", "buat-id"]); return `laporan:uji-${++id}`; },
    simpanLaporanAktif() { operasi.push(["pekerjaan", "simpan"]); },
    pekerjaan: { snapshot() { operasi.push(["pekerjaan", "snapshot"]); return { daftar: [], aktif: { id: null } }; } },
  };
  const muat = buatPemuatJsx({
    "src/lib/i18n.jsx": { useI18n: () => ({ t: terjemah }) },
    "src/modul/pekerjaan/index.js": pekerjaan,
    ...tambahan,
  });
  const modulProvider = muat(pathProvider);
  const { AnalyzeContext } = muat(pathKonteks);
  const board = muat(pathBoard);
  const impor = muat(pathImpor);
  function mount() {
    let nilai;
    let renders = 0;
    const Probe = React.memo(function Probe() {
      renders++;
      nilai = { gabungan: React.useContext(AnalyzeContext), board: board.useBoard(), impor: impor.useImport(), tampilan: board.useTampilan() };
      return React.createElement("span", { "data-uji": "anak-analyze" });
    });
    const pohon = (props = {}) => React.createElement(modulProvider.default, props, React.createElement(Probe));
    let renderer;
    act(() => { renderer = TestRenderer.create(pohon()); });
    renderers.add(renderer);
    return {
      get nilai() { return nilai; }, get renders() { return renders; }, get renderer() { return renderer; }, Probe,
      update(props) { act(() => renderer.update(pohon(props))); },
      unmount() { if (renderer) { act(() => renderer.unmount()); renderers.delete(renderer); renderer = null; } },
    };
  }
  return { local, session, operasi, muat, modulProvider, AnalyzeContext, board, impor, mount, renderers };
}

test("the original Analyze context has three named exports and immutable screen constants", () => {
  assert.deepEqual(Object.keys(asli).sort(), ["AnalyzeContext", "TAMPILAN_ANALISA", "normalisasiPemain"]);
  assert.equal(Object.hasOwn(asli, "default"), false);
  assert.deepEqual(asli.TAMPILAN_ANALISA, {
    PAPAN: "papan", BERMAIN: "bermain", AKUN: "akun", DETEKSI_ENGINE: "deteksi-engine",
    WAWASAN: "wawasan", PENGATURAN: "pengaturan", BASIS_DATA: "database", ENGINE: "engine", IMPOR: "impor",
  });
  assert.equal(Object.isFrozen(asli.TAMPILAN_ANALISA), true);
  assert.equal(Reflect.set(asli.TAMPILAN_ANALISA, "PAPAN", "lain"), false);
  assert.equal(asli.TAMPILAN_ANALISA.PAPAN, "papan");
});

test("the default AnalyzeContext keeps every field, neutral value, frozen player and no-op setter", (tes) => {
  let nilai;
  function Probe() { nilai = React.useContext(asli.AnalyzeContext); return null; }
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(Probe)); });
  tes.after(() => act(() => renderer.unmount()));
  assert.deepEqual(Object.keys(nilai), defaultFields);
  assert.deepEqual(nilai.data[0], { format: "fen", string: "" });
  assert.equal(nilai.pageState[0], "analyze");
  assert.deepEqual(nilai.game[0], []);
  assert.deepEqual(nilai.players[0], [{ name: "", elo: "NOELO" }, { name: "", elo: "NOELO" }]);
  assert.ok(Object.isFrozen(nilai.players[0]));
  assert.ok(nilai.players[0].every(Object.isFrozen));
  assert.equal(nilai.moveNumber[0], 0);
  assert.equal(nilai.forward[0], true);
  assert.equal(nilai.animation[0], false);
  assert.equal(nilai.white[0], true);
  assert.equal(nilai.playing[0], false);
  assert.equal(nilai.time[0], 0);
  assert.equal(nilai.materialAdvantage[0], 0);
  assert.equal(nilai.result[0], "");
  assert.equal(nilai.progress[0], 0);
  assert.deepEqual(nilai.langkahSementara[0], []);
  assert.equal(nilai.tab[0], "analyze");
  assert.ok(nilai.analyzeController[0] instanceof AbortController);
  assert.deepEqual(nilai.customLine[0], { moveNumber: -1, moves: [], arrows: {} });
  assert.equal(nilai.returnedToNormalGame[0], null);
  assert.equal(nilai.analyzingMove[0], false);
  assert.deepEqual(nilai.akun[0], { platform: "chessCom", username: "" });
  assert.equal(nilai.depth[0], 13);
  const setters = defaultFields.filter((key) => key !== "gameController").map((key) => nilai[key][1]);
  assert.equal(new Set(setters).size, setters.length);
  for (const setter of setters) assert.equal(setter(() => { throw new Error("default setter menjalankan updater"); }), undefined);
  assert.deepEqual(Object.keys(nilai.gameController), ["back", "forward", "last", "first", "play", "pause", "togglePlay"]);
  for (const fn of Object.values(nilai.gameController)) assert.equal(fn(), undefined);
});

test("the default context object and abort controller are shared by consumers without a provider", (tes) => {
  const diterima = [];
  function Probe() { diterima.push(React.useContext(asli.AnalyzeContext)); return null; }
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(React.Fragment, null, React.createElement(Probe), React.createElement(Probe))); });
  tes.after(() => act(() => renderer.unmount()));
  assert.strictEqual(diterima[0], diterima[1]);
  assert.strictEqual(diterima[0].analyzeController[0], diterima[1].analyzeController[0]);
  assert.equal(diterima[0].analyzeController[0].signal.aborted, false);
  act(() => renderer.update(React.createElement(Probe)));
  assert.strictEqual(diterima.at(-1), diterima[0]);
});

test("player normalization returns exactly two default entries for absent and non-array inputs", () => {
  for (const input of [undefined, null, false, 0, "players", { 0: { name: "bukan-array" } }, []]) {
    assert.deepEqual(asli.normalisasiPemain(input), [{ name: "", elo: "NOELO" }, { name: "", elo: "NOELO" }]);
  }
  const first = asli.normalisasiPemain([]);
  const second = asli.normalisasiPemain([]);
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(first[0], second[0]);
});

test("player normalization ignores primitive entries, trims names and coerces non-null names to strings", () => {
  assert.deepEqual(asli.normalisasiPemain(["nama", false], ["Putih", "Hitam"]), [
    { name: "Putih", elo: "NOELO" }, { name: "Hitam", elo: "NOELO" },
  ]);
  assert.deepEqual(asli.normalisasiPemain([{ name: "  putih  ", elo: 0 }, { name: 0, elo: false }, { name: "abaikan" }]), [
    { name: "putih", elo: 0 }, { name: "0", elo: false },
  ]);
  assert.deepEqual(asli.normalisasiPemain([{ name: true, elo: "" }, { name: null, elo: null }], ["X", "Y"]), [
    { name: "true", elo: "" }, { name: "Y", elo: "NOELO" },
  ]);
});

test("player normalization retains own extra fields and nested identities without mutating inputs", () => {
  const nested = { sumber: "pgn" };
  const putih = Object.freeze({ name: "  Alice ", elo: 1800, meta: nested });
  const hitam = Object.freeze({ name: "Bob", elo: undefined, extra: 0 });
  const input = Object.freeze([putih, hitam]);
  const hasil = asli.normalisasiPemain(input);
  assert.deepEqual(hasil, [{ name: "Alice", elo: 1800, meta: nested }, { name: "Bob", elo: "NOELO", extra: 0 }]);
  assert.notStrictEqual(hasil[0], putih);
  assert.notStrictEqual(hasil[1], hitam);
  assert.strictEqual(hasil[0].meta, nested);
  assert.equal(putih.name, "  Alice ");
});

test("player fallback values keep their existing truthiness semantics instead of being validated", () => {
  const fallback = { teks: "bawaan" };
  assert.deepEqual(asli.normalisasiPemain([{ name: "  " }, {}], [0, false]), [
    { name: "", elo: "NOELO" }, { name: "", elo: "NOELO" },
  ]);
  const hasil = asli.normalisasiPemain([{}, {}], [42, fallback]);
  assert.equal(hasil[0].name, 42);
  assert.strictEqual(hasil[1].name, fallback);
  assert.deepEqual(asli.normalisasiPemain([{}, {}], null), [{ name: "", elo: "NOELO" }, { name: "", elo: "NOELO" }]);
});

test("player normalization reads inherited name and Elo but spreads only own enumerable fields", () => {
  const pemain = Object.assign(Object.create({ name: "  Warisan  ", elo: 1600, diPrototipe: true }), { sendiri: "ya" });
  const hasil = asli.normalisasiPemain([pemain]);
  assert.deepEqual(hasil[0], { sendiri: "ya", name: "Warisan", elo: 1600 });
  assert.equal(Object.hasOwn(hasil[0], "diPrototipe"), false);
});

test("player normalization propagates a throwing player getter instead of silently repairing it", () => {
  const error = new Error("gagal membaca pemain");
  const pemain = Object.defineProperty({}, "name", { enumerable: true, get() { throw error; } });
  assert.throws(() => asli.normalisasiPemain([pemain]), (terjadi) => terjadi === error);
});

test("the original default provider nests real Board and Import providers and forwards all fields", (tes) => {
  const ling = lingkungan(tes);
  assert.deepEqual(Object.keys(ling.modulProvider), ["default"]);
  const app = ling.mount();
  const { gabungan, board, impor } = app.nilai;
  assert.deepEqual(Object.keys(gabungan), providerFields);
  for (const nama of boardFields) assert.strictEqual(gabungan[nama], board[nama], nama);
  for (const nama of imporFields) assert.strictEqual(gabungan[nama], impor[nama], nama);
  assert.strictEqual(gabungan.gameController, board.gameController);
  assert.equal(Object.hasOwn(gabungan, "tampilan"), false);
  assert.deepEqual(gabungan.akun[0], { platform: "chessCom", username: "" });
  assert.equal(typeof gabungan.akun[1], "function");
  const BoardProvider = ling.muat("src/halaman/Analisa/konteks/board.jsx").BoardProvider;
  const ImportProvider = ling.muat("src/halaman/Analisa/konteks/import.jsx").ImportProvider;
  assert.ok(app.renderer.root.findByType(BoardProvider).findByType(ImportProvider).findByProps({ "data-uji": "anak-analyze" }));
});

test("provider initialization keeps translation, depth, job and handoff read order without storage writes", (tes) => {
  const ling = lingkungan(tes, { lokal: [["depth", "9.7"]] });
  const app = ling.mount();
  assert.deepEqual(ling.operasi, [
    ["i18n", "t", "analisa.pemain.putih"], ["i18n", "t", "analisa.pemain.hitam"],
    ["local", "get", "maestro-analisa-kedalaman"], ["local", "get", "depth"],
    ["pekerjaan", "buat-id"], ["session", "get", "maestro-analisa-impor-awal"],
  ]);
  assert.equal(app.nilai.gabungan.depth[0], 10);
  assert.equal(app.nilai.gabungan.pageState[0], "default");
  assert.equal(app.nilai.gabungan.animation[0], true);
  assert.deepEqual(app.nilai.gabungan.players[0], [
    { name: "id:analisa.pemain.putih", elo: "?" }, { name: "id:analisa.pemain.hitam", elo: "?" },
  ]);
  assert.deepEqual(app.nilai.gabungan.data[0], { format: "fen", string: "", pekerjaanId: "laporan:uji-1", awalPekerjaan: true });
  assert.equal(ling.operasi.some(([, aksi]) => aksi === "set" || aksi === "remove"), false);
});

test("board changes create a new combined value while import state and the account setter stay stable", (tes) => {
  const ling = lingkungan(tes);
  const app = ling.mount();
  const sebelum = app.nilai;
  const akun = sebelum.gabungan.akun[0];
  const setAkun = sebelum.gabungan.akun[1];
  act(() => { sebelum.gabungan.game[1]([{ fen: "awal" }, { fen: "berikut" }]); sebelum.gabungan.moveNumber[1](1); });
  assert.notStrictEqual(app.nilai.gabungan, sebelum.gabungan);
  assert.notStrictEqual(app.nilai.board, sebelum.board);
  assert.strictEqual(app.nilai.impor, sebelum.impor);
  assert.strictEqual(app.nilai.gabungan.game, app.nilai.board.game);
  assert.equal(app.nilai.gabungan.moveNumber[0], 1);
  assert.strictEqual(app.nilai.gabungan.akun[0], akun);
  assert.strictEqual(app.nilai.gabungan.akun[1], setAkun);
  assert.notStrictEqual(app.nilai.gabungan.akun, sebelum.gabungan.akun);
});

test("import progress and page-state changes create a new combined value without changing the board", (tes) => {
  const ling = lingkungan(tes);
  const app = ling.mount();
  const sebelum = app.nilai;
  act(() => { sebelum.gabungan.progress[1](53.25); sebelum.gabungan.pageState[1]("loading"); });
  assert.notStrictEqual(app.nilai.gabungan, sebelum.gabungan);
  assert.strictEqual(app.nilai.board, sebelum.board);
  assert.notStrictEqual(app.nilai.impor, sebelum.impor);
  assert.strictEqual(app.nilai.gabungan.progress, app.nilai.impor.progress);
  assert.strictEqual(app.nilai.gabungan.pageState, app.nilai.impor.pageState);
  assert.equal(app.nilai.gabungan.progress[0], 53.25);
  assert.equal(app.nilai.gabungan.pageState[0], "loading");
});

test("screen navigation is separate and does not change the combined Analyze value", (tes) => {
  const ling = lingkungan(tes);
  const app = ling.mount();
  const sebelum = app.nilai;
  act(() => sebelum.tampilan[1]("pengaturan"));
  assert.equal(app.nilai.tampilan[0], "pengaturan");
  assert.strictEqual(app.nilai.gabungan, sebelum.gabungan);
  assert.strictEqual(app.nilai.board, sebelum.board);
  assert.strictEqual(app.nilai.impor, sebelum.impor);
});

test("account accepts arbitrary and functional updates without changing board/import or writing storage", (tes) => {
  const ling = lingkungan(tes);
  const app = ling.mount();
  const sebelum = app.nilai;
  const setter = sebelum.gabungan.akun[1];
  ling.operasi.length = 0;
  act(() => setter(null));
  assert.equal(app.nilai.gabungan.akun[0], null);
  assert.strictEqual(app.nilai.board, sebelum.board);
  assert.strictEqual(app.nilai.impor, sebelum.impor);
  assert.strictEqual(app.nilai.gabungan.akun[1], setter);
  const berikut = { platform: "lain", username: " nama ", ekstra: 7 };
  act(() => setter((lama) => { assert.equal(lama, null); return berikut; }));
  assert.strictEqual(app.nilai.gabungan.akun[0], berikut);
  assert.strictEqual(app.nilai.gabungan.akun[1], setter);
  assert.deepEqual(ling.operasi, []);
});

test("setting the same account object and parent-only rerenders preserve the combined context identity", (tes) => {
  const ling = lingkungan(tes);
  const app = ling.mount();
  const sebelum = app.nilai.gabungan;
  act(() => sebelum.akun[1](sebelum.akun[0]));
  assert.strictEqual(app.nilai.gabungan, sebelum);
  app.update({ extra: "tidak dipakai" });
  assert.strictEqual(app.nilai.gabungan, sebelum);
});

test("separate real Analyze provider mounts isolate accounts, board state, screen, import and controllers", (tes) => {
  const ling = lingkungan(tes);
  const nilai = {};
  function Probe({ id }) {
    nilai[id] = { gabungan: React.useContext(ling.AnalyzeContext), board: ling.board.useBoard(), impor: ling.impor.useImport(), tampilan: ling.board.useTampilan() };
    return null;
  }
  let renderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(React.Fragment, null,
      React.createElement(ling.modulProvider.default, null, React.createElement(Probe, { id: "satu" })),
      React.createElement(ling.modulProvider.default, null, React.createElement(Probe, { id: "dua" }))));
  });
  ling.renderers.add(renderer);
  assert.notStrictEqual(nilai.satu.gabungan, nilai.dua.gabungan);
  assert.notStrictEqual(nilai.satu.gabungan.analyzeController[0], nilai.dua.gabungan.analyzeController[0]);
  assert.notStrictEqual(nilai.satu.gabungan.gameController, nilai.dua.gabungan.gameController);
  assert.notEqual(nilai.satu.gabungan.data[0].pekerjaanId, nilai.dua.gabungan.data[0].pekerjaanId);
  act(() => {
    nilai.satu.gabungan.akun[1]({ platform: "lichess", username: "uji" });
    nilai.satu.gabungan.white[1](false);
    nilai.satu.gabungan.progress[1](75);
    nilai.satu.tampilan[1]("akun");
  });
  assert.equal(nilai.satu.gabungan.akun[0].username, "uji");
  assert.equal(nilai.satu.gabungan.white[0], false);
  assert.equal(nilai.satu.gabungan.progress[0], 75);
  assert.equal(nilai.satu.tampilan[0], "akun");
  assert.deepEqual(nilai.dua.gabungan.akun[0], { platform: "chessCom", username: "" });
  assert.equal(nilai.dua.gabungan.white[0], true);
  assert.equal(nilai.dua.gabungan.progress[0], 0);
  assert.equal(nilai.dua.tampilan[0], "papan");
});

test("remount resets account and allocates a new controller without aborting the old one", (tes) => {
  const ling = lingkungan(tes);
  const pertama = ling.mount();
  const controller = pertama.nilai.gabungan.analyzeController[0];
  act(() => pertama.nilai.gabungan.akun[1]({ platform: "lichess", username: "uji" }));
  pertama.unmount();
  assert.equal(controller.signal.aborted, false);
  const kedua = ling.mount();
  assert.deepEqual(kedua.nilai.gabungan.akun[0], { platform: "chessCom", username: "" });
  assert.notStrictEqual(kedua.nilai.gabungan.analyzeController[0], controller);
  assert.equal(kedua.nilai.gabungan.data[0].pekerjaanId, "laporan:uji-2");
});

test("a pending PGN handoff yields loading on each mount but is not consumed by Analyze", (tes) => {
  const kunci = "maestro-analisa-impor-awal";
  const ling = lingkungan(tes, { sesi: [[kunci, "1. e4 *"]] });
  const pertama = ling.mount();
  assert.equal(pertama.nilai.gabungan.pageState[0], "loading");
  assert.equal(ling.session.data.get(kunci), "1. e4 *");
  pertama.unmount();
  const kedua = ling.mount();
  assert.equal(kedua.nilai.gabungan.pageState[0], "loading");
  assert.equal(ling.session.data.get(kunci), "1. e4 *");
  assert.deepEqual(ling.operasi.filter(([nama]) => nama === "session"), [["session", "get", kunci], ["session", "get", kunci]]);
});

test("forwarded data setter retains the Import provider's job calls and generated record shape", (tes) => {
  const ling = lingkungan(tes);
  const app = ling.mount();
  ling.operasi.length = 0;
  act(() => app.nilai.gabungan.data[1]({ format: "pgn", string: "1. e4 *" }));
  assert.deepEqual(ling.operasi, [["pekerjaan", "simpan"], ["pekerjaan", "buat-id"], ["pekerjaan", "snapshot"]]);
  assert.strictEqual(app.nilai.gabungan.data, app.nilai.impor.data);
  assert.deepEqual(app.nilai.gabungan.data[0], { format: "pgn", string: "1. e4 *", pekerjaanId: "laporan:uji-2" });
});

test("replacing the forwarded import controller does not abort the previous controller", (tes) => {
  const ling = lingkungan(tes);
  const app = ling.mount();
  const lama = app.nilai.gabungan.analyzeController[0];
  const baru = new AbortController();
  act(() => app.nilai.gabungan.analyzeController[1](baru));
  assert.strictEqual(app.nilai.gabungan.analyzeController, app.nilai.impor.analyzeController);
  assert.strictEqual(app.nilai.gabungan.analyzeController[0], baru);
  assert.equal(lama.signal.aborted, false);
  assert.equal(baru.signal.aborted, false);
});

test("the combined game controller remains the Board controller across play and account updates", (tes) => {
  const ling = lingkungan(tes);
  const app = ling.mount();
  const controller = app.nilai.gabungan.gameController;
  act(() => controller.play());
  assert.equal(app.nilai.gabungan.playing[0], true);
  assert.strictEqual(app.nilai.gabungan.gameController, controller);
  assert.strictEqual(app.nilai.board.gameController, controller);
  act(() => app.nilai.gabungan.akun[1]({ platform: "lain", username: "x" }));
  assert.strictEqual(app.nilai.gabungan.gameController, controller);
  act(() => controller.pause());
  assert.equal(app.nilai.gabungan.playing[0], false);
});

test("the real Analisa root supplies its navigation and workspace children with one Analyze context", (tes) => {
  const lamaWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const lamaDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: { innerHeight: 640, addEventListener() {}, removeEventListener() {} } });
  Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: {} });
  let renderer;
  let ling;
  tes.after(() => {
    if (renderer) { act(() => renderer.unmount()); ling.renderers.delete(renderer); renderer = null; }
    if (lamaWindow) Object.defineProperty(globalThis, "window", lamaWindow); else delete globalThis.window;
    if (lamaDocument) Object.defineProperty(globalThis, "document", lamaDocument); else delete globalThis.document;
  });
  let muat;
  const nilai = {};
  const Pass = ({ children }) => React.createElement(React.Fragment, null, children);
  function Probe({ nama }) {
    const { AnalyzeContext } = muat(pathKonteks);
    nilai[nama] = React.useContext(AnalyzeContext);
    return React.createElement("span", { "data-uji": nama });
  }
  ling = lingkungan(tes, { tambahan: {
    "src/lib/i18n.jsx": { I18nProvider: Pass, useI18n: () => ({ t: (key) => key }) },
    "src/halaman/Analisa/konteks/mesin.jsx": { MesinProvider: Pass },
    "src/modul/sesi/index.js": { ConfigContextProvider: Pass, ErrorsContextProvider: Pass, TabKerjaProvider: Pass },
    "src/halaman/Analisa/komponen/errors/pageErrors.jsx": { default: () => null },
    "src/halaman/Analisa/komponen/nav/nav.jsx": { default: () => React.createElement(Probe, { nama: "nav" }) },
    "src/halaman/Analisa/komponen/areaKerja.jsx": { default: () => React.createElement(Probe, { nama: "area" }) },
    "src/halaman/Analisa/analisa.css": {},
  } });
  muat = ling.muat;
  const Analisa = muat("src/halaman/Analisa/Analisa.jsx").default;
  act(() => { renderer = TestRenderer.create(React.createElement(Analisa)); });
  ling.renderers.add(renderer);
  assert.strictEqual(nilai.nav, nilai.area);
  assert.deepEqual(nilai.nav.akun[0], { platform: "chessCom", username: "" });
  act(() => nilai.nav.akun[1]({ platform: "lichess", username: "real-root" }));
  assert.strictEqual(nilai.nav, nilai.area);
  assert.equal(nilai.area.akun[0].username, "real-root");
});
