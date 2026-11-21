import assert from "node:assert/strict";
import React, { useRef, useState } from "react";
import { Chess } from "chess.js";
import TestRenderer from "react-test-renderer";
import test from "node:test";
import { useMuatPartai } from "../src/halaman/Analisa/komponen/game/useMuatPartai.js";
import { gameStartSound } from "../src/halaman/Analisa/komponen/game/gameStartSound.js";

const { act } = TestRenderer;
const noop = () => {};
const flush = () => new Promise((resolve) => setImmediate(resolve));
const translateId = (key) => `id:${key}`;
const translateEn = (key) => `en:${key}`;

function Harness({ data, depth, boardSounds, t, siapkan, snapshot, pekerjaanLaporan }) {
  const [controller, setController] = useState(() => new AbortController());
  const [pageState, setPageState] = useState("default");
  const [players, setPlayers] = useState([]);
  const [game, setGame] = useState([]);
  const [errors, setErrors] = useState([]);
  const [moveNumber, setMoveNumber] = useState(0);
  const [white, setWhite] = useState(true);
  const [tab, setTab] = useState("summary");
  const [customLine, setCustomLine] = useState({ moveNumber: -1, moves: [], arrows: {} });
  const [arrows, setArrows] = useState({ 0: [] });
  const [time, setTime] = useState(0);
  const [result, setResult] = useState("");
  const boardSoundsRef = useRef(boardSounds);
  boardSoundsRef.current = boardSounds;
  useMuatPartai({
    data, depth, boardSoundsRef, t, siapkan, pekerjaanLaporan, analyzeController: controller,
    setAnalyzeController: setController, setPageState, setPlayers, setGame, setErrors,
    setTab, setProgress: noop, setLangkahSementara: noop, setTime,
    setResult, setAnimation: noop, setArrows, setCustomLine,
    setAnalyzingMove: noop, setMoveNumber, setWhite, setPlaying: noop,
  });
  snapshot.current = { controller, pageState, players, game, errors, moveNumber, white, tab, customLine, arrows, time, result };
  return null;
}

function fakeEngine() {
  const calls = [];
  return {
    calls,
    gameBaru: noop,
    setop: noop,
    async cari(fen, options) {
      calls.push({ fen, depth: options.kedalaman });
      return { staticEval: ["cp", "0"], bestMove: undefined, daftarKandidat: [] };
    },
  };
}

function mockBook(t) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ unused: "Opening" }) });
  t.after(() => { globalThis.fetch = original; });
}

const pgn = (white, black, moves) => ({
  format: "pgn",
  string: `[White "${white}"]\n[Black "${black}"]\n\n1. ${moves} *`,
});

test("language and sound changes do not restart analysis, while depth and new games do", async (t) => {
  mockBook(t);
  const engine = fakeEngine();
  const siapkan = async () => engine;
  const snapshot = {};
  const first = pgn("Alice", "Bob", "e4 e5");
  let props = { data: first, depth: 6, boardSounds: false, t: translateId, siapkan, snapshot };
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness, props)); await flush(); });
  t.after(() => renderer.unmount());
  assert.equal(snapshot.current.pageState, "analyze");
  assert.equal(engine.calls.length, 3);
  assert.deepEqual(snapshot.current.players.map((p) => p.name), ["Alice", "Bob"]);

  props = { ...props, t: translateEn, boardSounds: true, siapkan: async () => engine };
  await act(async () => { renderer.update(React.createElement(Harness, props)); await flush(); });
  assert.equal(snapshot.current.pageState, "analyze");
  assert.equal(engine.calls.length, 3);

  props = { ...props, depth: 7 };
  await act(async () => { renderer.update(React.createElement(Harness, props)); await flush(); });
  assert.equal(engine.calls.length, 6);
  assert.deepEqual(engine.calls.slice(3).map((call) => call.depth), [7, 7, 7]);

  props = { ...props, data: pgn("Carol", "Dan", "d4 d5") };
  await act(async () => { renderer.update(React.createElement(Harness, props)); await flush(); });
  assert.equal(engine.calls.length, 9);
  assert.deepEqual(snapshot.current.players.map((p) => p.name), ["Carol", "Dan"]);
});

