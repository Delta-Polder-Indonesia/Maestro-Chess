import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import { Chess } from "chess.js";
import ts from "typescript";
import * as boardContext from "../src/halaman/Analisa/konteks/boardKonteks.js";
import * as analyzeContext from "../src/halaman/Analisa/konteks/analyzeKonteks.js";
import * as configContext from "../src/halaman/Analisa/konteks/configKonteks.js";
import { boardThemes } from "../src/halaman/Analisa/komponen/pengaturan/boardThemes.js";
import { buatHandleKeyDown } from "../src/halaman/Analisa/komponen/game/keyboardPapan.js";
import { getCapturedPieces } from "../src/halaman/Analisa/komponen/game/getMoves.js";
import { useAnalisisPapan } from "../src/halaman/Analisa/komponen/game/useAnalisisPapan.js";
import { useUkuranArea } from "../src/halaman/Analisa/komponen/useUkuranArea.js";
import * as navigasiTab from "../src/halaman/Analisa/komponen/navigasiTab.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;
const noop = () => {};

// The Node test runner cannot import JSX directly: compile the real component
// and substitute only its external dependencies, as in the other UI tests.
function kompilasi(path, dependencies) {
  const filename = new URL(path, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename.pathname,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const factory = runInThisContext(`(function (require, module, exports) {\n${compiled}\n})`);
  const result = { exports: {} };
  factory((id) => {
    if (id in dependencies) return dependencies[id];
    if (id === "react" || id === "react/jsx-runtime" || id === "chess.js") return require(id);
    throw new Error(`Unexpected dependency: ${id}`);
  }, result, result.exports);
  return result.exports;
}

test("navigation notifies the screen only, while board and analysis still receive real board changes", async () => {
  const t = (key) => key;
  const muat = buatPemuatJsx({
    "src/lib/i18n.jsx": { useI18n: () => ({ t }) },
    "src/modul/sesi/preferensi.js": { bacaAngka: (_key, fallback) => fallback },
    "src/modul/sesi/analyzeKonteks.js": analyzeContext,
    "src/modul/sesi/boardKonteks.js": boardContext,
  });
  const board = muat("src/halaman/Analisa/konteks/board.jsx");
  const imp = {
    data: [{ format: "fen", string: "" }, noop], pageState: ["default", noop],
    progress: [0, noop], langkahSementara: [[], noop],
    analyzeController: [new AbortController(), noop], analyzingMove: [false, noop],
  };
  const analyze = kompilasi("../src/modul/sesi/AnalyzeContextProvider.jsx", {
    "./analyzeKonteks.js": analyzeContext,
    "./papanProvider.js": board,
    "./imporProvider.js": { ImportProvider: ({ children }) => children },
    "./papan.js": boardContext,
    "./impor.js": { useImport: () => imp },
  });
  const hitung = { papan: 0, analisis: 0, tampilan: 0, setter: 0 };
  const nilai = {};
  const Papan = React.memo(function Papan() {
    hitung.papan++;
    nilai.board = boardContext.useBoard();
    return null;
  });
  const Analisis = React.memo(function Analisis() {
    hitung.analisis++;
    nilai.analisis = React.useContext(analyzeContext.AnalyzeContext);
    return null;
  });
  const Tampilan = React.memo(function Tampilan() {
    hitung.tampilan++;
    nilai.tampilan = boardContext.useTampilan();
    return null;
  });
  const Setter = React.memo(function Setter() {
    hitung.setter++;
    nilai.setTampilan = boardContext.useSetTampilan();
    return null;
  });
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(analyze.default, null,
      React.createElement(Papan), React.createElement(Analisis), React.createElement(Tampilan), React.createElement(Setter)));
  });
  const awal = { ...hitung };
  const papanAwal = nilai.board;
  const analisisAwal = nilai.analisis;
  await act(async () => { nilai.setTampilan("pengaturan"); });
  assert.equal(nilai.tampilan[0], "pengaturan");
  assert.equal(hitung.tampilan, awal.tampilan + 1);
  assert.equal(hitung.papan, awal.papan);
  assert.equal(hitung.analisis, awal.analisis);
  assert.equal(hitung.setter, awal.setter);
  assert.equal(nilai.board, papanAwal);
  assert.equal(nilai.analisis, analisisAwal);

  await act(async () => { nilai.board.depth[1](8); });
  assert.equal(nilai.board.depth[0], 8);
  assert.equal(nilai.analisis.depth[0], 8);
  assert.equal(hitung.papan, awal.papan + 1);
  assert.equal(hitung.analisis, awal.analisis + 1);
  assert.equal(hitung.tampilan, awal.tampilan + 1);
  assert.equal(hitung.setter, awal.setter);
  await act(async () => { renderer.unmount(); });
});

