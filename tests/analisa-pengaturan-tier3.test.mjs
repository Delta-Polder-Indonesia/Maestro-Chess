// Karakterisasi preferensi Tier 3 adopsi En Croissant: pratinjau papan saat
// hover, gulir langkah dengan roda mouse, koleksi suara, ukuran font, warna
// aksen, dan tema terang/gelap — plus penerapannya ke perilaku nyata (papan,
// daftar langkah, root dokumen, .analisa-root) dan persistensi kontrol lewat
// katalog "1 pintu".
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
import { buatHandleKeyDown, buatHandleWheel } from "../src/halaman/Analisa/komponen/game/keyboardPapan.js";
import * as analyzeContext from "../src/halaman/Analisa/konteks/analyzeKonteks.js";
import { getCapturedPieces } from "../src/halaman/Analisa/komponen/game/getMoves.js";
import { aturKoleksiPengguna, bacaKoleksiPengguna, alamatSuara } from "../src/lib/suara.js";
import { DAFTAR_AKSEN, DAFTAR_KOLEKSI_SUARA } from "../src/modul/sesi/configKonteks.js";
import { TAB_META, GRUP_META, BARIS_STATIS } from "../src/halaman/Analisa/komponen/pengaturan/katalogPengaturan.js";
import { analisa as analisaId } from "../src/lib/terjemahan/id/analisa.js";
import { analisa as analisaEn } from "../src/lib/terjemahan/en/analisa.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const noop = () => {};
const kosong = () => null;

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
  return result.exports;
}

function pasangStorage(tes, awal = []) {
  const lama = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const data = new Map(awal);
  const storage = { data, getItem: (k) => data.get(k) ?? null, setItem(k, v) { data.set(k, String(v)); } };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: storage });
  tes.after(() => { if (lama) Object.defineProperty(globalThis, "localStorage", lama); else delete globalThis.localStorage; });
  return storage;
}

/* ------------------------------ Provider ------------------------------ */

function siapkanProvider(tes) {
  const muat = buatPemuatJsx({ "src/modul/pekerjaan/index.js": { KUNCI_FITUR: {}, ID_DRAF_IMPOR: "draf:impor", pekerjaan: {}, buatIdDrafImpor: () => "draf:uji" } });
  const provider = muat("src/halaman/Analisa/konteks/config.jsx").default;
  const konteks = muat("src/halaman/Analisa/konteks/configKonteks.js");
  const amatan = {};
  let renderer;
  function Probe() { amatan.nilai = React.useContext(konteks.ConfigContext); return null; }
  tes.after(() => { if (renderer) act(() => renderer.unmount()); });
  return { amatan, async mount() { await act(async () => { renderer = TestRenderer.create(React.createElement(provider, null, React.createElement(Probe))); await flush(); }); }, async unmount() { if (renderer) { await act(async () => { renderer.unmount(); await flush(); }); renderer = null; } } };
}

test("provider Tier 3 defaults preserve Maestro behaviour (opt-in, standard, 100%, green)", async (tes) => {
  pasangStorage(tes);
  const config = siapkanProvider(tes);
  await config.mount();
  const n = config.amatan.nilai;
  assert.equal(n.previewBoardOnHover[0], false);
  assert.equal(n.boardScroll[0], false);
  assert.equal(n.soundCollection[0], "standard");
  assert.equal(n.fontSize[0], 100);
  assert.equal(n.accentColor[0], "hijau");
});

test("provider reads Tier 3 values, clamps font size, and validates enums", async (tes) => {
  pasangStorage(tes, [
    ["maestro-analisa-previewBoardOnHover", "1"],
    ["maestro-analisa-boardScroll", "1"],
    ["maestro-analisa-soundCollection", "piano"],
    ["maestro-analisa-fontSize", "250"],
    ["maestro-analisa-accentColor", "biru"],
  ]);
  const config = siapkanProvider(tes);
  await config.mount();
  const n = config.amatan.nilai;
  assert.equal(n.previewBoardOnHover[0], true);
  assert.equal(n.boardScroll[0], true);
  assert.equal(n.soundCollection[0], "piano");
  assert.equal(n.fontSize[0], 200, "font dijepit ke 200");
  assert.equal(n.accentColor[0], "biru");
});

test("invalid Tier 3 values fall back to defaults; font clamps to 50..200", async (tes) => {
  const storage = pasangStorage(tes, [
    ["maestro-analisa-soundCollection", "dangdut"],
    ["maestro-analisa-accentColor", "pelangi"],
    ["maestro-analisa-fontSize", "10"],
  ]);
  const config = siapkanProvider(tes);
  await config.mount();
  assert.equal(config.amatan.nilai.soundCollection[0], "standard");
  assert.equal(config.amatan.nilai.accentColor[0], "hijau");
  assert.equal(config.amatan.nilai.fontSize[0], 50);
  storage.data.set("maestro-analisa-fontSize", "bukan angka");
  await config.unmount();
  await config.mount();
  assert.equal(config.amatan.nilai.fontSize[0], 100);
});

