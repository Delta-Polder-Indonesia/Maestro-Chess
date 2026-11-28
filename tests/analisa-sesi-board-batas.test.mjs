import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import * as lamaNative from "../src/halaman/Analisa/konteks/boardKonteks.js";
import * as ringanNative from "../src/modul/sesi/papan.js";
import * as implementasiNative from "../src/modul/sesi/boardKonteks.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const { act } = TestRenderer;
const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(akar, "src");
const modul = resolve(src, "modul/sesi");
const ekstensi = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];
const namaKonteks = ["BoardContext", "SetTampilanContext", "TampilanContext", "useBoard", "useSetTampilan", "useTampilan"].sort();
const namaProvider = ["BoardProvider"];
const pathLama = "src/halaman/Analisa/konteks/boardKonteks.js";
const providerLama = "src/halaman/Analisa/konteks/board.jsx";
const pathImplementasi = "src/modul/sesi/boardKonteks.js";
const providerImplementasi = "src/modul/sesi/BoardProvider.jsx";
const pathRingan = "src/modul/sesi/papan.js";
const providerRingan = "src/modul/sesi/papanProvider.js";
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
  return buatPemuatJsx({
    "src/lib/i18n.jsx": { useI18n: () => ({ t: (key) => `uji:${key}` }) },
    "src/modul/pekerjaan/index.js": {
      KUNCI_FITUR: {}, ID_DRAF_IMPOR: "draf:impor", buatIdDrafImpor: () => "draf:uji",
      buatIdPekerjaan: () => "laporan:uji", pekerjaan: { snapshot: () => ({ daftar: [], aktif: { id: null } }) },
      simpanLaporanAktif: () => {},
    },
  });
}

test("native board context paths expose exactly six original names with identical identities", () => {
  for (const api of [lamaNative, ringanNative, implementasiNative]) assert.deepEqual(Object.keys(api).sort(), namaKonteks);
  for (const nama of namaKonteks) {
    assert.strictEqual(lamaNative[nama], ringanNative[nama], nama);
    assert.strictEqual(implementasiNative[nama], ringanNative[nama], nama);
  }
  for (const nama of ["BoardContext", "TampilanContext", "SetTampilanContext"]) {
    assert.strictEqual(lamaNative[nama].Provider, ringanNative[nama].Provider, nama);
    assert.strictEqual(lamaNative[nama].Consumer, ringanNative[nama].Consumer, nama);
  }
});

test("the main facade, light entries, implementations and compatibility paths share all seven board identities", () => {
  const muat = pemuat();
  const konteks = [pathLama, pathRingan, pathImplementasi].map(muat);
  const providers = [providerLama, providerRingan, providerImplementasi].map(muat);
  const utama = muat(pathUtama);
  for (const api of konteks) assert.deepEqual(Object.keys(api).sort(), namaKonteks);
  for (const api of providers) assert.deepEqual(Object.keys(api), namaProvider);
  for (const nama of namaKonteks) {
    for (const api of [...konteks, utama]) assert.strictEqual(api[nama], konteks[0][nama], nama);
  }
  for (const api of [...providers, utama]) assert.strictEqual(api.BoardProvider, providers[0].BoardProvider);
});

test("legacy and public hooks read and update the same provider while separate provider instances stay isolated", (tes) => {
  const sebelumnya = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: { getItem: () => null } });
  let renderer;
  tes.after(() => {
    if (renderer) act(() => renderer.unmount());
    if (sebelumnya) Object.defineProperty(globalThis, "localStorage", sebelumnya);
    else delete globalThis.localStorage;
  });
  const muat = pemuat();
  const lama = muat(pathLama);
  const ringan = muat(pathRingan);
  const utama = muat(pathUtama);
  const ProviderLama = muat(providerLama).BoardProvider;
  const ProviderPublik = muat(providerRingan).BoardProvider;
  const nilai = {};
  function Probe({ id }) {
    nilai[id] = {
      lamaBoard: lama.useBoard(), publikBoard: ringan.useBoard(), utamaBoard: utama.useBoard(),
      lamaTampilan: lama.useTampilan(), publikTampilan: ringan.useTampilan(),
      lamaSetter: lama.useSetTampilan(), utamaSetter: utama.useSetTampilan(),
      langsung: React.useContext(utama.BoardContext),
    };
    return null;
  }
  act(() => {
    renderer = TestRenderer.create(React.createElement(React.Fragment, null,
      React.createElement(ProviderLama, null, React.createElement(Probe, { id: "lama" })),
      React.createElement(ProviderPublik, null, React.createElement(Probe, { id: "publik" }))));
  });
  for (const id of ["lama", "publik"]) {
    assert.strictEqual(nilai[id].lamaBoard, nilai[id].publikBoard);
    assert.strictEqual(nilai[id].lamaBoard, nilai[id].utamaBoard);
    assert.strictEqual(nilai[id].lamaBoard, nilai[id].langsung);
    assert.equal(nilai[id].lamaTampilan[0], nilai[id].publikTampilan[0]);
    assert.strictEqual(nilai[id].lamaTampilan[1], nilai[id].publikTampilan[1]);
    assert.strictEqual(nilai[id].lamaSetter, nilai[id].utamaSetter);
    assert.strictEqual(nilai[id].lamaSetter, nilai[id].lamaTampilan[1]);
  }
  assert.notStrictEqual(nilai.lama.lamaBoard, nilai.publik.lamaBoard);
  assert.notStrictEqual(nilai.lama.lamaBoard.gameController, nilai.publik.lamaBoard.gameController);
  act(() => { nilai.lama.publikBoard.moveNumber[1](7); nilai.lama.utamaSetter("pengaturan"); });
  assert.equal(nilai.lama.lamaBoard.moveNumber[0], 7);
  assert.equal(nilai.lama.lamaTampilan[0], "pengaturan");
  assert.equal(nilai.publik.utamaBoard.moveNumber[0], 0);
  assert.equal(nilai.publik.publikTampilan[0], "papan");
  act(() => { nilai.publik.lamaBoard.white[1](false); nilai.publik.lamaSetter("bermain"); });
  assert.equal(nilai.publik.utamaBoard.white[0], false);
  assert.equal(nilai.publik.publikTampilan[0], "bermain");
  assert.equal(nilai.lama.lamaBoard.white[0], true);
  assert.equal(nilai.lama.lamaTampilan[0], "pengaturan");
});