test("the board ignores unrelated configuration, applies sound/theme, and caches legal moves", async (t) => {
  let renderBidak = 0;
  let hitungLangkahSah = 0;
  const langkahAsli = Chess.prototype.moves;
  Chess.prototype.moves = function (...args) {
    hitungLangkahSah++;
    return langkahAsli.apply(this, args);
  };
  t.after(() => { Chess.prototype.moves = langkahAsli; });
  const suara = [];
  const Bidak = () => { renderBidak++; return React.createElement("span", { "data-bidak": true }); };
  const kosong = () => null;
  const Board = kompilasi("../src/halaman/Analisa/komponen/game/board.jsx", {
    "../../mesin/engine.js": { deformatSquare: noop, formatSquare: noop },
    "../suaraPapan.js": { buatSuara: (nama) => ({ play: () => suara.push(nama) }) },
    "../../../../modul/sesi/preferensi.js": { ...configContext, boardThemes },
    "../svg/piece.jsx": { default: Bidak },
    "../svg/rating.jsx": { default: kosong },
    "../svg/result.jsx": { default: kosong },
    "../Gambar.jsx": { default: kosong },
    "../../../../lib/asets.js": { berkasPublik: (path) => path },
    "../../../TekaTeki/animasiBidak.js": { GESER_ISEPIC: { durasi: 300, kurva: "ease" } },
  }).default;
  const kendali = {};
  const chess = new Chess();
  const fenAwal = chess.fen();
  chess.move("e4");
  const fenE4 = chess.fen();
  chess.move("e5");
  const fenE5 = chess.fen();
  const props = {
    boardSize: 320, white: true, forward: true, animation: false,
    drag: { is: false, id: "" }, arrows: [], setDrag: noop,
    setMaterialAdvantage: noop, setPlaying: noop, setAnimation: noop,
    cleanArrows: noop, pushArrow: noop, analyzeMove: noop,
  };
  const bawaan = {
    usedRatings: [configContext.defaultUsedRatings, noop], highlightByRating: [true, noop],
    showArrows: [true, noop], arrowAfterMove: [true, noop], showLegalMoves: [true, noop],
    animateMoves: [true, noop],
  };
  function Harness() {
    const openedMenu = React.useState(null);
    const boardTheme = React.useState(0);
    const boardSounds = React.useState(true);
    const fen = React.useState(fenAwal);
    const drag = React.useState({ is: false, id: "" });
    Object.assign(kendali, { openedMenu, boardTheme, boardSounds, fen, drag });
    const value = { ...bawaan, openedMenu, boardTheme, boardSounds };
    return React.createElement(configContext.ConfigContext.Provider, { value }, React.createElement(Board, { ...props, fen: fen[0], drag: drag[0], setDrag: drag[1] }));
  }
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness)); });
  assert.equal(renderBidak, 32);
  const warna = () => renderer.root.findByProps({ "data-square": "a8" }).props.style.backgroundColor;
  assert.equal(warna(), boardThemes[0].white);
  await act(async () => { kendali.openedMenu[1]("settings"); });
  assert.equal(renderBidak, 32, "unrelated menu state must not rebuild 64 squares");
  await act(async () => { kendali.boardTheme[1](2); });
  assert.equal(warna(), boardThemes[2].white);
  assert.equal(renderBidak, 64);
  await act(async () => { kendali.boardSounds[1](false); });
  assert.equal(renderBidak, 64, "sound alone should not rebuild the squares");
  await act(async () => { kendali.fen[1](fenE4); });
  assert.equal(renderBidak, 96);
  assert.deepEqual(suara, [], "the next position respects muted sound");
  await act(async () => { kendali.boardSounds[1](true); });
  assert.equal(renderBidak, 96);
  await act(async () => { kendali.fen[1](fenE5); });
  assert.equal(renderBidak, 128);
  assert.equal(suara.length, 1, "sound resumes on the next position");

  chess.move("d4");
  await act(async () => { kendali.boardSounds[1](false); kendali.fen[1](chess.fen()); });
  assert.equal(suara.length, 1, "muting and moving in the same commit is silent");
  chess.move("d5");
  await act(async () => { kendali.boardSounds[1](true); kendali.fen[1](chess.fen()); });
  assert.equal(suara.length, 2, "unmuting and moving in the same commit plays once");

  await act(async () => { kendali.drag[1]({ is: true, id: "b2" }); });
  const pertama = hitungLangkahSah;
  assert.ok(pertama > 0);
  const hover = renderer.root.findByProps({ "data-square": "b3" }).findAll((node) => typeof node.props.onMouseEnter === "function")[0];
  await act(async () => { hover.props.onMouseEnter(); });
  assert.equal(hitungLangkahSah, pertama, "hovering on the same position must reuse legal moves");
  await act(async () => { kendali.drag[1]({ is: true, id: "c2" }); });
  assert.equal(hitungLangkahSah, pertama + 1, "selecting another piece recalculates legal moves");
  chess.move("Nc3");
  await act(async () => { kendali.fen[1](chess.fen()); });
  assert.equal(hitungLangkahSah, pertama + 2, "a new position recalculates legal moves");
  await act(async () => { renderer.unmount(); });
});

