import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import test from "node:test";
import { DAFTAR_ENGINE } from "../src/lib/engineCatur.js";

// Exercise the actual shipped JS/WASM, not a mock. A temporary directory
// outside this ESM project lets the upstream Node loaders run as CommonJS.
// The Stockfish 16 single-thread CLI forwards through a thread-only method;
// its browser worker uses onCustomMessage, so use that same method here.
const wrapper16 = `
const create = require(process.argv[2]);
create()().then(engine => {
  engine.addMessageListener(line => process.stdout.write(line + "\\n"));
  require("node:readline").createInterface({ input: process.stdin }).on("line", line => {
    if (line === "quit") process.exit(0);
    else engine.onCustomMessage(line);
  });
  process.stdout.write("test-wrapper-ready\\n");
}).catch(error => { console.error(error); process.exit(1); });
`;

function jalankanUci(folder, namaBerkas, engine16) {
  return new Promise((resolveTest, rejectTest) => {
    const path = join(folder, namaBerkas);
    const args = engine16 ? [join(folder, "wrapper16.cjs"), path] : [path];
    const anak = spawn(process.execPath, args, { cwd: folder, stdio: ["pipe", "pipe", "pipe"] });
    const baris = [];
    let stderr = "";
    let selesaiCari = false;
    let mulaiCari = false;
    let selesai = false;
    const timer = setTimeout(() => {
      anak.kill("SIGKILL");
      akhiri(new Error(`UCI timeout for ${namaBerkas}: ${baris.slice(-8).join(" | ")} ${stderr.slice(-1000)}`));
    }, 30000);
    function akhiri(galat) {
      if (selesai) return;
      selesai = true;
      clearTimeout(timer);
      if (galat) rejectTest(galat); else resolveTest(baris);
    }
    anak.stderr.on("data", (chunk) => { stderr += String(chunk); });
    anak.stdin.on("error", (error) => { if (error.code !== "EPIPE") akhiri(error); });
    anak.on("error", akhiri);
    const pembaca = createInterface({ input: anak.stdout });
    pembaca.on("line", (line) => {
      baris.push(line);
      if (line === "test-wrapper-ready") anak.stdin.write("uci\n");
      if (line === "uciok") {
        if (engine16) anak.stdin.write("setoption name Use NNUE value true\n");
        anak.stdin.write("isready\n");
      }
      if (line === "readyok" && !mulaiCari) {
        mulaiCari = true;
        anak.stdin.write("position startpos\ngo depth 4\n");
      }
      if (/^bestmove [a-h][1-8][a-h][1-8][qrbn]?(?:\s|$)/.test(line)) {
        selesaiCari = true;
        anak.stdin.write("quit\n");
      }
    });
    anak.on("exit", (code, signal) => {
      pembaca.close();
      if (code !== 0 || !selesaiCari) {
        akhiri(new Error(`${namaBerkas}: exit ${code ?? signal}; ${baris.slice(-8).join(" | ")} ${stderr.slice(-1000)}`));
      } else akhiri();
    });
    if (!engine16) anak.stdin.write("uci\n");
  });
}

test("all selectable real engines identify themselves and search with their NNUE", { timeout: 210000 }, async () => {
  const ekspektasi = {
    "stockfish-16": /^id name Stockfish 16(?:\s|$)/,
    "stockfish-16.1-lite": /^id name Stockfish 16\.1 Lite(?:\s|$)/,
    "stockfish-17-lite": /^id name Stockfish 17\.1 Lite(?:\s|$)/,
    "stockfish-18-lite": /^id name Stockfish 18 Lite(?:\s|$)/,
    "stockfish-18.0.8-lite": /^id name Stockfish 18 Lite(?:\s|$)/,
    "stockfish-19-lite": /^id name Stockfish 19 Lite(?:\s|$)/,
  };
  assert.deepEqual(new Set(DAFTAR_ENGINE.map(({ id }) => id)), new Set(Object.keys(ekspektasi)));
  const folder = mkdtempSync(join(tmpdir(), "maestro-uci-"));
  try {
    const publik = resolve("public/engine");
    copyFileSync(join(publik, "nn-5af11540bbfe.nnue"), join(folder, "nn-5af11540bbfe.nnue"));
    writeFileSync(join(folder, "package.json"), '{"type":"commonjs"}');
    writeFileSync(join(folder, "wrapper16.cjs"), wrapper16);
    for (const pilihan of DAFTAR_ENGINE) {
      const js = basename(pilihan.url);
      const wasm = js.replace(/\.js$/, ".wasm");
      assert.notEqual(wasm, js);
      copyFileSync(join(publik, js), join(folder, js));
      copyFileSync(join(publik, wasm), join(folder, wasm));
      const lines = await jalankanUci(folder, js, pilihan.id === "stockfish-16");
      const nama = lines.filter((line) => line.startsWith("id name "));
      assert.equal(nama.length, 1, pilihan.id);
      assert.match(nama[0], ekspektasi[pilihan.id], pilihan.id);
      assert.ok(!lines.some((line) => /failed to download eval file|network file was not loaded|No such option/i.test(line)), pilihan.id);
      if (pilihan.id === "stockfish-16") {
        assert.ok(lines.some((line) => line.includes("EvalFile type string default nn-5af11540bbfe.nnue")));
        assert.ok(lines.some((line) => line.includes("NNUE evaluation enabled")));
      }
      if (pilihan.id === "stockfish-16.1-lite") {
        assert.ok(lines.some((line) => line.includes("NNUE evaluation using nn-9067e33176e8.nnue")));
      }
      if (pilihan.id === "stockfish-19-lite") {
        assert.ok(lines.some((line) => line.includes("EvalFile type string default nn-61e7af4bb97d.nnue")));
      }
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
