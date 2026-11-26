// Karakterisasi preferensi papan Tier 1 adopsi En Croissant:
// koordinat (no/edge/all), sorot langkah terakhir, auto-promosi menteri,
// dan hapus panah saat klik. Menguji lapisan provider, perilaku papan nyata,
// dan persistensi kontrol pengaturan — tanpa mengubah skor/analisis inti.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import { Chess } from "chess.js";
import ts from "typescript";
import * as configContext from "../src/halaman/Analisa/konteks/configKonteks.js";
import { boardThemes } from "../src/halaman/Analisa/komponen/pengaturan/boardThemes.js";
import { deformatSquare, formatSquare } from "../src/halaman/Analisa/mesin/engine.js";
import { analisa } from "../src/lib/terjemahan/id/analisa.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const noop = () => {};
const translate = (key, args = {}) => {
  let value = key.split(".").reduce((node, part) => node?.[part], { analisa }) ?? key;
  for (const [name, replacement] of Object.entries(args)) value = value.replaceAll(`{${name}}`, replacement);
  return value;
};

/* ----------------------------- Provider ----------------------------- */

function pasangStorage(tes, awal = []) {
  const lama = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const data = new Map(awal);
  const tulisan = [];
  const storage = {
    data, tulisan,
    getItem: (key) => data.get(key) ?? null,
    setItem(key, nilai) { tulisan.push([key, nilai]); data.set(key, String(nilai)); },
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: storage });
  tes.after(() => { if (lama) Object.defineProperty(globalThis, "localStorage", lama); else delete globalThis.localStorage; });
  return storage;
}

function siapkanProvider(tes, children = null) {
  const muat = buatPemuatJsx({
    "src/modul/pekerjaan/index.js": { KUNCI_FITUR: {}, ID_DRAF_IMPOR: "draf:impor", pekerjaan: {}, buatIdDrafImpor: () => "draf:uji" },
  });
  const provider = muat("src/halaman/Analisa/konteks/config.jsx").default;
  const konteks = muat("src/halaman/Analisa/konteks/configKonteks.js");
  const amatan = {};
  let renderer;
  function Probe() { amatan.nilai = React.useContext(konteks.ConfigContext); return null; }
  tes.after(() => { if (renderer) act(() => renderer.unmount()); });
  return {
    amatan, konteks,
    async mount() { await act(async () => { renderer = TestRenderer.create(React.createElement(provider, null, React.createElement(Probe), children)); await flush(); }); },
    get renderer() { return renderer; },
  };
}

test("provider exposes the four Tier 1 defaults that preserve current board behaviour", async (tes) => {
  pasangStorage(tes);
  const config = siapkanProvider(tes);
  await config.mount();
  const nilai = config.amatan.nilai;
  assert.equal(nilai.coordinates[0], "edge");
  assert.equal(nilai.moveHighlight[0], true);
  assert.equal(nilai.autoPromote[0], false);
  assert.equal(nilai.eraseArrowsOnClick[0], true);
  for (const nama of ["coordinates", "moveHighlight", "autoPromote", "eraseArrowsOnClick"]) {
    assert.equal(typeof nilai[nama][1], "function", nama);
  }
});

test("provider validates the coordinate enum and reads the boolean switches from storage", async (tes) => {
  const storage = pasangStorage(tes, [
    ["maestro-analisa-coordinates", "all"],
    ["maestro-analisa-moveHighlight", "0"],
    ["maestro-analisa-autoPromote", "1"],
    ["maestro-analisa-eraseArrowsOnClick", "0"],
  ]);
  const config = siapkanProvider(tes);
  await config.mount();
  const nilai = config.amatan.nilai;
  assert.equal(nilai.coordinates[0], "all");
  assert.equal(nilai.moveHighlight[0], false);
  assert.equal(nilai.autoPromote[0], true);
  assert.equal(nilai.eraseArrowsOnClick[0], false);
  assert.deepEqual(storage.tulisan, []);
});

test("an invalid coordinate value falls back to edge without rewriting storage", async (tes) => {
  const storage = pasangStorage(tes, [["maestro-analisa-coordinates", "diagonal"]]);
  const config = siapkanProvider(tes);
  await config.mount();
  assert.equal(config.amatan.nilai.coordinates[0], "edge");
  assert.deepEqual(storage.tulisan, []);
});