// Stub DOM untuk efek provider: font di root dokumen, aksen & tema di elemen
// .analisa-root (halaman Analisa mendefinisikan ulang variabel warna dari
// namespace --analisa-* sehingga override harus di elemen itu sendiri).
function pasangDom(tes) {
  const lama = Object.getOwnPropertyDescriptor(globalThis, "document");
  const style = {
    fontSize: "",
    props: new Map(),
    setProperty(k, v) { this.props.set(k, v); },
    removeProperty(k) { this.props.delete(k); },
  };
  const akar = {
    style: { props: new Map(), setProperty(k, v) { this.props.set(k, v); }, removeProperty(k) { this.props.delete(k); } },
    attrs: new Map(),
    setAttribute(k, v) { this.attrs.set(k, v); },
    removeAttribute(k) { this.attrs.delete(k); },
    getAttribute(k) { return this.attrs.get(k) ?? null; },
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true, writable: true,
    value: { documentElement: { style }, querySelector: (sel) => (sel === ".analisa-root" ? akar : null) },
  });
  tes.after(() => { if (lama) Object.defineProperty(globalThis, "document", lama); else delete globalThis.document; });
  return { style, akar };
}

test("provider applies font size to the document root and accent to the analisa root, restoring on unmount", async (tes) => {
  pasangStorage(tes, [["maestro-analisa-fontSize", "150"], ["maestro-analisa-accentColor", "biru"]]);
  const { style, akar } = pasangDom(tes);
  const config = siapkanProvider(tes);
  await config.mount();
  assert.equal(style.fontSize, "150%");
  assert.equal(akar.style.props.get("--analisa-backgroundBoxBoxHighlighted"), "#3b82f6");
  assert.equal(akar.style.props.get("--analisa-backgroundBoxBoxHighlightedHover"), "#60a5fa");
  assert.equal(style.props.size, 0, "aksen tidak ditulis ke root dokumen (akan terbayangi .analisa-root)");
  await config.unmount();
  assert.equal(style.fontSize, "", "font dipulihkan saat provider dilepas");
  assert.equal(akar.style.props.size, 0, "variabel aksen dipulihkan");
});

test("default font and green accent leave the root stylesheet untouched", async (tes) => {
  pasangStorage(tes);
  const { style, akar } = pasangDom(tes);
  const config = siapkanProvider(tes);
  await config.mount();
  assert.equal(style.fontSize, "", "100% tidak menulis override");
  assert.equal(akar.style.props.size, 0, "hijau memakai variabel CSS bawaan");
  assert.equal(akar.getAttribute("data-tema"), null, "tema bawaan gelap tidak menulis atribut");
  await config.unmount();
});

/* ------------------------------- Tema ------------------------------- */

test("theme defaults to dark, validates the enum, and toggles data-tema on the analisa root", async (tes) => {
  const storage = pasangStorage(tes, [["maestro-analisa-theme", "pelangi"]]);
  const { akar } = pasangDom(tes);
  const config = siapkanProvider(tes);
  await config.mount();
  assert.equal(config.amatan.nilai.theme[0], "dark", "nilai tidak sah jatuh ke dark");
  assert.equal(akar.getAttribute("data-tema"), null);
  await act(async () => { config.amatan.nilai.theme[1]("light"); await flush(); });
  assert.equal(akar.getAttribute("data-tema"), "terang", "tema terang menyalakan palet terang");
  await act(async () => { config.amatan.nilai.theme[1]("dark"); await flush(); });
  assert.equal(akar.getAttribute("data-tema"), null, "kembali gelap melepas atribut");
  await act(async () => { config.amatan.nilai.theme[1]("light"); await flush(); });
  await config.unmount();
  assert.equal(akar.getAttribute("data-tema"), null, "atribut tema dibersihkan saat provider dilepas");
  storage.data.set("maestro-analisa-theme", "auto");
  await config.mount();
  assert.equal(config.amatan.nilai.theme[0], "auto");
});

