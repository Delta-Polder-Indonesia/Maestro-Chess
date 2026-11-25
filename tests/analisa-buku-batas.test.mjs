import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";
import * as lamaBuku from "../src/halaman/Analisa/mesin/buku.js";
import * as lamaKunciFen from "../src/halaman/Analisa/mesin/kunciFen.js";
import * as implementasi from "../src/modul/analisis/bukuPembukaan.js";
import * as ringanBuku from "../src/modul/analisis/buku.js";
import * as utama from "../src/modul/analisis/index.js";

const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(akar, "src");
const ekstensi = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];
const lamaBukuPath = "src/halaman/Analisa/mesin/buku.js";
const lamaKunciPath = "src/halaman/Analisa/mesin/kunciFen.js";
const implPath = "src/modul/analisis/bukuPembukaan.js";
const fasadPath = "src/modul/analisis/buku.js";
const asetsPath = "src/lib/asets.js";
const utamaPath = "src/modul/analisis/index.js";

const namaBuku = ["cariNamaPembukaan", "muatBuku"];
const namaImpl = ["cariNamaPembukaan", "kunciFen", "muatBuku"];

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

test("legacy shims, facade and implementation share exact opening-book APIs without touching main barrel", () => {
  assert.deepEqual(Object.keys(implementasi).sort(), namaImpl);
  assert.equal(Object.hasOwn(implementasi, "default"), false);

  for (const api of [ringanBuku, lamaBuku]) {
    assert.deepEqual(Object.keys(api).sort(), namaBuku);
    assert.equal(Object.hasOwn(api, "default"), false);
    assert.equal(Object.hasOwn(api, "kunciFen"), false);
    assert.strictEqual(api.muatBuku, implementasi.muatBuku);
    assert.strictEqual(api.cariNamaPembukaan, implementasi.cariNamaPembukaan);
  }

  assert.deepEqual(Object.keys(lamaKunciFen), ["kunciFen"]);
  assert.equal(Object.hasOwn(lamaKunciFen, "default"), false);
  assert.strictEqual(lamaKunciFen.kunciFen, implementasi.kunciFen);

  // Tahap 18 menjaga barrel publik index.js tetap pada 34 ekspor tanpa menambahkan buku atau kunciFen.
  for (const simbol of namaImpl) assert.equal(Object.hasOwn(utama, simbol), false, simbol);
  assert.equal(Object.hasOwn(utama, "default"), false);
  assert.equal(Object.keys(utama).length, 34);
});

test("legacy shims and lightweight facade use direct named re-exports pointing to bukuPembukaan", () => {
  deklarasiReexport(fasadPath, implPath, namaBuku);
  deklarasiReexport(lamaBukuPath, implPath, namaBuku);
  deklarasiReexport(lamaKunciPath, implPath, ["kunciFen"]);
});

test("opening-book entries depend only on bukuPembukaan and asets without third-party packages or main barrel leak", () => {
  for (const awal of [fasadPath, lamaBukuPath, lamaKunciPath]) {
    const graph = grafDari(awal);
    assert.deepEqual(graph.files, [awal, implPath, asetsPath].sort(), awal);
    assert.deepEqual(graph.paket, [], awal);
    assert.ok(graph.files.every((file) => extname(file) === ".js"), awal);
    assert.equal(
      graph.files.some((file) => file.startsWith("src/halaman/") && file !== awal),
      false,
      awal,
    );
    assert.equal(graph.files.some((file) => file.startsWith("src/modul/sesi/")), false, awal);
  }

  const graphUtama = grafDari(utamaPath);
  assert.equal(graphUtama.files.includes(fasadPath), false);
  assert.equal(graphUtama.files.includes(implPath), false);
});

