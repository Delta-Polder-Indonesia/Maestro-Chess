import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import * as pilihan from "../src/lib/engineCatur.js";
import * as kemampuan from "../src/halaman/Analisa/mesin/cekWasm.js";

const { DAFTAR_ENGINE, ENGINE_BAKU, EngineCatur, cariEngine } = pilihan;
const { hashUntukEngine, wasmSupported, wasmThreadsSupported } = kemampuan;

function gantiGlobal(t, values) {
  const descriptors = Object.fromEntries(Object.keys(values).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete globalThis[key];
    else Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  t.after(() => {
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
}

function pasangWorker(t) {
  const daftar = [];
  class WorkerTiruan {
    constructor(url) { this.url = url; this.perintah = []; this.terminasi = 0; daftar.push(this); }
    postMessage(perintah) { this.perintah.push(perintah); }
    terminate() { this.terminasi++; }
    kirim(baris) { this.onmessage?.({ data: baris }); }
    gagal(pesan) { this.onerror?.({ message: pesan }); }
  }
  gantiGlobal(t, { Worker: WorkerTiruan });
  return daftar;
}

async function mulaiSiap(mesin, workers) {
  const janji = mesin.mulai();
  const worker = workers.at(-1);
  worker.kirim("readyok");
  await janji;
  return worker;
}

test("old engine and capability modules expose exactly their named APIs, without a default", () => {
  assert.deepEqual(Object.keys(pilihan), ["DAFTAR_ENGINE", "ENGINE_BAKU", "EngineCatur", "cariEngine"]);
  assert.deepEqual(Object.keys(kemampuan), ["hashUntukEngine", "wasmSupported", "wasmThreadsSupported"]);
  assert.equal(Object.hasOwn(pilihan, "default"), false);
  assert.equal(Object.hasOwn(kemampuan, "default"), false);
  for (const nama of ["EngineCatur", "cariEngine"]) assert.equal(typeof pilihan[nama], "function", nama);
  for (const nama of Object.keys(kemampuan)) assert.equal(typeof kemampuan[nama], "function", nama);
});

test("six selectable engines retain their order, labels, metadata, URLs and default", () => {
  const basis = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "");
  const url = (file) => `${basis}/engine/${file}`;
  assert.equal(ENGINE_BAKU, "stockfish-18-lite");
  assert.deepEqual(DAFTAR_ENGINE, [
    { id: "stockfish-16", label: "Stockfish 16", url: url("stockfish-nnue-16-single.js"), elo: "3.500" },
    { id: "stockfish-16.1-lite", label: "Stockfish 16.1 Lite", url: url("stockfish-16.1-lite-single.js"), elo: "3.500" },
    { id: "stockfish-17-lite", label: "Stockfish 17.1 Lite", url: url("stockfish-17-lite-single.js"), elo: "3.515" },
    { id: "stockfish-18-lite", label: "Stockfish 18 Lite", url: url("stockfish-18-lite-single.js"), elo: "3.530", saran: true },
    { id: "stockfish-18.0.8-lite", label: "Stockfish 18 Lite (JS 18.0.8)", url: url("stockfish-18.0.8-lite-single.js"), elo: "3.530", keterangan: "analisa.engine.paket1808" },
    { id: "stockfish-19-lite", label: "Stockfish 19 Lite", url: url("stockfish-19-lite-single.js"), elo: "3.550" },
  ]);
});

test("lookup returns the original object and falls back without normalizing the ID", () => {
  for (const item of DAFTAR_ENGINE) assert.strictEqual(cariEngine(item.id), item);
  const bawaan = DAFTAR_ENGINE.find(({ id }) => id === ENGINE_BAKU);
  for (const id of [undefined, null, "", "STOCKFISH-16", " stockfish-16 ", 16, {}, "https://example.test/engine.js"]) {
    assert.strictEqual(cariEngine(id), bawaan);
  }
});

test("the exported list is mutable, lookup selects the first duplicate, and a removed default yields undefined", () => {
  assert.equal(Object.isFrozen(DAFTAR_ENGINE), false);
  const sebelum = DAFTAR_ENGINE.slice();
  try {
    const duplikat = { id: "stockfish-16", label: "duplicate" };
    DAFTAR_ENGINE.unshift(duplikat);
    assert.strictEqual(cariEngine("stockfish-16"), duplikat);
    DAFTAR_ENGINE.splice(0, DAFTAR_ENGINE.length, ...sebelum.filter(({ id }) => id !== ENGINE_BAKU));
    assert.equal(cariEngine("unknown"), undefined);
  } finally {
    DAFTAR_ENGINE.splice(0, DAFTAR_ENGINE.length, ...sebelum);
  }
});

test("engine URLs are derived at module initialization for both root and subpath", () => {
  const url = pathToFileURL(resolve("src/lib/engineCatur.js")).href;
  const script = `import { DAFTAR_ENGINE, EngineCatur } from ${JSON.stringify(url)}; console.log(JSON.stringify({ urls: DAFTAR_ENGINE.map(x => x.url), bawaan: new EngineCatur().url }));`;
  for (const [nilai, basis] of [["", ""], ["/Maestro-Chess///", "/Maestro-Chess"]]) {
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      env: { ...process.env, NEXT_PUBLIC_BASE_PATH: nilai }, encoding: "utf8",
    });
    assert.equal(child.status, 0, child.stderr);
    const hasil = JSON.parse(child.stdout);
    assert.equal(hasil.urls.length, 6);
    assert.ok(hasil.urls.every((item) => item.startsWith(`${basis}/engine/`)));
    assert.equal(hasil.urls[0], `${basis}/engine/stockfish-nnue-16-single.js`);
    assert.equal(hasil.bawaan, `${basis}/engine/stockfish-18-lite-single.js`);
  }
});

