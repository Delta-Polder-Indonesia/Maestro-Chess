import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import * as lamaNative from "../src/halaman/Analisa/konteks/mesinKonteks.js";
import * as ringanNative from "../src/modul/sesi/mesin.js";
import * as implementasiNative from "../src/modul/sesi/mesinKonteks.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const { act } = TestRenderer;
const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(akar, "src");
const modul = resolve(src, "modul/sesi");
const ekstensi = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];
const namaKonteks = ["KonteksMesin", "useMesin"];
const pathLama = "src/halaman/Analisa/konteks/mesinKonteks.js";
const pathImplementasi = "src/modul/sesi/mesinKonteks.js";
const pathRingan = "src/modul/sesi/mesin.js";
const pathUtama = "src/modul/sesi/index.js";
const providerLama = "src/halaman/Analisa/konteks/mesin.jsx";

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
  class MesinTiruan {
    constructor(opsi) { this.opsi = opsi; }
    hancurkan() {}
    terapkanOpsi() {}
    setop() {}
  }
  return buatPemuatJsx({
    "src/lib/i18n.jsx": { useI18n: () => ({ t: (key) => key }) },
    "src/modul/pekerjaan/index.js": {
      KUNCI_FITUR: {}, ID_DRAF_IMPOR: "draf:impor", buatIdDrafImpor: () => "draf:uji",
      buatIdPekerjaan: () => "laporan:uji", pekerjaan: { snapshot: () => ({ daftar: [], aktif: { id: null } }) },
      simpanLaporanAktif: () => {},
    },
    "src/lib/engineCatur.js": { ENGINE_BAKU: "utama", cariEngine: (id) => ({ id: id === "kedua" ? "kedua" : "utama" }) },
    "src/halaman/Analisa/mesin/engine.js": { EngineAnalisis: MesinTiruan },
    "src/halaman/Analisa/mesin/cekWasm.js": { hashUntukEngine: () => 32, wasmSupported: () => true },
  });
}

test("native legacy, lightweight and implementation paths expose exactly the same context and hook", () => {
  for (const api of [lamaNative, ringanNative, implementasiNative]) assert.deepEqual(Object.keys(api).sort(), namaKonteks);
  for (const nama of namaKonteks) {
    assert.strictEqual(lamaNative[nama], ringanNative[nama], nama);
    assert.strictEqual(implementasiNative[nama], ringanNative[nama], nama);
  }
  assert.strictEqual(lamaNative.KonteksMesin.Provider, ringanNative.KonteksMesin.Provider);
  assert.strictEqual(lamaNative.KonteksMesin.Consumer, ringanNative.KonteksMesin.Consumer);
});

test("main, lightweight, implementation and legacy entries share identities without exporting the provider from Sesi", () => {
  const muat = pemuat();
  const contexts = [pathLama, pathRingan, pathImplementasi].map(muat);
  const utama = muat(pathUtama);
  const provider = muat(providerLama);
  for (const api of contexts) assert.deepEqual(Object.keys(api).sort(), namaKonteks);
  for (const nama of namaKonteks) for (const api of [...contexts, utama]) assert.strictEqual(api[nama], contexts[0][nama], nama);
  assert.deepEqual(Object.keys(provider), ["MesinProvider"]);
  assert.equal(typeof provider.MesinProvider, "function");
  assert.equal(Object.hasOwn(provider, "default"), false);
  assert.equal(Object.hasOwn(utama, "MesinProvider"), false);
});

test("mixed old and public hooks observe the original provider while mounts stay isolated", (tes) => {
  const sebelumnya = Object.fromEntries(["localStorage", "window"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: { getItem: () => null, setItem() {} } });
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: {} });
  let renderer;
  tes.after(() => {
    if (renderer) act(() => renderer.unmount());
    for (const [key, descriptor] of Object.entries(sebelumnya)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  });
  const muat = pemuat();
  const lama = muat(pathLama);
  const ringan = muat(pathRingan);
  const utama = muat(pathUtama);
  const { MesinProvider } = muat(providerLama);
  const nilai = {};
  function Probe({ id }) {
    nilai[id] = { lama: lama.useMesin(), ringan: ringan.useMesin(), utama: utama.useMesin() };
    return null;
  }
  act(() => {
    renderer = TestRenderer.create(React.createElement(React.Fragment, null,
      React.createElement(MesinProvider, null, React.createElement(Probe, { id: "satu" })),
      React.createElement(MesinProvider, null, React.createElement(Probe, { id: "dua" }))));
  });
  for (const id of ["satu", "dua"]) {
    assert.strictEqual(nilai[id].lama, nilai[id].ringan);
    assert.strictEqual(nilai[id].lama, nilai[id].utama);
  }
  assert.notStrictEqual(nilai.satu.lama, nilai.dua.lama);
  act(() => nilai.satu.ringan.gantiEngine("kedua"));
  assert.equal(nilai.satu.lama.idEngine, "kedua");
  assert.equal(nilai.satu.utama.idEngine, "kedua");
  assert.equal(nilai.dua.ringan.idEngine, "utama");
  assert.notStrictEqual(nilai.satu.lama.ambilMesin(), nilai.dua.lama.ambilMesin());
});

