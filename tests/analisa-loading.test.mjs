import assert from "node:assert/strict";
import React, { useState } from "react";
import TestRenderer from "react-test-renderer";
import test from "node:test";
import { useMuatPartai } from "../src/halaman/Analisa/komponen/game/useMuatPartai.js";

const { act } = TestRenderer;
const noop = () => {};
const flush = () => new Promise((resolve) => setImmediate(resolve));
const translateId = (key) => `id:${key}`;
const translateEn = (key) => `en:${key}`;

function Harness({ data, depth, boardSounds, t, siapkan, snapshot }) {
  const [controller, setController] = useState(() => new AbortController());
  const [pageState, setPageState] = useState("default");
  const [players, setPlayers] = useState([]);
  const [game, setGame] = useState([]);
  const [errors, setErrors] = useState([]);
  useMuatPartai({
    data, depth, boardSounds, t, siapkan, analyzeController: controller,
    setAnalyzeController: setController, setPageState, setPlayers, setGame, setErrors,
    setTab: noop, setProgress: noop, setLangkahSementara: noop, setTime: noop,
    setResult: noop, setAnimation: noop, setArrows: noop, setCustomLine: noop,
    setAnalyzingMove: noop, setMoveNumber: noop, setWhite: noop, setPlaying: noop,
  });
  snapshot.current = { controller, pageState, players, game, errors };
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
