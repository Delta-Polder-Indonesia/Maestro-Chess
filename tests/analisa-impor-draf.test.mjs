import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import { buatPenyimpananPekerjaan, simpanDrafImpor } from "../src/halaman/Analisa/pekerjaan.js";
import { tangkapGalatDiuji } from "./bantuGalat.mjs";
import { pesanPenyimpananPartai } from "../src/halaman/Analisa/database/statusSimpan.js";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));

function adapterMemori() {
  const isi = new Map();
  const daftar = new Map();
  return {
    isi,
    async daftar() { return structuredClone([...daftar.values()]); },
    async ambil(id) { return structuredClone(isi.get(id) ?? null); },
    async simpan(record, metadata) { isi.set(record.id, structuredClone(record)); daftar.set(record.id, structuredClone(metadata)); },
    async hapus(id) { isi.delete(id); daftar.delete(id); },
  };
}

// Render the actual import form, substituting storage, i18n and other boundaries.
function komponenImpor(store, onDatabaseImport = async () => ({ tersimpan: 1, diproses: 1, media: "indexedDB" }), warnings = []) {
  let idBaru = 0;
  const ErrorsContext = React.createContext({ errors: [[], () => {}] });
  const dependencies = {
    "./PanelLayar.jsx": { default: ({ headerKanan, children }) => React.createElement("section", null, headerKanan, children) },
    "../svg/ChessComLogo.jsx": { default: () => null },
    "../svg/LichessLogo.jsx": { default: () => null },
    "../../../../lib/i18n.jsx": { useI18n: () => ({ t: (key) => key }) },
    "../../basisData.js": { imporPgnKeBasisData: onDatabaseImport },
    "../../database/statusSimpan.js": { pesanPenyimpananPartai },
    "../../../../modul/sesi/galat.js": { ErrorsContext, pushPageWarning: (_set, judul, pesan, opsi) => warnings.push({ judul, pesan, opsi }) },
    "../../../../modul/pekerjaan/index.js": {
      ID_DRAF_IMPOR: "draf:impor", pekerjaan: store,
      buatIdDrafImpor: () => `draf:baru-${++idBaru}`,
      simpanDrafImpor: (draf, id) => simpanDrafImpor(draf, id, store),
      usePekerjaan: () => store.snapshot(),
    },
    "./validasiImpor.js": { BATAS_IMPOR: {}, KODE_GALAT: {}, validasiPgn: () => {}, validasiFen: (fen) => fen },
  };
  const filename = new URL("../src/halaman/Analisa/komponen/nav/layarImpor.jsx", import.meta.url);
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
    throw new Error(`Unexpected import dependency: ${id}`);
  }, result, result.exports);
  return result.exports.default;
}

function kontrol(renderer, id) {
  return renderer.root.find((node) => node.props["data-uji"] === id);
}

async function render(Impor, onImpor = () => {}, props = {}) {
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Impor, { onTutup: () => {}, onImpor, ...props }));
    await flush();
  });
  return renderer;
}

function pasangWindow(t) {
  const sebelumnya = globalThis.window;
  globalThis.window = { clearTimeout, setTimeout };
  t.after(() => { if (sebelumnya === undefined) delete globalThis.window; else globalThis.window = sebelumnya; });
}

test("successful import leaves a fresh draft without adding a button or overwriting the older one", async (t) => {
  pasangWindow(t);
  const adapter = adapterMemori();
  const store = buatPenyimpananPekerjaan(adapter);
  await store.init();
  simpanDrafImpor({ tipe: "pgn", pgn: "old PGN", fen: "", tautan: "" }, "draf:impor", store);
  await store.tungguTulis();
  const Impor = komponenImpor(store);
  const imported = [];
  let renderer = await render(Impor, (data) => imported.push(data));
  assert.equal(kontrol(renderer, "impor-pgn").props.value, "old PGN");
  assert.equal(store.snapshot().terakhirDrafId, "draf:impor");
  assert.equal(renderer.root.findAll((node) => node.props["data-uji"] === "impor-draf-baru").length, 0);
  await act(async () => { await kontrol(renderer, "kirim-impor").props.onClick(); });
  assert.deepEqual(imported, [{ format: "pgn", string: "old PGN" }]);
  const baru = store.snapshot().terakhirDrafId;
  assert.notEqual(baru, "draf:impor");
  act(() => renderer.unmount());

  renderer = await render(Impor);
  assert.equal(kontrol(renderer, "impor-pgn").props.value, "");
  act(() => kontrol(renderer, "impor-pgn").props.onChange({ currentTarget: { value: "new PGN" } }));
  await store.tungguTulis();
  assert.equal((await store.ambil("draf:impor")).isi.pgn, "old PGN");
  assert.equal((await store.ambil(baru)).isi.pgn, "new PGN");
  act(() => renderer.unmount());
  store.tetapkanDrafAktif("draf:impor");
  renderer = await render(Impor);
  assert.equal(kontrol(renderer, "impor-pgn").props.value, "old PGN");
  act(() => renderer.unmount());
  store.tetapkanDrafAktif(baru);
  renderer = await render(Impor);
  assert.equal(kontrol(renderer, "impor-pgn").props.value, "new PGN");
  act(() => renderer.unmount());
  await store.tungguTulis();
});

