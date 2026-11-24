import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import * as lama from "../src/halaman/Analisa/konteks/importKonteks.js";
import * as ringan from "../src/modul/sesi/impor.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(akar, "src");
const modul = resolve(src, "modul/sesi");
const pekerjaan = resolve(src, "modul/pekerjaan/index.js");
const ekstensi = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];
const apiImpor = ["ImportContext", "useImport"];

function berkasKode(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entri) => {
    const path = resolve(dir, entri.name);
    if (entri.isDirectory()) return berkasKode(path);
    return entri.isFile() && ekstensi.includes(extname(path)) ? [path] : [];
  });
}

function astBerkas(path) {
  return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
}

function referensi(path) {
  const hasil = [];
  function kunjungi(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (ts.isStringLiteralLike(node.moduleSpecifier)) hasil.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node)) {
      const impor = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const require = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (impor || require) {
        const argumen = node.arguments[0];
        assert.ok(argumen && ts.isStringLiteralLike(argumen), `Import nonliteral: ${relative(akar, path)}`);
        hasil.push(argumen.text);
      }
    }
    ts.forEachChild(node, kunjungi);
  }
  kunjungi(astBerkas(path));
  return hasil;
}

function tujuan(source, ref) {
  const bersih = ref.split(/[?#]/, 1)[0];
  let dasar;
  if (bersih.startsWith("@/")) dasar = resolve(src, bersih.slice(2));
  else if (bersih.startsWith(".")) dasar = resolve(dirname(source), bersih);
  else return null;
  const kandidat = [dasar, ...ekstensi.map((ext) => dasar + ext), ...ekstensi.map((ext) => resolve(dasar, `index${ext}`))];
  const ditemukan = kandidat.find((path) => existsSync(path) && statSync(path).isFile());
  assert.ok(ditemukan, `Import tidak terpecahkan: ${relative(akar, source)} -> ${ref}`);
  return ditemukan;
}

// Pekerjaan memang sudah merupakan dependensi provider sebelum pemindahan.
// Catat fasadnya sebagai batas dan jangan mengikutinya ke implementasi fitur.
function grafDari(awal) {
  const antrean = [resolve(akar, awal)];
  const diperiksa = new Set();
  const paket = new Set();
  while (antrean.length) {
    const path = antrean.shift();
    if (diperiksa.has(path)) continue;
    diperiksa.add(path);
    if (path === pekerjaan) continue;
    for (const ref of referensi(path)) {
      const target = tujuan(path, ref);
      if (target === null) paket.add(ref);
      else {
        assert.ok(target === pekerjaan || target.startsWith(modul + sep), `Keluar dari batas impor: ${relative(akar, path)} -> ${relative(akar, target)}`);
        antrean.push(target);
      }
    }
  }
  return { files: [...diperiksa].map((path) => relative(akar, path)).sort(), paket: [...paket].sort() };
}

function pasangStorage(tes, awal = []) {
  const sebelumnya = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const data = new Map(awal);
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, writable: true, value: {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, nilai) => data.set(key, String(nilai)),
    removeItem: (key) => data.delete(key),
  } });
  tes.after(() => {
    if (sebelumnya) Object.defineProperty(globalThis, "sessionStorage", sebelumnya);
    else delete globalThis.sessionStorage;
  });
  return data;
}

function pemuat() {
  let id = 0;
  return buatPemuatJsx({
    "src/modul/pekerjaan/index.js": {
      KUNCI_FITUR: {}, ID_DRAF_IMPOR: "draf:impor", buatIdDrafImpor: () => "draf:uji",
      buatIdPekerjaan: () => `laporan:batas-${++id}`,
      pekerjaan: { snapshot: () => ({ daftar: [], aktif: { id: null } }) },
      simpanLaporanAktif: () => {},
    },
  });
}

test("native JSX-free facade and old context path have the same exports, identities and default value", () => {
  assert.deepEqual(Object.keys(lama).sort(), [...apiImpor].sort());
  assert.deepEqual(Object.keys(ringan).sort(), [...apiImpor].sort());
  for (const nama of apiImpor) assert.strictEqual(lama[nama], ringan[nama], nama);
  let lewatLama;
  let lewatFasad;
  function Probe() { lewatLama = lama.useImport(); lewatFasad = ringan.useImport(); return null; }
  renderToString(React.createElement(Probe));
  assert.strictEqual(lewatLama, lewatFasad);
  assert.strictEqual(lewatLama.analyzeController[0], lewatFasad.analyzeController[0]);
  assert.equal(lewatLama.pageState[0], "default");
});

