import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";
import * as lamaWawasan from "../src/halaman/Analisa/mesin/wawasan.js";
import * as implementasi from "../src/modul/analisis/wawasanProfil.js";
import * as fasadWawasan from "../src/modul/analisis/wawasan.js";
import * as utama from "../src/modul/analisis/index.js";

const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(akar, "src");
const ekstensi = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];
const lamaPath = "src/halaman/Analisa/mesin/wawasan.js";
const implPath = "src/modul/analisis/wawasanProfil.js";
const fasadPath = "src/modul/analisis/wawasan.js";
const utamaPath = "src/modul/analisis/index.js";

const namaWawasan = [
  "LABEL_PEMBUKAAN",
  "agregasiWawasan",
  "ekstraksHeaderPgn",
  "extractFirstMovesFromPgn",
  "filterPartaiWawasan",
  "formatEcoUrlName",
  "hitungHasil",
  "hitungPembukaanTeratas",
  "hitungStreak",
  "hitungTaktikal",
  "hitungTrenRating",
  "parsePgnHeaders",
  "warnaPemain",
];

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
    let argumen;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) argumen = node.moduleSpecifier;
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) argumen = node.arguments[0];
    if (argumen) {
      assert.ok(ts.isStringLiteralLike(argumen), `Referensi nonliteral: ${relative(akar, path)}`);
      hasil.push(argumen.text);
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
  assert.ok(ditemukan, `Referensi tidak terpecahkan: ${relative(akar, source)} -> ${ref}`);
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

function deklarasiReexport(sumberPath, targetPath, nama) {
  const file = resolve(akar, sumberPath);
  const statements = astBerkas(file).statements;
  assert.equal(statements.length, 1, sumberPath);
  const node = statements[0];
  assert.ok(ts.isExportDeclaration(node), sumberPath);
  assert.equal(tujuan(file, node.moduleSpecifier.text), resolve(akar, targetPath), sumberPath);
  assert.ok(node.exportClause && ts.isNamedExports(node.exportClause), sumberPath);
  assert.deepEqual(
    node.exportClause.elements.map((element) => (element.propertyName ?? element.name).text).sort(),
    [...nama].sort(),
    sumberPath,
  );
  assert.ok(node.exportClause.elements.every((element) => element.propertyName === undefined), sumberPath);
}

test("legacy shim, internal facade and implementation share exact wawasan APIs without touching main barrel", () => {
  for (const api of [implementasi, fasadWawasan, lamaWawasan]) {
    assert.deepEqual(Object.keys(api).sort(), namaWawasan);
    assert.equal(Object.hasOwn(api, "default"), false);
  }
  for (const nama of namaWawasan) {
    assert.strictEqual(fasadWawasan[nama], implementasi[nama], nama);
    assert.strictEqual(lamaWawasan[nama], implementasi[nama], nama);
    assert.equal(Object.hasOwn(utama, nama), false, nama);
  }
  assert.strictEqual(implementasi.ekstraksHeaderPgn, implementasi.parsePgnHeaders);
  assert.strictEqual(fasadWawasan.ekstraksHeaderPgn, fasadWawasan.parsePgnHeaders);
  assert.strictEqual(lamaWawasan.ekstraksHeaderPgn, lamaWawasan.parsePgnHeaders);
  assert.equal(Object.isFrozen(implementasi.LABEL_PEMBUKAAN), true);

  // Tahap 23 menjaga barrel publik index.js tetap pada 34 ekspor tanpa menambahkan wawasan.
  assert.equal(Object.hasOwn(utama, "default"), false);
  assert.equal(Object.keys(utama).length, 34);
});

test("legacy shim and internal facade use direct named re-exports pointing to wawasanProfil", () => {
  deklarasiReexport(fasadPath, implPath, namaWawasan);
  deklarasiReexport(lamaPath, implPath, namaWawasan);
});

test("wawasan entries depend only on wawasanProfil with zero third-party, React, chess.js or main barrel dependencies", () => {
  for (const awal of [fasadPath, lamaPath]) {
    const graph = grafDari(awal);
    assert.deepEqual(graph.files, [awal, implPath].sort(), awal);
    assert.deepEqual(graph.paket, [], awal);
    assert.ok(graph.files.every((file) => extname(file) === ".js"), awal);
  }

  const graphUtama = grafDari(utamaPath);
  for (const jalur of [fasadPath, implPath]) {
    assert.equal(graphUtama.files.includes(jalur), false, jalur);
  }
});

test("wawasan imports stay safe on a server without touching browser globals, IndexedDB, fetch or Worker", () => {
  for (const entryPath of [fasadPath, lamaPath]) {
    const url = pathToFileURL(resolve(akar, entryPath)).href;
    const script = `
      for (const key of ["window", "navigator", "WebAssembly", "localStorage", "sessionStorage", "document", "indexedDB", "fetch"]) {
        Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error(key + " touched"); } });
      }
      globalThis.Worker = class { constructor() { throw new Error("worker created"); } };
      const api = await import(${JSON.stringify(url)});
      const res = api.agregasiWawasan(
        [{ id: "g1", whiteName: "Alice", blackName: "Bob", whiteElo: 1500, blackElo: 1450, result: "white", timestamp: Date.now(), pgn: '[Opening "Italian Game"]\\n\\n1. e4 e5 1-0' }],
        "Alice",
        { timeClass: "all", dateRange: "30d" },
      );
      if (res.totalPartai !== 1 || res.hasilUmum.wins !== 1 || res.peakRating !== 1500) {
        throw new Error("unexpected wawasan result");
      }
      console.log("ok");
    `;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: akar, encoding: "utf8" });
    assert.equal(child.status, 0, `${entryPath}: ${child.stderr}`);
    assert.equal(child.stdout.trim(), "ok", entryPath);
  }
});

