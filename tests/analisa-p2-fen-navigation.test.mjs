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
import { getMoves } from "../src/halaman/Analisa/komponen/game/getMoves.js";
import { useAnalisisPapan } from "../src/halaman/Analisa/komponen/game/useAnalisisPapan.js";
import { snapshotLaporanAman } from "../src/halaman/Analisa/pekerjaan.js";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;
const compiled = ts.transpileModule(readFileSync(new URL("../src/halaman/Analisa/konteks/board.jsx", import.meta.url), "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const dependencies = {
  "../../../lib/i18n.jsx": { useI18n: () => ({ t: (key) => key }) },
  "../penyimpanan.js": { bacaAngka: (_key, fallback) => fallback },
  "./analyzeKonteks.js": analyzeContext,
  "./boardKonteks.js": boardContext,
};
const compiledModule = { exports: {} };
runInThisContext(`(function (require, module, exports) {\n${compiled}\n})`)((id) => {
  if (id in dependencies) return dependencies[id];
  if (id === "react" || id === "react/jsx-runtime") return require(id);
  throw new Error(`Unexpected dependency: ${id}`);
}, compiledModule, compiledModule.exports);
const { BoardProvider } = compiledModule.exports;
const noop = () => {};

function mount() {
  let context;
  function Child() { context = boardContext.useBoard(); return null; }
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(BoardProvider, null, React.createElement(Child))); });
  return { renderer, get context() { return context; } };
}

function positions() {
  const chess = new Chess();
  const base = { fen: chess.fen() };
  const first = chess.move("e4");
  const second = chess.move("e5");
  return {
    base,
    first: { fen: first.after, san: first.san, movement: [{ col: 4, row: 1 }, { col: 4, row: 3 }], color: "b" },
    second: { fen: second.after, san: second.san, movement: [{ col: 4, row: 6 }, { col: 4, row: 4 }], color: "w" },
  };
}

test("a FEN line survives rewinding to its origin, forwards, first/last, and snapshot recovery", () => {
  const app = mount();
  const { base, first, second } = positions();
  const arrows = { 0: [[{ col: 0, row: 0 }, { col: 0, row: 1 }]], 1: [] };
  act(() => {
    app.context.game[1]([base]);
    app.context.customLine[1]({ moveNumber: 1, moves: [first, second], arrows });
  });
  act(() => app.context.gameController.back());
  assert.equal(app.context.customLine[0].moveNumber, 0);
  act(() => app.context.gameController.back());
  assert.equal(app.context.customLine[0].moveNumber, -1);
  assert.deepEqual(app.context.customLine[0].moves, [first, second]);
  assert.deepEqual(app.context.customLine[0].arrows, arrows);
  assert.deepEqual(getMoves([base], 0, app.context.customLine[0], app.context.returnedToNormalGame[0]).nextMove, first,
    "rewinding retains the complete next move for capture/castle animation");

  const snapshot = snapshotLaporanAman({
    versi: 1, game: [base], moveNumber: 0, customLine: app.context.customLine[0],
    pageState: "analyzeCustom", tab: "moves", players: [{ name: "" }, { name: "" }],
  });
  assert.equal(snapshot.customLine.moveNumber, -1);
  assert.equal(snapshot.customLine.moves.length, 2);
  act(() => app.context.gameController.forward());
  assert.equal(app.context.customLine[0].moveNumber, 0);
  act(() => app.context.gameController.forward());
  assert.equal(app.context.customLine[0].moveNumber, 1);
  act(() => app.context.gameController.forward());
  assert.equal(app.context.customLine[0].moveNumber, 1, "cannot advance past the line");
  act(() => app.context.gameController.first());
  assert.equal(app.context.customLine[0].moveNumber, -1);
  assert.equal(app.context.customLine[0].moves.length, 2);
  act(() => app.context.gameController.last());
  assert.equal(app.context.customLine[0].moveNumber, 1);

  const recovered = mount();
  act(() => { recovered.context.game[1](snapshot.game); recovered.context.customLine[1](snapshot.customLine); });
  act(() => recovered.context.gameController.forward());
  assert.equal(recovered.context.customLine[0].moveNumber, 0);
  assert.equal(recovered.context.customLine[0].moves[0].fen, first.fen);
  act(() => { app.renderer.unmount(); recovered.renderer.unmount(); });
});

test("returning from a PGN variation still resumes the original main line", () => {
  const app = mount();
  const { base, first, second } = positions();
  const variant = { ...second, san: "c5" };
  act(() => {
    app.context.game[1]([base, first, second]);
    app.context.moveNumber[1](1);
    app.context.customLine[1]({ moveNumber: 0, moves: [variant], arrows: { 0: [] } });
  });
  act(() => app.context.gameController.back());
  assert.equal(app.context.customLine[0].moveNumber, -1);
  assert.deepEqual(app.context.customLine[0].moves, []);
  assert.equal(app.context.moveNumber[0], 1);
  act(() => app.context.gameController.forward());
  assert.equal(app.context.moveNumber[0], 2);
  assert.equal(app.context.game[0][2].san, "e5");
  act(() => app.renderer.unmount());
});

