import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { DAFTAR_ENGINE, EngineCatur, cariEngine } from "../src/lib/engineCatur.js";
import { EngineAnalisis } from "../src/halaman/Analisa/mesin/engine.js";

function installWorker(t) {
  const previous = globalThis.Worker;
  const instances = [];
  class MockWorker {
    constructor(url) {
      this.url = url;
      this.commands = [];
      this.terminated = false;
      instances.push(this);
    }
    postMessage(command) { this.commands.push(command); }
    terminate() { this.terminated = true; }
    emit(line) { this.onmessage?.({ data: line }); }
    fail(message) { this.onerror?.({ message }); }
  }
  globalThis.Worker = MockWorker;
  t.after(() => {
    if (previous === undefined) delete globalThis.Worker;
    else globalThis.Worker = previous;
  });
  return instances;
}

test("only the verified Stockfish 18 Lite single-thread binary is shipped", () => {
  assert.deepEqual(DAFTAR_ENGINE.map(({ id }) => id), ["stockfish-18-lite"]);
  assert.equal(cariEngine("unknown").id, "stockfish-18-lite");
  const binaries = readdirSync("public/engine").filter((name) => /\.(js|wasm)$/.test(name)).sort();
  assert.deepEqual(binaries, ["stockfish-18-lite-single.js", "stockfish-18-lite-single.wasm"]);
  const expected = {
    "public/engine/stockfish-18-lite-single.js": "2278005057f381491f1c9bb3e44c9f5920b3a00bef9759e33cc6582769a1f1fe",
    "public/engine/stockfish-18-lite-single.wasm": "a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1",
    "public/engine/source/nn-9067e33176e8.nnue": "9067e33176e8c5edb7aa8db6a3aedd012f84a1f39872e86357c6c2d0993f314d",
    "public/engine/source/stockfish.js-082eeba46b0c5f8f8065e5386750aa0ecfa2062c.tar.gz": "8e047428efde3b856dddd163dd8bd1a019b97956792d284d1cca8ef8417b5635",
  };
  for (const [path, hash] of Object.entries(expected)) {
    assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), hash, path);
  }
});

test("worker starts lazily, parses UCI score and MultiPV, and cleans up", async (t) => {
  const workers = installWorker(t);
  const engine = new EngineCatur({ hash: 32 });
  assert.equal(workers.length, 0);
  const ready = engine.mulai();
  assert.equal(engine.mulai(), ready);
  const worker = workers[0];
  const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "");
  assert.equal(worker.url, `${base}/engine/stockfish-18-lite-single.js`);
  assert.ok(worker.commands.includes("setoption name Threads value 1"));
  assert.ok(worker.commands.includes("setoption name Hash value 32"));
  worker.emit("readyok");
  await ready;

  const search = engine.cari({ fen: "test-position", kedalaman: 8, multiPv: 2 });
  assert.ok(worker.commands.includes("setoption name MultiPV value 2"));
  assert.ok(worker.commands.includes("position fen test-position"));
  assert.ok(worker.commands.includes("go depth 8"));
  worker.emit("info depth 8 multipv 1 score cp -31 wdl 12 45 943 pv e2e4 e7e5");
  worker.emit("info depth 8 multipv 2 score mate -3 wdl 0 0 1000 pv d2d4 d7d5");
  worker.emit("bestmove e2e4 ponder e7e5");
  const result = await search;
  assert.equal(result.uci, "e2e4");
  assert.deepEqual(result.info, { kedalaman: 8, cp: -31, mate: null, pv: ["e2e4", "e7e5"], adaBatas: false });
  assert.deepEqual(result.daftarPv.map(({ peringkat, cp, mate, wdl }) => ({ peringkat, cp, mate, wdl })), [
    { peringkat: 1, cp: -31, mate: null, wdl: [12, 45, 943] },
    { peringkat: 2, cp: null, mate: -3, wdl: [0, 0, 1000] },
  ]);
  assert.ok(worker.commands.includes("setoption name MultiPV value 1"));
  engine.tamat();
  assert.equal(worker.terminated, true);
});