test("auto theme follows prefers-color-scheme and reacts to system changes", async (tes) => {
  pasangStorage(tes, [["maestro-analisa-theme", "auto"]]);
  const { akar } = pasangDom(tes);
  const lamaWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const pendengar = new Set();
  const media = {
    matches: true,
    addEventListener(_, fn) { pendengar.add(fn); },
    removeEventListener(_, fn) { pendengar.delete(fn); },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: { matchMedia: (kueri) => (kueri === "(prefers-color-scheme: light)" ? media : null) } });
  tes.after(() => { if (lamaWindow) Object.defineProperty(globalThis, "window", lamaWindow); else delete globalThis.window; });
  const config = siapkanProvider(tes);
  await config.mount();
  assert.equal(akar.getAttribute("data-tema"), "terang", "sistem terang -> tema terang");
  assert.equal(pendengar.size, 1, "auto mendengarkan perubahan sistem");
  media.matches = false;
  await act(async () => { for (const fn of pendengar) fn(); await flush(); });
  assert.equal(akar.getAttribute("data-tema"), null, "sistem gelap -> tema gelap");
  await config.unmount();
  assert.equal(pendengar.size, 0, "pendengar dilepas saat unmount");
});

/* --------------------------- Roda mouse --------------------------- */

function buatWheel(aktif = true) {
  const panggilan = [];
  const handler = buatHandleWheel({
    enabledRef: { current: aktif },
    pageStateRef: { current: "analyze" },
    dragRef: { current: { is: false } },
    analyzingMoveRef: { current: false },
    gameController: { forward: () => panggilan.push("maju"), back: () => panggilan.push("mundur") },
  });
  return { handler, panggilan };
}

test("wheel navigates moves only when enabled: down = next, up = previous, zero = nothing", () => {
  const { handler, panggilan } = buatWheel(true);
  handler({ deltaY: 100 });
  assert.deepEqual(panggilan, ["maju"]);
  // Throttle 25 ms: event beruntun langsung berikutnya diabaikan.
  handler({ deltaY: -100 });
  assert.deepEqual(panggilan, ["maju"]);
  const mati = buatWheel(false);
  mati.handler({ deltaY: 100 });
  assert.deepEqual(mati.panggilan, []);
  const nol = buatWheel(true);
  nol.handler({ deltaY: 0 });
  assert.deepEqual(nol.panggilan, []);
});

test("wheel respects the same guards as keyboard: no game, dragging, analyzing", () => {
  for (const penjaga of [
    { pageStateRef: { current: "default" } },
    { dragRef: { current: { is: true } } },
    { analyzingMoveRef: { current: true } },
  ]) {
    const panggilan = [];
    const handler = buatHandleWheel({
      enabledRef: { current: true },
      pageStateRef: { current: "analyze" },
      dragRef: { current: { is: false } },
      analyzingMoveRef: { current: false },
      gameController: { forward: () => panggilan.push("maju"), back: () => panggilan.push("mundur") },
      ...penjaga,
    });
    handler({ deltaY: 100 });
    assert.deepEqual(panggilan, [], JSON.stringify(penjaga));
  }
});

/* --------------------------- Koleksi suara --------------------------- */

test("sound collection whitelist matches the settings list and resolves collection files", () => {
  const semula = bacaKoleksiPengguna();
  for (const id of DAFTAR_KOLEKSI_SUARA) {
    aturKoleksiPengguna(id);
    assert.equal(bacaKoleksiPengguna(), id, id);
  }
  aturKoleksiPengguna("tidak-ada");
  assert.equal(bacaKoleksiPengguna(), "standard");
  aturKoleksiPengguna("piano");
  assert.equal(alamatSuara("move-self"), "/sounds/piano/Move.mp3");
  assert.equal(alamatSuara("move-opponent"), "/sounds/piano/Move.mp3");
  assert.equal(alamatSuara("capture"), "/sounds/piano/Capture.mp3");
  assert.equal(alamatSuara("move-check"), "/sounds/piano/Check.mp3");
  assert.equal(alamatSuara("castle"), "/sounds/piano/Move.mp3", "rokade tanpa Castles jatuh ke Move");
  assert.equal(alamatSuara("promote"), "/sounds/piano/Move.mp3");
  assert.equal(alamatSuara("game-end"), "/sounds/game-end.mp3", "peristiwa non-bidak tetap standar");
  assert.equal(alamatSuara("illegal"), "/sounds/illegal.mp3");
  aturKoleksiPengguna("lisp");
  assert.equal(alamatSuara("castle"), "/sounds/lisp/Castles.mp3");
  aturKoleksiPengguna("standard");
  assert.equal(alamatSuara("move-self"), "/sounds/move-self.mp3");
  assert.equal(alamatSuara("castle"), "/sounds/castle.mp3");
  aturKoleksiPengguna(semula);
});

/* --------------------------- Pratinjau papan --------------------------- */