test("mixed import paths share one singleton janji cache and reset cleanly after empty response", () => {
  const script = `
    import assert from "node:assert/strict";
    import * as fasad from ${JSON.stringify(pathToFileURL(resolve(akar, fasadPath)).href)};
    import * as impl from ${JSON.stringify(pathToFileURL(resolve(akar, implPath)).href)};
    import * as lama from ${JSON.stringify(pathToFileURL(resolve(akar, lamaBukuPath)).href)};

    let jumlahFetch = 0;
    globalThis.fetch = async () => {
      jumlahFetch++;
      return { ok: true, json: async () => ({}) };
    };
    const pKosong1 = fasad.muatBuku();
    const pKosong2 = lama.muatBuku();
    assert.strictEqual(pKosong1, pKosong2);
    assert.deepEqual(await pKosong1, {});
    assert.equal(jumlahFetch, 1);

    const kunciAwal = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";
    globalThis.fetch = async () => {
      jumlahFetch++;
      return { ok: true, json: async () => ({ [kunciAwal]: "Starting Position" }) };
    };
    const p1 = fasad.muatBuku();
    const p2 = impl.muatBuku();
    const p3 = lama.muatBuku();
    assert.strictEqual(p1, p2);
    assert.strictEqual(p2, p3);
    const peta = await p1;
    assert.strictEqual(await lama.muatBuku(), peta);
    const cari = await fasad.cariNamaPembukaan();
    assert.equal(cari(kunciAwal + " 0 1"), "Starting Position");
    assert.equal(jumlahFetch, 2);
    console.log("ok");
  `;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: akar, encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), "ok");
});

test("opening-book public imports stay safe on a server without touching browser globals, fetch or Worker", () => {
  for (const entryPath of [fasadPath, lamaBukuPath, lamaKunciPath]) {
    const url = pathToFileURL(resolve(akar, entryPath)).href;
    const isKunci = entryPath === lamaKunciPath;
    const script = `
      for (const key of ["window", "navigator", "WebAssembly", "localStorage", "sessionStorage", "document", "fetch"]) {
        Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error(key + " touched"); } });
      }
      globalThis.Worker = class { constructor() { throw new Error("worker created"); } };
      const api = await import(${JSON.stringify(url)});
      if (${JSON.stringify(isKunci)}) {
        if (api.kunciFen("a b c d e f") !== "a b c d") throw new Error("unexpected kunciFen result");
      } else {
        if (typeof api.muatBuku !== "function" || typeof api.cariNamaPembukaan !== "function") {
          throw new Error("missing opening-book functions");
        }
      }
      console.log("ok");
    `;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: akar, encoding: "utf8" });
    assert.equal(child.status, 0, `${entryPath}: ${child.stderr}`);
    assert.equal(child.stdout.trim(), "ok", entryPath);
  }
});

test("opening-book symbols have exactly one source definition", () => {
  const definisi = { kunciFen: [], muatBuku: [], cariNamaPembukaan: [], VERSI_BUKU: [] };
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
  for (const [nama, lokasi] of Object.entries(definisi)) {
    assert.deepEqual(lokasi, [implPath], nama);
  }
});

test("only the three mapped application callers import opening-book symbols through the lightweight facade", () => {
  const callers = new Map([
    ["src/halaman/Analisa/akun/antiCheatRiwayat.js", ["cariNamaPembukaan"]],
    ["src/halaman/Analisa/komponen/game/useAnalisisPapan.js", ["cariNamaPembukaan"]],
    ["src/halaman/Analisa/komponen/game/useMuatPartai.js", ["cariNamaPembukaan"]],
  ]);
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

test("application code does not deep-import legacy opening-book shims or private implementation", () => {
  const legacyShims = new Set([lamaBukuPath, lamaKunciPath].map((file) => resolve(akar, file)));
  const internal = resolve(akar, implPath);
  const allowed = new Set([lamaBukuPath, lamaKunciPath, fasadPath].map((file) => resolve(akar, file)));
  for (const path of berkasKode(src)) {
    for (const ref of referensi(path)) {
      const target = tujuan(path, ref);
      assert.equal(legacyShims.has(target), false, `${relative(akar, path)} -> ${ref}`);
      if (target === internal) assert.ok(allowed.has(path), `${relative(akar, path)} -> ${ref}`);
    }
  }
  // MesinProvider tetap di path lama dan modul Sesi tidak bergantung pada Analisis.
  assert.equal(existsSync(resolve(akar, "src/halaman/Analisa/konteks/mesin.jsx")), true);
  assert.equal(grafDari("src/modul/sesi/index.js").files.some((file) => file.startsWith("src/modul/analisis/")), false);
});
