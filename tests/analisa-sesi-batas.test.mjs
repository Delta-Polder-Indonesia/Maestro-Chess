import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import { ID_DRAF_IMPOR, KUNCI_FITUR } from "../src/modul/pekerjaan/index.js";
import * as modelLama from "../src/halaman/Analisa/tabKerja.js";
import * as modelPublik from "../src/modul/sesi/model.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(akar, "src");
const modul = resolve(src, "modul/sesi");
const api = resolve(modul, "index.js");
const model = resolve(modul, "model.js");
const preferensi = resolve(modul, "preferensi.js");
const galat = resolve(modul, "galat.js");
const titipan = resolve(modul, "titipan.js");
const impor = resolve(modul, "impor.js");
const imporProvider = resolve(modul, "imporProvider.js");
const panel = resolve(modul, "panel.js");
const papan = resolve(modul, "papan.js");
const papanProvider = resolve(modul, "papanProvider.js");
const analisa = resolve(modul, "analisa.js");
const analisaProvider = resolve(modul, "analisaProvider.js");
const mesin = resolve(modul, "mesin.js");
const lamaModel = resolve(src, "halaman/Analisa/tabKerja.js");
const lamaProvider = resolve(src, "halaman/Analisa/konteks/tabKerja.jsx");
const legacyTargets = new Map([
  [lamaModel, model],
  [lamaProvider, api],
  [resolve(src, "halaman/Analisa/penyimpanan.js"), resolve(modul, "penyimpanan.js")],
  [resolve(src, "halaman/Analisa/komponen/pengaturan/boardThemes.js"), resolve(modul, "boardThemes.js")],
  [resolve(src, "halaman/Analisa/konteks/configKonteks.js"), resolve(modul, "configKonteks.js")],
  [resolve(src, "halaman/Analisa/konteks/config.jsx"), resolve(modul, "ConfigContextProvider.jsx")],
  [resolve(src, "halaman/Analisa/komponen/errors/pushPageError.js"), resolve(modul, "pushPageError.js")],
  [resolve(src, "halaman/Analisa/konteks/errorsKonteks.js"), resolve(modul, "errorsKonteks.js")],
  [resolve(src, "halaman/Analisa/konteks/errors.jsx"), resolve(modul, "ErrorsContextProvider.jsx")],
  [resolve(src, "lib/titipanAnalisa.js"), resolve(modul, "titipanAnalisa.js")],
  [resolve(src, "halaman/Analisa/konteks/importKonteks.js"), resolve(modul, "importKonteks.js")],
  [resolve(src, "halaman/Analisa/konteks/import.jsx"), resolve(modul, "ImportProvider.jsx")],
  [resolve(src, "halaman/Analisa/konteks/panelAktif.js"), resolve(modul, "panelAktif.js")],
  [resolve(src, "halaman/Analisa/komponen/nav/useDropdown.js"), resolve(modul, "useDropdown.js")],
  [resolve(src, "halaman/Analisa/konteks/boardKonteks.js"), resolve(modul, "boardKonteks.js")],
  [resolve(src, "halaman/Analisa/konteks/board.jsx"), resolve(modul, "BoardProvider.jsx")],
  [resolve(src, "halaman/Analisa/konteks/analyzeKonteks.js"), resolve(modul, "analyzeKonteks.js")],
  [resolve(src, "halaman/Analisa/konteks/analyze.jsx"), resolve(modul, "AnalyzeContextProvider.jsx")],
  [resolve(src, "halaman/Analisa/konteks/mesinKonteks.js"), resolve(modul, "mesinKonteks.js")],
]);
const legacy = new Set(legacyTargets.keys());
const ekstensi = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];
const eksporModel = [
  "KUNCI_SESI_TAB", "aktifkanTab", "bacaSesiTab", "hapusPilihanAkun", "hapusTabLain", "idTabBaru",
  "normalisasiAkunTab", "perbaruiTab", "sesiBaru", "simpanSesiTab", "tabBaru", "tambahTab",
].sort();
const eksporProvider = ["TabKerjaProvider", "useTabKerja"];
const eksporPreferensi = [
  "bacaAngka", "bacaBoolean", "bacaTeks", "cobaBacaTeks", "tulis", "tulisBoolean",
  "boardThemes", "ConfigContext", "defaultUsedRatings", "ConfigContextProvider",
];
const eksporGalatTitipan = [
  "ErrorsContext", "ErrorsContextProvider", "pushPageError", "pushPageWarning",
  "KUNCI_PGN_TITIPAN", "adaPgnTitipan", "ambilPgnTitipan",
];
const eksporImpor = ["ImportContext", "useImport", "ImportProvider"];
const eksporPanel = ["PanelAktifContext", "tekanPanahOpsi", "useDropdown"];
const eksporPapan = ["BoardContext", "TampilanContext", "SetTampilanContext", "useBoard", "useTampilan", "useSetTampilan", "BoardProvider"];
const eksporAnalisa = ["AnalyzeContext", "TAMPILAN_ANALISA", "normalisasiPemain", "AnalyzeContextProvider"];
const eksporMesin = ["KonteksMesin", "useMesin"];

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