const PratinjauPapan = kompilasi("../src/halaman/Analisa/komponen/menu/analysis/moves/pratinjauPapan.jsx", {
  "react-dom": { createPortal: (children) => children },
  "../../../pengaturan/setBidak.js": await import("../src/halaman/Analisa/komponen/pengaturan/setBidak.js"),
}).default;

function renderPratinjau(props) {
  const lamaWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const lamaDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: { innerHeight: 900 } });
  Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: { body: {} } });
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(PratinjauPapan, props)); });
  return {
    renderer,
    pulihkan: () => {
      if (lamaWindow) Object.defineProperty(globalThis, "window", lamaWindow); else delete globalThis.window;
      if (lamaDocument) Object.defineProperty(globalThis, "document", lamaDocument); else delete globalThis.document;
    },
  };
}

test("hover preview renders a 64-square mini board with pieces, last-move highlight and orientation", () => {
  const chess = new Chess();
  chess.move("e4");
  const movement = [{ col: 4, row: 1 }, { col: 4, row: 3 }];
  const { renderer, pulihkan } = renderPratinjau({ fen: chess.fen(), movement, putih: true, pieceSet: "cburnett", tema: boardThemes[0], top: 100, left: 600 });
  const kotak = renderer.root.findAllByProps({ "data-kotak-pratinjau": "6-4" });
  assert.equal(renderer.root.findAll((n) => typeof n.props["data-kotak-pratinjau"] === "string").length, 64);
  assert.equal(renderer.root.findAllByType("img").length, 32);
  // e2 (row 1) dan e4 (row 3) disorot pada orientasi putih.
  for (const dr of ["6-4", "4-4"]) {
    const sel = renderer.root.findByProps({ "data-kotak-pratinjau": dr });
    assert.equal(sel.findAll((n) => n.props.className === "absolute inset-0 opacity-50").length, 1, dr);
  }
  assert.equal(kotak.length, 1);
  // Pratinjau di kiri baris, dijepit ke tepi layar.
  const akar = renderer.root.findByProps({ "data-pratinjau-papan": "1" });
  assert.equal(akar.props.style.left, 392);
  assert.equal(akar.props.style.top, 100);
  act(() => renderer.unmount());
  // Orientasi hitam membalik papan: e4 kini di baris tampilan 3, kolom 3.
  const balik = renderPratinjau({ fen: chess.fen(), movement, putih: false, top: 100, left: 600 });
  const selBalik = balik.renderer.root.findByProps({ "data-kotak-pratinjau": "3-3" });
  assert.equal(selBalik.findAll((n) => n.props.className === "absolute inset-0 opacity-50").length, 1);
  act(() => balik.renderer.unmount());
  balik.pulihkan();
  pulihkan();
});

test("hover preview is defensive: missing or invalid FEN renders nothing", () => {
  const { renderer, pulihkan } = renderPratinjau({ fen: "bukan-fen", top: 0, left: 0 });
  assert.equal(renderer.toJSON(), null);
  act(() => renderer.unmount());
  const kosongFen = renderPratinjau({ top: 0, left: 0 });
  assert.equal(kosongFen.renderer.toJSON(), null);
  act(() => kosongFen.renderer.unmount());
  kosongFen.pulihkan();
  pulihkan();
});

/* ------------------------ Wiring daftar langkah ------------------------ */