test("constructors are lazy and retain defaults and explicit options per instance", (t) => {
  const workers = pasangWorker(t);
  const satu = new EngineCatur();
  const dua = new EngineCatur({ url: "custom.js", hash: 77, threads: 3, skill: 4 });
  assert.equal(workers.length, 0);
  assert.equal(satu.url, cariEngine(ENGINE_BAKU).url);
  assert.deepEqual([satu.hash, satu.threads, satu.skill, satu.siap, satu.worker, satu.janjiSiap], [16, 1, null, false, null, null]);
  assert.deepEqual([dua.url, dua.hash, dua.threads, dua.skill, dua.siap, dua.worker], ["custom.js", 77, 3, 4, false, null]);
  assert.notStrictEqual(satu, dua);
  satu.tamat();
  dua.tamat();
  assert.equal(workers.length, 0);
});

test("startup sends the original UCI initialization sequence including Stockfish 16 NNUE", async (t) => {
  const workers = pasangWorker(t);
  const mesin = new EngineCatur({ url: cariEngine("stockfish-16").url, hash: 64, threads: 1, skill: 7 });
  const siap = mesin.mulai();
  assert.strictEqual(mesin.mulai(), siap);
  assert.equal(workers.length, 1);
  const worker = workers[0];
  assert.equal(worker.url, cariEngine("stockfish-16").url);
  assert.deepEqual(worker.perintah, [
    "uci", "setoption name Hash value 64", "setoption name Threads value 1",
    "setoption name Skill Level value 7", "setoption name Ponder value false",
    "setoption name UCI_ShowWDL value true", "setoption name Use NNUE value true", "isready",
  ]);
  worker.kirim("uciok");
  assert.equal(mesin.siap, false);
  worker.kirim("readyok");
  await siap;
  assert.equal(mesin.siap, true);
  mesin.tamat();
  assert.equal(worker.terminasi, 1);
});

test("readyok alone resolves startup even when uciok has not been received", async (t) => {
  const workers = pasangWorker(t);
  const mesin = new EngineCatur();
  const siap = mesin.mulai();
  workers[0].kirim("readyok");
  await siap;
  assert.equal(mesin.siap, true);
  assert.equal(workers[0].perintah.includes("setoption name Use NNUE value true"), false);
  mesin.tamat();
});

