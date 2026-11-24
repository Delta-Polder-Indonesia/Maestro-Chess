import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import * as lamaStorage from "../src/halaman/Analisa/penyimpanan.js";
import * as lamaTema from "../src/halaman/Analisa/komponen/pengaturan/boardThemes.js";
import * as lamaContext from "../src/halaman/Analisa/konteks/configKonteks.js";
import * as preferensi from "../src/modul/sesi/preferensi.js";
import { bacaDaftarAkun, hapusDariDaftar, tambahKeDaftar } from "../src/halaman/Analisa/akun/daftarAkun.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(akar, "src");
const modul = resolve(src, "modul/sesi");
const api = resolve(modul, "index.js");
const apiMurni = resolve(modul, "preferensi.js");
const ekstensi = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];
const eksporStorage = ["bacaAngka", "bacaBoolean", "bacaTeks", "cobaBacaTeks", "tulis", "tulisBoolean"];
const eksporTema = ["boardThemes"];
const eksporContext = ["ConfigContext", "defaultUsedRatings"];

function berkasKode(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entri) => {
    const path = resolve(dir, entri.name);
    if (entri.isDirectory()) return berkasKode(path);
    return entri.isFile() && ekstensi.includes(extname(path)) ? [path] : [];
  });
}

function referensi(path) {
  const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
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
  kunjungi(ast);
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

function pasangStorage(tes, awal = []) {
  const lama = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const data = new Map(awal);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, nilai) => data.set(key, String(nilai)),
  } });
  tes.after(() => {
    if (lama) Object.defineProperty(globalThis, "localStorage", lama);
    else delete globalThis.localStorage;
  });
  return data;
}

function muatDenganPekerjaanTiruan() {
  return buatPemuatJsx({
    "src/modul/pekerjaan/index.js": { KUNCI_FITUR: {}, ID_DRAF_IMPOR: "draf:impor", pekerjaan: {}, buatIdDrafImpor: () => "draf:uji" },
  });
}

test("the JSX-free facade and each legacy path preserve their original named subsets and identities", () => {
  assert.deepEqual(Object.keys(preferensi).sort(), [...eksporStorage, ...eksporTema, ...eksporContext].sort());
  for (const [lama, daftar] of [[lamaStorage, eksporStorage], [lamaTema, eksporTema], [lamaContext, eksporContext]]) {
    assert.deepEqual(Object.keys(lama).sort(), [...daftar].sort());
    for (const nama of daftar) assert.strictEqual(lama[nama], preferensi[nama], nama);
  }
  assert.strictEqual(lamaTema.boardThemes, preferensi.boardThemes);
  assert.strictEqual(lamaContext.defaultUsedRatings, preferensi.defaultUsedRatings);
  assert.strictEqual(lamaContext.ConfigContext, preferensi.ConfigContext);
});

test("native Node account consumers share storage with the compatibility and pure facade paths", (tes) => {
  const data = pasangStorage(tes);
  assert.equal(lamaStorage.tulis("daftar-akun", JSON.stringify([{ platform: "chessCom", username: "Alice" }])), true);
  assert.deepEqual(bacaDaftarAkun(), [{ platform: "chessCom", username: "Alice" }]);
  assert.deepEqual(tambahKeDaftar({ platform: "lichessOrg", username: "Bob" }), [
    { platform: "chessCom", username: "Alice" }, { platform: "lichessOrg", username: "Bob" },
  ]);
  assert.deepEqual(hapusDariDaftar("chessCom", "ALICE"), { tersimpan: true, daftar: [{ platform: "lichessOrg", username: "Bob" }] });
  assert.equal(preferensi.cobaBacaTeks("daftar-akun").nilai, data.get("maestro-analisa-daftar-akun"));
});