test("move list shows the hover preview only when the preference is on, and hides it on leave", async (tes) => {
  const lamaWindow = globalThis.window;
  globalThis.window = { addEventListener: noop, removeEventListener: noop };
  tes.after(() => { if (lamaWindow === undefined) delete globalThis.window; else globalThis.window = lamaWindow; });
  const tangkapan = [];
  const PratinjauStub = (props) => { tangkapan.push(props); return React.createElement("div", { "data-uji": "pratinjau" }); };
  const chess = new Chess();
  const fenAwal = chess.fen();
  chess.move("e4");
  const fenE4 = chess.fen();
  chess.move("e5");
  const moves = [
    { fen: fenAwal },
    { san: "e4", color: "w", fen: fenE4, movement: [{ col: 4, row: 1 }, { col: 4, row: 3 }] },
    { san: "e5", color: "b", fen: chess.fen(), movement: [{ col: 4, row: 6 }, { col: 4, row: 4 }] },
  ];
  const Moves = kompilasi("../src/halaman/Analisa/komponen/menu/analysis/moves/moves.jsx", {
    "./comments.jsx": { default: kosong, FormatEval: kosong },
    "../../../../../../modul/sesi/preferensi.js": { ...configContext, boardThemes },
    "./notasi.js": { notasiLangkah: (san) => san },
    "./pratinjauPapan.jsx": { default: PratinjauStub },
    "../gameChart.jsx": { default: kosong },
    "../../../svg/rating.jsx": { default: kosong },
    "../../../game/getMoves.js": { getMoves: (daftar, n) => ({ previousMove: daftar[n - 1], move: daftar[n] }) },
    "../../../../../../modul/analisis/evaluasi.js": { langkahTerpaksa: () => false, ratingTampilan: () => null },
    "../../../../../../lib/i18n.jsx": { useI18n: () => ({ t: (k) => k }) },
    "./movesData.js": { RATING_TEXT_COLORS: {}, getLastBookMove: () => -1 },
  }).default;
  function Harness({ aktif }) {
    const value = {
      moveNotation: ["letters", noop], previewBoardOnHover: [aktif, noop],
      pieceSet: ["cburnett", noop], boardTheme: [0, noop],
    };
    return React.createElement(configContext.ConfigContext.Provider, { value },
      React.createElement(Moves, { moves, moveNumber: 1, setMoveNumber: noop, setAnimation: noop, setForward: noop, customLine: { moveNumber: -1, moves: [] }, returnedToNormalGame: null, analyzingMove: false, white: true }));
  }
  const rect = { currentTarget: { getBoundingClientRect: () => ({ top: 120, left: 600 }) } };
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness, { aktif: true })); });
  const tombol = renderer.root.findAllByType("button").filter((n) => typeof n.props.onMouseEnter === "function");
  assert.equal(tombol.length, 2);
  await act(async () => { tombol[0].props.onMouseEnter(rect); });
  assert.equal(tangkapan.length, 1);
  assert.equal(tangkapan[0].fen, fenE4);
  assert.deepEqual(tangkapan[0].movement, moves[1].movement);
  assert.equal(tangkapan[0].putih, true);
  assert.equal(tangkapan[0].pieceSet, "cburnett");
  assert.equal(tangkapan[0].top, 120);
  assert.equal(tangkapan[0].left, 600);
  assert.equal(renderer.root.findAllByProps({ "data-uji": "pratinjau" }).length, 1);
  await act(async () => { tombol[0].props.onMouseLeave(); });
  assert.equal(renderer.root.findAllByProps({ "data-uji": "pratinjau" }).length, 0);
  await act(async () => { renderer.unmount(); });
  // Preferensi mati → hover tidak memunculkan pratinjau.
  tangkapan.length = 0;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness, { aktif: false })); });
  const tombolMati = renderer.root.findAllByType("button").filter((n) => typeof n.props.onMouseEnter === "function");
  await act(async () => { tombolMati[0].props.onMouseEnter(rect); });
  assert.equal(tangkapan.length, 0);
  await act(async () => { renderer.unmount(); });
});

/* ------------------------ Sinkron papan & game ------------------------ */

test("board syncs the sound collection and forwards onWheel to the board root", async (tes) => {
  const lamaDocument = globalThis.document;
  globalThis.document = { body: { style: {} }, addEventListener: noop, removeEventListener: noop };
  tes.after(() => { if (lamaDocument === undefined) delete globalThis.document; else globalThis.document = lamaDocument; });
  const panggilan = { volume: [], koleksi: [] };
  const Board = kompilasi("../src/halaman/Analisa/komponen/game/board.jsx", {
    "../../mesin/engine.js": await import("../src/halaman/Analisa/mesin/engine.js"),
    "../suaraPapan.js": { buatSuara: () => ({ play: noop }) },
    "../../../../modul/sesi/preferensi.js": { ...configContext, boardThemes },
    "../svg/piece.jsx": { default: kosong },
    "../svg/rating.jsx": { default: kosong },
    "../svg/result.jsx": { default: kosong },
    "../Gambar.jsx": { default: kosong },
    "../../../../lib/asets.js": { berkasPublik: (p) => p },
    "../../../TekaTeki/animasiBidak.js": { GESER_ISEPIC: { durasi: 300, kurva: "ease" } },
    "../../../../lib/suara.js": { aturVolumePengguna: (v) => panggilan.volume.push(v), aturKoleksiPengguna: (k) => panggilan.koleksi.push(k) },
  }).default;
  const onWheel = noop;
  function Harness() {
    const value = {
      usedRatings: [configContext.defaultUsedRatings, noop], highlightByRating: [true, noop],
      showArrows: [true, noop], arrowAfterMove: [true, noop], showLegalMoves: [true, noop],
      animateMoves: [true, noop], boardSounds: [false, noop], boardTheme: [0, noop],
      pieceSet: ["cburnett", noop], volume: [50, noop], soundCollection: ["piano", noop],
    };
    return React.createElement(configContext.ConfigContext.Provider, { value }, React.createElement(Board, {
      fen: new Chess().fen(), white: true, t: (k) => k, boardSize: 320, forward: true, animation: false, arrows: [],
      drag: { is: false, id: "" }, setDrag: noop, setMaterialAdvantage: noop, setPlaying: noop,
      setAnimation: noop, cleanArrows: noop, pushArrow: noop, analyzeMove: noop, onWheel,
    }));
  }
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Harness), { createNodeMock: (node) => node.props.role === "group" ? { getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, right: 320, bottom: 320, width: 320, height: 320 }), querySelector: () => ({ focus: noop }), contains: () => false } : null });
  });
  assert.deepEqual(panggilan.koleksi, ["piano"]);
  assert.deepEqual(panggilan.volume, [0.5]);
  const akar = renderer.root.findAllByProps({ role: "group" }).find((n) => n.props["aria-describedby"]);
  assert.equal(akar.props.onWheel, onWheel, "handler roda diteruskan ke akar papan");
  await act(async () => { renderer.unmount(); });
});

