import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import * as lamaNative from "../src/halaman/Analisa/konteks/analyzeKonteks.js";
import * as ringanNative from "../src/modul/sesi/analisa.js";
import * as implementasiNative from "../src/modul/sesi/analyzeKonteks.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const { act } = TestRenderer;
const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(akar, "src");
const modul = resolve(src, "modul/sesi");
const ekstensi = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];
const namaKonteks = ["AnalyzeContext", "TAMPILAN_ANALISA", "normalisasiPemain"].sort();
const pathLama = "src/halaman/Analisa/konteks/analyzeKonteks.js";
const providerLama = "src/halaman/Analisa/konteks/analyze.jsx";
const pathImplementasi = "src/modul/sesi/analyzeKonteks.js";
const providerImplementasi = "src/modul/sesi/AnalyzeContextProvider.jsx";
const pathRingan = "src/modul/sesi/analisa.js";
const providerRingan = "src/modul/sesi/analisaProvider.js";
const pathUtama = "src/modul/sesi/index.js";

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
      assert.ok(ts.isStringLiteralLike(node.moduleSpecifier), `Referensi nonliteral: ${relative(akar, path)}`);
      hasil.push(node.moduleSpecifier.text);
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

function grafDari(awal) {
  const antrean = [resolve(akar, awal)];
  const diperiksa = new Set();
  const paket = new Set();
  while (antrean.length) {
    const path = antrean.shift();
    if (diperiksa.has(path)) continue;
    diperiksa.add(path);
    for (const ref of referensi(path)) {
      const target = tujuan(path, ref);
      if (target === null) paket.add(ref);
      else antrean.push(target);
    }
  }
  return { files: [...diperiksa].map((path) => relative(akar, path)).sort(), paket: [...paket].sort() };
}

function pemuat() {
  let id = 0;
  return buatPemuatJsx({
    "src/lib/i18n.jsx": { useI18n: () => ({ t: (key) => `uji:${key}` }) },
    "src/modul/pekerjaan/index.js": {
      KUNCI_FITUR: {}, ID_DRAF_IMPOR: "draf:impor", buatIdDrafImpor: () => "draf:uji",
      buatIdPekerjaan: () => `laporan:uji-${++id}`,
      pekerjaan: { snapshot: () => ({ daftar: [], aktif: { id: null } }) }, simpanLaporanAktif: () => {},
    },
  });
}

test("native old path, light facade and implementation expose exactly three identical named exports", () => {
  for (const api of [lamaNative, ringanNative, implementasiNative]) assert.deepEqual(Object.keys(api).sort(), namaKonteks);
  for (const nama of namaKonteks) {
    assert.strictEqual(lamaNative[nama], ringanNative[nama], nama);
    assert.strictEqual(implementasiNative[nama], ringanNative[nama], nama);
  }
  assert.strictEqual(lamaNative.AnalyzeContext.Provider, ringanNative.AnalyzeContext.Provider);
  assert.strictEqual(lamaNative.AnalyzeContext.Consumer, ringanNative.AnalyzeContext.Consumer);
  assert.ok(Object.isFrozen(ringanNative.TAMPILAN_ANALISA));
});

test("main, light, implementation and old paths share the same context, normalizer, constants and default provider", () => {
  const muat = pemuat();
  const contexts = [pathLama, pathRingan, pathImplementasi].map(muat);
  const providers = [providerLama, providerRingan, providerImplementasi].map(muat);
  const utama = muat(pathUtama);
  for (const api of contexts) assert.deepEqual(Object.keys(api).sort(), namaKonteks);
  for (const api of providers) assert.deepEqual(Object.keys(api), ["default"]);
  for (const nama of namaKonteks) {
    for (const api of [...contexts, utama]) assert.strictEqual(api[nama], contexts[0][nama], nama);
  }
  for (const api of providers) assert.strictEqual(api.default, providers[0].default);
  assert.strictEqual(utama.AnalyzeContextProvider, providers[0].default);
  assert.equal(Object.hasOwn(utama, "default"), false);
});