/* --------------------------- Perilaku papan --------------------------- */

const source = readFileSync(new URL("../src/halaman/Analisa/komponen/game/board.jsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const dependencies = {
  "../../mesin/engine.js": { deformatSquare, formatSquare },
  "../suaraPapan.js": { buatSuara: () => ({ play: noop }) },
  "../../../../modul/sesi/preferensi.js": { ...configContext, boardThemes },
  "../svg/piece.jsx": { default: () => React.createElement("span", { "data-piece": true }) },
  "../svg/rating.jsx": { default: () => null },
  "../svg/result.jsx": { default: () => null },
  "../Gambar.jsx": { default: () => null },
  "../../../../lib/asets.js": { berkasPublik: (path) => path },
  "../../../TekaTeki/animasiBidak.js": { GESER_ISEPIC: { durasi: 300, kurva: "ease" } },
  "../../../../lib/suara.js": { aturVolumePengguna: noop },
};
const compiledModule = { exports: {} };
runInThisContext(`(function (require, module, exports) {\n${compiled}\n})`)((id) => {
  if (id in dependencies) return dependencies[id];
  if (["react", "react/jsx-runtime", "chess.js"].includes(id)) return require(id);
  throw new Error(`Unexpected dependency: ${id}`);
}, compiledModule, compiledModule.exports);
const Board = compiledModule.exports.default;

function mountPapan(tes, { fen = new Chess().fen(), white = true, move = [], preferensi = {}, cleanArrows = noop } = {}) {
  const oldDocument = globalThis.document;
  globalThis.document = { body: { style: {} }, addEventListener() {}, removeEventListener() {} };
  tes.after(() => { if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument; });
  const calls = [];
  const settings = {
    usedRatings: [configContext.defaultUsedRatings, noop], highlightByRating: [true, noop],
    showArrows: [true, noop], arrowAfterMove: [true, noop], showLegalMoves: [true, noop],
    animateMoves: [true, noop], boardSounds: [false, noop], boardTheme: [0, noop],
    coordinates: [preferensi.coordinates ?? "edge", noop],
    moveHighlight: [preferensi.moveHighlight ?? true, noop],
    autoPromote: [preferensi.autoPromote ?? false, noop],
    eraseArrowsOnClick: [preferensi.eraseArrowsOnClick ?? true, noop],
  };
  let renderer;
  function Harness() {
    const drag = React.useState({ is: false, id: "" });
    return React.createElement(configContext.ConfigContext.Provider, { value: settings }, React.createElement(Board, {
      fen, white, move, t: translate, boardSize: 320, forward: true, animation: false, arrows: [],
      drag: drag[0], setDrag: drag[1], setMaterialAdvantage: noop, setPlaying: noop,
      setAnimation: noop, cleanArrows, pushArrow: noop, analyzeMove: (...args) => calls.push(args),
    }));
  }
  act(() => { renderer = TestRenderer.create(React.createElement(Harness), { createNodeMock: (node) => {
    if (node.props.role === "group") return { querySelector: () => ({ focus: noop }), contains: () => false, getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, width: 320, height: 320 }) };
    return null;
  } }); });
  const square = (id) => renderer.root.findByProps({ "data-square": id });
  const key = (id, name) => {
    const event = { key: name, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
    act(() => square(id).props.onKeyDown(event));
    return event;
  };
  const jumlahKelas = (potongan) => renderer.root.findAll((n) => typeof n.props.className === "string" && n.props.className.includes(potongan)).length;
  // Panduan koordinat memakai kelas persis; cincin seret berbagi awalan
  // "absolute top-0" sehingga pencocokan substring akan salah menghitung.
  const jumlahKelasPersis = (kelas) => renderer.root.findAll((n) => n.props.className === kelas).length;
  return { renderer, square, key, calls, jumlahKelas, jumlahKelasPersis };
}

test("auto-promote moves a pawn straight to a queen without opening the picker", (tes) => {
  const app = mountPapan(tes, { fen: "7k/P7/8/8/8/8/8/7K w - - 0 1", preferensi: { autoPromote: true } });
  app.key("a7", "Enter");
  app.key("a8", "Enter");
  assert.deepEqual(app.calls[0][1], { from: "a7", to: "a8", promotion: "q" });
  assert.equal(app.renderer.root.findAllByProps({ "aria-label": "Pilih promosi pion" }).length, 0);
  act(() => app.renderer.unmount());
});

