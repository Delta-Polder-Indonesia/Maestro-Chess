import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import * as galatLama from "../src/halaman/Analisa/komponen/errors/pushPageError.js";
import * as konteksLama from "../src/halaman/Analisa/konteks/errorsKonteks.js";
import * as titipanLama from "../src/lib/titipanAnalisa.js";
import * as galat from "../src/modul/sesi/galat.js";
import * as titipan from "../src/modul/sesi/titipan.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(akar, "src");
const modul = resolve(src, "modul/sesi");
const ekstensi = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];
const namaGalat = ["ErrorsContext", "pushPageError", "pushPageWarning"];
const namaTitipan = ["KUNCI_PGN_TITIPAN", "adaPgnTitipan", "ambilPgnTitipan"];

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
      else {
        assert.ok(target.startsWith(modul + sep), `Keluar dari Sesi: ${relative(akar, path)} -> ${relative(akar, target)}`);
        antrean.push(target);
      }
    }
  }
  return { files: [...diperiksa].map((path) => relative(akar, path)).sort(), paket: [...paket].sort() };
}

test("native Node light facades and old paths expose the same error, context and handoff identities", () => {
  assert.deepEqual(Object.keys(galat).sort(), [...namaGalat].sort());
  assert.deepEqual(Object.keys(titipan).sort(), [...namaTitipan].sort());
  assert.deepEqual(Object.keys(galatLama).sort(), ["pushPageError", "pushPageWarning"]);
  assert.deepEqual(Object.keys(konteksLama), ["ErrorsContext"]);
  assert.deepEqual(Object.keys(titipanLama).sort(), [...namaTitipan].sort());
  for (const nama of ["pushPageError", "pushPageWarning"]) assert.strictEqual(galatLama[nama], galat[nama], nama);
  assert.strictEqual(konteksLama.ErrorsContext, galat.ErrorsContext);
  for (const nama of namaTitipan) assert.strictEqual(titipanLama[nama], titipan[nama], nama);
  assert.equal(titipan.KUNCI_PGN_TITIPAN, "maestro-analisa-impor-awal");
});

test("alternating legacy and facade helpers uses one counter, including deferred updaters", async () => {
  let daftar = [];
  const setErrors = (updater) => { daftar = updater(daftar); };
  await galatLama.pushPageError(setErrors, "lama", "");
  await galat.pushPageWarning(setErrors, "baru", "");
  await galatLama.pushPageError(setErrors, "lama lagi", "");
  const pertama = daftar[0].errorKey;
  assert.deepEqual(daftar.map((item) => item.errorKey), [pertama, pertama + 1, pertama + 2]);
  const tertunda = [];
  await galatLama.pushPageError((updater) => tertunda.push(updater), "tertunda lama", "");
  await galat.pushPageWarning((updater) => tertunda.push(updater), "tertunda baru", "");
  const hasil = tertunda[1](tertunda[0]([]));
  assert.deepEqual(hasil.map((item) => item.errorKey), [pertama + 4, pertama + 4]);
});