test("legacy, context, provider and main facade exports share one registry and provider identity", () => {
  // Node tidak memuat JSX native; pemuat ini melakukan transpile dan cache
  // modul, sehingga semua jalur diuji di dalam satu registry yang sama.
  const muat = pemuat();
  const legacyContext = muat("src/halaman/Analisa/konteks/importKonteks.js");
  const legacyProvider = muat("src/halaman/Analisa/konteks/import.jsx");
  const context = muat("src/modul/sesi/impor.js");
  const provider = muat("src/modul/sesi/imporProvider.js");
  const utama = muat("src/modul/sesi/index.js");
  const implContext = muat("src/modul/sesi/importKonteks.js");
  const implProvider = muat("src/modul/sesi/ImportProvider.jsx");
  assert.deepEqual(Object.keys(legacyContext).sort(), [...apiImpor].sort());
  assert.deepEqual(Object.keys(legacyProvider), ["ImportProvider"]);
  assert.deepEqual(Object.keys(provider), ["ImportProvider"]);
  for (const nama of apiImpor) {
    assert.strictEqual(legacyContext[nama], context[nama], nama);
    assert.strictEqual(utama[nama], context[nama], nama);
    assert.strictEqual(implContext[nama], context[nama], nama);
  }
  assert.strictEqual(legacyProvider.ImportProvider, provider.ImportProvider);
  assert.strictEqual(utama.ImportProvider, provider.ImportProvider);
  assert.strictEqual(implProvider.ImportProvider, provider.ImportProvider);
});

test("old and public hooks read and update the same provider state and one handoff", async (tes) => {
  const data = pasangStorage(tes, [["maestro-analisa-impor-awal", "1. e4 e5 *"]]);
  const muat = pemuat();
  const legacyContext = muat("src/halaman/Analisa/konteks/importKonteks.js");
  const legacyProvider = muat("src/halaman/Analisa/konteks/import.jsx");
  const context = muat("src/modul/sesi/impor.js");
  const utama = muat("src/modul/sesi/index.js");
  let lewatLama;
  let lewatRingan;
  let lewatUtama;
  function Probe() {
    lewatLama = legacyContext.useImport();
    lewatRingan = context.useImport();
    lewatUtama = utama.useImport();
    return null;
  }
  let renderer;
  tes.after(() => { if (renderer) act(() => renderer.unmount()); });
  await act(async () => { renderer = TestRenderer.create(React.createElement(legacyProvider.ImportProvider, null, React.createElement(Probe))); await flush(); });
  assert.strictEqual(lewatLama, lewatRingan);
  assert.strictEqual(lewatRingan, lewatUtama);
  assert.equal(lewatUtama.pageState[0], "loading");
  assert.equal(data.get("maestro-analisa-impor-awal"), "1. e4 e5 *");
  const controllerAwal = lewatUtama.analyzeController[0];
  await act(async () => { lewatRingan.progress[1](47); await flush(); });
  assert.strictEqual(lewatLama, lewatUtama);
  assert.equal(lewatLama.progress[0], 47);
  data.delete("maestro-analisa-impor-awal");
  await act(async () => { renderer.unmount(); renderer = TestRenderer.create(React.createElement(utama.ImportProvider, null, React.createElement(Probe))); await flush(); });
  assert.strictEqual(lewatLama, lewatRingan);
  assert.strictEqual(lewatRingan, lewatUtama);
  assert.equal(lewatLama.pageState[0], "default");
  assert.equal(lewatLama.progress[0], 0);
  assert.notStrictEqual(lewatLama.analyzeController[0], controllerAwal);
  await act(async () => { lewatLama.pageState[1]("analyze"); await flush(); });
  assert.equal(lewatUtama.pageState[0], "analyze");
});