test("the latest sound setting is respected while an analysis is loading", async (t) => {
  mockBook(t);
  // A previous completed analysis may still have its 100 ms sound timer.
  await new Promise((resolve) => setTimeout(resolve, 150));
  const engine = fakeEngine();
  const suaraAsli = gameStartSound.play;
  let bunyi = 0;
  gameStartSound.play = () => { bunyi++; };
  t.after(() => { gameStartSound.play = suaraAsli; });
  let release;
  const siapkan = () => new Promise((resolve) => { release = () => resolve(engine); });
  const snapshot = {};
  let props = { data: pgn("Alice", "Bob", "e4 e5"), depth: 6, boardSounds: true, t: translateId, siapkan, snapshot };
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness, props)); await flush(); });
  assert.equal(snapshot.current.pageState, "loading");
  props = { ...props, boardSounds: false };
  await act(async () => { renderer.update(React.createElement(Harness, props)); release(); await flush(); });
  assert.equal(snapshot.current.pageState, "analyze");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 120)); });
  assert.equal(bunyi, 0);

  props = { ...props, boardSounds: true, data: pgn("Carol", "Dan", "d4 d5"), siapkan: async () => engine };
  await act(async () => { renderer.update(React.createElement(Harness, props)); await flush(); });
  assert.equal(snapshot.current.pageState, "analyze");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 120)); });
  assert.equal(bunyi, 1);
  await act(async () => { renderer.unmount(); });
});

test("canceling while the engine loads prevents a late analysis", async (t) => {
  mockBook(t);
  const engine = fakeEngine();
  let release;
  const siapkan = () => new Promise((resolve) => { release = () => resolve(engine); });
  const snapshot = {};
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Harness, {
      data: pgn("Old", "Game", "e4 e5"), depth: 6, boardSounds: false,
      t: translateId, siapkan, snapshot,
    }));
    await flush();
  });
  t.after(() => renderer.unmount());
  assert.equal(snapshot.current.pageState, "loading");
  await act(async () => { snapshot.current.controller.abort(); await flush(); });
  assert.equal(snapshot.current.pageState, "default");
  await act(async () => { release(); await flush(); });
  assert.equal(engine.calls.length, 0);
  assert.equal(snapshot.current.pageState, "default");
  assert.deepEqual(snapshot.current.players, []);
});

test("a superseded load cannot overwrite a newer game", async (t) => {
  mockBook(t);
  const engine = fakeEngine();
  let releaseOld;
  let requests = 0;
  const siapkan = () => {
    requests++;
    return requests === 1 ? new Promise((resolve) => { releaseOld = () => resolve(engine); }) : Promise.resolve(engine);
  };
  const snapshot = {};
  let props = { data: pgn("Old", "Game", "e4 e5"), depth: 6, boardSounds: false, t: translateId, siapkan, snapshot };
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness, props)); await flush(); });
  t.after(() => renderer.unmount());
  props = { ...props, data: pgn("New", "Game", "d4 d5") };
  await act(async () => { renderer.update(React.createElement(Harness, props)); await flush(); });
  assert.equal(engine.calls.length, 3);
  assert.equal(snapshot.current.players[0].name, "New");
  await act(async () => { releaseOld(); await flush(); });
  assert.equal(engine.calls.length, 3);
  assert.equal(snapshot.current.players[0].name, "New");
  assert.equal(snapshot.current.pageState, "analyze");
});