test("legacy and facade providers share one ConfigContext while preserving the default export", async (tes) => {
  pasangStorage(tes, [["maestro-analisa-boardTheme", "3"]]);
  // Node tidak memuat JSX secara native: pengujian ini memakai registry yang
  // meng-cache hasil transpile, seperti pengujian provider Sesi sebelumnya.
  const muat = muatDenganPekerjaanTiruan();
  const fasad = muat("src/modul/sesi/index.js");
  const murni = muat("src/modul/sesi/preferensi.js");
  const providerLama = muat("src/halaman/Analisa/konteks/config.jsx");
  const konteksLama = muat("src/halaman/Analisa/konteks/configKonteks.js");
  const temaLama = muat("src/halaman/Analisa/komponen/pengaturan/boardThemes.js");
  assert.deepEqual(Object.keys(providerLama), ["default"]);
  assert.strictEqual(providerLama.default, fasad.ConfigContextProvider);
  for (const nama of [...eksporStorage, ...eksporTema, ...eksporContext]) assert.strictEqual(fasad[nama], murni[nama], nama);
  assert.strictEqual(konteksLama.ConfigContext, murni.ConfigContext);
  assert.strictEqual(temaLama.boardThemes, murni.boardThemes);

  let lewatLama;
  let lewatFasad;
  function Probe() {
    lewatLama = React.useContext(konteksLama.ConfigContext);
    lewatFasad = React.useContext(fasad.ConfigContext);
    return null;
  }
  let renderer;
  tes.after(() => { if (renderer) act(() => renderer.unmount()); });
  await act(async () => { renderer = TestRenderer.create(React.createElement(providerLama.default, null, React.createElement(Probe))); await flush(); });
  assert.strictEqual(lewatLama, lewatFasad);
  assert.equal(lewatFasad.boardTheme[0], 3);
  await act(async () => { lewatFasad.boardTheme[1](5); await flush(); });
  assert.strictEqual(lewatLama, lewatFasad);
  assert.equal(lewatLama.boardTheme[0], 5);
  await act(async () => { renderer.unmount(); renderer = TestRenderer.create(React.createElement(fasad.ConfigContextProvider, null, React.createElement(Probe))); await flush(); });
  assert.strictEqual(lewatLama, lewatFasad);
  assert.equal(lewatLama.boardTheme[0], 3);
});

test("all four old files are only re-exports to their single migrated implementations", () => {
  const paths = [
    ["src/halaman/Analisa/penyimpanan.js", resolve(modul, "penyimpanan.js")],
    ["src/halaman/Analisa/komponen/pengaturan/boardThemes.js", resolve(modul, "boardThemes.js")],
    ["src/halaman/Analisa/konteks/configKonteks.js", resolve(modul, "configKonteks.js")],
    ["src/halaman/Analisa/konteks/config.jsx", resolve(modul, "ConfigContextProvider.jsx")],
  ];
  for (const [file, expected] of paths) {
    const path = resolve(akar, file);
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
    assert.equal(ast.statements.length, 1, file);
    assert.ok(ts.isExportDeclaration(ast.statements[0]), file);
    assert.equal(tujuan(path, ast.statements[0].moduleSpecifier.text), expected, file);
  }
});

test("legacy preference paths do not pull in unrelated modules or extra packages", () => {
  const pasangan = [
    ["src/halaman/Analisa/penyimpanan.js", ["src/modul/sesi/penyimpanan.js"], []],
    ["src/halaman/Analisa/komponen/pengaturan/boardThemes.js", ["src/modul/sesi/boardThemes.js"], []],
    ["src/halaman/Analisa/konteks/configKonteks.js", ["src/modul/sesi/configKonteks.js"], ["react"]],
    ["src/halaman/Analisa/konteks/config.jsx", [
      "src/modul/sesi/ConfigContextProvider.jsx", "src/modul/sesi/configKonteks.js",
      "src/modul/sesi/penyimpanan.js", "src/modul/sesi/boardThemes.js",
    ], ["react"]],
  ];
  for (const [awal, internal, dependencies] of pasangan) {
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
    assert.deepEqual([...diperiksa].map((path) => relative(akar, path)).sort(), [awal, ...internal].sort(), awal);
    assert.deepEqual([...paket].sort(), dependencies, awal);
  }
  // Memuat provider kompatibilitas tidak memerlukan tiruan Pekerjaan/Tab Kerja.
  const muat = buatPemuatJsx();
  assert.equal(typeof muat("src/halaman/Analisa/konteks/config.jsx").default, "function");
});