test("move navigation defers the side panel without overriding a later tab selection", async (t) => {
  const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  t.after(() => {
    if (previousActEnvironment === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    else globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });
  let transitions = 0;
  let release;
  let suspendMoves = true;
  const pendingMoves = new Promise((resolve) => { release = resolve; });
  const reactWithSpy = { ...React, startTransition: (callback) => { transitions++; React.startTransition(callback); } };
  const kosong = () => null;
  const Summary = () => React.createElement("div", { "data-uji": "ringkasan-test" });
  const Moves = () => {
    if (suspendMoves) throw pendingMoves;
    return React.createElement("div", { "data-uji": "langkah-test" });
  };
  const translate = (key) => key;
  const Menu = kompilasi("../src/halaman/Analisa/komponen/menu/menu.jsx", {
    react: reactWithSpy,
    "../../../../modul/sesi/analisa.js": analyzeContext,
    "../../../../lib/i18n.jsx": { useI18n: () => ({ t: translate }) },
    "./loading/loading.jsx": { default: kosong },
    "./loading/grafikMuat.jsx": { default: kosong },
    "./analysis/gameButtons.jsx": { default: kosong },
    "../svg/star.jsx": { default: kosong },
    "../svg/boardIcon.jsx": { default: kosong },
    "./analysis/summary/summary.jsx": { default: Summary },
    "./analysis/moves/moves.jsx": { default: Moves },
    "./analysis/moves/overallGameComment.jsx": { default: () => "" },
    "../svg/profile.jsx": { default: kosong },
    "../svg/files.jsx": { default: kosong },
    "../navigasiTab.js": navigasiTab,
  }).default;
  const kendali = {};
  function Harness() {
    const tab = React.useState("summary");
    const pageState = React.useState("loading");
    const moveNumber = React.useState(0);
    Object.assign(kendali, { tab, pageState, moveNumber });
    const value = {
      tab, pageState, moveNumber, data: [{ format: "pgn" }, noop], game: [[], noop],
      langkahSementara: [[], noop], players: [[{ name: "" }, { name: "" }], noop],
      result: ["", noop], analyzeController: [new AbortController(), noop], analyzingMove: [false, noop],
      animation: [false, noop], forward: [true, noop],
      customLine: [{ moveNumber: -1, moves: [], arrows: {} }, noop], returnedToNormalGame: [null, noop],
    };
    return React.createElement(analyzeContext.AnalyzeContext.Provider, { value }, React.createElement(Menu));
  }
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(React.Suspense, { fallback: "loading" }, React.createElement(Harness)), { unstable_isConcurrent: true });
  });
  await act(async () => { kendali.pageState[1]("analyze"); });
  assert.equal(transitions, 0, "a completed analysis first opens the summary");
  assert.equal(renderer.root.findAllByProps({ "data-uji": "ringkasan-test" }).length, 1);
  await act(async () => { kendali.moveNumber[1](1); });
  assert.equal(transitions, 1);
  assert.equal(renderer.root.findAllByProps({ "data-uji": "ringkasan-test" }).length, 1, "old panel stays visible while the transition is pending");
  const ringkasan = renderer.root.findAllByProps({ role: "tab" })[0];
  await act(async () => { ringkasan.props.onClick(); });
  assert.equal(transitions, 1, "an explicit tab click is not deferred");
  await act(async () => { suspendMoves = false; release(); await pendingMoves; });
  assert.equal(kendali.tab[0], "summary", "the later explicit choice wins over a pending transition");
  await act(async () => { kendali.moveNumber[1](2); });
  assert.equal(kendali.tab[0], "moves");
  assert.equal(renderer.root.findAllByProps({ "data-uji": "langkah-test" }).length, 1);
  await act(async () => { renderer.unmount(); });
});

