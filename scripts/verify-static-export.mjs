import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const exportDirectory = process.argv[2] ?? "dist";
const requiredFiles = [
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

let failed = false;

for (const file of requiredFiles) {
  const path = join(exportDirectory, file);
  try {
    const stat = statSync(path);
    if (!stat.isFile() || stat.size === 0) {
      throw new Error("Not a non-empty file");
    }
  } catch {
    console.error(`Missing or empty export file: ${path}`);
    failed = true;
  }
}

for (const file of ["index.html", "404.html", "attributions/index.html"]) {
  const path = join(exportDirectory, file);
  try {
    const html = readFileSync(path, "utf8");
    const invalidUrl = html.match(/\b(?:src|href)="undefined\/[^"]*"/);
    if (invalidUrl) {
      console.error(`Invalid exported asset URL in ${path}: ${invalidUrl[0]}`);
      failed = true;
    }
  } catch {
    console.error(`Cannot read exported page: ${path}`);
    failed = true;
  }
}

const assetsDirectory = join(exportDirectory, "_next/static");
try {
  if (!statSync(assetsDirectory).isDirectory()) {
    throw new Error("Not a directory");
  }
} catch {
  console.error(`Missing export assets directory: ${assetsDirectory}`);
  failed = true;
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(`Static export verified: ${requiredFiles.length} files and the Next.js assets directory.`);
}