test("game wires the wheel handler to the board and the boardScroll preference gates it", async (tes) => {
  const sebelumnya = { window: globalThis.window, ResizeObserver: globalThis.ResizeObserver, document: globalThis.document };
  globalThis.window = { innerWidth: 1440, innerHeight: 900, addEventListener: noop, removeEventListener: noop };
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.document = { addEventListener: noop, removeEventListener: noop, querySelectorAll: () => [] };
  tes.after(() => { for (const [k, v] of Object.entries(sebelumnya)) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; } });
  const panggilan = [];
  const BoardStub = (props) => React.createElement("div", { "data-uji": "papan", onWheel: props.onWheel });
  const Game = kompilasi("../src/halaman/Analisa/komponen/game/game.jsx", {
    "./board.jsx": { default: BoardStub },
    "./clock.jsx": { default: kosong },
    "./name.jsx": { default: kosong },
    "./evaluation.jsx": { default: kosong },
    "../../../../modul/sesi/analisa.js": analyzeContext,
    "../../../../modul/analisis/evaluasi.js": { ratingTampilan: noop },
    "../../../../modul/sesi/galat.js": { ErrorsContext: React.createContext({ errors: [[], noop] }), pushPageWarning: noop },
    "../../../../modul/sesi/mesin.js": { useMesin: () => ({ didukung: true, siapkan: noop, ambilMesin: noop }) },
    "../../../../lib/i18n.jsx": { useI18n: () => ({ t: (key) => key }) },
    "@/modul/profil/index.js": { useKartuPemain: () => null },
    "../../konstanta.js": { maxSisiPapan: 1000, minSisiPapan: 160, navTop: 516 },
    "../../../../modul/sesi/preferensi.js": configContext,
    "../menu/analysis/gameButtons.jsx": { default: kosong },
    "./getMoves.js": { getMoves: (game, i) => ({ move: game[i] }), getArrows: () => [], getCapturedPieces, getCustomResult: () => "", formatPlayerLabel: (player) => player?.name ?? "" },
    "./useMuatPartai.js": { useMuatPartai: () => ({ controllerRef: {}, muatSeqRef: {}, openingsRef: {} }) },
    "./useAnalisisPapan.js": { useAnalisisPapan: () => ({ analyzeMove: noop, analyzingMoveRef: { current: false } }) },
    "./usePekerjaanLaporan.js": { usePekerjaanLaporan: () => ({}) },
    "./pendengarKeyboard.jsx": { default: kosong },
    "./keyboardPapan.js": { buatHandleKeyDown, buatHandleWheel },
  }).default;
  const state = {
    players: [{ name: "Alice" }, { name: "Bob" }], time: 0, moveNumber: 0,
    game: [{ color: "w" }], data: { format: "fen", string: "" }, pageState: "analyze",
    forward: true, animation: false, white: true, playing: false, materialAdvantage: 0,
    result: "", progress: 0, langkahSementara: [], tab: "moves", analyzeController: new AbortController(),
    customLine: { moveNumber: -1, moves: [], arrows: {} }, returnedToNormalGame: null,
    analyzingMove: false, depth: 13,
  };
  const nilai = { ...Object.fromEntries(Object.entries(state).map(([key, value]) => [key, [value, noop]])), gameController: { forward: () => panggilan.push("maju"), back: () => panggilan.push("mundur") } };
  const main = { clientWidth: 1230, clientHeight: 864 };
  const isi = { offsetHeight: 832, getElementsByTagName: () => [{ offsetHeight: 28 }], closest: () => main };
  async function pasang(aktif) {
    const config = { boardSounds: [true, noop], boardScroll: [aktif, noop] };
    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(analyzeContext.AnalyzeContext.Provider, { value: nilai },
          React.createElement(configContext.ConfigContext.Provider, { value: config },
            React.createElement(Game, { wadah: { current: null }, ukuranWadah: undefined }))),
        { createNodeMock: (node) => node.props.className === "h-full flex flex-col justify-start" ? isi : null },
      );
    });
    return renderer;
  }
  let renderer = await pasang(true);
  const papan = renderer.root.findByProps({ "data-uji": "papan" });
  assert.equal(typeof papan.props.onWheel, "function");
  await act(async () => { papan.props.onWheel({ deltaY: 100 }); });
  assert.deepEqual(panggilan, ["maju"], "roda ke bawah memajukan langkah saat sakelar aktif");
  await act(async () => { renderer.unmount(); });
  panggilan.length = 0;
  renderer = await pasang(false);
  await act(async () => { renderer.root.findByProps({ "data-uji": "papan" }).props.onWheel({ deltaY: 100 }); });
  assert.deepEqual(panggilan, [], "sakelar mati menahan navigasi roda");
  await act(async () => { renderer.unmount(); });
});