test("mixed legacy and public context consumers share a provider while independent mounts stay isolated", (tes) => {
  const sebelumnya = Object.fromEntries(["localStorage", "sessionStorage"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of ["localStorage", "sessionStorage"]) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: { getItem: () => null } });
  }
  let renderer;
  tes.after(() => {
    if (renderer) act(() => renderer.unmount());
    for (const key of ["localStorage", "sessionStorage"]) {
      if (sebelumnya[key]) Object.defineProperty(globalThis, key, sebelumnya[key]); else delete globalThis[key];
    }
  });
  const muat = pemuat();
  const lama = muat(pathLama);
  const ringan = muat(pathRingan);
  const utama = muat(pathUtama);
  const ProviderLama = muat(providerLama).default;
  const ProviderPublik = muat(providerRingan).default;
  const nilai = {};
  function Probe({ id }) {
    nilai[id] = {
      lama: React.useContext(lama.AnalyzeContext),
      ringan: React.useContext(ringan.AnalyzeContext),
      utama: React.useContext(utama.AnalyzeContext),
    };
    return null;
  }
  act(() => {
    renderer = TestRenderer.create(React.createElement(React.Fragment, null,
      React.createElement(ProviderLama, null, React.createElement(Probe, { id: "lama" })),
      React.createElement(ProviderPublik, null, React.createElement(Probe, { id: "publik" }))));
  });
  for (const id of ["lama", "publik"]) {
    assert.strictEqual(nilai[id].lama, nilai[id].ringan);
    assert.strictEqual(nilai[id].lama, nilai[id].utama);
  }
  assert.notStrictEqual(nilai.lama.lama, nilai.publik.lama);
  assert.notStrictEqual(nilai.lama.lama.gameController, nilai.publik.lama.gameController);
  act(() => { nilai.lama.ringan.akun[1]({ platform: "lichess", username: "satu" }); nilai.lama.utama.moveNumber[1](4); });
  assert.equal(nilai.lama.lama.akun[0].username, "satu");
  assert.equal(nilai.lama.lama.moveNumber[0], 4);
  assert.deepEqual(nilai.publik.utama.akun[0], { platform: "chessCom", username: "" });
  assert.equal(nilai.publik.ringan.moveNumber[0], 0);
  act(() => nilai.publik.lama.progress[1](55));
  assert.equal(nilai.publik.utama.progress[0], 55);
  assert.equal(nilai.lama.ringan.progress[0], 0);
});

test("old Analyze paths are direct re-exports with the exact original named and default APIs", () => {
  for (const [file, target, names] of [
    [pathLama, pathImplementasi, namaKonteks], [providerLama, providerImplementasi, ["default"]],
  ]) {
    const path = resolve(akar, file);
    const statements = astBerkas(path).statements;
    assert.equal(statements.length, 1, file);
    const declaration = statements[0];
    assert.ok(ts.isExportDeclaration(declaration), file);
    assert.equal(tujuan(path, declaration.moduleSpecifier.text), resolve(akar, target), file);
    assert.ok(declaration.exportClause && ts.isNamedExports(declaration.exportClause), file);
    assert.deepEqual(declaration.exportClause.elements.map((element) => element.name.text).sort(), [...names].sort(), file);
  }
});

test("context entry and legacy context load only the implementation and React, without JSX or feature modules", () => {
  for (const awal of [pathRingan, pathLama]) {
    const hasil = grafDari(awal);
    assert.deepEqual(hasil.files, [awal, pathImplementasi].sort(), awal);
    assert.deepEqual(hasil.paket, ["react"], awal);
    assert.ok(hasil.files.every((file) => extname(file) === ".js"), awal);
  }
});

test("provider entry and old provider load only the documented Board/Import/Pekerjaan closure, not the session barrel", () => {
  const internal = [
    "src/lib/i18n.jsx", "src/lib/terjemahan/en/analisa.js", "src/lib/terjemahan/id/analisa.js",
    "src/lib/terjemahan/en/tekaTeki.js", "src/lib/terjemahan/id/tekaTeki.js",
    "src/modul/pekerjaan/index.js", "src/modul/pekerjaan/manajerLaporan.js", "src/modul/pekerjaan/pekerjaan.js",
    "src/modul/pekerjaan/riwayatFitur.js", "src/modul/pekerjaan/usePekerjaan.js",
    providerImplementasi, "src/modul/sesi/BoardProvider.jsx", "src/modul/sesi/ImportProvider.jsx",
    pathImplementasi, "src/modul/sesi/boardKonteks.js", "src/modul/sesi/boardThemes.js", "src/modul/sesi/configKonteks.js",
    "src/modul/sesi/impor.js", "src/modul/sesi/imporProvider.js", "src/modul/sesi/importKonteks.js",
    "src/modul/sesi/papan.js", "src/modul/sesi/papanProvider.js", "src/modul/sesi/penyimpanan.js",
    "src/modul/sesi/preferensi.js", "src/modul/sesi/titipanAnalisa.js",
  ];
  for (const awal of [providerRingan, providerLama]) {
    const hasil = grafDari(awal);
    assert.deepEqual(hasil.files, [awal, ...internal].sort(), awal);
    assert.deepEqual(hasil.paket, ["chess.js", "react"], awal);
    assert.equal(hasil.files.includes(pathUtama), false);
    assert.equal(hasil.files.includes("src/modul/sesi/TabKerjaProvider.jsx"), false);
    assert.equal(hasil.files.some((file) => file.startsWith("src/halaman/Analisa/mesin/")), false);
  }
});

