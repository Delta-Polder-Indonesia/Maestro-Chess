import assert from "node:assert/strict";
import test from "node:test";
import { ESLint } from "eslint";

test("ESLint keeps the existing rules and ignores generated or bundled files", async () => {
  const eslint = new ESLint();
  for (const path of [
    ".next/file.js", "src/.next/file.js", "dist/file.js", "src/dist/file.js",
    "out/file.js", "src/out/file.js", "next-env.d.ts", "src/next-env.d.ts",
    "public/engine/file.js", ".hidden/file.js", "src/.hidden/file.js",
  ]) {
    assert.equal(await eslint.isPathIgnored(path), true, path);
  }
  assert.equal(await eslint.isPathIgnored("src/engine/stockfish.ts"), false);
  assert.equal(await eslint.isPathIgnored("src/public/engine/file.js"), false);

  const config = await eslint.calculateConfigForFile("src/engine/stockfish.ts");
  assert.equal(config.rules["@typescript-eslint/no-explicit-any"][0], 0);
  assert.equal(config.rules["react-hooks/exhaustive-deps"][0], 0);
  assert.equal(config.rules["react-hooks/rules-of-hooks"][0], 2);
  assert.equal(config.rules["@next/next/no-html-link-for-pages"][0], 2);
  assert.equal(config.linterOptions.reportUnusedDisableDirectives, 0);
});