test("analysis adapter preserves centipawn and mate scores", async (t) => {
  const workers = installWorker(t);
  const engine = new EngineAnalisis({ hash: 16, threads: 1 });
  const ready = engine.siapkan();
  const worker = workers[0];
  worker.emit("readyok");
  await ready;
  const pending = engine.cari("position", { kedalaman: 6 });
  // EngineAnalisis awaits its existing ready promise before starting a search.
  await new Promise((resolve) => setImmediate(resolve));
  worker.emit("info depth 6 score cp 75 pv e2e4 e7e5");
  worker.emit("bestmove e2e4");
  const result = await pending;
  assert.deepEqual(result.staticEval, ["cp", "75"]);
  assert.equal(result.kedalamanTercapai, 6);
  assert.deepEqual(result.bestMove, [{ col: 4, row: 1 }, { col: 4, row: 3 }]);
  engine.hancurkan();
});

test("aborting an active search sends stop and a later search still completes", async (t) => {
  const workers = installWorker(t);
  const engine = new EngineAnalisis();
  const ready = engine.siapkan();
  const worker = workers[0];
  worker.emit("readyok");
  await ready;

  const controller = new AbortController();
  const first = engine.cari("old-position", { kedalaman: 8, sinyal: controller.signal });
  const canceled = assert.rejects(first, /canceled/);
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(worker.commands.includes("go depth 8"));
  controller.abort();
  assert.ok(worker.commands.includes("stop"));

  // The replacement waits for the old bestmove rather than changing the
  // position while Stockfish is still searching.
  const next = engine.cari("new-position", { kedalaman: 6 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(!worker.commands.includes("position fen new-position"));
  worker.emit("bestmove e2e4");
  await canceled;
  assert.ok(worker.commands.includes("position fen new-position"));
  worker.emit("info depth 6 score cp 12 pv d2d4");
  worker.emit("bestmove d2d4");
  assert.deepEqual((await next).staticEval, ["cp", "12"]);
  engine.hancurkan();
});

test("analysis adapter can restart after the worker dies during a search", async (t) => {
  const workers = installWorker(t);
  const failures = [];
  const engine = new EngineAnalisis({ onError: (error) => failures.push(error.message) });
  const ready = engine.siapkan();
  workers[0].emit("readyok");
  await ready;
  const search = engine.cari("first-position", { kedalaman: 6 });
  const failed = assert.rejects(search, /search crashed/);
  await new Promise((resolve) => setImmediate(resolve));
  workers[0].fail("search crashed");
  await failed;
  assert.deepEqual(failures, ["search crashed"]);
  assert.equal(workers[0].terminated, true);

  const retry = engine.siapkan();
  assert.equal(workers.length, 2);
  workers[1].emit("readyok");
  await retry;
  const next = engine.cari("next-position", { kedalaman: 6 });
  await new Promise((resolve) => setImmediate(resolve));
  workers[1].emit("info depth 6 score cp 12 pv e2e4");
  workers[1].emit("bestmove e2e4");
  assert.deepEqual((await next).staticEval, ["cp", "12"]);
  engine.hancurkan();
});

test("superseded, terminated and failed workers settle their pending promises", async (t) => {
  const workers = installWorker(t);
  const engine = new EngineCatur();
  const ready = engine.mulai();
  workers[0].emit("readyok");
  await ready;

  const first = engine.cari({ fen: "first", kedalaman: 6 });
  const replaced = engine.cari({ fen: "second", kedalaman: 6 });
  const replacedCheck = assert.rejects(replaced, /digantikan/);
  const latest = engine.cari({ fen: "third", kedalaman: 6 });
  await replacedCheck;
  assert.ok(workers[0].commands.includes("stop"));
  workers[0].emit("bestmove e2e4");
  assert.equal((await first).uci, "e2e4");
  assert.ok(workers[0].commands.includes("position fen third"));
  const latestCheck = assert.rejects(latest, /dihentikan/);
  engine.tamat();
  await latestCheck;
  assert.equal(workers[0].terminated, true);

  const retry = engine.mulai();
  const failure = assert.rejects(retry, /broken wasm/);
  workers[1].fail("broken wasm");
  await failure;
  const newReady = engine.mulai();
  workers[2].emit("readyok");
  await newReady;
  engine.tamat();

  const startup = engine.mulai();
  const stopped = assert.rejects(startup, /dihentikan/);
  engine.tamat();
  await stopped;
});