function muatDenganPekerjaanTiruan() {
  return buatPemuatJsx({
    "src/modul/pekerjaan/index.js": {
      ID_DRAF_IMPOR, KUNCI_FITUR,
      buatIdDrafImpor: () => "draf:uji",
      pekerjaan: { init: async () => {}, snapshot: () => ({ daftar: [] }), tetapkanDrafAktif: () => {} },
    },
  });
}

test("public and legacy paths expose all original names and the same exported identities", () => {
  assert.deepEqual(Object.keys(modelPublik).sort(), eksporModel);
  assert.deepEqual(Object.keys(modelLama).sort(), eksporModel);
  for (const nama of eksporModel) assert.strictEqual(modelLama[nama], modelPublik[nama], nama);

  // Node tidak mengimpor JSX secara native. Pemuat ini meng-cache modul setelah
  // transpile sehingga jalur fasad dan shim dievaluasi dalam satu registry.
  const muat = muatDenganPekerjaanTiruan();
  const fasad = muat("src/modul/sesi/index.js");
  const murni = muat("src/modul/sesi/model.js");
  const lama = muat("src/halaman/Analisa/tabKerja.js");
  const provider = muat("src/halaman/Analisa/konteks/tabKerja.jsx");
  assert.deepEqual(Object.keys(fasad).sort(), [...eksporModel, ...eksporProvider, ...eksporPreferensi, ...eksporGalatTitipan, ...eksporImpor, ...eksporPanel, ...eksporPapan, ...eksporAnalisa, ...eksporMesin].sort());
  assert.deepEqual(Object.keys(provider).sort(), eksporProvider);
  for (const nama of eksporModel) {
    assert.strictEqual(fasad[nama], murni[nama], nama);
    assert.strictEqual(lama[nama], murni[nama], nama);
  }
  for (const nama of eksporProvider) assert.strictEqual(provider[nama], fasad[nama], nama);
  for (const [path, expected] of [[lamaModel, model], [lamaProvider, api]]) {
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
    assert.equal(ast.statements.length, 1, `${relative(akar, path)} harus hanya re-export`);
    assert.ok(ts.isExportDeclaration(ast.statements[0]));
    assert.equal(tujuan(path, ast.statements[0].moduleSpecifier.text), expected);
  }
});

