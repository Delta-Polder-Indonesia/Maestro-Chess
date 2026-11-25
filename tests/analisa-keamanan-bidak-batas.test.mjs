import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";
import * as lamaKeamanan from "../src/halaman/Analisa/mesin/keamananBidak.js";
import * as implementasi from "../src/modul/analisis/bateraiBidak.js";
import * as fasadInternal from "../src/modul/analisis/keamananBidak.js";
import * as utama from "../src/modul/analisis/index.js";

const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(akar, "src");
const ekstensi = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];
const lamaPath = "src/halaman/Analisa/mesin/keamananBidak.js";
const implPath = "src/modul/analisis/bateraiBidak.js";
const fasadPath = "src/modul/analisis/keamananBidak.js";
const utamaPath = "src/modul/analisis/index.js";

const namaKeamanan = ["penyerangTersembunyi"];

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
  const awalAbs = resolve(akar, awal);
  const terlihat = new Set();
  const paket = new Set();
  function telusur(file) {
    if (terlihat.has(file)) return;
    terlihat.add(file);
    for (const ref of referensi(file)) {
      const target = tujuan(file, ref);
      if (target) telusur(target);
      else paket.add(ref);
    }
  }
  telusur(awalAbs);
  return {
    files: [...terlihat].map((file) => relative(akar, file)).sort(),
    paket: [...paket].sort(),
  };
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

test("legacy shim, implementation and internal facade share exact keamananBidak API without polluting main barrel", () => {
  for (const api of [implementasi, fasadInternal, lamaKeamanan]) {
    assert.deepEqual(Object.keys(api), namaKeamanan);
    assert.equal(Object.hasOwn(api, "default"), false);
  }
  assert.strictEqual(lamaKeamanan.penyerangTersembunyi, implementasi.penyerangTersembunyi);
  assert.strictEqual(fasadInternal.penyerangTersembunyi, implementasi.penyerangTersembunyi);

  // Tahap 17 menjaga barrel publik index.js tetap pada 34 ekspor tanpa menambahkan helper internal ini.
  assert.equal(Object.hasOwn(utama, "penyerangTersembunyi"), false);
  assert.equal(Object.hasOwn(utama, "default"), false);
  assert.equal(Object.keys(utama).length, 34);
});

test("legacy shim and internal facade use direct named re-exports pointing to bateraiBidak", () => {
  deklarasiReexport(lamaPath, implPath, namaKeamanan);
  deklarasiReexport(fasadPath, implPath, namaKeamanan);
});

test("internal keamananBidak entries depend only on bateraiBidak and chess.js without JSX or main barrel leak", () => {
  for (const awal of [fasadPath, lamaPath]) {
    const graph = grafDari(awal);
    assert.deepEqual(graph.files, [awal, implPath].sort(), awal);
    assert.deepEqual(graph.paket, ["chess.js"], awal);
    assert.ok(graph.files.every((file) => extname(file) === ".js"), awal);
    assert.equal(graph.files.some((file) => file.startsWith("src/halaman/") && file !== lamaPath), false, awal);
    assert.equal(graph.files.some((file) => file.startsWith("src/modul/sesi/")), false, awal);
    assert.equal(graph.paket.includes("react"), false, awal);
  }

  const graphUtama = grafDari(utamaPath);
  assert.equal(graphUtama.files.includes(fasadPath), false);
  assert.equal(graphUtama.files.includes(implPath), false);
});

test("keamananBidak imports stay safe on a server without touching browser globals or creating a worker", () => {
  for (const entryPath of [fasadPath, lamaPath]) {
    const url = pathToFileURL(resolve(akar, entryPath)).href;
    const script = `
      import { Chess } from "chess.js";
      for (const key of ["window", "navigator", "WebAssembly", "localStorage", "sessionStorage", "document"]) {
        Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error(key + " touched"); } });
      }
      globalThis.Worker = class { constructor() { throw new Error("worker created"); } };
      const api = await import(${JSON.stringify(url)});
      const res = api.penyerangTersembunyi(new Chess("q5k1/8/8/8/8/8/R7/R5K1 w - - 0 1"), "a8", "w");
      if (!Array.isArray(res) || res.length !== 1 || res[0] !== "a1") {
        throw new Error("unexpected battery result: " + JSON.stringify(res));
      }
      console.log("ok");
    `;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: akar, encoding: "utf8" });
    assert.equal(child.status, 0, `${entryPath}: ${child.stderr}`);
    assert.equal(child.stdout.trim(), "ok", entryPath);
  }
});

test("keamananBidak symbols have exactly one source definition", () => {
  const definisi = { penyerangTersembunyi: [], BATAS_RANTAI: [] };
  for (const path of berkasKode(src)) {
    function kunjungi(node) {
      if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node))
          && node.name && ts.isIdentifier(node.name) && Object.hasOwn(definisi, node.name.text)) {
        definisi[node.name.text].push(relative(akar, path));
      }
      ts.forEachChild(node, kunjungi);
    }
    kunjungi(astBerkas(path));
  }
  assert.deepEqual(definisi.penyerangTersembunyi, [implPath]);
  assert.deepEqual(definisi.BATAS_RANTAI, [implPath]);
});

test("only penilaianLangkah.js imports penyerangTersembunyi through the internal facade", () => {
  const callers = new Map([["src/modul/analisis/penilaianLangkah.js", ["penyerangTersembunyi"]]]);
  for (const path of berkasKode(src)) {
    const imports = astBerkas(path).statements.filter((node) => ts.isImportDeclaration(node) && node.moduleSpecifier
      && tujuan(path, node.moduleSpecifier.text) === resolve(akar, fasadPath));
    if (imports.length === 0) continue;
    const file = relative(akar, path);
    assert.ok(callers.has(file), `Pemanggil tak terpetakan: ${file}`);
    assert.equal(imports.length, 1, file);
    const binding = imports[0].importClause?.namedBindings;
    assert.ok(binding && ts.isNamedImports(binding), file);
    assert.deepEqual(binding.elements.map((item) => (item.propertyName ?? item.name).text).sort(), callers.get(file).slice().sort(), file);
    callers.delete(file);
  }
  assert.deepEqual([...callers.keys()], []);
});

test("application code does not deep-import legacy keamananBidak shim or private implementation", () => {
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