test("legacy, lightweight and main facades use the same provider and context in one module registry", async (tes) => {
  // Node tidak mendukung JSX native. Registry transpile ini menyimpan cache
  // tiap modul, sehingga identitas dapat dibandingkan dalam registry yang sama.
  const muat = buatPemuatJsx({
    "src/modul/pekerjaan/index.js": { KUNCI_FITUR: {}, ID_DRAF_IMPOR: "draf:impor", pekerjaan: {}, buatIdDrafImpor: () => "draf:uji" },
  });
  const utama = muat("src/modul/sesi/index.js");
  const ringan = muat("src/modul/sesi/galat.js");
  const ringanTitipan = muat("src/modul/sesi/titipan.js");
  const lamaProvider = muat("src/halaman/Analisa/konteks/errors.jsx");
  const lamaContext = muat("src/halaman/Analisa/konteks/errorsKonteks.js");
  const lamaHelper = muat("src/halaman/Analisa/komponen/errors/pushPageError.js");
  const lamaTitipan = muat("src/lib/titipanAnalisa.js");
  assert.deepEqual(Object.keys(lamaProvider), ["default"]);
  assert.strictEqual(lamaProvider.default, utama.ErrorsContextProvider);
  for (const nama of namaGalat) assert.strictEqual(utama[nama], ringan[nama], nama);
  for (const nama of namaTitipan) {
    assert.strictEqual(utama[nama], ringanTitipan[nama], nama);
    assert.strictEqual(lamaTitipan[nama], ringanTitipan[nama], nama);
  }
  assert.strictEqual(lamaContext.ErrorsContext, ringan.ErrorsContext);
  assert.strictEqual(lamaHelper.pushPageError, ringan.pushPageError);
  assert.strictEqual(lamaHelper.pushPageWarning, ringan.pushPageWarning);

  let lewatLama;
  let lewatUtama;
  let lewatRingan;
  function Probe() {
    lewatLama = React.useContext(lamaContext.ErrorsContext);
    lewatUtama = React.useContext(utama.ErrorsContext);
    lewatRingan = React.useContext(ringan.ErrorsContext);
    return null;
  }
  let renderer;
  tes.after(() => { if (renderer) act(() => renderer.unmount()); });
  await act(async () => { renderer = TestRenderer.create(React.createElement(lamaProvider.default, null, React.createElement(Probe))); await flush(); });
  assert.strictEqual(lewatLama, lewatUtama);
  assert.strictEqual(lewatUtama, lewatRingan);
  await act(async () => { await utama.pushPageWarning(lewatLama.errors[1], "lama ke baru", ""); await flush(); });
  assert.equal(lewatRingan.errors[0][0].title, "lama ke baru");
  const kunci = lewatRingan.errors[0][0].errorKey;
  await act(async () => { renderer.unmount(); renderer = TestRenderer.create(React.createElement(utama.ErrorsContextProvider, null, React.createElement(Probe))); await flush(); });
  assert.strictEqual(lewatLama, lewatUtama);
  assert.strictEqual(lewatUtama, lewatRingan);
  assert.deepEqual(lewatLama.errors[0], []);
  await act(async () => { await lamaHelper.pushPageError(lewatUtama.errors[1], "baru ke lama", ""); await flush(); });
  assert.equal(lewatLama.errors[0][0].title, "baru ke lama");
  assert.equal(lewatLama.errors[0][0].errorKey, kunci + 1);
});

test("a PGN deposited under the same key can be checked and consumed through either path", (tes) => {
  const lama = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const data = new Map();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, writable: true, value: {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, nilai) => data.set(key, String(nilai)),
    removeItem: (key) => data.delete(key),
  } });
  tes.after(() => {
    if (lama) Object.defineProperty(globalThis, "sessionStorage", lama);
    else delete globalThis.sessionStorage;
  });
  sessionStorage.setItem(titipan.KUNCI_PGN_TITIPAN, "[Event \"satu\"]\n\n1. e4 *\n");
  assert.equal(titipan.adaPgnTitipan(), true);
  assert.equal(titipanLama.ambilPgnTitipan(), "[Event \"satu\"]\n\n1. e4 *\n");
  assert.equal(titipan.ambilPgnTitipan(), "");
  sessionStorage.setItem(titipanLama.KUNCI_PGN_TITIPAN, "1. d4 *");
  assert.equal(titipanLama.adaPgnTitipan(), true);
  assert.equal(titipan.ambilPgnTitipan(), "1. d4 *");
  assert.equal(titipanLama.adaPgnTitipan(), false);
});

test("the four old paths are single direct re-exports of the relocated implementations", () => {
  const paths = [
    ["src/halaman/Analisa/komponen/errors/pushPageError.js", "src/modul/sesi/pushPageError.js"],
    ["src/halaman/Analisa/konteks/errorsKonteks.js", "src/modul/sesi/errorsKonteks.js"],
    ["src/halaman/Analisa/konteks/errors.jsx", "src/modul/sesi/ErrorsContextProvider.jsx"],
    ["src/lib/titipanAnalisa.js", "src/modul/sesi/titipanAnalisa.js"],
  ];
  for (const [file, target] of paths) {
    const path = resolve(akar, file);
    const statements = astBerkas(path).statements;
    assert.equal(statements.length, 1, file);
    assert.ok(ts.isExportDeclaration(statements[0]), file);
    assert.equal(tujuan(path, statements[0].moduleSpecifier.text), resolve(akar, target), file);
  }
});