test("Analyze context, constants, normalizer and provider each have exactly one source definition", () => {
  const definisi = Object.fromEntries([...namaKonteks, "AnalyzeContextProvider"].map((nama) => [nama, []]));
  for (const path of berkasKode(src)) {
    function kunjungi(node) {
      if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name && ts.isIdentifier(node.name)
          && Object.hasOwn(definisi, node.name.text)) definisi[node.name.text].push(relative(akar, path));
      ts.forEachChild(node, kunjungi);
    }
    kunjungi(astBerkas(path));
  }
  for (const nama of namaKonteks) assert.deepEqual(definisi[nama], [pathImplementasi], nama);
  assert.deepEqual(definisi.AnalyzeContextProvider, [providerImplementasi]);
});

test("all eleven mapped application consumers and both internal providers import exact Analyze names", () => {
  const konsumen = [
    ["src/halaman/Analisa/komponen/areaKerja.jsx", pathRingan, ["TAMPILAN_ANALISA"]],
    ["src/halaman/Analisa/komponen/boardMenu/boardMenu.jsx", pathRingan, ["TAMPILAN_ANALISA"]],
    ["src/halaman/Analisa/komponen/game/game.jsx", pathRingan, ["AnalyzeContext"]],
    ["src/halaman/Analisa/komponen/game/keyboardPapan.js", pathRingan, ["TAMPILAN_ANALISA"]],
    ["src/halaman/Analisa/komponen/menu/menu.jsx", pathRingan, ["AnalyzeContext"]],
    ["src/halaman/Analisa/komponen/nav/layarAkun.jsx", pathRingan, ["AnalyzeContext"]],
    ["src/halaman/Analisa/komponen/nav/layarDeteksiEngine.jsx", pathRingan, ["AnalyzeContext"]],
    ["src/halaman/Analisa/komponen/nav/layarEngine.jsx", pathRingan, ["AnalyzeContext"]],
    ["src/halaman/Analisa/komponen/nav/layarWawasan.jsx", pathRingan, ["AnalyzeContext"]],
    ["src/halaman/Analisa/komponen/nav/nav.jsx", pathRingan, ["TAMPILAN_ANALISA"]],
    ["src/halaman/Analisa/komponen/pengaturan/mesin.jsx", pathRingan, ["AnalyzeContext"]],
    ["src/modul/sesi/BoardProvider.jsx", pathImplementasi, ["normalisasiPemain", "TAMPILAN_ANALISA"]],
    ["src/modul/sesi/TabKerjaProvider.jsx", pathImplementasi, ["TAMPILAN_ANALISA"]],
    [providerImplementasi, pathImplementasi, ["AnalyzeContext"]],
  ];
  for (const [file, entry, names] of konsumen) {
    const path = resolve(akar, file);
    const imports = astBerkas(path).statements.filter((node) =>
      ts.isImportDeclaration(node) && node.moduleSpecifier && tujuan(path, node.moduleSpecifier.text) === resolve(akar, entry));
    assert.equal(imports.length, 1, file);
    const binding = imports[0].importClause?.namedBindings;
    assert.ok(binding && ts.isNamedImports(binding), file);
    assert.deepEqual(binding.elements.map((element) => (element.propertyName ?? element.name).text).sort(), [...names].sort(), file);
  }
  const root = resolve(akar, "src/halaman/Analisa/Analisa.jsx");
  const imports = astBerkas(root).statements.filter((node) =>
    ts.isImportDeclaration(node) && node.moduleSpecifier && tujuan(root, node.moduleSpecifier.text) === resolve(akar, providerRingan));
  assert.equal(imports.length, 1);
  assert.equal(imports[0].importClause?.name?.text, "AnalyzeContextProvider");
  assert.equal(imports[0].importClause?.namedBindings, undefined);
});

test("the relocated default provider imports only the existing Board and Import entries plus its context", () => {
  const provider = resolve(akar, providerImplementasi);
  const expected = new Map([
    [resolve(modul, "analyzeKonteks.js"), ["AnalyzeContext"]],
    [resolve(modul, "papanProvider.js"), ["BoardProvider"]],
    [resolve(modul, "imporProvider.js"), ["ImportProvider"]],
    [resolve(modul, "papan.js"), ["useBoard"]],
    [resolve(modul, "impor.js"), ["useImport"]],
  ]);
  for (const node of astBerkas(provider).statements.filter(ts.isImportDeclaration)) {
    const target = tujuan(provider, node.moduleSpecifier.text);
    if (target === null) { assert.equal(node.moduleSpecifier.text, "react"); continue; }
    assert.ok(expected.has(target), `Dependensi provider tak terduga: ${target}`);
    const binding = node.importClause?.namedBindings;
    assert.ok(binding && ts.isNamedImports(binding));
    assert.deepEqual(binding.elements.map((element) => (element.propertyName ?? element.name).text).sort(), expected.get(target).slice().sort());
    expected.delete(target);
  }
  assert.equal(expected.size, 0);
});