test("the board observes its workspace from the first mount and resizes when the sidebar changes", async (t) => {
  const sebelumnya = { window: globalThis.window, ResizeObserver: globalThis.ResizeObserver };
  const pendengar = new Map();
  globalThis.window = {
    innerWidth: 1440, innerHeight: 900,
    addEventListener: (jenis, fn) => pendengar.set(jenis, fn),
    removeEventListener: (jenis) => pendengar.delete(jenis),
  };
  const observers = [];
  globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(elemen) { this.elemen = elemen; }
    disconnect() { this.terputus = true; }
  };
  t.after(() => {
    for (const [key, value] of Object.entries(sebelumnya)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  });

  const main = { clientWidth: 1230, clientHeight: 864 };
  let refWadah;
  let fallbackSaatRefKosong = false;
  let tinggiStatus = 28;
  const isi = { closest: (selector) => selector === "main" ? main : null };
  const component = {
    get offsetHeight() { return 832; },
    getElementsByTagName: () => [{ offsetHeight: tinggiStatus }],
    closest: (selector) => {
      assert.equal(selector, "[data-wadah-papan]");
      if (!refWadah.current) fallbackSaatRefKosong = true;
      return main;
    },
  };
  const kosong = () => null;
  const Board = ({ boardSize }) => React.createElement("div", { "data-uji": "ukuran-papan-test", "data-size": boardSize });
  const Game = kompilasi("../src/halaman/Analisa/komponen/game/game.jsx", {
    "./board.jsx": { default: Board },
    "./clock.jsx": { default: kosong },
    "./name.jsx": { default: kosong },
    "./evaluation.jsx": { default: kosong },
    "../../../../modul/sesi/analisa.js": analyzeContext,
    "../../mesin/evaluasi.js": { ratingTampilan: noop },
    "../../../../modul/sesi/galat.js": { ErrorsContext: React.createContext({ errors: [[], noop] }), pushPageWarning: noop },
    "../../../../modul/sesi/mesin.js": { useMesin: () => ({ didukung: true, siapkan: noop, ambilMesin: noop }) },
    "../../../../lib/i18n.jsx": { useI18n: () => ({ t: (key) => key }) },
    "@/modul/profil/index.js": { useKartuPemain: () => null },
    "../../konstanta.js": { maxSisiPapan: 1000, minSisiPapan: 160, navTop: 516 },
    "../../../../modul/sesi/preferensi.js": configContext,
    "../menu/analysis/gameButtons.jsx": { default: kosong },
    "./getMoves.js": {
      getMoves: (game, i) => ({ move: game[i] }), getArrows: () => [], getCapturedPieces,
      getCustomResult: () => "", formatPlayerLabel: (player) => player.name,
    },
    "./useMuatPartai.js": { useMuatPartai: () => ({ controllerRef: {}, muatSeqRef: {}, openingsRef: {} }) },
    "./useAnalisisPapan.js": { useAnalisisPapan: () => ({ analyzeMove: noop, analyzingMoveRef: {} }) },
    "./usePekerjaanLaporan.js": { usePekerjaanLaporan: () => ({}) },
    "./pendengarKeyboard.jsx": { default: kosong },
  }).default;
  const state = {
    players: [{ name: "Alice" }, { name: "Bob" }], time: 0, moveNumber: 0,
    game: [{ color: "w" }], data: { format: "fen", string: "" }, pageState: "default",
    forward: true, animation: false, white: true, playing: false, materialAdvantage: 0,
    result: "", progress: 0, langkahSementara: [], tab: "moves", analyzeController: new AbortController(),
    customLine: { moveNumber: -1, moves: [], arrows: {} }, returnedToNormalGame: null,
    analyzingMove: false, depth: 13,
  };
  const nilai = { ...Object.fromEntries(Object.entries(state).map(([key, value]) => [key, [value, noop]])), gameController: {} };
  function Harness() {
    refWadah = React.useRef(null);
    const refIsi = React.useRef(null);
    const ukuranWadah = useUkuranArea(refWadah, refIsi);
    tinggiStatus = ukuranWadah?.sejajar ? 44 : 28;
    return React.createElement("main", { ref: refWadah },
      React.createElement("div", { ref: refIsi, "data-uji": "isi-area-test" }, React.createElement(Game, { wadah: refWadah, ukuranWadah })));
  }
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(analyzeContext.AnalyzeContext.Provider, { value: nilai }, React.createElement(Harness)), {
      createNodeMock: (element) => element.type === "main" ? main : element.props["data-uji"] === "isi-area-test" ? isi : element.props.className === "h-full flex flex-col justify-start" ? component : null,
    });
  });
  assert.equal(fallbackSaatRefKosong, true, "the child layout effect runs before the parent main ref is attached");
  assert.equal(observers.length, 1);
  assert.equal(observers[0].elemen, main);
  const ukuran = () => renderer.root.findByProps({ "data-uji": "ukuran-papan-test" }).props["data-size"];
  assert.equal(ukuran(), 704, "the board stays large while the panel is below it");
  main.clientWidth = 1392;
  await act(async () => { observers[0].callback(); });
  assert.equal(ukuran(), 728, "closing the sidebar can move the panel alongside without shrinking the board");
  main.clientWidth = 1230;
  await act(async () => { observers[0].callback(); });
  assert.equal(ukuran(), 704, "reopening the sidebar restores the column and its board size");
  main.clientHeight = 224;
  await act(async () => { observers[0].callback(); });
  assert.equal(ukuran(), 160, "a very short viewport keeps a usable board instead of a negative size");
  await act(async () => { renderer.unmount(); });
  assert.equal(observers[0].terputus, true);
  assert.equal(pendengar.has("resize"), false);
});

