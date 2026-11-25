import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";
import * as lamaEngine from "../src/lib/engineCatur.js";
import * as lamaWasm from "../src/halaman/Analisa/mesin/cekWasm.js";
import * as engine from "../src/modul/analisis/engineCatur.js";
import * as wasm from "../src/modul/analisis/cekWasm.js";
import * as ringan from "../src/modul/analisis/mesin.js";
import * as utama from "../src/modul/analisis/index.js";
import { EngineAnalisis } from "../src/halaman/Analisa/mesin/engine.js";

const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(akar, "src");
const ekstensi = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];
const lamaEnginePath = "src/lib/engineCatur.js";
const lamaWasmPath = "src/halaman/Analisa/mesin/cekWasm.js";
const enginePath = "src/modul/analisis/engineCatur.js";
const wasmPath = "src/modul/analisis/cekWasm.js";
const ringanPath = "src/modul/analisis/mesin.js";
const utamaPath = "src/modul/analisis/index.js";
const assetPath = "src/lib/asets.js";
const namaEngine = ["DAFTAR_ENGINE", "ENGINE_BAKU", "EngineCatur", "cariEngine"];
const namaWasm = ["hashUntukEngine", "wasmSupported", "wasmThreadsSupported"];
const namaSemua = [...namaEngine, ...namaWasm].sort();
const fasePath = "src/modul/analisis/fase.js";
const deteksiFasePath = "src/modul/analisis/deteksiFase.js";
const peluangPath = "src/modul/analisis/peluang.js";
const kurvaPeluangPath = "src/modul/analisis/kurvaPeluang.js";
const analisisTersimpanPath = "src/modul/analisis/analisisTersimpan.js";
const hasilSesiPath = "src/modul/analisis/hasilSesi.js";

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

function deklarasiReexport(file, target, names) {
  const path = resolve(akar, file);
  const statements = astBerkas(path).statements;
  assert.equal(statements.length, 1, file);
  const declaration = statements[0];
  assert.ok(ts.isExportDeclaration(declaration), file);
  assert.equal(tujuan(path, declaration.moduleSpecifier.text), resolve(akar, target), file);
  assert.ok(declaration.exportClause && ts.isNamedExports(declaration.exportClause), file);
  assert.deepEqual(declaration.exportClause.elements.map((item) => (item.propertyName ?? item.name).text).sort(), [...names].sort(), file);
  assert.ok(declaration.exportClause.elements.every((item) => item.propertyName === undefined), file);
}

test("legacy, implementation, lightweight and main entries retain the exact named exports and identities", () => {
  for (const api of [lamaEngine, engine]) assert.deepEqual(Object.keys(api), namaEngine);
  for (const api of [lamaWasm, wasm]) assert.deepEqual(Object.keys(api), namaWasm);
  assert.deepEqual(Object.keys(ringan), namaSemua);
  for (const nama of namaSemua) assert.ok(Object.hasOwn(utama, nama), nama);
  for (const nama of namaEngine) {
    for (const api of [engine, ringan, utama]) assert.strictEqual(api[nama], lamaEngine[nama], nama);
  }
  for (const nama of namaWasm) {
    for (const api of [wasm, ringan, utama]) assert.strictEqual(api[nama], lamaWasm[nama], nama);
  }
  for (const api of [lamaEngine, lamaWasm, engine, wasm, ringan, utama]) assert.equal(Object.hasOwn(api, "default"), false);
});

test("mixed paths share one mutable engine list and one class identity in the same module registry", () => {
  assert.strictEqual(lamaEngine.DAFTAR_ENGINE, ringan.DAFTAR_ENGINE);
  assert.strictEqual(ringan.cariEngine("stockfish-16"), lamaEngine.DAFTAR_ENGINE[0]);
  const sementara = { id: "uji-batas-identitas", label: "test" };
  try {
    lamaEngine.DAFTAR_ENGINE.push(sementara);
    assert.strictEqual(utama.cariEngine(sementara.id), sementara);
  } finally {
    lamaEngine.DAFTAR_ENGINE.pop();
  }
  const lama = new lamaEngine.EngineCatur();
  const baru = new utama.EngineCatur();
  assert.ok(lama instanceof ringan.EngineCatur);
  assert.ok(baru instanceof lamaEngine.EngineCatur);
  assert.notStrictEqual(lama, baru);
  lama.tamat();
  baru.tamat();
});

test("both legacy paths directly re-export only their original named APIs", () => {
  deklarasiReexport(lamaEnginePath, enginePath, namaEngine);
  deklarasiReexport(lamaWasmPath, wasmPath, namaWasm);
});

test("the main entry directly re-exports the lightweight engine facade", () => {
  const utamaFile = resolve(akar, utamaPath);
  const utamaStatements = astBerkas(utamaFile).statements;
  assert.ok(utamaStatements.every((node) => ts.isExportDeclaration(node)));
  const reexportMesin = utamaStatements.find((node) => tujuan(utamaFile, node.moduleSpecifier.text) === resolve(akar, ringanPath));
  assert.ok(reexportMesin && reexportMesin.exportClause && ts.isNamedExports(reexportMesin.exportClause));
  assert.deepEqual(reexportMesin.exportClause.elements.map((element) => (element.propertyName ?? element.name).text).sort(), namaSemua);
  assert.ok(reexportMesin.exportClause.elements.every((element) => element.propertyName === undefined));
  const path = resolve(akar, ringanPath);
  const statements = astBerkas(path).statements;
  assert.equal(statements.length, 2);
  for (const [index, target, names] of [[0, enginePath, namaEngine], [1, wasmPath, namaWasm]]) {
    const node = statements[index];
    assert.ok(ts.isExportDeclaration(node));
    assert.equal(tujuan(path, node.moduleSpecifier.text), resolve(akar, target));
    assert.ok(node.exportClause && ts.isNamedExports(node.exportClause));
    assert.deepEqual(node.exportClause.elements.map((element) => element.name.text).sort(), [...names].sort());
  }
});

