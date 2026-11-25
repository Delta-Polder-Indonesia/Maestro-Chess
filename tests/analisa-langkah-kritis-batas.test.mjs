import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";
import * as lamaLangkahKritis from "../src/halaman/Analisa/mesin/langkahKritis.js";
import * as implementasi from "../src/modul/analisis/deteksiLangkahKritis.js";
import * as fasadLangkahKritis from "../src/modul/analisis/langkahKritis.js";
import * as utama from "../src/modul/analisis/index.js";

const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(akar, "src");
const ekstensi = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];
const lamaPath = "src/halaman/Analisa/mesin/langkahKritis.js";
const implPath = "src/modul/analisis/deteksiLangkahKritis.js";
const fasadPath = "src/modul/analisis/langkahKritis.js";
const akurasiPath = "src/modul/analisis/akurasi.js";
const metrikAkurasiPath = "src/modul/analisis/metrikAkurasi.js";
const penilaianPath = "src/modul/analisis/penilaian.js";
const penilaianImplPath = "src/modul/analisis/penilaianLangkah.js";
const keamananPath = "src/modul/analisis/keamananBidak.js";
const bateraiPath = "src/modul/analisis/bateraiBidak.js";
const peluangPath = "src/modul/analisis/peluang.js";
const kurvaPeluangPath = "src/modul/analisis/kurvaPeluang.js";
const evaluasiPath = "src/modul/analisis/evaluasi.js";
const konvensiEvaluasiPath = "src/modul/analisis/konvensiEvaluasi.js";
const utamaPath = "src/modul/analisis/index.js";

const namaLangkahKritis = [
  "AMBANG_KERUGIAN_KRITIS",
  "AMBANG_UNGGUL_MUTLAK_CP",
  "apakahLangkahKritis",
  "cpKandidat",
  "kerugianPeluangKandidat",
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

test("legacy shim, internal facade and implementation share exact langkahKritis APIs without touching main barrel", () => {
  for (const api of [implementasi, fasadLangkahKritis, lamaLangkahKritis]) {
    assert.deepEqual(Object.keys(api).sort(), namaLangkahKritis);
    assert.equal(Object.hasOwn(api, "default"), false);
  }
  for (const nama of namaLangkahKritis) {
    assert.strictEqual(fasadLangkahKritis[nama], implementasi[nama], nama);
    assert.strictEqual(lamaLangkahKritis[nama], implementasi[nama], nama);
    assert.equal(Object.hasOwn(utama, nama), false, nama);
  }

  // Tahap 21 menjaga barrel publik index.js tetap pada 34 ekspor tanpa menambahkan langkahKritis.
  assert.equal(Object.hasOwn(utama, "default"), false);
  assert.equal(Object.keys(utama).length, 34);
});

test("legacy shim and internal facade use direct named re-exports pointing to deteksiLangkahKritis", () => {
  deklarasiReexport(fasadPath, implPath, namaLangkahKritis);
  deklarasiReexport(lamaPath, implPath, namaLangkahKritis);
});

test("langkahKritis entries depend only on deteksiLangkahKritis, modul/analisis facades and chess.js without React, engine.js or main barrel leak", () => {
  const dependensi = [
    implPath,
    akurasiPath,
    metrikAkurasiPath,
    penilaianPath,
    penilaianImplPath,
    keamananPath,
    bateraiPath,
    peluangPath,
    kurvaPeluangPath,
    evaluasiPath,
    konvensiEvaluasiPath,
  ];
  for (const awal of [fasadPath, lamaPath]) {
    const graph = grafDari(awal);
    assert.deepEqual(graph.files, [awal, ...dependensi].sort(), awal);
    assert.deepEqual(graph.paket, ["chess.js"], awal);
    assert.ok(graph.files.every((file) => extname(file) === ".js"), awal);
    assert.equal(
      graph.files.some((file) => file.startsWith("src/halaman/") && file !== awal),
      false,
      awal,
    );
    assert.equal(graph.files.some((file) => file.startsWith("src/modul/sesi/")), false, awal);
    assert.equal(graph.paket.includes("react"), false, awal);
  }

  const graphUtama = grafDari(utamaPath);
  for (const jalur of [fasadPath, implPath]) {
    assert.equal(graphUtama.files.includes(jalur), false, jalur);
  }
});

test("langkahKritis imports stay safe on a server without touching browser globals, fetch or Worker", () => {
  for (const entryPath of [fasadPath, lamaPath]) {
    const url = pathToFileURL(resolve(akar, entryPath)).href;
    const script = `
      for (const key of ["window", "navigator", "WebAssembly", "localStorage", "sessionStorage", "document", "fetch"]) {
        Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error(key + " touched"); } });
      }
      globalThis.Worker = class { constructor() { throw new Error("worker created"); } };
      const api = await import(${JSON.stringify(url)});
      const okCp = api.cpKandidat({ mate: 2 }) === 1000 && api.cpKandidat({ cp: 50, mate: "" }) === null;
      const okDrop = api.kerugianPeluangKandidat([{ cp: 500 }, { cp: 100 }]) > api.AMBANG_KERUGIAN_KRITIS;
      const okKritis = api.apakahLangkahKritis(
        { san: "e4", before: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" },
        { staticEval: ["cp", "-300"], previousKandidat: [{ cp: 500 }, { cp: 100 }], previousBestMoveSan: "e4" },
      );
      if (!okCp || !okDrop || okKritis !== true) {
        throw new Error("unexpected langkahKritis result");
      }
      console.log("ok");
    `;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: akar, encoding: "utf8" });
    assert.equal(child.status, 0, `${entryPath}: ${child.stderr}`);
    assert.equal(child.stdout.trim(), "ok", entryPath);
  }
});

test("langkahKritis symbols have exact expected source definitions in deteksiLangkahKritis", () => {
  const definisi = Object.fromEntries(namaLangkahKritis.map((nama) => [nama, []]));
  const definisiEkspor = Object.fromEntries(namaLangkahKritis.map((nama) => [nama, []]));

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

  for (const nama of namaLangkahKritis) {
    if (nama === "cpKandidat") {
      // antiCheat/dasar.js mendefinisikan cpKandidat versi ±10000 secara terpisah dari versi ±1000 di deteksiLangkahKritis.js.
      const diharapkan = [implPath, "src/halaman/Analisa/mesin/antiCheat/dasar.js"].sort();
      assert.deepEqual(definisiEkspor[nama].slice().sort(), diharapkan, `export ${nama}`);
      assert.deepEqual(definisi[nama].slice().sort(), diharapkan, nama);
      continue;
    }
    assert.deepEqual(definisiEkspor[nama], [implPath], `export ${nama}`);
    assert.deepEqual(definisi[nama], [implPath], nama);
  }
});

test("only engine.js imports langkahKritis symbols through the internal facade", () => {
  const callers = new Map([
    ["src/halaman/Analisa/mesin/engine.js", ["apakahLangkahKritis", "cpKandidat"]],
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

test("application code does not deep-import the legacy langkahKritis shim or private implementation", () => {
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