test("old board paths are direct named re-exports of exactly their original APIs", () => {
  for (const [file, target, names] of [
    [pathLama, pathImplementasi, namaKonteks], [providerLama, providerImplementasi, namaProvider],
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

test("the light context facade and old context path only load the implementation and React, without JSX or Pekerjaan", () => {
  for (const awal of [pathRingan, pathLama]) {
    const hasil = grafDari(awal);
    assert.deepEqual(hasil.files, [awal, pathImplementasi].sort(), awal);
    assert.deepEqual(hasil.paket, ["react"], awal);
    assert.ok(hasil.files.every((file) => extname(file) === ".js"), awal);
  }
});

test("the provider entry and legacy provider load only the documented closure, not the heavy facade or Pekerjaan", () => {
  const internal = [
    "src/modul/sesi/analyzeKonteks.js", "src/lib/i18n.jsx",
    "src/lib/terjemahan/en/analisa.js", "src/lib/terjemahan/id/analisa.js",
    "src/lib/terjemahan/en/tekaTeki.js", "src/lib/terjemahan/id/tekaTeki.js",
    providerImplementasi, pathImplementasi, "src/modul/sesi/boardThemes.js", "src/modul/sesi/configKonteks.js",
    "src/modul/sesi/penyimpanan.js", "src/modul/sesi/preferensi.js",
  ];
  for (const awal of [providerRingan, providerLama]) {
    const hasil = grafDari(awal);
    assert.deepEqual(hasil.files, [awal, ...internal].sort(), awal);
    assert.deepEqual(hasil.paket, ["react"], awal);
    assert.equal(hasil.files.some((file) => file.startsWith("src/modul/pekerjaan/")), false);
    assert.equal(hasil.files.includes(pathUtama), false);
  }
});

test("each board context, hook and provider has exactly one source definition", () => {
  const definisi = Object.fromEntries([...namaKonteks, ...namaProvider].map((nama) => [nama, []]));
  for (const path of berkasKode(src)) {
    function kunjungi(node) {
      if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name && ts.isIdentifier(node.name)
          && Object.hasOwn(definisi, node.name.text)) definisi[node.name.text].push(relative(akar, path));
      ts.forEachChild(node, kunjungi);
    }
    kunjungi(astBerkas(path));
  }
  for (const nama of namaKonteks) assert.deepEqual(definisi[nama], [pathImplementasi], nama);
  assert.deepEqual(definisi.BoardProvider, [providerImplementasi]);
});

test("five application consumers and the relocated Analyze provider use the correct lightweight Board entries", () => {
  const konsumen = [
    ["src/halaman/Analisa/komponen/areaKerja.jsx", pathRingan, ["useSetTampilan", "useTampilan"]],
    ["src/halaman/Analisa/komponen/boardMenu/boardMenu.jsx", pathRingan, ["useBoard", "useSetTampilan"]],
    ["src/halaman/Analisa/komponen/game/pendengarKeyboard.jsx", pathRingan, ["useTampilan"]],
    ["src/halaman/Analisa/komponen/menu/analysis/gameButtons.jsx", pathRingan, ["useBoard"]],
    ["src/halaman/Analisa/komponen/nav/nav.jsx", pathRingan, ["useTampilan"]],
    ["src/modul/sesi/AnalyzeContextProvider.jsx", pathRingan, ["useBoard"]],
    ["src/modul/sesi/AnalyzeContextProvider.jsx", providerRingan, ["BoardProvider"]],
    ["src/modul/sesi/TabKerjaProvider.jsx", pathImplementasi, ["useTampilan"]],
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
  // Assert the provider's mapped dependencies, including Analyze now internal to Sesi.
  const provider = resolve(akar, providerImplementasi);
  const expected = new Map([
    [resolve(akar, "src/lib/i18n.jsx"), ["useI18n"]],
    [resolve(modul, "preferensi.js"), ["bacaAngka"]],
    [resolve(modul, "analyzeKonteks.js"), ["normalisasiPemain", "TAMPILAN_ANALISA"]],
    [resolve(modul, "boardKonteks.js"), ["BoardContext", "SetTampilanContext", "TampilanContext"]],
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
