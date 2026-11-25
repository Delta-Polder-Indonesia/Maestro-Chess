import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";
import * as lamaHasil from "../src/halaman/Analisa/mesin/analisisTersimpan.js";
import * as implementasi from "../src/modul/analisis/hasilSesi.js";
import * as ringanHasil from "../src/modul/analisis/analisisTersimpan.js";
import * as utama from "../src/modul/analisis/index.js";

const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(akar, "src");
const ekstensi = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];
const lamaPath = "src/halaman/Analisa/mesin/analisisTersimpan.js";
const implPath = "src/modul/analisis/hasilSesi.js";
const ringanPath = "src/modul/analisis/analisisTersimpan.js";
const mesinPath = "src/modul/analisis/mesin.js";
const fasePath = "src/modul/analisis/fase.js";
const peluangPath = "src/modul/analisis/peluang.js";
const utamaPath = "src/modul/analisis/index.js";
const namaHasil = [
  "ambilPetaAnalisis",
  "bersihkanAnalisis",
  "catatAnalisis",
  "hapusAnalisis",
  "jumlahAnalisis",
  "langgananAnalisis",
];
const namaMesin = [
  "DAFTAR_ENGINE",
  "ENGINE_BAKU",
  "EngineCatur",
  "cariEngine",
  "hashUntukEngine",
  "wasmSupported",
  "wasmThreadsSupported",
];
const namaFase = [
  "DAFTAR_FASE",
  "FASE_AKHIR",
  "FASE_MENENGAH",
  "FASE_PEMBUKAAN",
  "faseBerikutnya",
  "isEndMiddlegame",
  "isEndOpening",
  "papanDariFen",
];
const namaPeluang = ["CP_CEILING", "FAKTOR_PELUANG", "batasiCp", "peluangMenang"];

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

test("legacy, implementation, lightweight and main entries expose exact session-results APIs and identities", () => {
  for (const api of [lamaHasil, implementasi, ringanHasil]) {
    assert.deepEqual(Object.keys(api).sort(), namaHasil);
    assert.equal(Object.hasOwn(api, "default"), false);
  }
  assert.deepEqual(Object.keys(utama).sort(), [...namaMesin, ...namaFase, ...namaPeluang, ...namaHasil].sort());
  assert.equal(Object.hasOwn(utama, "default"), false);
  for (const nama of namaHasil) {
    for (const api of [implementasi, ringanHasil, utama]) {
      assert.strictEqual(api[nama], lamaHasil[nama], nama);
    }
  }
});

test("mixed paths share one singleton results Map and subscriber Set in the same module registry", (t) => {
  t.after(() => implementasi.bersihkanAnalisis());
  implementasi.bersihkanAnalisis();

  let notifikasi = 0;
  const berhenti = ringanHasil.langgananAnalisis(() => { notifikasi++; });
  t.after(berhenti);

  const entri = { status: "complete", totalPlies: 10 };
  lamaHasil.catatAnalisis("hash-uji-1", entri);
  assert.equal(notifikasi, 1);
  assert.equal(utama.jumlahAnalisis(), 1);
  assert.strictEqual(utama.ambilPetaAnalisis()["hash-uji-1"], entri);

  implementasi.hapusAnalisis("hash-uji-1");
  assert.equal(notifikasi, 2);
  assert.equal(ringanHasil.jumlahAnalisis(), 0);
  assert.deepEqual(lamaHasil.ambilPetaAnalisis(), {});
});

test("legacy shim, lightweight facade and main barrel use direct named re-exports", () => {
  deklarasiReexport(lamaPath, implPath, namaHasil);
  deklarasiReexport(ringanPath, implPath, namaHasil);

  const path = resolve(akar, utamaPath);
  const statements = astBerkas(path).statements;
  assert.equal(statements.length, 4);
  for (const [index, target, names] of [
    [0, mesinPath, namaMesin],
    [1, fasePath, namaFase],
    [2, peluangPath, namaPeluang],
    [3, ringanPath, namaHasil],
  ]) {
    const node = statements[index];
    assert.ok(ts.isExportDeclaration(node));
    assert.equal(tujuan(path, node.moduleSpecifier.text), resolve(akar, target));
    assert.ok(node.exportClause && ts.isNamedExports(node.exportClause));
    assert.deepEqual(node.exportClause.elements.map((element) => (element.propertyName ?? element.name).text).sort(), [...names].sort());
    assert.ok(node.exportClause.elements.every((element) => element.propertyName === undefined));
  }
});

test("lightweight session-results entries load only hasilSesi with zero third-party or React/chess.js dependencies", () => {
  for (const awal of [ringanPath, lamaPath]) {
    const graph = grafDari(awal);
    assert.deepEqual(graph.files, [awal, implPath].sort(), awal);
    assert.deepEqual(graph.paket, [], awal);
    assert.ok(graph.files.every((file) => extname(file) === ".js"), awal);
  }
  const graphUtama = grafDari(utamaPath);
  assert.equal(graphUtama.files.some((file) => file.startsWith("src/halaman/")), false);
  assert.equal(graphUtama.files.some((file) => file.startsWith("src/modul/sesi/")), false);
  assert.equal(graphUtama.paket.includes("react"), false);
});

test("session-results public imports stay safe on a server without touching browser globals or creating a worker", () => {
  for (const entryPath of [ringanPath, utamaPath]) {
    const url = pathToFileURL(resolve(akar, entryPath)).href;
    const script = `
      for (const key of ["window", "navigator", "WebAssembly", "localStorage", "sessionStorage", "document"]) {
        Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error(key + " touched"); } });
      }
      globalThis.Worker = class { constructor() { throw new Error("worker created"); } };
      const api = await import(${JSON.stringify(url)});
      api.catatAnalisis("srv-1", { status: "complete" });
      if (api.jumlahAnalisis() !== 1 || api.ambilPetaAnalisis()["srv-1"]?.status !== "complete") {
        throw new Error("unexpected session-results state");
      }
      api.bersihkanAnalisis();
      console.log("ok");
    `;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: akar, encoding: "utf8" });
    assert.equal(child.status, 0, `${entryPath}: ${child.stderr}`);
    assert.equal(child.stdout.trim(), "ok", entryPath);
  }
});

test("session-results symbols have exactly one source definition", () => {
  const definisi = Object.fromEntries(namaHasil.map((nama) => [nama, []]));
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
  for (const nama of namaHasil) assert.deepEqual(definisi[nama], [implPath], nama);
});

test("both mapped application callers import session-results symbols through the lightweight facade", () => {
  const callers = new Map([
    ["src/halaman/Analisa/komponen/game/useMuatPartai.js", ["catatAnalisis"]],
    ["src/halaman/Analisa/komponen/nav/layarWawasan.jsx", ["ambilPetaAnalisis", "langgananAnalisis"]],
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

test("application code does not deep-import the legacy session-results shim or private implementation", () => {
  const lama = resolve(akar, lamaPath);
  const internal = resolve(akar, implPath);
  const allowed = new Set([lamaPath, ringanPath].map((file) => resolve(akar, file)));
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