test("captured pieces follow the current move and the visible custom line", () => {
  const game = [
    {},
    { color: "b", capture: "p" },
    { color: "w", capture: "n" },
    { color: "b", capture: "b" },
  ];
  const variation = { moveNumber: 1, moves: [{ color: "w", capture: "q" }, { color: "b", capture: "r" }] };
  assert.deepEqual(getCapturedPieces(game, 0, { moveNumber: -1, moves: [] }), { white: [], black: [] });
  assert.deepEqual(getCapturedPieces(game, 2, { moveNumber: -1, moves: [] }), { white: ["p"], black: ["n"] });
  assert.deepEqual(getCapturedPieces(game, 1, variation), { white: ["p", "r"], black: ["q"] });
  assert.deepEqual(getCapturedPieces(game, 1, { ...variation, moveNumber: 0 }), { white: ["p"], black: ["q"] });
});

test("keyboard listener follows the visible screen through a memoized parent and is removed on unmount", async (t) => {
  const Pendengar = kompilasi("../src/halaman/Analisa/komponen/game/pendengarKeyboard.jsx", {
    "../../../../modul/sesi/papan.js": boardContext,
    "./keyboardPapan.js": { buatHandleKeyDown },
  }).default;
  const previousDocument = globalThis.document;
  const listeners = new Set();
  globalThis.document = {
    addEventListener: (event, fn) => { if (event === "keydown") listeners.add(fn); },
    removeEventListener: (event, fn) => { if (event === "keydown") listeners.delete(fn); },
    querySelectorAll: () => [],
  };
  t.after(() => { if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; });
  let setTampilan;
  let parentRenders = 0;
  let maju = 0;
  const refs = {
    pageStateRef: { current: "analyze" }, dragRef: { current: { is: false, id: "" } },
    analyzingMoveRef: { current: false }, gameController: { forward: () => { maju++; } },
  };
  const Parent = React.memo(function Parent() {
    parentRenders++;
    return React.createElement(Pendengar, refs);
  });
  function Provider() {
    const [tampilan, set] = React.useState("bermain");
    setTampilan = set;
    return React.createElement(boardContext.TampilanContext.Provider, { value: tampilan },
      React.createElement(boardContext.SetTampilanContext.Provider, { value: set }, React.createElement(Parent)));
  }
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Provider)); });
  assert.equal(listeners.size, 1);
  const event = () => ({ key: "ArrowRight", target: { tagName: "DIV", closest: () => null }, preventDefault: noop });
  for (const fn of listeners) fn(event());
  assert.equal(maju, 1);
  await act(async () => { setTampilan("pengaturan"); });
  assert.equal(listeners.size, 1);
  assert.equal(parentRenders, 1);
  for (const fn of listeners) fn(event());
  assert.equal(maju, 1, "hidden board must not handle arrow keys");
  await new Promise((resolve) => setTimeout(resolve, 30));
  await act(async () => { setTampilan("bermain"); });
  for (const fn of listeners) fn(event());
  assert.equal(maju, 2);
  assert.equal(parentRenders, 1);
  await act(async () => { renderer.unmount(); });
  assert.equal(listeners.size, 0);
});