test("light facades and legacy shims load only their own implementations, without unrelated modules", () => {
  const graph = [
    ["src/modul/sesi/galat.js", ["src/modul/sesi/errorsKonteks.js", "src/modul/sesi/pushPageError.js"], ["react"]],
    ["src/modul/sesi/titipan.js", ["src/modul/sesi/titipanAnalisa.js"], []],
    ["src/halaman/Analisa/komponen/errors/pushPageError.js", ["src/modul/sesi/pushPageError.js"], []],
    ["src/halaman/Analisa/konteks/errorsKonteks.js", ["src/modul/sesi/errorsKonteks.js"], ["react"]],
    ["src/halaman/Analisa/konteks/errors.jsx", ["src/modul/sesi/ErrorsContextProvider.jsx", "src/modul/sesi/errorsKonteks.js"], ["react"]],
    ["src/lib/titipanAnalisa.js", ["src/modul/sesi/titipanAnalisa.js"], []],
  ];
  for (const [awal, internal, paket] of graph) {
    const hasil = grafDari(awal);
    assert.deepEqual(hasil.files, [awal, ...internal].sort(), awal);
    assert.deepEqual(hasil.paket, paket, awal);
    if (awal === "src/modul/sesi/galat.js" || awal === "src/modul/sesi/titipan.js") {
      assert.ok(hasil.files.every((file) => extname(file) === ".js"), `Fasad memuat JSX: ${awal}`);
    }
  }
  assert.equal(typeof buatPemuatJsx()("src/halaman/Analisa/konteks/errors.jsx").default, "function");
});

test("the PGN storage key, ErrorsContext and shared key counter each have one definition", () => {
  const definisi = { errorKey: [], ErrorsContext: [], KUNCI_PGN_TITIPAN: [] };
  const pemilikKunci = [];
  for (const path of berkasKode(src)) {
    if (readFileSync(path, "utf8").includes('"maestro-analisa-impor-awal"')) pemilikKunci.push(relative(akar, path));
    function kunjungi(node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && Object.hasOwn(definisi, node.name.text)) {
        definisi[node.name.text].push(relative(akar, path));
      }
      ts.forEachChild(node, kunjungi);
    }
    kunjungi(astBerkas(path));
  }
  assert.deepEqual(pemilikKunci, ["src/modul/sesi/titipanAnalisa.js"]);
  assert.deepEqual(definisi, {
    errorKey: ["src/modul/sesi/pushPageError.js"],
    ErrorsContext: ["src/modul/sesi/errorsKonteks.js"],
    KUNCI_PGN_TITIPAN: ["src/modul/sesi/titipanAnalisa.js"],
  });
});

test("all ten mapped callers import their required names from the correct public facade or module-internal implementation", () => {
  const konsumen = [
    ["src/halaman/Analisa/Analisa.jsx", "src/modul/sesi/index.js", ["ErrorsContextProvider"]],
    ["src/halaman/Analisa/komponen/areaKerja.jsx", "src/modul/sesi/galat.js", ["ErrorsContext", "pushPageError", "pushPageWarning"]],
    ["src/halaman/Analisa/komponen/areaKerja.jsx", "src/modul/sesi/titipan.js", ["ambilPgnTitipan"]],
    ["src/halaman/Analisa/komponen/errors/pageErrors.jsx", "src/modul/sesi/galat.js", ["ErrorsContext"]],
    ["src/halaman/Analisa/komponen/game/game.jsx", "src/modul/sesi/galat.js", ["ErrorsContext", "pushPageWarning"]],
    ["src/halaman/Analisa/komponen/game/useAnalisisPapan.js", "src/modul/sesi/galat.js", ["pushPageError"]],
    ["src/halaman/Analisa/komponen/game/useMuatPartai.js", "src/modul/sesi/galat.js", ["pushPageError", "pushPageWarning"]],
    ["src/halaman/Analisa/komponen/game/useMuatPartai.js", "src/modul/sesi/titipan.js", ["adaPgnTitipan"]],
    ["src/halaman/Analisa/komponen/nav/layarAkun.jsx", "src/modul/sesi/galat.js", ["ErrorsContext", "pushPageWarning"]],
    ["src/halaman/Analisa/komponen/nav/layarImpor.jsx", "src/modul/sesi/galat.js", ["ErrorsContext", "pushPageWarning"]],
    ["src/modul/sesi/ImportProvider.jsx", "src/modul/sesi/titipanAnalisa.js", ["adaPgnTitipan"]],
    ["src/modul/sesi/TabKerjaProvider.jsx", "src/modul/sesi/titipanAnalisa.js", ["adaPgnTitipan"]],
  ];
  assert.equal(new Set(konsumen.map(([file]) => file)).size, 10);
  for (const [file, entry, names] of konsumen) {
    const path = resolve(akar, file);
    const imports = astBerkas(path).statements.filter((node) =>
      ts.isImportDeclaration(node) && node.moduleSpecifier && tujuan(path, node.moduleSpecifier.text) === resolve(akar, entry));
    assert.equal(imports.length, 1, `${file} -> ${entry}`);
    const binding = imports[0].importClause?.namedBindings;
    assert.ok(binding && ts.isNamedImports(binding), file);
    const aktual = binding.elements.map((element) => (element.propertyName ?? element.name).text);
    for (const nama of names) assert.ok(aktual.includes(nama), `${file}: ${nama}`);
  }
});
