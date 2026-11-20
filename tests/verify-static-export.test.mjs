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
      "404.html",
      "attributions.html",
      "openings/openings.json",
      "engine/stockfish.js",
      "engine/stockfish-single.js",
      "engine/stockfish-asm.js",
      ...Array.from({ length: 6 }, (_, index) => `engine/stockfish-part-${index}.wasm`),
      ...Array.from({ length: 6 }, (_, index) => `engine/stockfish-single-part-${index}.wasm`),
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
      ["attributions.html", '<link href="undefined/_next/static/app.css">'],
    ]) {
      writeFileSync(join(fixture, file), markup);
      result = runCheck();
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Invalid exported asset URL/);
      writeFileSync(join(fixture, file), "fixture");
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