test("facade and legacy hooks observe the same provider context and session state", async (tes) => {
  const lamaStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const nilai = new Map();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, writable: true, value: {
    getItem: (key) => nilai.get(key) ?? null,
    setItem: (key, value) => nilai.set(key, value),
  } });
  tes.after(() => {
    if (lamaStorage) Object.defineProperty(globalThis, "sessionStorage", lamaStorage);
    else delete globalThis.sessionStorage;
  });
  const muat = muatDenganPekerjaanTiruan();
  const fasad = muat("src/modul/sesi/index.js");
  const legacyApi = muat("src/halaman/Analisa/konteks/tabKerja.jsx");
  let baru;
  let lama;
  function Probe() {
    baru = fasad.useTabKerja();
    lama = legacyApi.useTabKerja();
    return null;
  }
  let renderer;
  tes.after(() => { if (renderer) act(() => renderer.unmount()); });
  await act(async () => { renderer = TestRenderer.create(React.createElement(legacyApi.TabKerjaProvider, null, React.createElement(Probe))); await flush(); });
  assert.strictEqual(baru, lama);
  const id = baru.aktifId;
  await act(async () => { lama.catat(id, { drafId: "draf:shared" }); await flush(); });
  assert.strictEqual(baru, lama);
  assert.equal(baru.daftar[0].drafId, "draf:shared");
  assert.equal(JSON.parse(nilai.get("maestro-analisa-tab-v1")).daftar[0].drafId, "draf:shared");
  await act(async () => { renderer.unmount(); renderer = TestRenderer.create(React.createElement(fasad.TabKerjaProvider, null, React.createElement(Probe))); await flush(); });
  assert.strictEqual(baru, lama);
  assert.equal(lama.daftar[0].drafId, "draf:shared");
});

test("separate provider instances keep independent in-memory sessions", async (tes) => {
  const lamaStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const lamaCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  const nilai = new Map();
  let nomor = 0;
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, writable: true, value: {
    getItem: (key) => nilai.get(key) ?? null,
    setItem: (key, value) => nilai.set(key, value),
  } });
  Object.defineProperty(globalThis, "crypto", { configurable: true, writable: true, value: { randomUUID: () => `fixed-${++nomor}` } });
  tes.after(() => {
    if (lamaStorage) Object.defineProperty(globalThis, "sessionStorage", lamaStorage);
    else delete globalThis.sessionStorage;
    if (lamaCrypto) Object.defineProperty(globalThis, "crypto", lamaCrypto);
    else delete globalThis.crypto;
  });
  const fasad = muatDenganPekerjaanTiruan()("src/modul/sesi/index.js");
  const sesi = {};
  function Probe({ nama }) { sesi[nama] = fasad.useTabKerja(); return null; }
  let renderer;
  tes.after(() => { if (renderer) act(() => renderer.unmount()); });
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(React.Fragment, null,
      React.createElement(fasad.TabKerjaProvider, null, React.createElement(Probe, { nama: "satu" })),
      React.createElement(fasad.TabKerjaProvider, null, React.createElement(Probe, { nama: "dua" }))));
    await flush();
  });
  assert.notStrictEqual(sesi.satu, sesi.dua);
  assert.notEqual(sesi.satu.aktifId, sesi.dua.aktifId);
  const idDua = sesi.dua.aktifId;
  await act(async () => { sesi.satu.catat(sesi.satu.aktifId, { drafId: "draf:hanya-satu" }); await flush(); });
  assert.equal(sesi.satu.daftar[0].drafId, "draf:hanya-satu");
  assert.equal(sesi.dua.aktifId, idDua);
  assert.equal(sesi.dua.daftar[0].drafId, null);
});

test("session module has no new external dependencies and keeps the one tab-session storage key", () => {
  const keluar = new Set();
  const paket = new Set();
  for (const source of berkasKode(modul)) {
    for (const ref of referensi(source)) {
      const target = tujuan(source, ref);
      if (target === null) paket.add(ref);
      else if (!diDalam(target, modul)) keluar.add(`${relative(akar, source)} -> ${relative(akar, target)}`);
    }
  }
  assert.deepEqual([...paket].sort(), ["react"]);
  assert.deepEqual([...keluar].sort(), [
    "src/modul/sesi/BoardProvider.jsx -> src/lib/i18n.jsx",
    "src/modul/sesi/ImportProvider.jsx -> src/modul/pekerjaan/index.js",
    "src/modul/sesi/TabKerjaProvider.jsx -> src/modul/pekerjaan/index.js",
    "src/modul/sesi/tabKerja.js -> src/modul/pekerjaan/index.js",
  ].sort());
  const penyimpanKunci = berkasKode(src).filter((path) => readFileSync(path, "utf8").includes('"maestro-analisa-tab-v1"'));
  assert.deepEqual(penyimpanKunci.map((path) => relative(akar, path)), ["src/modul/sesi/tabKerja.js"]);
});