test("stable board analysis callback uses the latest depth when it changes", async () => {
  const dipakai = [];
  const mesin = { async cari(_fen, opsi) { dipakai.push(opsi.kedalaman); return { staticEval: ["cp", "0"], daftarKandidat: [] }; } };
  const ambilMesin = () => mesin;
  const siapkan = async () => mesin;
  const t = (key) => key;
  const data = { format: "fen", string: "" };
  const hasil = {};
  function Harness({ depth, lain }) {
    const controllerRef = React.useRef(new AbortController());
    const muatSeqRef = React.useRef(0);
    const openingsRef = React.useRef(() => undefined);
    const [customLine, setCustomLine] = React.useState({ moveNumber: -1, moves: [], arrows: {} });
    const analisis = useAnalisisPapan({
      controllerRef, muatSeqRef, openingsRef, data, depth, time: 0, move2: undefined,
      siapkan, ambilMesin, t, setErrors: noop, setAnalyzeController: noop,
      setPageState: noop, setAnimation: noop, setForward: noop, setCustomLine,
      setAnalyzingMove: noop, analyzingMove: false,
    });
    Object.assign(hasil, { callback: analisis.analyzeMove, customLine, lain });
    return null;
  }
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness, { depth: 6, lain: 0 })); });
  const awal = hasil.callback;
  await act(async () => { renderer.update(React.createElement(Harness, { depth: 6, lain: 1 })); });
  assert.equal(hasil.callback, awal);
  await act(async () => { renderer.update(React.createElement(Harness, { depth: 8, lain: 1 })); });
  assert.notEqual(hasil.callback, awal);
  await act(async () => {
    await hasil.callback(new Chess().fen(), { from: "e2", to: "e4" }, false, [["cp", "0"]], false, undefined, []);
  });
  assert.deepEqual(dipakai, [8]);
  assert.equal(hasil.customLine.moves[0].san, "e4");
  await act(async () => { renderer.unmount(); });
});