test("worker construction errors reject startup, are not sent to onError, and permit a retry", async (t) => {
  let percobaan = 0;
  const error = new Error("worker constructor failed");
  const dilaporkan = [];
  class WorkerGagal { constructor() { percobaan++; throw error; } }
  gantiGlobal(t, { Worker: WorkerGagal });
  const mesin = new EngineCatur({ onError: (e) => dilaporkan.push(e) });
  await assert.rejects(mesin.mulai(), (e) => e === error);
  assert.equal(mesin.janjiSiap, null);
  assert.equal(mesin.worker, null);
  await assert.rejects(mesin.mulai(), (e) => e === error);
  assert.equal(percobaan, 2);
  assert.deepEqual(dilaporkan, []);
  mesin.tamat();
});

test("worker errors settle startup, terminate the worker, swallow callback errors and allow retry", async (t) => {
  const workers = pasangWorker(t);
  const diterima = [];
  const mesin = new EngineCatur({ onError: (error) => { diterima.push(error.message); throw new Error("callback failure"); } });
  const gagal = assert.rejects(mesin.mulai(), { message: "worker engine gagal" });
  workers[0].gagal("");
  await gagal;
  assert.deepEqual(diterima, ["worker engine gagal"]);
  assert.equal(workers[0].terminasi, 1);
  assert.equal(mesin.worker, null);
  assert.equal(mesin.janjiSiap, null);
  await mulaiSiap(mesin, workers);
  assert.equal(workers.length, 2);
  mesin.tamat();
});

test("UCI results keep ranked clean MultiPV lines while discarding bounds and empty lines", async (t) => {
  const workers = pasangWorker(t);
  const mesin = new EngineCatur();
  const worker = await mulaiSiap(mesin, workers);
  const panah = [];
  let selesai;
  mesin.analisis("posisi", { kedalaman: 9, movetime: 1200, multiPv: 3, padaInfo: (info) => panah.push(info), padaSelesai: (...args) => { selesai = args; } });
  worker.kirim("info depth 8 multipv 1 score cp 10 lowerbound pv e2e4");
  worker.kirim("info depth 9 multipv 3 score mate -2 wdl 1 2 997 pv d2d4 d7d5");
  worker.kirim("info depth 9 multipv 2 score cp 15 pv");
  worker.kirim("info depth 9 multipv 1 score cp 30 wdl 600 300 100 pv e2e4 e7e5");
  worker.kirim("bestmove e2e4 ponder e7e5");
  const info = { kedalaman: 9, cp: 30, mate: null, pv: ["e2e4", "e7e5"], adaBatas: false };
  assert.deepEqual(panah, [info]);
  assert.equal(selesai[0], "e2e4");
  assert.deepEqual(selesai[1], info);
  assert.equal(selesai[2], undefined);
  assert.deepEqual(selesai[3], [
    { peringkat: 1, cp: 30, mate: null, pv: ["e2e4", "e7e5"], wdl: [600, 300, 100], adaBatas: false },
    { peringkat: 3, cp: null, mate: -2, pv: ["d2d4", "d7d5"], wdl: [1, 2, 997], adaBatas: false },
  ]);
  assert.deepEqual(worker.perintah.slice(-4), ["setoption name MultiPV value 3", "position fen posisi", "go depth 9 movetime 1200", "setoption name MultiPV value 1"]);
  mesin.tamat();
});

test("node limit is sent as go nodes and combines with depth/time limits", async (t) => {
  const workers = pasangWorker(t);
  const mesin = new EngineCatur();
  const worker = await mulaiSiap(mesin, workers);
  mesin.analisis("posisi", { kedalaman: null, movetime: null, nodes: 250000, padaSelesai: () => {} });
  worker.kirim("bestmove e2e4");
  assert.deepEqual(worker.perintah.slice(-2), ["position fen posisi", "go nodes 250000"]);
  mesin.analisis("posisi2", { kedalaman: 9, movetime: 1200, nodes: 100000, padaSelesai: () => {} });
  worker.kirim("bestmove d2d4");
  assert.deepEqual(worker.perintah.slice(-2), ["position fen posisi2", "go depth 9 movetime 1200 nodes 100000"]);
  mesin.tamat();
});