test("with auto-promote off the promotion picker still opens (default behaviour)", async (tes) => {
  const app = mountPapan(tes, { fen: "7k/P7/8/8/8/8/8/7K w - - 0 1" });
  app.key("a7", "Enter");
  app.key("a8", "Enter");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  assert.ok(app.renderer.root.findByProps({ "aria-label": "Pilih promosi pion" }));
  assert.equal(app.calls.length, 0);
  act(() => app.renderer.unmount());
});

test("highlight-last-move toggles the coloured squares of the previous move", (tes) => {
  const move = [formatSquare("e2"), formatSquare("e4")];
  const aktif = mountPapan(tes, { move, preferensi: { moveHighlight: true } });
  assert.equal(aktif.jumlahKelas("z-[10]"), 2);
  act(() => aktif.renderer.unmount());
  const mati = mountPapan(tes, { move, preferensi: { moveHighlight: false } });
  assert.equal(mati.jumlahKelas("z-[10]"), 0);
  act(() => mati.renderer.unmount());
});

test("erase-arrows-on-click controls whether a left click clears drawn arrows", (tes) => {
  const akarPapan = (app) => app.renderer.root.findAllByProps({ role: "group" }).find((n) => n.props["aria-describedby"]);
  const bersih = [];
  const hidup = mountPapan(tes, { preferensi: { eraseArrowsOnClick: true }, cleanArrows: () => bersih.push("hidup") });
  act(() => akarPapan(hidup).props.onMouseDown({ button: 0, target: { dataset: {} }, preventDefault: noop }));
  assert.deepEqual(bersih, ["hidup"]);
  act(() => hidup.renderer.unmount());
  const mati = mountPapan(tes, { preferensi: { eraseArrowsOnClick: false }, cleanArrows: () => bersih.push("mati") });
  act(() => akarPapan(mati).props.onMouseDown({ button: 0, target: { dataset: {} }, preventDefault: noop }));
  assert.deepEqual(bersih, ["hidup"], "left click must not clear arrows when the switch is off");
  act(() => mati.renderer.unmount());
});

test("coordinate modes render none, edge-only, or every-square guides", (tes) => {
  const tanpa = mountPapan(tes, { preferensi: { coordinates: "no" } });
  assert.equal(tanpa.jumlahKelasPersis("absolute bottom-0"), 0);
  assert.equal(tanpa.jumlahKelasPersis("absolute top-0"), 0);
  act(() => tanpa.renderer.unmount());
  const tepi = mountPapan(tes, { preferensi: { coordinates: "edge" } });
  assert.equal(tepi.jumlahKelasPersis("absolute bottom-0"), 8);
  assert.equal(tepi.jumlahKelasPersis("absolute top-0"), 8);
  act(() => tepi.renderer.unmount());
  const semua = mountPapan(tes, { preferensi: { coordinates: "all" } });
  assert.equal(semua.jumlahKelasPersis("absolute bottom-0"), 64);
  assert.equal(semua.jumlahKelasPersis("absolute top-0"), 64);
  act(() => semua.renderer.unmount());
});

/* ------------------------- Persistensi kontrol ------------------------- */

function pasangDocument(tes) {
  const lama = globalThis.document;
  globalThis.document = { addEventListener() {}, removeEventListener() {} };
  tes.after(() => { if (lama === undefined) delete globalThis.document; else globalThis.document = lama; });
}