test("legacy and lightweight files directly re-export only the original two names", () => {
  for (const file of [pathLama, pathRingan]) {
    const path = resolve(akar, file);
    const statements = astBerkas(path).statements;
    assert.equal(statements.length, 1, file);
    const declaration = statements[0];
    assert.ok(ts.isExportDeclaration(declaration), file);
    assert.equal(tujuan(path, declaration.moduleSpecifier.text), resolve(akar, pathImplementasi), file);
    assert.ok(declaration.exportClause && ts.isNamedExports(declaration.exportClause), file);
    assert.deepEqual(declaration.exportClause.elements.map((element) => element.name.text).sort(), namaKonteks, file);
  }
});

test("the context entry and legacy path load only the implementation and React, without JSX or engine code", () => {
  for (const awal of [pathRingan, pathLama]) {
    const hasil = grafDari(awal);
    assert.deepEqual(hasil.files, [awal, pathImplementasi].sort(), awal);
    assert.deepEqual(hasil.paket, ["react"], awal);
    assert.ok(hasil.files.every((file) => extname(file) === ".js"), awal);
  }
});

test("the session barrel does not import the engine provider or legacy engine implementation", () => {
  const hasil = grafDari(pathUtama);
  assert.ok(hasil.files.includes(pathRingan));
  assert.ok(hasil.files.includes(pathImplementasi));
  assert.equal(hasil.files.includes(providerLama), false);
  assert.equal(hasil.files.includes("src/lib/engineCatur.js"), false);
  assert.equal(hasil.files.some((file) => file.startsWith("src/halaman/Analisa/mesin/")), false);
});

test("engine context, hook and legacy provider each have exactly one source definition", () => {
  const definisi = Object.fromEntries([...namaKonteks, "MesinProvider"].map((nama) => [nama, []]));
  for (const path of berkasKode(src)) {
    function kunjungi(node) {
      if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name && ts.isIdentifier(node.name)
          && Object.hasOwn(definisi, node.name.text)) definisi[node.name.text].push(relative(akar, path));
      ts.forEachChild(node, kunjungi);
    }
    kunjungi(astBerkas(path));
  }
  for (const nama of namaKonteks) assert.deepEqual(definisi[nama], [pathImplementasi], nama);
  assert.deepEqual(definisi.MesinProvider, [providerLama]);
});

test("the five mapped components and original provider use the lightweight public entry", () => {
  const konsumen = [
    ["src/halaman/Analisa/komponen/game/game.jsx", ["useMesin"]],
    ["src/halaman/Analisa/komponen/menu/loading/loading.jsx", ["useMesin"]],
    ["src/halaman/Analisa/komponen/nav/layarDeteksiEngine.jsx", ["useMesin"]],
    ["src/halaman/Analisa/komponen/nav/layarEngine.jsx", ["useMesin"]],
    ["src/halaman/Analisa/komponen/pengaturan/mesin.jsx", ["useMesin"]],
    [providerLama, ["KonteksMesin"]],
  ];
  for (const [file, names] of konsumen) {
    const path = resolve(akar, file);
    const imports = astBerkas(path).statements.filter((node) =>
      ts.isImportDeclaration(node) && node.moduleSpecifier && tujuan(path, node.moduleSpecifier.text) === resolve(akar, pathRingan));
    assert.equal(imports.length, 1, file);
    const binding = imports[0].importClause?.namedBindings;
    assert.ok(binding && ts.isNamedImports(binding), file);
    assert.deepEqual(binding.elements.map((element) => (element.propertyName ?? element.name).text).sort(), [...names].sort(), file);
  }
});

test("the provider stays at its old path and keeps only its previously mapped dependencies", () => {
  const provider = resolve(akar, providerLama);
  const expected = new Map([
    [resolve(akar, "src/lib/engineCatur.js"), ["ENGINE_BAKU", "cariEngine"]],
    [resolve(akar, "src/halaman/Analisa/mesin/engine.js"), ["EngineAnalisis"]],
    [resolve(akar, "src/halaman/Analisa/mesin/cekWasm.js"), ["hashUntukEngine", "wasmSupported"]],
    [resolve(modul, "preferensi.js"), ["bacaAngka", "bacaTeks", "tulis"]],
    [resolve(modul, "mesin.js"), ["KonteksMesin"]],
  ]);
  let react = 0;
  for (const node of astBerkas(provider).statements.filter(ts.isImportDeclaration)) {
    const target = tujuan(provider, node.moduleSpecifier.text);
    if (target === null) { assert.equal(node.moduleSpecifier.text, "react"); react++; continue; }
    assert.ok(expected.has(target), `Dependensi provider tak terduga: ${target}`);
    const binding = node.importClause?.namedBindings;
    assert.ok(binding && ts.isNamedImports(binding));
    assert.deepEqual(binding.elements.map((element) => (element.propertyName ?? element.name).text).sort(), expected.get(target).slice().sort());
    expected.delete(target);
  }
  assert.equal(react, 1);
  assert.equal(expected.size, 0);
  const root = resolve(akar, "src/halaman/Analisa/Analisa.jsx");
  const imports = astBerkas(root).statements.filter((node) =>
    ts.isImportDeclaration(node) && node.moduleSpecifier && tujuan(root, node.moduleSpecifier.text) === provider);
  assert.equal(imports.length, 1);
  const binding = imports[0].importClause?.namedBindings;
  assert.ok(binding && ts.isNamedImports(binding));
  assert.deepEqual(binding.elements.map((element) => (element.propertyName ?? element.name).text), ["MesinProvider"]);
});
