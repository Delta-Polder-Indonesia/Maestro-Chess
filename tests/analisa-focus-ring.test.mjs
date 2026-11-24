import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sumber = readFileSync(new URL("../src/halaman/Analisa/komponen/areaKerja.jsx", import.meta.url), "utf8");

test("the programmatically focused screen layer has no visible focus ring", () => {
  const lapisan = sumber.match(/<div\s+key=\{`\$\{tab\.id\}:\$\{layar\}`\}[\s\S]*?className="([^"]+)"/);
  assert.ok(lapisan, "lapisan layar tidak ditemukan");
  assert.match(lapisan[1], /\boutline-none\b/);
  assert.match(lapisan[0], /tabIndex=\{-1\}/);
});
