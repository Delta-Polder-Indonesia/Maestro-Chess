import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import * as daftarEngine from "../src/lib/engineCatur.js";
import { EngineAnalisis } from "../src/halaman/Analisa/mesin/engine.js";
import { KonteksMesin } from "../src/halaman/Analisa/konteks/mesinKonteks.js";
import * as penyimpanan from "../src/halaman/Analisa/penyimpanan.js";
import { storageMemori } from "./bantuStorage.mjs";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;
const compiled = ts.transpileModule(readFileSync(new URL("../src/halaman/Analisa/konteks/mesin.jsx", import.meta.url), "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const dependencies = {
  "../../../modul/analisis/mesin.js": { ...daftarEngine, hashUntukEngine: () => 32, wasmSupported: () => true },
  "../mesin/engine.js": { EngineAnalisis },
  "../mesin/rentangElo.js": { RENTANG_ELO: { min: 1320, max: 3190, bawaan: 2000 } },
  "../../../modul/sesi/preferensi.js": penyimpanan,
  "../../../modul/sesi/mesin.js": { KonteksMesin },
};
const result = { exports: {} };
runInThisContext(`(function (require, module, exports) {\n${compiled}\n})`)((id) => {
  if (id in dependencies) return dependencies[id];
  if (id === "react" || id === "react/jsx-runtime") return require(id);
  throw new Error(`Unexpected dependency: ${id}`);
}, result, result.exports);
const { MesinProvider } = result.exports;

function setup(t, saved) {
  const previous = { Worker: globalThis.Worker, window: globalThis.window, localStorage: globalThis.localStorage };
  const storage = storageMemori(saved === undefined ? [] : [["maestro-analisa-engine", saved]]);
  const workers = [];
  globalThis.localStorage = storage;
  globalThis.window = {};
  globalThis.Worker = class {
    constructor(url) { this.url = url; this.commands = []; this.terminated = false; workers.push(this); }
    postMessage(value) { this.commands.push(value); }
    terminate() { this.terminated = true; }
    emit(value) { this.onmessage?.({ data: value }); }
    fail(message) { this.onerror?.({ message }); }
  };
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  });
  return { storage, workers };
}

function mount(onMount) {
  let context;
  let pending;
  function Child() {
    context = React.useContext(KonteksMesin);
    React.useEffect(() => { if (onMount) pending = onMount(context); }, []);
    return null;
  }
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(MesinProvider, null, React.createElement(Child))); });
  return { renderer, get context() { return context; }, get pending() { return pending; } };
}

test("a saved choice is restored before child startup effects and is actually used by the worker", async (t) => {
  const { workers } = setup(t, "stockfish-16");
  const app = mount((context) => context.siapkan());
  assert.equal(app.context.idEngine, "stockfish-16");
  assert.equal(workers.length, 1);
  assert.match(workers[0].url, /stockfish-nnue-16-single\.js$/);
  assert.ok(workers[0].commands.includes("setoption name Use NNUE value true"));
  await act(async () => { workers[0].emit("readyok"); assert.equal((await app.pending).idEngine, "stockfish-16"); });
  assert.equal(app.context.status, "siap");
  act(() => app.renderer.unmount());
  assert.equal(workers[0].terminated, true);
});