/* ------------------------- Persistensi kontrol ------------------------- */

test("Tier 3 controls persist switches, collection, font size, accent and theme through the catalog rows", async (tes) => {
  const lamaDocument = globalThis.document;
  globalThis.document = { addEventListener: noop, removeEventListener: noop };
  tes.after(() => { if (lamaDocument === undefined) delete globalThis.document; else globalThis.document = lamaDocument; });
  const tulisan = [];
  const preferensi = { ...configContext, boardThemes, bacaTeks: () => null, tulis: (k, v) => tulisan.push([k, v]) };
  const i18n = { useI18n: () => ({ t: (key) => key }) };
  const Baris = kompilasi("../src/halaman/Analisa/komponen/pengaturan/barisPengaturan.jsx", {}).default;
  const Sakelar = kompilasi("../src/halaman/Analisa/komponen/pengaturan/sakelarPengaturan.jsx", {}).default;
  const Pilih = kompilasi("../src/halaman/Analisa/komponen/pengaturan/pilihRingkas.jsx", {}).default;
  const Geser = kompilasi("../src/halaman/Analisa/komponen/pengaturan/geserPengaturan.jsx", {}).default;
  const PilihTema = kompilasi("../src/halaman/Analisa/komponen/pengaturan/pilihTema.jsx", {}).default;
  const umum = { "../../../../modul/sesi/preferensi.js": preferensi, "../../../../lib/i18n.jsx": i18n, "./barisPengaturan.jsx": { default: Baris }, "./sakelarPengaturan.jsx": { default: Sakelar }, "./pilihRingkas.jsx": { default: Pilih }, "./geserPengaturan.jsx": { default: Geser }, "./pilihTema.jsx": { default: PilihTema }, "../svg/piece.jsx": { default: kosong }, "../svg/soundMax.jsx": { default: kosong }, "../svg/sound-mute.jsx": { default: kosong } };
  const Moves = kompilasi("../src/halaman/Analisa/komponen/pengaturan/moves.jsx", umum).default;
  const Tampilan = kompilasi("../src/halaman/Analisa/komponen/pengaturan/tampilan.jsx", umum).default;
  function Harness() {
    const value = {
      boardTheme: React.useState(0), pieceSet: React.useState("cburnett"), usedRatings: React.useState(configContext.defaultUsedRatings),
      highlightByRating: React.useState(true), showArrows: React.useState(true), arrowAfterMove: React.useState(true),
      showLegalMoves: React.useState(true), animateMoves: React.useState(true), boardSounds: React.useState(true),
      previewBoardOnHover: React.useState(false), boardScroll: React.useState(false), soundCollection: React.useState("standard"),
      fontSize: React.useState(100), accentColor: React.useState("hijau"), theme: React.useState("dark"),
    };
    return React.createElement(configContext.ConfigContext.Provider, { value }, React.createElement(Moves, { aktif: false }), React.createElement(Tampilan));
  }
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness)); });
  const sakelar = (label) => renderer.root.findAllByType("button").find((n) => n.props["aria-label"] === label && "aria-checked" in n.props);
  await act(async () => { sakelar("analisa.pengaturan.pratinjauHover").props.onClick(); });
  assert.deepEqual(tulisan.at(-1), ["previewBoardOnHover", "1"]);
  await act(async () => { sakelar("analisa.pengaturan.gulirLangkah").props.onClick(); });
  assert.deepEqual(tulisan.at(-1), ["boardScroll", "1"]);
  // Dropdown koleksi suara.
  const trigger = renderer.root.findAllByProps({ "aria-haspopup": "listbox" }).find((n) => n.props["aria-label"] === "analisa.pengaturan.koleksiSuara");
  await act(async () => { trigger.props.onClick(); });
  const listbox = renderer.root.findAllByProps({ role: "listbox" }).find((n) => n.props["aria-label"] === "analisa.pengaturan.koleksiSuara");
  // Urutan opsi = DAFTAR_KOLEKSI_SUARA: standard, futuristic, lisp, nes, piano, ...
  await act(async () => { listbox.findAllByProps({ role: "option" })[4].findByType("button").props.onClick(); });
  assert.deepEqual(tulisan.at(-1), ["soundCollection", "piano"]);
  // Slider font menulis angka yang dijepit.
  const slider = renderer.root.findByProps({ type: "range", "aria-label": "analisa.pengaturan.ukuranFont" });
  assert.equal(slider.props.min, 50);
  assert.equal(slider.props.max, 200);
  assert.equal(slider.props.step, 10);
  await act(async () => { slider.props.onChange({ target: { value: "150" } }); });
  assert.deepEqual(tulisan.at(-1), ["fontSize", "150"]);
  // Swatch aksen menulis id palet.
  const swatch = renderer.root.findAllByType("button").find((n) => n.props["aria-label"] === "analisa.pengaturan.aksen.biru");
  assert.equal(swatch.props["aria-pressed"], false);
  await act(async () => { swatch.props.onClick(); });
  assert.deepEqual(tulisan.at(-1), ["accentColor", "biru"]);
  // Pemilih tema: radio terang menulis "light"; panah kanan dari gelap
  // membungkus ke otomatis (urutan auto, light, dark).
  const radio = (label) => renderer.root.findAllByProps({ role: "radio" }).find((n) => n.props["aria-label"] === label);
  assert.equal(radio("analisa.pengaturan.opsiTema.dark").props["aria-checked"], true);
  await act(async () => { radio("analisa.pengaturan.opsiTema.light").props.onClick(); });
  assert.deepEqual(tulisan.at(-1), ["theme", "light"]);
  assert.equal(radio("analisa.pengaturan.opsiTema.light").props["aria-checked"], true);
  let dicegah = false;
  await act(async () => { radio("analisa.pengaturan.opsiTema.dark").props.onKeyDown({ key: "ArrowRight", preventDefault: () => { dicegah = true; } }); });
  assert.ok(dicegah, "panah memanggil preventDefault");
  assert.deepEqual(tulisan.at(-1), ["theme", "auto"]);
  await act(async () => { renderer.unmount(); });
});

