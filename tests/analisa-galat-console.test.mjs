import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import { AnalyzeContext } from "../src/halaman/Analisa/konteks/analyzeKonteks.js";
import { muatBuku } from "../src/halaman/Analisa/mesin/buku.js";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;
const noop = () => {};
const flush = () => new Promise((resolve) => setImmediate(resolve));

function kompilasi(path, dependencies) {
  const filename = new URL(path, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename.pathname,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const factory = runInThisContext(`(function (require, module, exports) {\n${compiled}\n})`);
  const result = { exports: {} };
  factory((id) => {
    if (id === "react" || id === "react/jsx-runtime") return require(id);
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, result, result.exports);
  return result.exports;
}

test("engine startup failures from settings are visible in the console", async (t) => {
  const error = new Error("worker tidak tersedia");
  const tercatat = [];
  const consoleAsli = console.error;
  console.error = (...args) => {
    tercatat.push(args);
    if (args[1] !== error) consoleAsli(...args);
  };
  t.after(() => { console.error = consoleAsli; });
  const mesin = {
    idEngine: "lite", status: "mati", galat: "", didukung: true,
    siapkan: async () => { throw error; }, setop: noop, gantiEngine: noop,
  };
  const kosong = () => null;
  const kartu = { id: "lite", label: "Stockfish 18 Lite", url: "/engine/stockfish.js" };
  const PengaturanMesin = kompilasi("../src/halaman/Analisa/komponen/pengaturan/mesin.jsx", {
    "../../../../lib/i18n.jsx": { useI18n: () => ({ t: (key) => key }) },
    "../../../../modul/analisis/mesin.js": { DAFTAR_ENGINE: [kartu], cariEngine: () => kartu },
    "../../../../lib/asets.js": { gambar: (path) => path },
    "../../../../modul/sesi/mesin.js": { useMesin: () => mesin },
    "../../../../modul/sesi/analisa.js": { AnalyzeContext },
    "../../../../modul/sesi/preferensi.js": { tulis: noop },
    "../nav/SelectDaftar.jsx": { default: kosong },
    "../Gambar.jsx": { default: kosong },
    "../../mesin/rentangElo.js": { RENTANG_ELO: { min: 1320, max: 3190, bawaan: 2000 } },
    "./sakelarPengaturan.jsx": { default: kosong },
    "./pilihRingkas.jsx": { default: kosong },
  }).default;
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(AnalyzeContext.Provider, {
      value: { depth: [13, noop], analyzeController: [new AbortController(), noop] },
    }, React.createElement(PengaturanMesin)));
  });
  const tombol = renderer.root.findAllByType("button")[0];
  await act(async () => { tombol.props.onClick(); await flush(); });
  const galatEngine = tercatat.filter((args) => args[1] === error);
  assert.equal(galatEngine.length, 1);
  assert.match(galatEngine[0][0], /engine/i);
  await act(async () => { renderer.unmount(); });
});

test("engine card ignores unrelated analysis progress but updates its depth", async () => {
  let gambarRenders = 0;
  const gambarMock = () => { gambarRenders++; return null; };
  const mesin = { idEngine: "lite", status: "mati", galat: "", didukung: true, siapkan: async () => ({}), setop: noop, gantiEngine: noop };
  const kartu = { id: "lite", label: "Stockfish 18 Lite", url: "/engine/stockfish.js" };
  const kosong = () => null;
  const PengaturanMesin = kompilasi("../src/halaman/Analisa/komponen/pengaturan/mesin.jsx", {
    "../../../../lib/i18n.jsx": { useI18n: () => ({ t: (key) => key }) },
    "../../../../modul/analisis/mesin.js": { DAFTAR_ENGINE: [kartu], cariEngine: () => kartu },
    "../../../../lib/asets.js": { gambar: (path) => path },
    "../../../../modul/sesi/mesin.js": { useMesin: () => mesin },
    "../../../../modul/sesi/analisa.js": { AnalyzeContext },
    "../../../../modul/sesi/preferensi.js": { tulis: noop },
    "../nav/SelectDaftar.jsx": { default: kosong },
    "../Gambar.jsx": { default: gambarMock },
    "../../mesin/rentangElo.js": { RENTANG_ELO: { min: 1320, max: 3190, bawaan: 2000 } },
    "./sakelarPengaturan.jsx": { default: kosong },
    "./pilihRingkas.jsx": { default: kosong },
  }).default;
  const kendali = {};
  function Harness() {
    const depth = React.useState(13);
    const progress = React.useState(0);
    const analyzeController = React.useState(() => new AbortController());
    Object.assign(kendali, { depth, progress });
    return React.createElement(AnalyzeContext.Provider, { value: { depth, progress, analyzeController } }, React.createElement(PengaturanMesin));
  }
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness)); });
  const awal = gambarRenders;
  assert.equal(awal, 2);
  await act(async () => { kendali.progress[1](50); });
  assert.equal(gambarRenders, awal);
  await act(async () => { kendali.depth[1](8); });
  assert.ok(gambarRenders > awal);
  assert.equal(renderer.root.findAllByType("input").find((n) => n.props.min === 6).props.value, "8");
  await act(async () => { renderer.unmount(); });
});

test("a failed opening-book request is logged, falls back and can be retried", async (t) => {
  const fetchAsli = globalThis.fetch;
  const consoleAsli = console.error;
  const tercatat = [];
  console.error = (...args) => {
    tercatat.push(args);
    if (args[0] !== "Gagal memuat buku pembukaan:") consoleAsli(...args);
  };
  t.after(() => { globalThis.fetch = fetchAsli; console.error = consoleAsli; });
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  assert.deepEqual(await muatBuku(), {});
  assert.equal(tercatat.length, 1);
  assert.match(String(tercatat[0][1]), /HTTP 503/);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ contoh: "Pembukaan" }) });
  assert.deepEqual(await muatBuku(), { contoh: "Pembukaan" });
});