test("wawasan symbols have exactly one source definition in wawasanProfil", () => {
  const definisi = Object.fromEntries(namaWawasan.map((nama) => [nama, []]));
  const definisiEkspor = Object.fromEntries(namaWawasan.map((nama) => [nama, []]));

  for (const path of berkasKode(src)) {
    const rel = relative(akar, path);
    const sf = astBerkas(path);
    function adaModifierEkspor(node) {
      return Boolean(node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword));
    }
    function kunjungi(node) {
      if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node))
          && node.name && ts.isIdentifier(node.name)) {
        const nama = node.name.text;
        if (Object.hasOwn(definisi, nama)) definisi[nama].push(rel);
        const targetNode = ts.isVariableDeclaration(node) ? node.parent?.parent : node;
        if (Object.hasOwn(definisiEkspor, nama) && targetNode && adaModifierEkspor(targetNode)) {
          definisiEkspor[nama].push(rel);
        }
      }
      ts.forEachChild(node, kunjungi);
    }
    kunjungi(sf);
  }

  for (const nama of namaWawasan) {
    assert.deepEqual(definisiEkspor[nama], [implPath], `export ${nama}`);
    assert.deepEqual(definisi[nama], [implPath], nama);
  }
});

test("only layarWawasan imports wawasan symbols through the internal facade", () => {
  const callers = new Map([
    [
      "src/halaman/Analisa/komponen/nav/layarWawasan.jsx",
      ["agregasiWawasan", "filterPartaiWawasan", "hitungPembukaanTeratas"],
    ],
  ]);
  for (const path of berkasKode(src)) {
    const nodes = astBerkas(path).statements.filter((node) =>
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && tujuan(path, node.moduleSpecifier.text) === resolve(akar, fasadPath));
    if (nodes.length === 0) continue;
    const file = relative(akar, path);
    assert.ok(callers.has(file), `Pemanggil tak terpetakan: ${file}`);
    assert.equal(nodes.length, 1, file);
    const decl = nodes[0];
    const elemen = ts.isImportDeclaration(decl)
      ? decl.importClause?.namedBindings?.elements
      : null;
    assert.ok(Array.isArray(elemen), file);
    assert.deepEqual(
      elemen.map((item) => (item.propertyName ?? item.name).text).sort(),
      callers.get(file).slice().sort(),
      file,
    );
    callers.delete(file);
  }
  assert.deepEqual([...callers.keys()], []);
});

test("application code does not deep-import the legacy wawasan shim or private implementation", () => {
  const lama = resolve(akar, lamaPath);
  const internal = resolve(akar, implPath);
  const allowed = new Set([lamaPath, fasadPath].map((file) => resolve(akar, file)));
  for (const path of berkasKode(src)) {
    for (const ref of referensi(path)) {
      const target = tujuan(path, ref);
      assert.notEqual(target, lama, `${relative(akar, path)} -> ${ref}`);
      if (target === internal) assert.ok(allowed.has(path), `${relative(akar, path)} -> ${ref}`);
    }
  }
  // MesinProvider tetap di path lama dan modul Sesi tidak bergantung pada Analisis.
  assert.equal(existsSync(resolve(akar, "src/halaman/Analisa/konteks/mesin.jsx")), true);
  assert.equal(grafDari("src/modul/sesi/index.js").files.some((file) => file.startsWith("src/modul/analisis/")), false);
});