test("switching replaces and persists the engine, reload restores it, and invalid IDs fall back safely", async (t) => {
  const { workers, storage } = setup(t);
  const app = mount();
  act(() => app.context.gantiEngine("stockfish-16"));
  let first;
  act(() => { first = app.context.siapkan(); });
  const oldStartup = assert.rejects(first, /dihentikan/);
  assert.match(workers[0].url, /stockfish-nnue-16-single\.js$/);
  act(() => app.context.gantiEngine("stockfish-17-lite"));
  await oldStartup;
  assert.equal(workers[0].terminated, true);
  assert.equal(app.context.idEngine, "stockfish-17-lite");
  assert.equal(app.context.status, "mati");
  assert.equal(storage.getItem("maestro-analisa-engine"), "stockfish-17-lite");
  let ready;
  act(() => { ready = app.context.siapkan(); });
  assert.match(workers[1].url, /stockfish-17-lite-single\.js$/);
  assert.ok(!workers[1].commands.includes("setoption name Use NNUE value true"));
  await act(async () => { workers[1].emit("readyok"); assert.equal((await ready).idEngine, "stockfish-17-lite"); });
  act(() => app.renderer.unmount());
  const reloaded = mount((context) => context.siapkan());
  assert.equal(reloaded.context.idEngine, "stockfish-17-lite");
  assert.match(workers[2].url, /stockfish-17-lite-single\.js$/);
  await act(async () => { workers[2].emit("readyok"); await reloaded.pending; });
  act(() => reloaded.context.gantiEngine("https://example.test/untrusted.js"));
  assert.equal(reloaded.context.idEngine, daftarEngine.ENGINE_BAKU);
  assert.equal(storage.getItem("maestro-analisa-engine"), daftarEngine.ENGINE_BAKU);
  act(() => reloaded.renderer.unmount());
  storage.setItem("maestro-analisa-engine", "invalid");
  const invalid = mount((context) => context.siapkan());
  assert.equal(invalid.context.idEngine, daftarEngine.ENGINE_BAKU);
  assert.match(workers[3].url, /stockfish-18-lite-single\.js$/);
  await act(async () => { workers[3].emit("readyok"); await invalid.pending; });
  act(() => invalid.renderer.unmount());
});

test("every selectable engine survives reload and starts its own worker", async (t) => {
  const { workers, storage } = setup(t);
  for (const pilihan of daftarEngine.DAFTAR_ENGINE) {
    const app = mount();
    act(() => app.context.gantiEngine(pilihan.id));
    assert.equal(app.context.idEngine, pilihan.id);
    assert.equal(storage.getItem("maestro-analisa-engine"), pilihan.id);
    let ready;
    act(() => { ready = app.context.siapkan(); });
    const worker = workers.at(-1);
    assert.equal(worker.url, pilihan.url);
    assert.equal(worker.commands.includes("setoption name Use NNUE value true"), pilihan.id === "stockfish-16");
    await act(async () => { worker.emit("readyok"); await ready; });
    act(() => app.renderer.unmount());
    assert.equal(worker.terminated, true);

    const reload = mount((context) => context.siapkan());
    const restoredWorker = workers.at(-1);
    assert.equal(reload.context.idEngine, pilihan.id);
    assert.equal(restoredWorker.url, pilihan.url);
    await act(async () => { restoredWorker.emit("readyok"); await reload.pending; });
    act(() => reload.renderer.unmount());
  }
});

test("a selection or startup resolution racing hydration never returns a destroyed engine", async (t) => {
  const { storage, workers } = setup(t, "stockfish-16");
  const choice = mount((context) => context.gantiEngine("stockfish-19-lite"));
  assert.equal(choice.context.idEngine, "stockfish-19-lite");
  assert.equal(storage.getItem("maestro-analisa-engine"), "stockfish-19-lite");
  act(() => choice.renderer.unmount());

  const app = mount();
  let old;
  act(() => { old = app.context.siapkan(); });
  const rejected = assert.rejects(old, /engine diganti/);
  act(() => {
    workers[0].emit("readyok");
    app.context.gantiEngine("stockfish-16.1-lite");
  });
  await rejected;
  assert.equal(workers[0].terminated, true);
  assert.equal(app.context.status, "mati");
  let next;
  act(() => { next = app.context.siapkan(); });
  assert.match(workers[1].url, /stockfish-16\.1-lite-single\.js$/);
  await act(async () => { workers[1].emit("readyok"); await next; });
  assert.equal(app.context.status, "siap");
  act(() => app.renderer.unmount());
});

test("missing NNUE is reported and a retry can start a fresh worker", async (t) => {
  const { workers } = setup(t, "stockfish-16");
  const previousError = console.error;
  console.error = () => {};
  t.after(() => { console.error = previousError; });
  const app = mount();
  let startup;
  act(() => { startup = app.context.siapkan(); });
  const failed = assert.rejects(startup, /failed to download eval file/i);
  await act(async () => { workers[0].emit("info string ERROR: failed to download eval file"); await failed; });
  assert.equal(app.context.status, "gagal");
  assert.equal(workers[0].terminated, true);
  let retry;
  act(() => { retry = app.context.siapkan(); });
  await act(async () => { workers[1].emit("readyok"); await retry; });
  assert.equal(app.context.status, "siap");
  act(() => app.renderer.unmount());
});