function kompilasi(path, dependencies) {
  const filename = new URL(path, import.meta.url);
  const out = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename.pathname,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const factory = runInThisContext(`(function (require, module, exports) {\n${out}\n})`);
  const result = { exports: {} };
  factory((id) => {
    if (id === "react" || id === "react/jsx-runtime" || id === "chess.js") return require(id);
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, result, result.exports);
  return result.exports.default;
}

test("the coordinates dropdown and the three switches persist their choices", async (tes) => {
  pasangDocument(tes);
  const tulisan = [];
  const preferensi = { ...configContext, boardThemes, bacaTeks: () => null, tulis: (key, value) => tulisan.push([key, value]) };
  const i18n = { useI18n: () => ({ t: (key) => key }) };
  const kosong = () => null;
  const Baris = kompilasi("../src/halaman/Analisa/komponen/pengaturan/barisPengaturan.jsx", {});
  const Sakelar = kompilasi("../src/halaman/Analisa/komponen/pengaturan/sakelarPengaturan.jsx", {});
  const Pilih = kompilasi("../src/halaman/Analisa/komponen/pengaturan/pilihRingkas.jsx", {});
  const Geser = kompilasi("../src/halaman/Analisa/komponen/pengaturan/geserPengaturan.jsx", {});
  const setBidak = await import("../src/halaman/Analisa/komponen/pengaturan/setBidak.js");
  const umum = { "../../../../modul/sesi/preferensi.js": preferensi, "../../../../lib/i18n.jsx": i18n, "./barisPengaturan.jsx": { default: Baris } };
  const Themes = kompilasi("../src/halaman/Analisa/komponen/pengaturan/themes.jsx", { ...umum, "./pilihRingkas.jsx": { default: Pilih }, "./setBidak.js": setBidak });
  const Moves = kompilasi("../src/halaman/Analisa/komponen/pengaturan/moves.jsx", { ...umum, "./sakelarPengaturan.jsx": { default: Sakelar }, "./pilihRingkas.jsx": { default: Pilih }, "./geserPengaturan.jsx": { default: Geser }, "../svg/piece.jsx": { default: kosong }, "../svg/soundMax.jsx": { default: kosong }, "../svg/sound-mute.jsx": { default: kosong } });
  const BestMoves = kompilasi("../src/halaman/Analisa/komponen/pengaturan/bestMoves.jsx", { ...umum, "./sakelarPengaturan.jsx": { default: Sakelar }, "./pilihRingkas.jsx": { default: Pilih }, "../svg/piece.jsx": { default: kosong }, "../game/board.jsx": { Arrow: kosong } });
  function Harness() {
    const value = {
      boardTheme: React.useState(0), pieceSet: React.useState("cburnett"),
      usedRatings: React.useState(configContext.defaultUsedRatings), highlightByRating: React.useState(true),
      showArrows: React.useState(true), arrowAfterMove: React.useState(true), showLegalMoves: React.useState(true),
      animateMoves: React.useState(true), boardSounds: React.useState(true),
      coordinates: React.useState("edge"), moveHighlight: React.useState(true),
      autoPromote: React.useState(false), eraseArrowsOnClick: React.useState(true),
    };
    return React.createElement(configContext.ConfigContext.Provider, { value },
      React.createElement(Themes), React.createElement(Moves, { aktif: false }), React.createElement(BestMoves));
  }
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness)); });
  const sakelar = (label) => renderer.root.findAllByProps({ role: "switch" }).find((n) => n.props["aria-label"] === label);
  await act(async () => { sakelar("analisa.pengaturan.sorotLangkah").props.onClick(); });
  assert.deepEqual(tulisan.at(-1), ["moveHighlight", "0"]);
  await act(async () => { sakelar("analisa.pengaturan.autoPromosi").props.onClick(); });
  assert.deepEqual(tulisan.at(-1), ["autoPromote", "1"]);
  await act(async () => { sakelar("analisa.pengaturan.hapusPanahKlik").props.onClick(); });
  assert.deepEqual(tulisan.at(-1), ["eraseArrowsOnClick", "0"]);
  const trigger = renderer.root.findAllByProps({ "aria-haspopup": "listbox" }).find((n) => n.props["aria-label"] === "analisa.pengaturan.koordinatPapan");
  await act(async () => { trigger.props.onClick(); });
  const listbox = renderer.root.findAllByProps({ role: "listbox" }).find((n) => n.props["aria-label"] === "analisa.pengaturan.koordinatPapan");
  const opsi = listbox.findAllByProps({ role: "option" });
  assert.equal(opsi.length, 3);
  await act(async () => { opsi[2].findByType("button").props.onClick(); });
  assert.deepEqual(tulisan.at(-1), ["coordinates", "all"]);
  await act(async () => { renderer.unmount(); });
});