test("unreadable draft is not overwritten when later writes succeed", async (t) => {
  pasangWindow(t);
  const galat = tangkapGalatDiuji(t, "Gagal membaca pekerjaan Analisa:");
  const adapter = adapterMemori();
  const seeded = buatPenyimpananPekerjaan(adapter);
  simpanDrafImpor({ tipe: "pgn", pgn: "valuable original", fen: "", tautan: "" }, "draf:impor", seeded);
  await seeded.tungguTulis();
  const store = buatPenyimpananPekerjaan(adapter);
  await store.init();
  adapter.ambil = async () => { throw new Error("read failed"); };
  const renderer = await render(komponenImpor(store));
  assert.equal(store.snapshot().tersedia, false);
  assert.equal(galat.length, 1);
  assert.match(String(galat[0][1]), /read failed/);
  assert.equal(kontrol(renderer, "galat-draf").props.role, "alert");
  assert.equal(kontrol(renderer, "impor-pgn").props.value, "");
  assert.notEqual(store.snapshot().terakhirDrafId, "draf:impor");
  act(() => kontrol(renderer, "impor-pgn").props.onChange({ currentTarget: { value: "replacement text" } }));
  await store.tungguTulis();
  assert.equal(adapter.isi.get("draf:impor").isi.pgn, "valuable original");
  assert.equal(adapter.isi.get(store.snapshot().terakhirDrafId).isi.pgn, "replacement text");
  act(() => renderer.unmount());
});

test("a tab loads its own draft and defers import until confirmation", async (t) => {
  pasangWindow(t);
  const store = buatPenyimpananPekerjaan(adapterMemori());
  simpanDrafImpor({ tipe: "pgn", pgn: "first PGN" }, "draf:1", store);
  simpanDrafImpor({ tipe: "pgn", pgn: "second PGN" }, "draf:2", store);
  store.tetapkanDrafAktif("draf:2");
  await store.tungguTulis();
  const imported = [];
  const database = [];
  const draftIds = [];
  let lanjut;
  const renderer = await render(komponenImpor(store, async (pgn) => database.push(pgn)), (data) => imported.push(data), {
    drafId: "draf:1",
    onDrafId: (id) => draftIds.push(id),
    onSebelumImpor: (aksi) => { lanjut = aksi; },
  });
  assert.equal(kontrol(renderer, "impor-pgn").props.value, "first PGN");
  assert.equal(store.snapshot().terakhirDrafId, "draf:1");
  await act(async () => { await kontrol(renderer, "kirim-impor").props.onClick(); });
  assert.equal(typeof lanjut, "function");
  assert.deepEqual(imported, []);
  assert.deepEqual(database, []);
  assert.equal(store.snapshot().terakhirDrafId, "draf:1");
  assert.equal(kontrol(renderer, "impor-pgn").props.value, "first PGN");

  await act(async () => { lanjut(); await flush(); });
  assert.deepEqual(imported, [{ format: "pgn", string: "first PGN" }]);
  assert.deepEqual(database, ["first PGN"]);
  assert.deepEqual(draftIds, ["draf:1", "draf:baru-1"]);
  assert.equal((await store.ambil("draf:1")).isi.pgn, "first PGN");
  assert.equal((await store.ambil("draf:2")).isi.pgn, "second PGN");
  act(() => renderer.unmount());
  await store.tungguTulis();
});

test("PGN import warns after an asynchronous database failure without blocking analysis", async (t) => {
  pasangWindow(t);
  const store = buatPenyimpananPekerjaan(adapterMemori());
  simpanDrafImpor({ tipe: "pgn", pgn: "1. e4 e5 *" }, "draf:impor", store);
  await store.tungguTulis();
  const imported = [];
  const warnings = [];
  let selesai;
  const Impor = komponenImpor(store, () => new Promise((resolve) => { selesai = resolve; }), warnings);
  const renderer = await render(Impor, (data) => imported.push(data));
  await act(async () => { await kontrol(renderer, "kirim-impor").props.onClick(); });
  assert.deepEqual(imported, [{ format: "pgn", string: "1. e4 e5 *" }]);
  assert.deepEqual(warnings, []);
  await act(async () => {
    selesai({ diproses: 1, tersimpan: 0, sementara: 0, media: "gagal" });
    await flush();
  });
  assert.deepEqual(warnings, [{ judul: "analisa.basisData.simpanGagalJudul", pesan: "analisa.basisData.simpanGagal", opsi: { persisten: true } }]);
  act(() => renderer.unmount());
});
