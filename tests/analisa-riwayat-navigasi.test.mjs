import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import { TAMPILAN_ANALISA } from "../src/halaman/Analisa/konteks/analyzeKonteks.js";
import { buatPenyimpananPekerjaan, snapshotLaporanAman } from "../src/halaman/Analisa/pekerjaan.js";
import { catatFitur, KUNCI_FITUR } from "../src/halaman/Analisa/riwayatFitur.js";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));

function adapterMemori() {
  const isi = new Map();
  const daftar = new Map();
  return {
    async daftar() { return structuredClone([...daftar.values()]); },
    async ambil(id) { return structuredClone(isi.get(id) ?? null); },
    async simpan(record, metadata) { isi.set(record.id, structuredClone(record)); daftar.set(record.id, structuredClone(metadata)); },
    async hapus(id) { isi.delete(id); daftar.delete(id); },
  };
}

// Render the real workspace with its screen/engine boundaries replaced.
function siapkanAreaKerja(store, navigasi) {
  const Board = React.createContext(null);
  const Import = React.createContext(null);
  const Errors = React.createContext(null);
  let waktu = 0;
  const kosong = () => null;
  const pembungkus = ({ children }) => React.createElement(React.Fragment, null, children);
  const layarPapan = (props) => { navigasi.papan = props; return null; };
  const layar = Object.fromEntries([
    "layarAkun", "layarDatabase", "layarImpor", "layarDeteksiEngine", "layarWawasan", "layarPengaturan",
  ].map((nama) => [`./nav/${nama}.jsx`, { default: kosong }]));
  const dependencies = {
    "../konteks/analyzeKonteks.js": { TAMPILAN_ANALISA },
    "../konteks/boardKonteks.js": { useBoard: () => React.useContext(Board) },
    "../konteks/importKonteks.js": { useImport: () => React.useContext(Import) },
    "../konteks/errorsKonteks.js": { ErrorsContext: Errors },
    "../pekerjaan.js": { pekerjaan: store, snapshotLaporanAman },
    "../riwayatFitur.js": { KUNCI_FITUR, catatFitur: (fitur, target) => catatFitur(fitur, target, store, ++waktu) },
    "../usePekerjaan.js": { usePekerjaan: () => React.useSyncExternalStore(store.langganan, store.snapshot, store.snapshot) },
    "../../../lib/i18n.jsx": { useI18n: () => ({ t: (key) => key }) },
    "../../../components/ui/alert-dialog.jsx": Object.fromEntries([
      "AlertDialog", "AlertDialogAction", "AlertDialogCancel", "AlertDialogContent", "AlertDialogDescription",
      "AlertDialogFooter", "AlertDialogHeader", "AlertDialogTitle",
    ].map((nama) => [nama, pembungkus])),
    "./errors/pushPageError.js": { pushPageError: () => {} },
    "./game/game.jsx": { default: kosong },
    "./boardMenu/boardMenu.jsx": { default: kosong },
    "./menu/menu.jsx": { default: kosong },
    "./menu/analysis/gameButtons.jsx": { default: kosong },
    "./nav/validasiImpor.js": { validasiPgn: () => {} },
    "../../../lib/titipanAnalisa.js": { ambilPgnTitipan: () => "" },
    "./nav/layarPapan.jsx": { default: layarPapan },
    ...layar,
  };
  const filename = new URL("../src/halaman/Analisa/komponen/areaKerja.jsx", import.meta.url);
  const source = readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    fileName: filename.pathname,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const factory = runInThisContext(`(function (require, module, exports) {\n${compiled}\n})`);
  const result = { exports: {} };
  factory((id) => {
    if (id === "react" || id === "react/jsx-runtime") return require(id);
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected workspace dependency: ${id}`);
  }, result, result.exports);

  function Providers() {
    const tampilan = React.useState(TAMPILAN_ANALISA.PAPAN);
    const data = React.useState({ format: "fen", string: "", pekerjaanId: "laporan:aktif" });
    const pageState = React.useState("default");
    const errors = React.useState([]);
    navigasi.tampilan = tampilan[0];
    navigasi.setTampilan = tampilan[1];
    navigasi.data = data[0];
    return React.createElement(Board.Provider, { value: { tampilan } },
      React.createElement(Import.Provider, { value: { data, pageState } },
        React.createElement(Errors.Provider, { value: { errors } }, React.createElement(result.exports.default))));
  }
  return Providers;
}

test("opened screens enter history and their rows return to the corresponding feature or saved target", async (t) => {
  const oldDocument = globalThis.document;
  globalThis.document = { addEventListener() {}, removeEventListener() {}, querySelector() { return null; } };
  t.after(() => { if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument; });
  const store = buatPenyimpananPekerjaan(adapterMemori());
  await store.init();
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); });
  const records = () => store.snapshot().daftar.filter((item) => item.jenis === "fitur");
  const pindah = async (tampilan) => act(async () => { navigasi.setTampilan(tampilan); await flush(); await store.tungguTulis(); });
  assert.equal(records().length, 0); // The home screen itself is not a recent feature.

  for (const fitur of ["akun", "database", "deteksi-engine", "wawasan", "pengaturan", "impor", "bermain"]) {
    await pindah(fitur);
    assert.equal(navigasi.tampilan, fitur);
    assert.ok(records().some((item) => item.fitur === fitur));
    await pindah("papan");
  }
  assert.equal(records().length, 7);

  for (const fitur of ["akun", "database", "deteksi-engine", "wawasan", "pengaturan", "impor", "bermain"]) {
    const item = records().find((record) => record.fitur === fitur);
    await act(async () => { navigasi.papan.onBukaPekerjaan(item); await flush(); await store.tungguTulis(); });
    assert.equal(navigasi.tampilan, fitur);
    assert.ok(records().find((record) => record.id === item.id).waktu > item.waktu);
    await pindah("papan");
  }

  const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  await act(async () => {
    store.simpan({
      id: "laporan:lama", jenis: "laporan", status: "selesai", waktu: 1,
      sumber: { format: "fen", string: fen },
      snapshot: { versi: 1, game: [{ fen }], customLine: { moves: [] } },
    });
    store.simpan({ id: "draf:lama", jenis: "draf", status: "draf", waktu: 1, isi: { tipe: "pgn", pgn: "1. e4" } });
    catatFitur("bermain", "laporan:lama", store, 100);
    catatFitur("impor", "draf:lama", store, 101);
    await store.tungguTulis();
  });
  await act(async () => {
    navigasi.papan.onBukaPekerjaan(records().find((item) => item.targetId === "laporan:lama"));
    await flush(); await store.tungguTulis();
  });
  assert.equal(navigasi.tampilan, "bermain");
  assert.equal(navigasi.data.pekerjaanId, "laporan:lama");
  assert.equal(navigasi.data.pemulihan.snapshot.game[0].fen, fen);
  await pindah("papan");
  await act(async () => {
    store.tetapkanDrafAktif("draf:lain");
    navigasi.papan.onBukaPekerjaan(records().find((item) => item.targetId === "draf:lama"));
    await flush(); await store.tungguTulis();
  });
  assert.equal(navigasi.tampilan, "impor");
  assert.equal(store.snapshot().terakhirDrafId, "draf:lama");
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});