test("searches serialize: only the latest pending request starts after the active bestmove", async (t) => {
  const workers = pasangWorker(t);
  const mesin = new EngineCatur();
  const worker = await mulaiSiap(mesin, workers);
  const awal = mesin.cari({ fen: "awal", kedalaman: 5 });
  const tengah = mesin.cari({ fen: "tengah", kedalaman: 6 });
  const ditolak = assert.rejects(tengah, { message: "permintaan digantikan" });
  const akhir = mesin.cari({ fen: "akhir", kedalaman: 7 });
  await ditolak;
  assert.equal(worker.perintah.filter((p) => p === "stop").length, 2);
  assert.equal(worker.perintah.includes("position fen tengah"), false);
  assert.equal(worker.perintah.includes("position fen akhir"), false);
  worker.kirim("bestmove e2e4");
  assert.deepEqual(await awal, { uci: "e2e4", info: null, daftarPv: null });
  assert.ok(worker.perintah.includes("position fen akhir"));
  worker.kirim("bestmove d2d4");
  assert.equal((await akhir).uci, "d2d4");
  mesin.tamat();
});

test("stop rejects a pending search but active search settles on the later bestmove", async (t) => {
  const workers = pasangWorker(t);
  const mesin = new EngineCatur();
  const worker = await mulaiSiap(mesin, workers);
  const aktif = mesin.cari({ fen: "aktif", kedalaman: 4 });
  const tertunda = mesin.cari({ fen: "tertunda", kedalaman: 4 });
  const ditolak = assert.rejects(tertunda, { message: "pencarian dibatalkan" });
  mesin.setop();
  await ditolak;
  assert.equal(worker.perintah.includes("position fen tertunda"), false);
  worker.kirim("bestmove e2e4");
  assert.equal((await aktif).uci, "e2e4");
  mesin.tamat();
});

test("gameBaru stops the active search then sends ucinewgame and isready", async (t) => {
  const workers = pasangWorker(t);
  const mesin = new EngineCatur();
  const worker = await mulaiSiap(mesin, workers);
  const aktif = mesin.cari({ fen: "x", kedalaman: 3 });
  mesin.gameBaru();
  assert.deepEqual(worker.perintah.slice(-3), ["stop", "ucinewgame", "isready"]);
  worker.kirim("bestmove e2e4");
  await aktif;
  mesin.tamat();
});

test("skill can be changed before or after startup and null sends the full-strength value", async (t) => {
  const workers = pasangWorker(t);
  const mesin = new EngineCatur();
  mesin.terapkanSkill(6);
  const worker = await mulaiSiap(mesin, workers);
  assert.ok(worker.perintah.includes("setoption name Skill Level value 6"));
  mesin.terapkanSkill(null);
  assert.equal(mesin.skill, null);
  assert.equal(worker.perintah.at(-1), "setoption name Skill Level value 20");
  mesin.tamat();
});

test("termination rejects startup and ignores a stale worker message after replacement", async (t) => {
  const workers = pasangWorker(t);
  const mesin = new EngineCatur();
  const startup = mesin.mulai();
  const gagal = assert.rejects(startup, { message: "engine dihentikan" });
  const pesanLama = workers[0].onmessage;
  mesin.tamat();
  await gagal;
  assert.equal(workers[0].onmessage, null);
  assert.equal(workers[0].onerror, null);
  const baru = mesin.mulai();
  pesanLama({ data: "readyok" });
  assert.equal(mesin.siap, false);
  workers[1].kirim("readyok");
  await baru;
  assert.equal(mesin.siap, true);
  mesin.tamat();
});

test("WASM detection returns false for absent, non-object or missing validation support", (t) => {
  gantiGlobal(t, { WebAssembly: undefined });
  assert.equal(wasmSupported(), false);
  globalThis.WebAssembly = () => {};
  assert.equal(wasmSupported(), false);
  globalThis.WebAssembly = {};
  assert.equal(wasmSupported(), false);
  globalThis.WebAssembly = { validate: true };
  assert.equal(wasmSupported(), false);
});

