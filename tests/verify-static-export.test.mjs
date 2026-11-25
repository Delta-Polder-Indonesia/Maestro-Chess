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
      "images/analisa/chesscom.svg",
      "images/analisa/cross.svg",
      "images/analisa/flip.svg",
      "images/analisa/lichess.svg",
      "images/analisa/settings.svg",
      "images/stockfish.webp",
      "flags/id.svg",
      "sounds/capture.mp3",
      "sounds/castle.mp3",
      "sounds/game-end.mp3",
      "sounds/game-start.mp3",
      "sounds/illegal.mp3",
      "sounds/move-check.mp3",
      "sounds/move-opponent.mp3",
      "sounds/move-self.mp3",
      "sounds/promote.mp3",
      "licenses/chessclub-MIT.txt",
      "licenses/brilliant-chess-MIT.txt",
      "licenses/chess-game-reviewer-MIT.txt",
      "licenses/chess-openings-CC0.txt",
      "licenses/flag-icons-MIT.txt",
      "licenses/geist-OFL-1.1.txt",
      "licenses/montserrat-OFL-1.1.txt",
      "licenses/lichess-AGPL-3.0.txt",
      "engine/stockfish-nnue-16-single.js",
      "engine/stockfish-nnue-16-single.wasm",
      "engine/nn-5af11540bbfe.nnue",
      "engine/source/stockfish.js-efc5758a1cf72ec7644fa771a1f17fcbfdae410e-no-networks.tar.gz",
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
      "engine/source/stockfish.js-215df8c6a72847e306644d399733de18fb8e0d6c-source-only.tar.gz",
      "engine/source/stockfish.js-602fd7e1a571a2be71f242942db90483731f2a1f-source-only.tar.gz",
      "engine/source/stockfish.js-93c994592dcf3b4b21052ab925e9b534df9c0918.tar.gz",
      "engine/source/stockfish.js-0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6.tar.gz",
      "engine/source/nn-9067e33176e8.nnue",
      "engine/source/nn-61e7af4bb97d.nnue",
    ];
    for (const file of files) {
      const path = join(fixture, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, "fixture");
    }
    mkdirSync(join(fixture, "_next/static"), { recursive: true });

    const runCheck = () => spawnSync(process.execPath, [verifyScript, fixture], { encoding: "utf8" });
    writeFileSync(join(fixture, "index.html"), '<img src="/Maestro-Chess/images/analisa/settings.svg">');
    let result = runCheck();
    assert.equal(result.status, 0, result.stderr);

    for (const [file, markup, pattern] of [
      ["index.html", '<img src="/Maestro-Chess/images/analisa/settings.svg">', null],
      ["index.html", '<img src="undefined/images/analisa/settings.svg">', /Invalid exported asset URL/],
      ["404.html", '<img src="undefined/images/error.svg">', /Invalid exported asset URL/],
      ["attributions/index.html", '<link href="undefined/_next/static/app.css">', /Invalid exported asset URL/],
      ["index.html", "<script>alert(1)</script>", /Executable inline <script>/],
      ["attributions/index.html", '<script type="module">console.log(1)</script>', /Executable inline <script>/],
      ["index.html", '<script src="/_next/static/csp/missing.js"></script>', /Missing or empty CSP script asset/],
    ]) {
      writeFileSync(join(fixture, file), markup);
      result = runCheck();
      if (pattern === null) {
        assert.equal(result.status, 0, result.stderr);
      } else {
        assert.equal(result.status, 1, file);
        assert.match(result.stderr, pattern);
      }
      writeFileSync(join(fixture, file), "fixture");
    }

    writeFileSync(join(fixture, "index.html"), '<script id="__NEXT_DATA__" type="application/json">{"ok":true}</script>');
    mkdirSync(join(fixture, "_next/static/csp"), { recursive: true });
    writeFileSync(join(fixture, "_next/static/csp/ok.js"), "self.__next_f=[];");
    writeFileSync(join(fixture, "404.html"), '<script src="/Maestro-Chess/_next/static/csp/ok.js"></script>');
    result = runCheck();
    assert.equal(result.status, 0, result.stderr);
    writeFileSync(join(fixture, "index.html"), "fixture");
    writeFileSync(join(fixture, "404.html"), "fixture");

    // Client-side navigation, dynamically selected images/sounds, and every
    // distributed Stockfish build must retain their required exported files.
    for (const file of [
      "index.txt", "attributions/index.txt", "favicon.ico",
      "images/analisa/chesscom.svg", "images/analisa/cross.svg",
      "images/analisa/flip.svg", "images/analisa/lichess.svg", "images/analisa/settings.svg",
      "sounds/capture.mp3", "sounds/castle.mp3", "sounds/game-end.mp3", "sounds/game-start.mp3",
      "sounds/illegal.mp3", "sounds/move-check.mp3", "sounds/move-opponent.mp3",
      "sounds/move-self.mp3", "sounds/promote.mp3",
      "licenses/montserrat-OFL-1.1.txt",
      "engine/nn-5af11540bbfe.nnue",
      "engine/source/stockfish.js-efc5758a1cf72ec7644fa771a1f17fcbfdae410e-no-networks.tar.gz",
      "engine/source/stockfish.js-215df8c6a72847e306644d399733de18fb8e0d6c-source-only.tar.gz",
      "engine/source/stockfish.js-602fd7e1a571a2be71f242942db90483731f2a1f-source-only.tar.gz",
      "engine/source/stockfish.js-082eeba46b0c5f8f8065e5386750aa0ecfa2062c.tar.gz",
      "engine/source/stockfish.js-93c994592dcf3b4b21052ab925e9b534df9c0918.tar.gz",
      "engine/source/stockfish.js-0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6.tar.gz",
      "engine/source/nn-9067e33176e8.nnue",
      "engine/source/nn-61e7af4bb97d.nnue",
    ]) {
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