test("the pure facade has no JSX or outgoing feature imports, and the preference prefix has one definition", () => {
  const antrean = [apiMurni];
  const diperiksa = new Set();
  const paket = new Set();
  while (antrean.length) {
    const path = antrean.shift();
    if (diperiksa.has(path)) continue;
    diperiksa.add(path);
    assert.equal(extname(path), ".js", `Fasad murni memuat JSX: ${relative(akar, path)}`);
    for (const ref of referensi(path)) {
      const target = tujuan(path, ref);
      if (target === null) paket.add(ref);
      else {
        assert.ok(target.startsWith(modul + sep), `Fasad murni keluar dari modul: ${relative(akar, path)} -> ${relative(akar, target)}`);
        antrean.push(target);
      }
    }
  }
  assert.deepEqual([...paket], ["react"]);
  assert.deepEqual([...diperiksa].map((path) => relative(akar, path)).sort(), [
    "src/modul/sesi/preferensi.js", "src/modul/sesi/penyimpanan.js", "src/modul/sesi/boardThemes.js", "src/modul/sesi/configKonteks.js",
  ].sort());
  const definisi = berkasKode(src).filter((path) => readFileSync(path, "utf8").includes('const AWALAN = "maestro-analisa-";'));
  assert.deepEqual(definisi.map((path) => relative(akar, path)), ["src/modul/sesi/penyimpanan.js"]);
});

test("all fifteen mapped application consumers use the correct facade exports", () => {
  const konsumen = new Map([
    ["src/halaman/Analisa/Analisa.jsx", [api, ["ConfigContextProvider"]]],
    ["src/halaman/Analisa/akun/FormulirAkun.jsx", [apiMurni, ["bacaTeks", "tulis"]]],
    ["src/halaman/Analisa/akun/PanelTarikPartai.jsx", [apiMurni, ["bacaTeks", "tulis"]]],
    ["src/halaman/Analisa/akun/daftarAkun.js", [apiMurni, ["bacaTeks", "cobaBacaTeks", "tulis"]]],
    ["src/halaman/Analisa/komponen/nav/nav.jsx", [apiMurni, ["bacaBoolean", "tulisBoolean"]]],
    ["src/halaman/Analisa/komponen/nav/layarPengaturan.jsx", [apiMurni, ["boardThemes"]]],
    ["src/halaman/Analisa/komponen/game/board.jsx", [apiMurni, ["ConfigContext", "boardThemes"]]],
    ["src/halaman/Analisa/komponen/game/game.jsx", [apiMurni, ["ConfigContext"]]],
    ["src/halaman/Analisa/komponen/pengaturan/bestMoves.jsx", [apiMurni, ["ConfigContext", "boardThemes", "bacaTeks", "tulis"]]],
    ["src/halaman/Analisa/komponen/pengaturan/mesin.jsx", [apiMurni, ["tulis"]]],
    ["src/halaman/Analisa/komponen/pengaturan/moves.jsx", [apiMurni, ["ConfigContext", "boardThemes", "bacaTeks", "tulis"]]],
    ["src/halaman/Analisa/komponen/pengaturan/ratings.jsx", [apiMurni, ["ConfigContext", "defaultUsedRatings", "boardThemes", "bacaTeks", "tulis"]]],
    ["src/halaman/Analisa/komponen/pengaturan/themes.jsx", [apiMurni, ["ConfigContext", "boardThemes", "bacaTeks", "tulis"]]],
    ["src/halaman/Analisa/konteks/board.jsx", [apiMurni, ["bacaAngka"]]],
    ["src/halaman/Analisa/konteks/mesin.jsx", [apiMurni, ["bacaAngka", "bacaTeks", "tulis"]]],
  ]);
  for (const [file, [expected, names]] of konsumen) {
    const path = resolve(akar, file);
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
    const imports = ast.statements.filter((node) => ts.isImportDeclaration(node) && node.moduleSpecifier && tujuan(path, node.moduleSpecifier.text) === expected);
    assert.equal(imports.length, 1, file);
    const binding = imports[0].importClause?.namedBindings;
    assert.ok(binding && ts.isNamedImports(binding), file);
    const aktual = binding.elements.map((element) => (element.propertyName ?? element.name).text);
    for (const nama of names) assert.ok(aktual.includes(nama), `${file}: ${nama}`);
  }
  assert.equal(konsumen.size, 15);
});
