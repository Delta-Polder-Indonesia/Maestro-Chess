import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("static export validation rejects undefined asset prefixes", () => {
  const fixture = mkdtempSync(join(tmpdir(), "maestro-export-"));
  const verifyScript = resolve("scripts/verify-static-export.mjs");

  try {
    const files = [
      "index.html",
      "index.txt",
      "404.html",
      "attributions/index.html",
      "attributions/index.txt",
      "favicon.ico",
      "data/buku-analisa.json",
      "images/analisa/settings.svg",
      "images/analisa/flip.svg",
      "images/stockfish.webp",
      "flags/id.svg",
      "sounds/move-self.mp3",
      "sounds/capture.mp3",
      "licenses/chessclub-MIT.txt",
      "licenses/brilliant-chess-MIT.txt",
      "licenses/chess-game-reviewer-MIT.txt",
      "licenses/chess-openings-CC0.txt",
      "licenses/flag-icons-MIT.txt",
      "licenses/geist-OFL-1.1.txt",
      "licenses/lichess-AGPL-3.0.txt",
      "engine/stockfish-nnue-16-single.js",
      "engine/stockfish-nnue-16-single.wasm",
      "engine/stockfish-16.1-lite-single.js",
      "engine/stockfish-16.1-lite-single.wasm",
      "engine/stockfish-17-lite-single.js",
      "engine/stockfish-17-lite-single.wasm",
      "engine/stockfish-18-lite-single.js",
      "engine/stockfish-18-lite-single.wasm",
      "engine/stockfish-18.0.8-lite-single.js",
      "engine/stockfish-18.0.8-lite-single.wasm",
      "engine/stockfish-19-lite-single.js",
      "engine/stockfish-19-lite-single.wasm",
      "engine/source/COPYING.txt",
      "engine/source/AUTHORS.txt",
      "engine/source/stockfish.js-082eeba46b0c5f8f8065e5386750aa0ecfa2062c.tar.gz",
      "engine/source/nn-9067e33176e8.nnue",
    ];
    for (const file of files) {
      const path = join(fixture, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, "fixture");
    }
    mkdirSync(join(fixture, "_next/static"), { recursive: true });

    const runCheck = () => spawnSync(process.execPath, [verifyScript, fixture], { encoding: "utf8" });
    writeFileSync(join(fixture, "index.html"), '<img src="/Maestro-Chess/images/logo.svg">');
    let result = runCheck();
    assert.equal(result.status, 0, result.stderr);

    for (const [file, markup] of [
      ["index.html", '<img src="undefined/images/logo.svg">'],
      ["404.html", '<img src="undefined/images/error.svg">'],
      ["attributions/index.html", '<link href="undefined/_next/static/app.css">'],
    ]) {
      writeFileSync(join(fixture, file), markup);
      result = runCheck();
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Invalid exported asset URL/);
      writeFileSync(join(fixture, file), "fixture");
    }

    // Client-side navigation in a trailing-slash static export needs both
    // RSC payloads, and every page references the favicon.
    for (const file of ["index.txt", "attributions/index.txt", "favicon.ico"]) {
      rmSync(join(fixture, file));
      result = runCheck();
      assert.equal(result.status, 1, file);
      assert.match(result.stderr, /Missing or empty export file/);
      writeFileSync(join(fixture, file), "fixture");
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