test("both public entries stay minimal without JSX or legacy engine adapter", () => {
  const graphRingan = grafDari(ringanPath);
  assert.deepEqual(graphRingan.files, [ringanPath, enginePath, wasmPath, assetPath].sort(), ringanPath);
  assert.deepEqual(graphRingan.paket, [], ringanPath);
  assert.ok(graphRingan.files.every((file) => extname(file) === ".js"), ringanPath);

  const graphUtama = grafDari(utamaPath);
  assert.deepEqual(
    graphUtama.files,
    [
      utamaPath,
      ringanPath,
      enginePath,
      wasmPath,
      assetPath,
      fasePath,
      deteksiFasePath,
      peluangPath,
      kurvaPeluangPath,
      analisisTersimpanPath,
      hasilSesiPath,
    ].sort(),
    utamaPath,
  );
  assert.deepEqual(graphUtama.paket, ["chess.js"], utamaPath);
  assert.ok(graphUtama.files.every((file) => extname(file) === ".js"), utamaPath);
});

test("legacy entry graphs stay as small as their previous independent APIs", () => {
  assert.deepEqual(grafDari(lamaEnginePath), { files: [lamaEnginePath, enginePath, assetPath].sort(), paket: [] });
  assert.deepEqual(grafDari(lamaWasmPath), { files: [lamaWasmPath, wasmPath].sort(), paket: [] });
});

test("public imports and construction stay safe on a server without touching browser globals or creating a worker", () => {
  const url = pathToFileURL(resolve(akar, utamaPath)).href;
  const script = `
    for (const key of ["window", "navigator", "WebAssembly"]) {
      Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error(key + " touched"); } });
    }
    globalThis.Worker = class { constructor() { throw new Error("worker created"); } };
    const api = await import(${JSON.stringify(url)});
    const engine = new api.EngineCatur();
    if (engine.worker !== null || api.DAFTAR_ENGINE.length !== 6) throw new Error("unexpected startup");
    engine.tamat();
    console.log("ok");
  `;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: akar, encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), "ok");
});

test("engine selections, class and WASM functions have exactly one source definition", () => {
  const definisi = Object.fromEntries(namaSemua.map((nama) => [nama, []]));
  for (const path of berkasKode(src)) {
    function kunjungi(node) {
      if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node))
          && node.name && ts.isIdentifier(node.name) && Object.hasOwn(definisi, node.name.text)) {
        definisi[node.name.text].push(relative(akar, path));
      }
      ts.forEachChild(node, kunjungi);
    }
    kunjungi(astBerkas(path));
  }
  for (const nama of namaEngine) assert.deepEqual(definisi[nama], [enginePath], nama);
  for (const nama of namaWasm) assert.deepEqual(definisi[nama], [wasmPath], nama);
});

test("all five mapped application callers import the expected names through the facade", () => {
  const callers = new Map([
    ["src/halaman/Analisa/mesin/engine.js", ["EngineCatur", "cariEngine", "hashUntukEngine"]],
    ["src/halaman/Analisa/konteks/mesin.jsx", ["ENGINE_BAKU", "cariEngine", "hashUntukEngine", "wasmSupported"]],
    ["src/halaman/Analisa/komponen/pengaturan/mesin.jsx", ["cariEngine"]],
    ["src/halaman/Analisa/komponen/nav/layarEngine.jsx", ["DAFTAR_ENGINE"]],
    ["src/halaman/Analisa/komponen/nav/layarDeteksiEngine.jsx", ["cariEngine", "DAFTAR_ENGINE", "hashUntukEngine"]],
  ]);
  for (const path of berkasKode(src)) {
    const imports = astBerkas(path).statements.filter((node) => ts.isImportDeclaration(node) && node.moduleSpecifier
      && tujuan(path, node.moduleSpecifier.text) === resolve(akar, ringanPath));
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

test("application code does not deep-import old shims or implementations, except the two compatibility shims", () => {
  const old = new Set([lamaEnginePath, lamaWasmPath].map((file) => resolve(akar, file)));
  const internal = new Set([enginePath, wasmPath].map((file) => resolve(akar, file)));
  const allowed = new Set([lamaEnginePath, lamaWasmPath, ringanPath].map((file) => resolve(akar, file)));
  for (const path of berkasKode(src)) {
    for (const ref of referensi(path)) {
      const target = tujuan(path, ref);
      assert.equal(old.has(target), false, `${relative(akar, path)} -> ${ref}`);
      if (internal.has(target)) assert.ok(allowed.has(path), `${relative(akar, path)} -> ${ref}`);
    }
  }
});

test("legacy EngineAnalisis constructs the very same EngineCatur exposed by every entry", () => {
  const wrapper = new EngineAnalisis({ idEngine: "stockfish-16", hash: 48 });
  assert.ok(wrapper.engine instanceof lamaEngine.EngineCatur);
  assert.ok(wrapper.engine instanceof utama.EngineCatur);
  assert.equal(wrapper.engine.url, ringan.cariEngine("stockfish-16").url);
  assert.equal(wrapper.engine.hash, 48);
  assert.equal(wrapper.engine.worker, null);
  wrapper.hancurkan();
});