test("application consumers use the public facade, never legacy or private session files", () => {
  const konsumen = new Set();
  for (const source of berkasKode(src)) {
    if (diDalam(source, modul)) continue;
    for (const ref of referensi(source)) {
      const target = tujuan(source, ref);
      if (!target) continue;
      assert.equal(legacy.has(target), false, `Import Sesi lama di source: ${relative(akar, source)} -> ${ref}`);
      if (diDalam(target, modul)) {
        if (legacyTargets.has(source)) assert.equal(target, legacyTargets.get(source), `Shim salah: ${relative(akar, source)}`);
        else assert.ok([api, preferensi, galat, titipan, impor, imporProvider, panel, papan, papanProvider, analisa, analisaProvider, mesin].includes(target), `Import internal Sesi dari luar modul: ${relative(akar, source)} -> ${ref}`);
        if (!legacy.has(source)) konsumen.add(`${relative(akar, source)} -> ${relative(akar, target)}`);
      }
    }
  }
  // Pemanggil hanya memakai fasad publik yang sesuai; shim galat, titipan,
  // impor, panel, dropdown, papan, Analyze, dan context Mesin meneruskan langsung ke implementasi masing-masing.
  assert.deepEqual([...konsumen].sort(), [
    "src/halaman/Analisa/Analisa.jsx -> src/modul/sesi/index.js",
    "src/halaman/Analisa/Analisa.jsx -> src/modul/sesi/analisaProvider.js",
    "src/halaman/Analisa/akun/FormulirAkun.jsx -> src/modul/sesi/preferensi.js",
    "src/halaman/Analisa/akun/PanelTarikPartai.jsx -> src/modul/sesi/preferensi.js",
    "src/halaman/Analisa/akun/daftarAkun.js -> src/modul/sesi/preferensi.js",
    "src/halaman/Analisa/komponen/areaKerja.jsx -> src/modul/sesi/index.js",
    "src/halaman/Analisa/komponen/areaKerja.jsx -> src/modul/sesi/galat.js",
    "src/halaman/Analisa/komponen/areaKerja.jsx -> src/modul/sesi/titipan.js",
    "src/halaman/Analisa/komponen/areaKerja.jsx -> src/modul/sesi/impor.js",
    "src/halaman/Analisa/komponen/areaKerja.jsx -> src/modul/sesi/panel.js",
    "src/halaman/Analisa/komponen/areaKerja.jsx -> src/modul/sesi/papan.js",
    "src/halaman/Analisa/komponen/areaKerja.jsx -> src/modul/sesi/analisa.js",
    "src/halaman/Analisa/komponen/boardMenu/boardMenu.jsx -> src/modul/sesi/papan.js",
    "src/halaman/Analisa/komponen/boardMenu/boardMenu.jsx -> src/modul/sesi/analisa.js",
    "src/halaman/Analisa/komponen/errors/pageErrors.jsx -> src/modul/sesi/galat.js",
    "src/halaman/Analisa/komponen/game/board.jsx -> src/modul/sesi/preferensi.js",
    "src/halaman/Analisa/komponen/game/game.jsx -> src/modul/sesi/preferensi.js",
    "src/halaman/Analisa/komponen/game/game.jsx -> src/modul/sesi/galat.js",
    "src/halaman/Analisa/komponen/game/game.jsx -> src/modul/sesi/analisa.js",
    "src/halaman/Analisa/komponen/game/game.jsx -> src/modul/sesi/mesin.js",
    "src/halaman/Analisa/komponen/game/keyboardPapan.js -> src/modul/sesi/analisa.js",
    "src/halaman/Analisa/komponen/game/pendengarKeyboard.jsx -> src/modul/sesi/papan.js",
    "src/halaman/Analisa/komponen/game/useAnalisisPapan.js -> src/modul/sesi/galat.js",
    "src/halaman/Analisa/komponen/game/useMuatPartai.js -> src/modul/sesi/galat.js",
    "src/halaman/Analisa/komponen/game/useMuatPartai.js -> src/modul/sesi/titipan.js",
    "src/halaman/Analisa/komponen/menu/analysis/gameButtons.jsx -> src/modul/sesi/papan.js",
    "src/halaman/Analisa/komponen/menu/loading/loading.jsx -> src/modul/sesi/impor.js",
    "src/halaman/Analisa/komponen/menu/loading/loading.jsx -> src/modul/sesi/mesin.js",
    "src/halaman/Analisa/komponen/menu/menu.jsx -> src/modul/sesi/analisa.js",
    "src/halaman/Analisa/komponen/nav/SelectDaftar.jsx -> src/modul/sesi/panel.js",
    "src/halaman/Analisa/komponen/nav/database/tabelPartai.jsx -> src/modul/sesi/panel.js",
    "src/halaman/Analisa/komponen/nav/layarAkun.jsx -> src/modul/sesi/galat.js",
    "src/halaman/Analisa/komponen/nav/layarAkun.jsx -> src/modul/sesi/analisa.js",
    "src/halaman/Analisa/komponen/nav/layarDeteksiEngine.jsx -> src/modul/sesi/analisa.js",
    "src/halaman/Analisa/komponen/nav/layarDeteksiEngine.jsx -> src/modul/sesi/mesin.js",
    "src/halaman/Analisa/komponen/nav/layarEngine.jsx -> src/modul/sesi/analisa.js",
    "src/halaman/Analisa/komponen/nav/layarEngine.jsx -> src/modul/sesi/mesin.js",
    "src/halaman/Analisa/komponen/nav/layarWawasan.jsx -> src/modul/sesi/analisa.js",
    "src/halaman/Analisa/komponen/nav/layarImpor.jsx -> src/modul/sesi/galat.js",
    "src/halaman/Analisa/komponen/nav/layarPengaturan.jsx -> src/modul/sesi/preferensi.js",
    "src/halaman/Analisa/komponen/nav/nav.jsx -> src/modul/sesi/index.js",
    "src/halaman/Analisa/komponen/nav/nav.jsx -> src/modul/sesi/preferensi.js",
    "src/halaman/Analisa/komponen/nav/nav.jsx -> src/modul/sesi/papan.js",
    "src/halaman/Analisa/komponen/nav/nav.jsx -> src/modul/sesi/analisa.js",
    "src/halaman/Analisa/komponen/pengaturan/bestMoves.jsx -> src/modul/sesi/preferensi.js",
    "src/halaman/Analisa/komponen/pengaturan/mesin.jsx -> src/modul/sesi/preferensi.js",
    "src/halaman/Analisa/komponen/pengaturan/mesin.jsx -> src/modul/sesi/analisa.js",
    "src/halaman/Analisa/komponen/pengaturan/mesin.jsx -> src/modul/sesi/mesin.js",
    "src/halaman/Analisa/komponen/pengaturan/moves.jsx -> src/modul/sesi/preferensi.js",
    "src/halaman/Analisa/komponen/pengaturan/ratings.jsx -> src/modul/sesi/preferensi.js",
    "src/halaman/Analisa/komponen/pengaturan/themes.jsx -> src/modul/sesi/preferensi.js",
    "src/halaman/Analisa/konteks/mesin.jsx -> src/modul/sesi/preferensi.js",
    "src/halaman/Analisa/konteks/mesin.jsx -> src/modul/sesi/mesin.js",
  ].sort());
});