test("both old files are single direct re-exports to the relocated implementations", () => {
  const paths = [
    ["src/halaman/Analisa/konteks/importKonteks.js", "src/modul/sesi/importKonteks.js"],
    ["src/halaman/Analisa/konteks/import.jsx", "src/modul/sesi/ImportProvider.jsx"],
  ];
  for (const [file, target] of paths) {
    const path = resolve(akar, file);
    const statements = astBerkas(path).statements;
    assert.equal(statements.length, 1, file);
    assert.ok(ts.isExportDeclaration(statements[0]), file);
    assert.equal(tujuan(path, statements[0].moduleSpecifier.text), resolve(akar, target), file);
  }
});

test("the context facade and legacy context shim load no JSX, Pekerjaan or unrelated session features", () => {
  const graph = [
    ["src/modul/sesi/impor.js", ["src/modul/sesi/importKonteks.js"]],
    ["src/halaman/Analisa/konteks/importKonteks.js", ["src/modul/sesi/importKonteks.js"]],
  ];
  for (const [awal, internal] of graph) {
    const hasil = grafDari(awal);
    assert.deepEqual(hasil.files, [awal, ...internal].sort(), awal);
    assert.deepEqual(hasil.paket, ["react"], awal);
    assert.ok(hasil.files.every((file) => extname(file) === ".js"), awal);
  }
});

test("the provider facade and legacy shim load only import state, handoff and the existing Pekerjaan boundary", () => {
  const internal = [
    "src/modul/sesi/ImportProvider.jsx", "src/modul/sesi/importKonteks.js",
    "src/modul/sesi/titipanAnalisa.js", "src/modul/pekerjaan/index.js",
  ];
  for (const awal of ["src/modul/sesi/imporProvider.js", "src/halaman/Analisa/konteks/import.jsx"]) {
    const hasil = grafDari(awal);
    assert.deepEqual(hasil.files, [awal, ...internal].sort(), awal);
    assert.deepEqual(hasil.paket, ["react"], awal);
  }
  // Tidak perlu tiruan Tab Kerja atau konteks papan untuk memuat shim provider.
  assert.equal(typeof pemuat()("src/halaman/Analisa/konteks/import.jsx").ImportProvider, "function");
});

test("ImportContext and ImportProvider each have exactly one source definition", () => {
  const definisi = { ImportContext: [], ImportProvider: [] };
  for (const path of berkasKode(src)) {
    function kunjungi(node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "ImportContext") {
        definisi.ImportContext.push(relative(akar, path));
      }
      if (ts.isFunctionDeclaration(node) && node.name?.text === "ImportProvider") {
        definisi.ImportProvider.push(relative(akar, path));
      }
      ts.forEachChild(node, kunjungi);
    }
    kunjungi(astBerkas(path));
  }
  assert.deepEqual(definisi, {
    ImportContext: ["src/modul/sesi/importKonteks.js"],
    ImportProvider: ["src/modul/sesi/ImportProvider.jsx"],
  });
});

test("all three mapped application consumers import their names from the appropriate public facade", () => {
  const konsumen = [
    ["src/halaman/Analisa/komponen/areaKerja.jsx", "src/modul/sesi/impor.js", ["useImport"]],
    ["src/halaman/Analisa/komponen/menu/loading/loading.jsx", "src/modul/sesi/impor.js", ["useImport"]],
    ["src/halaman/Analisa/konteks/analyze.jsx", "src/modul/sesi/impor.js", ["useImport"]],
    ["src/halaman/Analisa/konteks/analyze.jsx", "src/modul/sesi/imporProvider.js", ["ImportProvider"]],
  ];
  assert.equal(new Set(konsumen.map(([file]) => file)).size, 3);
  for (const [file, entry, names] of konsumen) {
    const path = resolve(akar, file);
    const imports = astBerkas(path).statements.filter((node) =>
      ts.isImportDeclaration(node) && node.moduleSpecifier && tujuan(path, node.moduleSpecifier.text) === resolve(akar, entry));
    assert.equal(imports.length, 1, `${file} -> ${entry}`);
    const binding = imports[0].importClause?.namedBindings;
    assert.ok(binding && ts.isNamedImports(binding), file);
    assert.deepEqual(binding.elements.map((element) => (element.propertyName ?? element.name).text).sort(), [...names].sort(), file);
  }
});