test("a replacement manual move discards future moves and their arrows", async () => {
  const { first, second } = positions();
  const arrow = [{ col: 0, row: 0 }, { col: 1, row: 1 }];
  let state;
  function Harness() {
    const [line, setLine] = React.useState({ moveNumber: -1, moves: [first, second], arrows: { 0: [arrow], 1: [arrow] } });
    const analysis = useAnalisisPapan({
      controllerRef: React.useRef(new AbortController()), muatSeqRef: React.useRef(0), openingsRef: React.useRef(() => undefined),
      data: { format: "fen" }, depth: 6, time: 0, move2: null,
      siapkan: async () => null, ambilMesin: () => null, t: (key) => key,
      setErrors: noop, setAnalyzeController: noop, setPageState: noop, setAnimation: noop, setForward: noop,
      setCustomLine: setLine, setAnalyzingMove: noop, analyzingMove: false,
    });
    state = { line, setLine, analyzeMove: analysis.analyzeMove };
    return null;
  }
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(Harness)); });
  await act(async () => { await state.analyzeMove(new Chess().fen(), { from: "d2", to: "d4" }, false, [["cp", "0"]], false); });
  assert.deepEqual(state.line.moves.map((move) => move.san), ["d4"]);
  assert.deepEqual(state.line.arrows, { 0: [] });

  act(() => state.setLine({ moveNumber: 0, moves: [first, second], arrows: { 0: [arrow], 1: [arrow] } }));
  await act(async () => { await state.analyzeMove(first.fen, { from: "c7", to: "c5" }, false, [["cp", "0"]], false); });
  assert.deepEqual(state.line.moves.map((move) => move.san), ["e4", "c5"]);
  assert.deepEqual(state.line.arrows, { 0: [arrow], 1: [] });
  act(() => renderer.unmount());
});

test("a pending evaluation updates its own move even when navigation changes", async (t) => {
  const { first } = positions();
  const pendingSearches = [];
  const mesin = { cari: () => new Promise((resolve, reject) => pendingSearches.push({ resolve, reject })) };
  const savedError = console.error;
  console.error = noop;
  t.after(() => { console.error = savedError; });
  let state;
  function Harness() {
    const [line, setLine] = React.useState({ moveNumber: 0, moves: [first], arrows: { 0: [] } });
    const analysis = useAnalisisPapan({
      controllerRef: React.useRef(new AbortController()), muatSeqRef: React.useRef(0), openingsRef: React.useRef(() => undefined),
      data: { format: "fen" }, depth: 6, time: 0, move2: first,
      siapkan: async () => mesin, ambilMesin: () => mesin, t: (key) => key,
      setErrors: noop, setAnalyzeController: noop, setPageState: noop, setAnimation: noop, setForward: noop,
      setCustomLine: setLine, setAnalyzingMove: noop, analyzingMove: false,
    });
    state = { line, setLine, analyzeMove: analysis.analyzeMove };
    return null;
  }
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(Harness)); });
  // Do not await the analysis promise until its artificial engine search is
  // resolved. The user can navigate while that search is still pending.
  let analysis;
  await act(async () => {
    analysis = state.analyzeMove(first.fen, { from: "e7", to: "e5" }, false, [["cp", "0"]], false);
    await Promise.resolve();
  });
  assert.equal(pendingSearches.length, 1);
  act(() => state.setLine((prev) => ({ ...prev, moveNumber: 0 })));
  await act(async () => { pendingSearches.shift().resolve({ staticEval: ["cp", "0"], daftarKandidat: [] }); await analysis; });
  assert.equal(state.line.moveNumber, 0);
  assert.deepEqual(state.line.moves.map((move) => move.san), ["e4", "e5"]);
  assert.equal(state.line.moves[1].statusEvaluasi, "siap");

  act(() => state.setLine({ moveNumber: 0, moves: [first], arrows: { 0: [] } }));
  await act(async () => {
    analysis = state.analyzeMove(first.fen, { from: "e7", to: "e5" }, false, [["cp", "0"]], false);
    await Promise.resolve();
  });
  act(() => state.setLine((prev) => ({ ...prev, moveNumber: 0 })));
  await act(async () => { pendingSearches.shift().reject(new Error("worker failed")); await analysis; });
  assert.equal(state.line.moves[0].statusEvaluasi, undefined);
  assert.equal(state.line.moves[1].statusEvaluasi, "gagal");

  act(() => state.setLine({ moveNumber: 0, moves: [first], arrows: { 0: [] } }));
  await act(async () => {
    analysis = state.analyzeMove(first.fen, { from: "e7", to: "e5" }, false, [["cp", "0"]], false);
    await Promise.resolve();
  });
  // Exiting a PGN variation removes its placeholder; a late result must not
  // recreate it or alter the new line.
  act(() => state.setLine({ moveNumber: -1, moves: [], arrows: {} }));
  await act(async () => { pendingSearches.shift().resolve({ staticEval: ["cp", "0"], daftarKandidat: [] }); await analysis; });
  assert.deepEqual(state.line, { moveNumber: -1, moves: [], arrows: {} });
  act(() => renderer.unmount());
});
