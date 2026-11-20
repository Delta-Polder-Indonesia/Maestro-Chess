import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

test("Vercel build verification requires automatic output and Next.js manifests", () => {
  const fixture = mkdtempSync(join(tmpdir(), "maestro-vercel-"));
  const verifyScript = resolve("scripts/verify-vercel-build.mjs");
  const runCheck = () => spawnSync(process.execPath, [verifyScript, fixture], { encoding: "utf8" });
  const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value));

  try {
    const realConfig = JSON.parse(readFileSync("vercel.json", "utf8"));
    assert.equal(realConfig.outputDirectory, null);

    mkdirSync(join(fixture, ".next"), { recursive: true });
    const configPath = join(fixture, "vercel.json");
    const routesPath = join(fixture, ".next", "routes-manifest.json");
    writeJson(configPath, { outputDirectory: null });
    for (const name of ["routes-manifest.json", "prerender-manifest.json", "images-manifest.json"]) {
      writeJson(join(fixture, ".next", name), { version: 1 });
    }
    writeJson(join(fixture, ".next", "required-server-files.json"), {
      config: { distDir: ".next", output: "export" },
    });
    let result = runCheck();
    assert.equal(result.status, 0, result.stderr);

    writeJson(configPath, { outputDirectory: "dist" });
    result = runCheck();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /outputDirectory must be null/);

    writeJson(configPath, { outputDirectory: null });
    rmSync(routesPath);
    result = runCheck();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /routes-manifest\.json/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