test("a completed report restores source, position and variation without engine searches; a later depth change reanalyzes", async (t) => {
  mockBook(t);
  const engine = fakeEngine();
  let setups = 0;
  const siapkan = async () => { setups++; return engine; };
  const chess = new Chess();
  const moves = [{ fen: chess.fen(), color: "w", previousStaticEvals: [["cp", "0"]] }];
  for (const san of ["e4", "e5"]) {
    chess.move(san);
    moves.push({ fen: chess.fen(), color: chess.turn(), san, previousStaticEvals: [["cp", "0"]] });
  }
  chess.move("Nf3");
  const custom = { moveNumber: 0, moves: [{ fen: chess.fen(), san: "Nf3", previousStaticEvals: [["cp", "0"]] }], arrows: { 0: [] } };
  const saved = {
    id: "saved", jenis: "laporan", status: "selesai",
    snapshot: {
      versi: 1, game: moves, players: [{ name: "Alice", elo: "1500" }, { name: "Bob", elo: "1600" }],
      time: 120, result: "1-0", moveNumber: 2, white: false, tab: "moves", customLine: custom,
      arrows: { 0: [], 1: [], 2: [] }, pageState: "analyze", kedalaman: 6,
    },
  };
  const actions = [];
  const work = {
    pulih: (_data, record) => actions.push(`restore:${record.id}`),
    punyaSnapshot: (id) => id === "saved",
    mulai: () => actions.push("start"), metadata: noop, selesai: () => actions.push("complete"), gagal: noop,
  };
  const source = pgn("Alice", "Bob", "e4 e5");
  const data = { ...source, pekerjaanId: "saved", pemulihan: saved };
  const snapshot = {};
  let props = { data, depth: 6, boardSounds: false, t: translateId, siapkan, snapshot, pekerjaanLaporan: work };
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness, props)); await flush(); });
  t.after(() => renderer.unmount());
  assert.equal(setups, 0);
  assert.deepEqual(actions, ["restore:saved"]);
  assert.equal(snapshot.current.pageState, "analyze");
  assert.equal(snapshot.current.players[0].name, "Alice");
  assert.equal(snapshot.current.moveNumber, 2);
  assert.equal(snapshot.current.white, false);
  assert.equal(snapshot.current.customLine.moves[0].san, "Nf3");
  assert.equal(snapshot.current.time, 120);
  assert.equal(data.string, source.string);

  props = { ...props, depth: 7 };
  await act(async () => { renderer.update(React.createElement(Harness, props)); await flush(); });
  assert.equal(setups, 1);
  assert.equal(engine.calls.length, 3);
  assert.deepEqual(actions, ["restore:saved", "start", "complete"]);
  assert.equal(snapshot.current.moveNumber, 2);
  assert.equal(snapshot.current.customLine.moves[0].san, "Nf3");
});

test("restored unevaluated variation remains visible and produces an interruption warning", async (t) => {
  mockBook(t);
  const chess = new Chess();
  const awal = chess.fen();
  chess.move("e4");
  const sesudah = chess.fen();
  const data = {
    ...pgn("Alice", "Bob", "e4 e5"), pekerjaanId: "saved",
    pemulihan: {
      id: "saved", status: "selesai", snapshot: {
        versi: 1, game: [{ fen: awal, color: "w" }, { fen: sesudah, color: "b", san: "e4" }],
        players: [{ name: "Alice" }, { name: "Bob" }], moveNumber: 0, white: true, tab: "moves", pageState: "analyze",
        customLine: { moveNumber: 0, moves: [{ fen: sesudah, san: "e4", statusEvaluasi: "dibatalkan" }], arrows: { 0: [] } },
        arrows: { 0: [], 1: [] },
      },
    },
  };
  let setups = 0;
  const snapshot = {};
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Harness, {
      data, depth: 6, boardSounds: false, t: translateId, siapkan: async () => { setups++; return fakeEngine(); }, snapshot,
    }));
    await flush();
  });
  t.after(() => renderer.unmount());
  assert.equal(setups, 0);
  assert.equal(snapshot.current.customLine.moves[0].statusEvaluasi, "dibatalkan");
  assert.ok(snapshot.current.errors.some((e) => e.title === "id:analisa.pekerjaan.variasiJudul" && e.type === "warning"));
});
