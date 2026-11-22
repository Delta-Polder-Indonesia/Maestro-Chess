import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { Chess } from "chess.js";
import { DAFTAR_ENGINE, EngineCatur, cariEngine } from "../src/lib/engineCatur.js";
import { EngineAnalisis, parseMove, parsePosition } from "../src/halaman/Analisa/mesin/engine.js";

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

test("analysis errors retain the original worker failure as their cause", async () => {
  const gagal = new Error("worker crashed");
  const mesin = { async cari() { throw gagal; } };
  const periksa = (error) => error.kunci === "mesin" && error.cause === gagal;
  await assert.rejects(parsePosition(mesin, new Chess(), 6), periksa);
  const chess = new Chess();
  const langkah = chess.move("e4");
  await assert.rejects(parseMove(mesin, 6, langkah, chess, [["cp", "0"]]), periksa);
});

function hashBerkas(path) {
  const isi = readFileSync(path);
  // Saat checkout di Windows, git mengubah LF menjadi CRLF pada berkas teks.
  // Normalisasi supaya hash tetap sama dengan blob yang tersimpan di repo.
  const isiNormal = path.endsWith(".js")
    ? Buffer.from(isi.toString("latin1").replace(/\r\n/g, "\n"), "latin1")
    : isi;
  return createHash("sha256").update(isiNormal).digest("hex");
}

test("verified single-thread Stockfish 16–19 binaries are shipped", () => {
  assert.deepEqual(DAFTAR_ENGINE.map(({ id }) => id), [
    "stockfish-16",
    "stockfish-16.1-lite",
    "stockfish-17-lite",
    "stockfish-18-lite",
    "stockfish-18.0.8-lite",
    "stockfish-19-lite",
  ]);
  assert.equal(cariEngine("unknown").id, "stockfish-18-lite");
  const binaries = readdirSync("public/engine").filter((name) => /\.(js|wasm)$/.test(name)).sort();
  assert.deepEqual(binaries, [
    "stockfish-16.1-lite-single.js",
    "stockfish-16.1-lite-single.wasm",
    "stockfish-17-lite-single.js",
    "stockfish-17-lite-single.wasm",
    "stockfish-18-lite-single.js",
    "stockfish-18-lite-single.wasm",
    "stockfish-18.0.8-lite-single.js",
    "stockfish-18.0.8-lite-single.wasm",
    "stockfish-19-lite-single.js",
    "stockfish-19-lite-single.wasm",
    "stockfish-nnue-16-single.js",
    "stockfish-nnue-16-single.wasm",
  ]);
  const expected = {
    "public/engine/stockfish-nnue-16-single.js": "e2958bb89fc6ee0faedde87284bbb7e14da2ab224f06ca1bd82e62eaca87d00b",
    "public/engine/stockfish-nnue-16-single.wasm": "a7acf7f20cb81d755b39b3dd42a4bdfd6e8c8d3d203d9fbdc525e40e1f68df08",
    "public/engine/nn-5af11540bbfe.nnue": "5af11540bbfefcb54e38c5dd000cab4b469dfa7599a1d55be5d2722c20a8929b",
    "public/engine/source/stockfish.js-efc5758a1cf72ec7644fa771a1f17fcbfdae410e-no-networks.tar.gz": "9fddb8876aba9ca6a0e0c47ea40e29f8376c023b1c110a68cd54734eef0a3c0f",
    "public/engine/stockfish-16.1-lite-single.js": "8f43669b56239aaeb96c0fe0b9ac9cc033bcab2a1ce101ddeafdeae115df2b85",
    "public/engine/stockfish-16.1-lite-single.wasm": "1313432744224014a1a98604f34ee71b34187af9980e2336fc2d4f5c6747ebfb",
    "public/engine/stockfish-17-lite-single.js": "1c8265e52fdaef797684b4979b42c5dcfe0350df3e11a87e48e4ec5f86e0ca5c",
    "public/engine/stockfish-17-lite-single.wasm": "7ca31bedd166148931a1cc84dbd8dd9cf001744e9994caf23a3c6ff4988d7086",
    "public/engine/stockfish-18-lite-single.js": "2278005057f381491f1c9bb3e44c9f5920b3a00bef9759e33cc6582769a1f1fe",
    "public/engine/stockfish-18-lite-single.wasm": "a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1",
    "public/engine/stockfish-18.0.8-lite-single.js": "5243fd9b276cab7dfe3ad1d43ab9ead73568fac76468c614242977a210c4a391",
    "public/engine/stockfish-18.0.8-lite-single.wasm": "a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1",
    "public/engine/stockfish-19-lite-single.js": "ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a",
    "public/engine/stockfish-19-lite-single.wasm": "ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de",
    "public/engine/source/nn-9067e33176e8.nnue": "9067e33176e8c5edb7aa8db6a3aedd012f84a1f39872e86357c6c2d0993f314d",
    "public/engine/source/nn-61e7af4bb97d.nnue": "61e7af4bb97d51eeeb25d322916f86513b5cd3a827ce189c98c6e31946f99e5b",
    "public/engine/source/stockfish.js-082eeba46b0c5f8f8065e5386750aa0ecfa2062c.tar.gz": "8e047428efde3b856dddd163dd8bd1a019b97956792d284d1cca8ef8417b5635",
    "public/engine/source/stockfish.js-215df8c6a72847e306644d399733de18fb8e0d6c-source-only.tar.gz": "1206c5e69a34847ae2172f5d65f7a4009a4cf75b74b9233487a90f51da2a09b3",
    "public/engine/source/stockfish.js-602fd7e1a571a2be71f242942db90483731f2a1f-source-only.tar.gz": "fdba5cd0604a4e195cac76e5c054c3c8b08028e18167c63bfbb497762b04d042",
    "public/engine/source/stockfish.js-93c994592dcf3b4b21052ab925e9b534df9c0918.tar.gz": "ef9b6e9bd66de9869dc4715979ada23c6ab4fa96648025823a0a865f300667b2",
    "public/engine/source/stockfish.js-0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6.tar.gz": "e5289a920554bf0069a6601c228e81d957c00522bb31c4343588dc5d7d251879",
  };
  for (const [path, hash] of Object.entries(expected)) {
    assert.equal(hashBerkas(path), hash, path);
  }
});

test("documentation matches the selectable engines and Stockfish 16 NNUE", () => {
  const readme = readFileSync("README.md", "utf8");
  const analisa = readFileSync("src/halaman/Analisa/README.md", "utf8");
  for (const { label } of DAFTAR_ENGINE) assert.ok(readme.includes(label), `README should document ${label}`);
  assert.match(readme, /Stockfish 18 Lite[^.]*bawaan|bawaan[^.]*Stockfish 18 Lite/i);
  assert.match(analisa, /nn-5af11540bbfe\.nnue/);
  assert.match(readme, /WASM mesinnya identik/);
  const label1808 = DAFTAR_ENGINE.find(({ id }) => id === "stockfish-18.0.8-lite");
  assert.equal(label1808.label, "Stockfish 18 Lite (JS 18.0.8)");
  assert.equal(label1808.keterangan, "analisa.engine.paket1808");
  assert.equal(hashBerkas("public/engine/stockfish-18-lite-single.wasm"), hashBerkas("public/engine/stockfish-18.0.8-lite-single.wasm"));
  assert.notEqual(hashBerkas("public/engine/stockfish-18-lite-single.js"), hashBerkas("public/engine/stockfish-18.0.8-lite-single.js"));
  assert.doesNotMatch(`${readme}\n${analisa}`, /Satu-satunya (?:engine|build)/i);
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
