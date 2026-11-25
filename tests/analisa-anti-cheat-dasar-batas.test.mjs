import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";
import * as lamaDasar from "../src/halaman/Analisa/mesin/antiCheat/dasar.js";
import * as implDasar from "../src/modul/analisis/dasarAntiCheat.js";
import * as fasadDasar from "../src/modul/analisis/antiCheatDasar.js";
import * as implMultiPv from "../src/modul/analisis/konstantaMesin.js";
import * as fasadMultiPv from "../src/modul/analisis/multiPv.js";
import * as engine from "../src/halaman/Analisa/mesin/engine.js";
import * as antiCheat from "../src/halaman/Analisa/mesin/antiCheat.js";
import * as utama from "../src/modul/analisis/index.js";

const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(akar, "src");
const ekstensi = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];

const lamaDasarPath = "src/halaman/Analisa/mesin/antiCheat/dasar.js";
const implDasarPath = "src/modul/analisis/dasarAntiCheat.js";
const fasadDasarPath = "src/modul/analisis/antiCheatDasar.js";
const implMultiPvPath = "src/modul/analisis/konstantaMesin.js";
const fasadMultiPvPath = "src/modul/analisis/multiPv.js";
const deteksiKritisImplPath = "src/modul/analisis/deteksiLangkahKritis.js";

const penilaianPath = "src/modul/analisis/penilaian.js";
const penilaianImplPath = "src/modul/analisis/penilaianLangkah.js";
const keamananPath = "src/modul/analisis/keamananBidak.js";
const bateraiPath = "src/modul/analisis/bateraiBidak.js";
const peluangPath = "src/modul/analisis/peluang.js";
const kurvaPeluangPath = "src/modul/analisis/kurvaPeluang.js";
const evaluasiPath = "src/modul/analisis/evaluasi.js";
const konvensiEvaluasiPath = "src/modul/analisis/konvensiEvaluasi.js";
const utamaPath = "src/modul/analisis/index.js";

const namaDasar = [
  "AMBANG",
  "BATAS_KERUGIAN",
  "BOBOT",
  "CP_MATE",
  "LEVEL_RENDAH",
  "LEVEL_SEDANG",
  "LEVEL_SEMENTARA",
  "LEVEL_TINGGI",
  "MIN_LANGKAH_AGGREGAT",
  "MIN_PARTAI_AGGREGAT",
  "SAMPEL_WAKTU_MINIMUM",
  "batasi01",
  "bulat1",
  "cpKandidat",
  "kehilanganMenangPermille",
  "kerugianCentipawn",
  "kerugianKandidatCp",
  "ketajamanKandidat",
  "korelasiSpearman",
  "nilaiCentipawn",
  "normalkanSan",
  "pemainLangkah",
  "peringkatLangkahDalam",
  "rataRata",
  "statistikWaktu",
  "waktuBerpikir",
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

test("legacy shim, internal facades and implementations share exact MULTI_PV and dasar APIs without touching main barrel", () => {
  for (const api of [implMultiPv, fasadMultiPv]) {
    assert.deepEqual(Object.keys(api), ["MULTI_PV"]);
    assert.equal(Object.hasOwn(api, "default"), false);
  }
  assert.equal(implMultiPv.MULTI_PV, 5);
  assert.strictEqual(fasadMultiPv.MULTI_PV, implMultiPv.MULTI_PV);
  assert.strictEqual(engine.MULTI_PV, implMultiPv.MULTI_PV);
  assert.strictEqual(antiCheat.MULTI_PV, implMultiPv.MULTI_PV);
  assert.equal(Object.hasOwn(utama, "MULTI_PV"), false);

  for (const api of [implDasar, fasadDasar, lamaDasar]) {
    assert.deepEqual(Object.keys(api).sort(), namaDasar);
    assert.equal(Object.hasOwn(api, "default"), false);
  }
  for (const nama of namaDasar) {
    assert.strictEqual(fasadDasar[nama], implDasar[nama], nama);
    assert.strictEqual(lamaDasar[nama], implDasar[nama], nama);
    assert.strictEqual(antiCheat[nama], implDasar[nama], `antiCheat.${nama}`);
    assert.equal(Object.hasOwn(utama, nama), false, nama);
  }

  for (const konstanta of ["AMBANG", "BOBOT"]) {
    assert.equal(Object.isFrozen(implDasar[konstanta]), true, konstanta);
    assert.strictEqual(lamaDasar[konstanta], implDasar[konstanta], konstanta);
    assert.strictEqual(fasadDasar[konstanta], implDasar[konstanta], konstanta);
    assert.strictEqual(antiCheat[konstanta], implDasar[konstanta], konstanta);
  }

  // Barrel publik index.js tetap pada 34 ekspor bernama.
  assert.equal(Object.hasOwn(utama, "default"), false);
  assert.equal(Object.keys(utama).length, 34);
});

test("multiPv facade, antiCheatDasar facade and legacy shim use direct named re-exports", () => {
  deklarasiReexport(fasadMultiPvPath, implMultiPvPath, ["MULTI_PV"]);
  deklarasiReexport(fasadDasarPath, implDasarPath, namaDasar);
  deklarasiReexport(lamaDasarPath, implDasarPath, namaDasar);
});

test("multiPv and antiCheatDasar graphs stay isolated from React, engine.js, halaman and main barrel", () => {
  const graphMultiPv = grafDari(fasadMultiPvPath);
  assert.deepEqual(graphMultiPv.files, [fasadMultiPvPath, implMultiPvPath].sort());
  assert.deepEqual(graphMultiPv.paket, []);

  const dependensiDasar = [
    implDasarPath,
    fasadMultiPvPath,
    implMultiPvPath,
    penilaianPath,
    penilaianImplPath,
    keamananPath,
    bateraiPath,
    peluangPath,
    kurvaPeluangPath,
    evaluasiPath,
    konvensiEvaluasiPath,
  ];
  for (const awal of [fasadDasarPath, lamaDasarPath]) {
    const graph = grafDari(awal);
    assert.deepEqual(graph.files, [awal, ...dependensiDasar].sort(), awal);
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
  for (const jalur of [fasadMultiPvPath, implMultiPvPath, fasadDasarPath, implDasarPath]) {
    assert.equal(graphUtama.files.includes(jalur), false, jalur);
  }
});

test("multiPv and antiCheatDasar imports stay safe on a server without browser globals, fetch or Worker", () => {
  for (const entryPath of [fasadMultiPvPath, fasadDasarPath, lamaDasarPath]) {
    const url = pathToFileURL(resolve(akar, entryPath)).href;
    const isMultiPvOnly = entryPath === fasadMultiPvPath;
    const script = isMultiPvOnly
      ? `
        for (const key of ["window", "navigator", "WebAssembly", "localStorage", "sessionStorage", "document", "fetch"]) {
          Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error(key + " touched"); } });
        }
        globalThis.Worker = class { constructor() { throw new Error("worker created"); } };
        const api = await import(${JSON.stringify(url)});
        if (api.MULTI_PV !== 5) throw new Error("unexpected MULTI_PV");
        console.log("ok");
      `
      : `
        for (const key of ["window", "navigator", "WebAssembly", "localStorage", "sessionStorage", "document", "fetch"]) {
          Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error(key + " touched"); } });
        }
        globalThis.Worker = class { constructor() { throw new Error("worker created"); } };
        const api = await import(${JSON.stringify(url)});
        if (
          api.AMBANG.peringkatJenuh !== 6 ||
          api.nilaiCentipawn(["mate", 0]) !== -10000 ||
          api.cpKandidat({ mate: 2 }) !== 10000 ||
          api.pemainLangkah({ color: "w" }, 1) !== "b"
        ) {
          throw new Error("unexpected antiCheatDasar result");
        }
        console.log("ok");
      `;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: akar, encoding: "utf8" });
    assert.equal(child.status, 0, `${entryPath}: ${child.stderr}`);
    assert.equal(child.stdout.trim(), "ok", entryPath);
  }
});

