import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import ts from "typescript";
import * as apiPekerjaan from "../src/modul/pekerjaan/index.js";
import * as pekerjaanLama from "../src/halaman/Analisa/pekerjaan.js";
import * as manajerLama from "../src/halaman/Analisa/manajerLaporan.js";
import * as riwayatLama from "../src/halaman/Analisa/riwayatFitur.js";
import * as hookLama from "../src/halaman/Analisa/usePekerjaan.js";

const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(akar, "src");
const modul = resolve(src, "modul/pekerjaan");
const api = resolve(modul, "index.js");
const legacy = new Map([
  [resolve(src, "halaman/Analisa/pekerjaan.js"), pekerjaanLama],
  [resolve(src, "halaman/Analisa/manajerLaporan.js"), manajerLama],
  [resolve(src, "halaman/Analisa/riwayatFitur.js"), riwayatLama],
  [resolve(src, "halaman/Analisa/usePekerjaan.js"), hookLama],
]);
const ekstensi = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];
const expected = {
  pekerjaan: [
    "ID_DRAF_IMPOR", "buatAdapterPekerjaan", "buatIdDrafImpor", "buatIdPekerjaan", "buatPenyimpananPekerjaan",
    "daftarkanPembacaLaporan", "judulPekerjaan", "pekerjaan", "simpanDrafImpor", "simpanLaporanAktif",
    "snapshotLaporanAman", "sumberPekerjaan",
  ],
  manajerLaporan: ["buatManajerLaporan"],
  riwayatFitur: ["KUNCI_FITUR", "catatFitur", "daftarRiwayat"],
  usePekerjaan: ["usePekerjaan"],
};

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

function diDalam(path, folder) {
  return path === folder || path.startsWith(folder + sep);
}

test("the facade and all four legacy paths preserve every original named export and identity", () => {
  assert.deepEqual(Object.keys(apiPekerjaan).sort(), Object.values(expected).flat().sort());
  for (const [path, lama] of legacy) {
    const nama = path.slice(path.lastIndexOf(sep) + 1, -3);
    assert.deepEqual(Object.keys(lama).sort(), [...expected[nama]].sort(), nama);
    for (const ekspor of expected[nama]) assert.strictEqual(lama[ekspor], apiPekerjaan[ekspor], `${nama}:${ekspor}`);
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
    assert.equal(ast.statements.length, 1, `${nama} must remain a re-export only`);
    assert.ok(ts.isExportDeclaration(ast.statements[0]));
    assert.equal(tujuan(path, ast.statements[0].moduleSpecifier.text), api);
  }
});

test("facade and legacy readers, writers, history and manager share the default singleton", async (tes) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  const factory = new IDBFactory();
  const opens = [];
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, writable: true, value: {
    open(name, version) { opens.push([name, version]); return factory.open(name, version); },
  } });
  tes.after(() => {
    if (original) Object.defineProperty(globalThis, "indexedDB", original);
    else delete globalThis.indexedDB;
  });
  assert.strictEqual(apiPekerjaan.pekerjaan, pekerjaanLama.pekerjaan);
  const lepas = pekerjaanLama.daftarkanPembacaLaporan(() => ({
    id: "laporan:lama-baru", jenis: "laporan", judul: "Berbagi", status: "selesai", waktu: 1,
  }));
  apiPekerjaan.simpanLaporanAktif();
  lepas();
  apiPekerjaan.simpanDrafImpor({ tipe: "pgn", pgn: "1. e4 *" });
  riwayatLama.catatFitur("impor", apiPekerjaan.ID_DRAF_IMPOR, undefined, 2);
  await apiPekerjaan.pekerjaan.tungguTulis();
  assert.equal((await pekerjaanLama.pekerjaan.ambil("laporan:lama-baru")).judul, "Berbagi");
  assert.equal((await pekerjaanLama.pekerjaan.ambil(apiPekerjaan.ID_DRAF_IMPOR)).isi.pgn, "1. e4 *");
  assert.equal((await apiPekerjaan.pekerjaan.ambil("fitur:impor:draf:impor")).targetId, "draf:impor");
  const papan = { data: { pekerjaanId: "laporan:manajer", format: "pgn", string: "1. e4 *" }, game: [], pageState: "loading" };
  const manajer = manajerLama.buatManajerLaporan(() => papan);
  manajer.mulai({ data: papan.data, depth: 6 });
  manajer.gagal("laporan:manajer");
  manajer.tutup();
  await pekerjaanLama.pekerjaan.tungguTulis();
  assert.equal((await apiPekerjaan.pekerjaan.ambil("laporan:manajer")).status, "terputus");
  assert.deepEqual(opens, [["maestro_chess_pekerjaan_v1", 1]]);
});

test("Pekerjaan has no outgoing dependencies on other application features", () => {
  const antrean = berkasKode(modul);
  const diperiksa = new Set();
  const paket = new Set();
  while (antrean.length) {
    const source = antrean.shift();
    if (diperiksa.has(source)) continue;
    diperiksa.add(source);
    for (const ref of referensi(source)) {
      const target = tujuan(source, ref);
      if (target === null) {
        assert.ok(["react", "chess.js"].includes(ref), `Dependensi eksternal Pekerjaan tidak diizinkan: ${relative(akar, source)} -> ${ref}`);
        paket.add(ref);
      } else {
        assert.ok(diDalam(target, modul), `Pekerjaan tidak boleh bergantung ke fitur lain: ${relative(akar, source)} -> ${relative(akar, target)}`);
        antrean.push(target);
      }
    }
  }
  assert.ok(diperiksa.has(api));
  assert.deepEqual([...paket].sort(), ["chess.js", "react"]);
  const namaDb = berkasKode(src).filter((path) => readFileSync(path, "utf8").includes("maestro_chess_pekerjaan_v1"));
  assert.deepEqual(namaDb.map((path) => relative(akar, path)), ["src/modul/pekerjaan/pekerjaan.js"]);
});

test("all application consumers use the facade, not private files or legacy paths", () => {
  const konsumen = new Set();
  for (const source of berkasKode(src)) {
    if (diDalam(source, modul)) continue;
    for (const ref of referensi(source)) {
      const target = tujuan(source, ref);
      if (!target) continue;
      assert.equal(legacy.has(target), false, `Import path Pekerjaan lama di source: ${relative(akar, source)} -> ${ref}`);
      if (diDalam(target, modul)) {
        assert.equal(target, api, `Import internal Pekerjaan dari luar modul: ${relative(akar, source)} -> ${ref}`);
        if (!legacy.has(source)) konsumen.add(relative(akar, source));
      }
    }
  }
  for (const path of [
    "src/modul/sesi/tabKerja.js",
    "src/halaman/Analisa/konteks/import.jsx",
    "src/modul/sesi/TabKerjaProvider.jsx",
    "src/halaman/Analisa/komponen/areaKerja.jsx",
    "src/halaman/Analisa/komponen/tabBar.jsx",
    "src/halaman/Analisa/komponen/nav/daftarPekerjaan.jsx",
    "src/halaman/Analisa/komponen/nav/layarImpor.jsx",
    "src/halaman/Analisa/komponen/game/useMuatPartai.js",
    "src/halaman/Analisa/komponen/game/usePekerjaanLaporan.js",
  ]) assert.ok(konsumen.has(path), `Pemanggil belum memakai API Pekerjaan: ${path}`);
});
