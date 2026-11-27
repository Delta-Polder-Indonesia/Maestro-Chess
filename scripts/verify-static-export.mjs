import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const exportDirectory = process.argv[2] ?? "dist";
const JS_SCRIPT_TYPES = new Set([
  "",
  "text/javascript",
  "application/javascript",
  "application/ecmascript",
  "text/ecmascript",
  "module",
]);

function collectHtmlFiles(directory) {
  const results = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectHtmlFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      results.push(path);
    }
  }
  return results.sort();
}
const requiredFiles = [
  "index.html",
  "index.txt",
  "404.html",
  "attributions/index.html",
  "attributions/index.txt",
  "favicon.ico",
  "data/buku-analisa.json",
  "data/buku-pembukaan.json",
  "data/teka-teki.json",
  "data/teka-teki-video.json",
  "data/teka-teki-harian/2007.json",
  "data/teka-teki-harian/2008.json",
  "data/teka-teki-harian/2009.json",
  "data/teka-teki-harian/2010.json",
  "data/teka-teki-harian/2011.json",
  "data/teka-teki-harian/2012.json",
  "data/teka-teki-harian/2013.json",
  "data/teka-teki-harian/2014.json",
  "data/teka-teki-harian/2015.json",
  "data/teka-teki-harian/2016.json",
  "data/teka-teki-harian/2017.json",
  "data/teka-teki-harian/2018.json",
  "data/teka-teki-harian/2019.json",
  "data/teka-teki-harian/2020.json",
  "data/teka-teki-harian/2021.json",
  "data/teka-teki-harian/2022.json",
  "data/teka-teki-harian/2023.json",
  "data/teka-teki-harian/2024.json",
  "data/teka-teki-harian/2025.json",
  "data/teka-teki-harian/2026.json",
  "data/teka-teki-harian/indeks.json",
  "data/teka-teki-harian/terbaru.json",
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

for (const path of collectHtmlFiles(exportDirectory)) {
  try {
    const html = readFileSync(path, "utf8");
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const attrs = match[1];
      const body = match[2];
      const srcMatch = attrs.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const src = srcMatch?.[1] ?? srcMatch?.[2] ?? srcMatch?.[3];
      if (src) {
        const cspMatch = src.match(/\/_next\/static\/csp\/([^/?#]+\.js)$/);
        if (cspMatch) {
          const cspAssetPath = join(exportDirectory, "_next/static/csp", cspMatch[1]);
          try {
            const stat = statSync(cspAssetPath);
            if (!stat.isFile() || stat.size === 0) {
              throw new Error("Not a non-empty file");
            }
          } catch {
            console.error(`Missing or empty CSP script asset referenced by ${path}: ${cspAssetPath}`);
            failed = true;
          }
        }
        continue;
      }

      const typeMatch = attrs.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const type = (typeMatch?.[1] ?? typeMatch?.[2] ?? typeMatch?.[3] ?? "").trim().toLowerCase();
      if (JS_SCRIPT_TYPES.has(type) && body.trim().length > 0) {
        console.error(`Executable inline <script> violates strict CSP in ${path}`);
        failed = true;
      }
    }

    // Shell statis tidak boleh memuat inline style: atribut style diblokir oleh
    // style-src-attr 'none', dan elemen <style> tidak dihasilkan aplikasi (semua
    // styling runtime berjalan via CSSOM). Penjagaan ini menangkap regresi bila
    // suatu komponen kelak dirender SSR dengan style inline.
    const styleAttr = html.match(/<[a-zA-Z][^>]*\sstyle\s*=/i);
    if (styleAttr) {
      console.error(`Inline style attribute violates style-src-attr 'none' in ${path}: ${styleAttr[0].slice(0, 80)}`);
      failed = true;
    }
    if (/<style[\s>]/i.test(html)) {
      console.error(`Unexpected inline <style> element in exported HTML: ${path}`);
      failed = true;
    }

    // Validasi SRI: setiap integrity pada skrip/stylesheet/preload lokal harus
    // cocok dengan hash SHA-384 byte berkas yang dirujuk (injeksi pasca-build).
    for (const tagMatch of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
      const tag = tagMatch[0];
      const integrity = tag.match(/\bintegrity\s*=\s*"([^"]*)"/i)?.[1];
      if (!integrity) continue;
      const jenis = tagMatch[1].toLowerCase();
      const url = tag.match(jenis === "script" ? /\bsrc\s*=\s*"([^"]*)"/i : /\bhref\s*=\s*"([^"]*)"/i)?.[1];
      const aset = url?.match(/\/_next\/static\/([^?#]+)$/);
      if (!aset) continue;
      const file = join(exportDirectory, "_next/static", aset[1]);
      let benar;
      try {
        benar = "sha384-" + createHash("sha384").update(readFileSync(file)).digest("base64");
      } catch {
        console.error(`SRI references missing asset in ${path}: ${file}`);
        failed = true;
        continue;
      }
      const token = integrity.split(/\s+/).find((t) => t.startsWith("sha384-"));
      if (token !== benar) {
        console.error(`SRI hash mismatch in ${path} for ${aset[1]}`);
        failed = true;
      }
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