test("MULTI_PV and antiCheatDasar symbols have expected single source definitions", () => {
  const simbolDasar = [...namaDasar, "daftarKandidatValid"];
  const definisiMultiPv = [];
  const definisiEksporMultiPv = [];
  const definisi = Object.fromEntries(simbolDasar.map((nama) => [nama, []]));
  const definisiEkspor = Object.fromEntries(namaDasar.map((nama) => [nama, []]));

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
        const targetNode = ts.isVariableDeclaration(node) ? node.parent?.parent : node;
        if (nama === "MULTI_PV") {
          definisiMultiPv.push(rel);
          if (targetNode && adaModifierEkspor(targetNode)) definisiEksporMultiPv.push(rel);
        }
        if (Object.hasOwn(definisi, nama)) definisi[nama].push(rel);
        if (Object.hasOwn(definisiEkspor, nama) && targetNode && adaModifierEkspor(targetNode)) {
          definisiEkspor[nama].push(rel);
        }
      }
      ts.forEachChild(node, kunjungi);
    }
    kunjungi(sf);
  }

  assert.deepEqual(definisiMultiPv, [implMultiPvPath]);
  assert.deepEqual(definisiEksporMultiPv, [implMultiPvPath]);

  for (const nama of namaDasar) {
    if (nama === "cpKandidat") {
      // Pemisahan disengaja: cpKandidat versi ±10000 di dasarAntiCheat vs ±1000 di deteksiLangkahKritis.
      const diharapkan = [implDasarPath, deteksiKritisImplPath].sort();
      assert.deepEqual(definisiEkspor[nama].slice().sort(), diharapkan, `export ${nama}`);
      assert.deepEqual(definisi[nama].slice().sort(), diharapkan, nama);
      continue;
    }
    assert.deepEqual(definisiEkspor[nama], [implDasarPath], `export ${nama}`);
    assert.deepEqual(definisi[nama], [implDasarPath], nama);
  }
  assert.deepEqual(definisi.daftarKandidatValid, [implDasarPath]);
});