test("WASM detection forwards the exact minimal module bytes and the validator result", (t) => {
  let input;
  gantiGlobal(t, { WebAssembly: { validate: (bytes) => { input = bytes; return "validator-result"; } } });
  assert.equal(wasmSupported(), "validator-result");
  assert.ok(input instanceof Uint8Array);
  assert.deepEqual([...input], [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
});

test("WASM detection propagates validator errors and throws for a null WebAssembly object", (t) => {
  const galat = new Error("validator error");
  gantiGlobal(t, { WebAssembly: { validate: () => { throw galat; } } });
  assert.throws(wasmSupported, (e) => e === galat);
  assert.throws(wasmThreadsSupported, (e) => e === galat);
  globalThis.WebAssembly = null;
  assert.throws(wasmSupported, TypeError);
});

test("thread capability needs WASM, SharedArrayBuffer and Atomics before attempting memory allocation", (t) => {
  let dibuat = 0;
  const wasm = { validate: () => false, Memory: class { constructor() { dibuat++; } } };
  gantiGlobal(t, { WebAssembly: wasm, SharedArrayBuffer: class {}, Atomics: {} });
  assert.equal(wasmThreadsSupported(), false);
  wasm.validate = () => true;
  globalThis.SharedArrayBuffer = undefined;
  assert.equal(wasmThreadsSupported(), false);
  globalThis.SharedArrayBuffer = class {};
  globalThis.Atomics = undefined;
  assert.equal(wasmThreadsSupported(), false);
  assert.equal(dibuat, 0);
});

test("thread capability creates shared memory and grows it by eight pages", (t) => {
  const peristiwa = [];
  class BufferBersama {}
  const wasm = {
    validate: () => true,
    Memory: class {
      constructor(opsi) { peristiwa.push(["memory", opsi]); this.buffer = new BufferBersama(); }
      grow(jumlah) { peristiwa.push(["grow", jumlah]); }
    },
  };
  gantiGlobal(t, { WebAssembly: wasm, SharedArrayBuffer: BufferBersama, Atomics: {} });
  assert.equal(wasmThreadsSupported(), true);
  assert.deepEqual(peristiwa, [["memory", { shared: true, initial: 8, maximum: 16 }], ["grow", 8]]);
});

test("thread capability returns false for nonshared memory or allocation/grow errors", (t) => {
  class BufferBersama {}
  let grow = 0;
  const wasm = { validate: () => true, Memory: class { constructor() { this.buffer = {}; } grow() { grow++; } } };
  gantiGlobal(t, { WebAssembly: wasm, SharedArrayBuffer: BufferBersama, Atomics: {} });
  assert.equal(wasmThreadsSupported(), false);
  assert.equal(grow, 0);
  wasm.Memory = class { constructor() { throw new Error("allocation denied"); } };
  assert.equal(wasmThreadsSupported(), false);
  wasm.Memory = class { constructor() { this.buffer = new BufferBersama(); } grow() { throw new Error("grow denied"); } };
  assert.equal(wasmThreadsSupported(), false);
});

test("hash defaults to 32 without navigator and follows the exact device memory threshold", (t) => {
  gantiGlobal(t, { navigator: undefined });
  assert.equal(hashUntukEngine(), 32);
  for (const [memory, hasil] of [[0, 16], [2, 16], [2.01, 32], [4, 32], [NaN, 32], ["1", 32], [undefined, 32]]) {
    globalThis.navigator = { userAgent: "Desktop", deviceMemory: memory };
    assert.equal(hashUntukEngine(), hasil, String(memory));
  }
});

test("recognized mobile user agents always use a 16 MB hash, case insensitively", (t) => {
  gantiGlobal(t, { navigator: {} });
  for (const agent of ["ANDROID", "iPhone", "iPad", "iPod", "KaiOS", "BlackBerry", "BB10", "Tizen"]) {
    globalThis.navigator = { userAgent: agent, deviceMemory: 32 };
    assert.equal(hashUntukEngine(), 16, agent);
  }
  globalThis.navigator = { deviceMemory: 4 };
  assert.equal(hashUntukEngine(), 32);
});

test("a null navigator still throws rather than silently falling back", (t) => {
  gantiGlobal(t, { navigator: null });
  assert.throws(hashUntukEngine, TypeError);
});
