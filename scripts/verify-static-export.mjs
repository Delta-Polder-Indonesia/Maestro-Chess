import { statSync } from "node:fs";
import { join } from "node:path";

const exportDirectory = process.argv[2] ?? "dist";
const requiredFiles = [
  "index.html",
  "404.html",
  "attributions.html",
  "openings/openings.json",
  "engine/stockfish.js",
  "engine/stockfish-single.js",
  "engine/stockfish-asm.js",
  ...Array.from({ length: 6 }, (_, index) => `engine/stockfish-part-${index}.wasm`),
  ...Array.from({ length: 6 }, (_, index) => `engine/stockfish-single-part-${index}.wasm`),
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