test("only mapped application callers import or re-export MULTI_PV and antiCheatDasar symbols through internal facades", () => {
  const callersMultiPv = new Map([
    ["src/modul/analisis/dasarAntiCheat.js", ["MULTI_PV"]],
    ["src/halaman/Analisa/mesin/engine.js", ["MULTI_PV"]],
    ["src/halaman/Analisa/mesin/antiCheat.js", ["MULTI_PV"]],
    ["src/halaman/Analisa/akun/antiCheatRiwayat.js", ["MULTI_PV"]],
    ["src/halaman/Analisa/komponen/nav/ringkasanAntiCheat.jsx", ["MULTI_PV"]],
    ["src/halaman/Analisa/komponen/nav/layarDeteksiEngine.jsx", ["MULTI_PV"]],
  ]);
  for (const path of berkasKode(src)) {
    const nodes = astBerkas(path).statements.filter((node) =>
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && tujuan(path, node.moduleSpecifier.text) === resolve(akar, fasadMultiPvPath));
    if (nodes.length === 0) continue;
    const file = relative(akar, path);
    assert.ok(callersMultiPv.has(file), `Pemanggil MULTI_PV tak terpetakan: ${file}`);
    assert.equal(nodes.length, 1, file);
    const decl = nodes[0];
    const elemen = ts.isImportDeclaration(decl)
      ? decl.importClause?.namedBindings?.elements
      : (decl.exportClause && ts.isNamedExports(decl.exportClause) ? decl.exportClause.elements : null);
    assert.ok(Array.isArray(elemen), file);
    assert.deepEqual(
      elemen.map((item) => (item.propertyName ?? item.name).text).sort(),
      callersMultiPv.get(file).slice().sort(),
      file,
    );
    callersMultiPv.delete(file);
  }
  assert.deepEqual([...callersMultiPv.keys()], []);

  const callersDasar = new Map([
    ["src/halaman/Analisa/mesin/antiCheat.js", namaDasar],
    ["src/modul/analisis/kalibrasiAntiCheat.js", ["AMBANG", "LEVEL_RENDAH", "LEVEL_SEDANG", "LEVEL_TINGGI", "batasi01"]],
    ["src/modul/analisis/skorAntiCheat.js", [
      "AMBANG", "BOBOT", "LEVEL_SEMENTARA", "bulat1", "kehilanganMenangPermille",
      "kerugianCentipawn", "kerugianKandidatCp", "ketajamanKandidat", "korelasiSpearman",
      "normalkanSan", "pemainLangkah", "peringkatLangkahDalam", "statistikWaktu", "waktuBerpikir",
    ]],
    ["src/halaman/Analisa/mesin/antiCheat/agregat.js", [
      "AMBANG", "MIN_LANGKAH_AGGREGAT", "MIN_PARTAI_AGGREGAT", "bulat1", "pemainLangkah", "rataRata",
    ]],
  ]);
  for (const path of berkasKode(src)) {
    const nodes = astBerkas(path).statements.filter((node) =>
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && tujuan(path, node.moduleSpecifier.text) === resolve(akar, fasadDasarPath));
    if (nodes.length === 0) continue;
    const file = relative(akar, path);
    assert.ok(callersDasar.has(file), `Pemanggil antiCheatDasar tak terpetakan: ${file}`);
    assert.equal(nodes.length, 1, file);
    const decl = nodes[0];
    const elemen = ts.isImportDeclaration(decl)
      ? decl.importClause?.namedBindings?.elements
      : (decl.exportClause && ts.isNamedExports(decl.exportClause) ? decl.exportClause.elements : null);
    assert.ok(Array.isArray(elemen), file);
    assert.deepEqual(
      elemen.map((item) => (item.propertyName ?? item.name).text).sort(),
      callersDasar.get(file).slice().sort(),
      file,
    );
    callersDasar.delete(file);
  }
  assert.deepEqual([...callersDasar.keys()], []);
});

test("application code does not deep-import legacy dasar shim or private implementations", () => {
  const lama = resolve(akar, lamaDasarPath);
  const internalDasar = resolve(akar, implDasarPath);
  const internalMultiPv = resolve(akar, implMultiPvPath);
  const allowedDasar = new Set([lamaDasarPath, fasadDasarPath].map((file) => resolve(akar, file)));
  const allowedMultiPv = new Set([fasadMultiPvPath].map((file) => resolve(akar, file)));
  for (const path of berkasKode(src)) {
    for (const ref of referensi(path)) {
      const target = tujuan(path, ref);
      assert.notEqual(target, lama, `${relative(akar, path)} -> ${ref}`);
      if (target === internalDasar) assert.ok(allowedDasar.has(path), `${relative(akar, path)} -> ${ref}`);
      if (target === internalMultiPv) assert.ok(allowedMultiPv.has(path), `${relative(akar, path)} -> ${ref}`);
    }
  }
  assert.equal(existsSync(resolve(akar, "src/halaman/Analisa/konteks/mesin.jsx")), true);
  assert.equal(grafDari("src/modul/sesi/index.js").files.some((file) => file.startsWith("src/modul/analisis/")), false);
});