/* --------------------------- Katalog & palet --------------------------- */

test("catalog registers every Tier 3 row and the accent palette keeps the legacy green", () => {
  assert.ok(GRUP_META.some((g) => g.id === "tampilan" && g.tab === "papan"));
  const harapan = { pratinjauHover: "perilaku", gulirLangkah: "perilaku", koleksiSuara: "perilaku", tema: "tampilan", ukuranFont: "tampilan", warnaAksen: "tampilan" };
  for (const [kunci, grup] of Object.entries(harapan)) {
    const baris = BARIS_STATIS.find((b) => b.kunci === kunci);
    assert.ok(baris, kunci);
    assert.equal(baris.grup, grup, kunci);
  }
  assert.deepEqual(DAFTAR_AKSEN[0], { id: "hijau", dasar: "#81b64c", hover: "#8bc550" }, "aksen bawaan = hijau asli Maestro");
  assert.equal(new Set(DAFTAR_AKSEN.map((a) => a.id)).size, DAFTAR_AKSEN.length);
  assert.equal(DAFTAR_KOLEKSI_SUARA[0], "standard");
  // Semua label baru tersedia di kedua bahasa (label, sub-opsi, deskripsi).
  for (const kamus of [analisaId, analisaEn]) {
    const p = kamus.pengaturan;
    for (const kunci of ["pratinjauHover", "gulirLangkah", "koleksiSuara", "tema", "ukuranFont", "warnaAksen", "tampilan"]) assert.equal(typeof p[kunci], "string", kunci);
    for (const id of ["auto", "light", "dark"]) assert.equal(typeof p.opsiTema[id], "string", id);
    for (const id of DAFTAR_KOLEKSI_SUARA) assert.equal(typeof p.koleksi[id], "string", id);
    for (const a of DAFTAR_AKSEN) assert.equal(typeof p.aksen[a.id], "string", a.id);
    for (const kunci of ["pratinjauHover", "gulirLangkah", "koleksiSuara", "tema", "ukuranFont", "warnaAksen", "tampilan"]) assert.equal(typeof p.deskripsi[kunci], "string", kunci);
  }
  assert.ok(TAB_META.length === 5);
});
