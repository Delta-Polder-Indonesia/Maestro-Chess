import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const wrapper = ({ children }) => React.createElement(React.Fragment, null, children);
const kosong = () => null;
const t = (key) => key;

function kompilasi(path, dependencies, namaExport = "default") {
  const filename = new URL(path, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename.pathname,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = { exports: {} };
  runInThisContext(`(function (require, module, exports) {\n${compiled}\n})`)((id) => {
    if (["react", "react/jsx-runtime", "lucide-react"].includes(id)) return require(id);
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected panel dependency: ${id}`);
  }, result, result.exports);
  return result.exports[namaExport];
}

function lingkungan(tes) {
  const lamaDocument = globalThis.document;
  const lamaWindow = globalThis.window;
  globalThis.document = { querySelector: () => null };
  globalThis.window = { setTimeout, clearTimeout };
  tes.after(() => {
    if (lamaDocument === undefined) delete globalThis.document; else globalThis.document = lamaDocument;
    if (lamaWindow === undefined) delete globalThis.window; else globalThis.window = lamaWindow;
  });
}

function dialogMock() {
  const nama = ["AlertDialogAction", "AlertDialogCancel", "AlertDialogContent", "AlertDialogDescription", "AlertDialogFooter", "AlertDialogHeader", "AlertDialogTitle"];
  return {
    ...Object.fromEntries(nama.map((key) => [key, wrapper])),
    AlertDialog: ({ open, children }) => React.createElement("div", { "data-uji": "dialog-test", "data-open": Boolean(open) }, open ? children : null),
  };
}

test("a hidden account tab closes its portaled delete confirmation", async (tes) => {
  lingkungan(tes);
  const KartuAkun = kompilasi("../src/halaman/Analisa/akun/KartuAkun.jsx", {
    "../../../lib/i18n.jsx": { useI18n: () => ({ t, bahasa: "id" }) },
    "../../../components/ui/tooltip.jsx": { TooltipLabel: wrapper },
    "../../../components/ui/alert-dialog.jsx": dialogMock(),
    "../../../lib/pemainCatur.js": { useKartuPemain: () => null },
    "../basisData.js": { bacaRevisiBasis: () => 0, ambilDaftarPartai: async () => ({ partai: [], total: 0 }) },
    "../komponen/svg/profile.jsx": { default: kosong },
    "../komponen/svg/trash.jsx": { default: kosong },
  });
  let renderer;
  const props = { platform: "chessCom", username: "Alice", onPilih() {}, onHapus() {} };
  await act(async () => { renderer = TestRenderer.create(React.createElement(KartuAkun, { ...props, tabAktif: true })); await flush(); });
  act(() => renderer.root.findByProps({ "aria-label": "analisa.akun.hapus: Alice" }).props.onClick({ stopPropagation() {} }));
  assert.equal(renderer.root.findByProps({ "data-uji": "dialog-test" }).props["data-open"], true);
  act(() => renderer.update(React.createElement(KartuAkun, { ...props, tabAktif: false })));
  assert.equal(renderer.root.findByProps({ "data-uji": "dialog-test" }).props["data-open"], false);
  act(() => renderer.update(React.createElement(KartuAkun, { ...props, tabAktif: true })));
  assert.equal(renderer.root.findByProps({ "data-uji": "dialog-test" }).props["data-open"], false);
  act(() => renderer.unmount());
});

test("a hidden detection tab closes its portal and aborts its engine search without losing input", async (tes) => {
  lingkungan(tes);
  const AnalyzeContext = React.createContext(null);
  let sinyal;
  const mesin = { idEngine: "engine", opsi: { hash: 32 }, siapkan: async () => ({}), setop() {} };
  const Deteksi = kompilasi("../src/halaman/Analisa/komponen/nav/layarDeteksiEngine.jsx", {
    "../../../../lib/i18n.jsx": { useI18n: () => ({ t }) },
    "../../../../lib/asets.js": { gambar: (x) => x },
    "../../../../lib/engineCatur.js": { DAFTAR_ENGINE: [{ id: "engine", label: "Stockfish 18" }], cariEngine: () => ({ label: "Stockfish 18" }) },
    "../../konteks/analyzeKonteks.js": { AnalyzeContext },
    "../../konteks/mesinKonteks.js": { useMesin: () => mesin },
    "../../basisData.js": { ambilDaftarPartai: async () => ({ partai: [{ pgn: "1. e4 *" }] }) },
    "../../akun/useAkunKoleksi.js": { useAkunKoleksi: () => ({ akunTersimpan: [], koleksi: [] }) },
    "../../akun/antiCheatRiwayat.js": {
      BATAS_PARTAI: 50, KEDALAMAN_AGGREGAT: 6, batasPartaiDariInput: (value) => Number(value) || 50,
      analisisRiwayatAntiCheat: ({ sinyal: value }) => { sinyal = value; return new Promise(() => {}); },
    },
    "../../mesin/engine.js": { MULTI_PV: 1 },
    "../../mesin/cekWasm.js": { hashUntukEngine: () => 32 },
    "../../mesin/laporanPeninjauan.js": { unduhLaporanPeninjauan() {} },
    "./PanelLayar.jsx": { default: wrapper },
    "./ringkasanAntiCheat.jsx": { default: kosong },
    "./SelectDaftar.jsx": { default: kosong },
    "../Gambar.jsx": { default: kosong },
    "../../../../components/ui/alert-dialog.jsx": dialogMock(),
  });
  const analyze = { akun: [{ platform: "chessCom", username: "Alice" }, () => {}], pageState: ["default"], analyzingMove: [false] };
  const isi = (aktif) => React.createElement(AnalyzeContext.Provider, { value: analyze }, React.createElement(Deteksi, { aktif }));
  let renderer;
  await act(async () => { renderer = TestRenderer.create(isi(true)); await flush(); });
  act(() => renderer.root.findByProps({ "data-uji": "deteksi-jumlah" }).props.onChange({ currentTarget: { value: "12" } }));
  act(() => renderer.root.findByProps({ "data-uji": "info-jumlah" }).props.onClick());
  assert.equal(renderer.root.findByProps({ "data-uji": "dialog-test" }).props["data-open"], true);
  const mulai = renderer.root.findAllByType("button").find((node) => node.children.includes("analisa.antiCheat.riwayat.mulai"));
  await act(async () => { mulai.props.onClick(); await flush(); });
  assert.ok(sinyal && !sinyal.aborted);
  await act(async () => { renderer.update(isi(false)); await flush(); });
  assert.equal(sinyal.aborted, true);
  assert.equal(renderer.root.findAllByProps({ "data-uji": "dialog-test" }).length, 0);
  assert.equal(renderer.root.findByProps({ "data-uji": "deteksi-jumlah" }).props.value, "12");
  act(() => renderer.update(isi(true)));
  assert.equal(renderer.root.findAllByProps({ "data-uji": "dialog-test" }).length, 0);
  assert.equal(renderer.root.findByProps({ "data-uji": "deteksi-jumlah" }).props.value, "12");
  act(() => renderer.unmount());
});

test("hidden database dialogs and delayed reads cannot reopen or navigate a later visit", async (tes) => {
  lingkungan(tes);
  const ekspor = [];
  const partai = [];
  const analisis = [];
  let tutup = 0;
  const Database = kompilasi("../src/halaman/Analisa/komponen/nav/layarDatabase.jsx", {
    "./PanelLayar.jsx": { default: wrapper },
    "../svg/database.jsx": { default: kosong },
    "../svg/back.jsx": { default: kosong },
    "../../../../components/ui/alert.jsx": { Alert: wrapper, Alertjudul: wrapper },
    "../../../../components/ui/tooltip.jsx": { TooltipLabel: wrapper },
    "../../../../lib/i18n.jsx": { useI18n: () => ({ t, bahasa: "id" }) },
    "../../basisData.js": {
      bacaRevisiBasis: () => 0, langgananRevisi: () => () => {},
      ambilSemuaKoleksi: async () => [], hitungStatistikBasisData: async () => ({}),
      ambilDaftarPartai: async () => ({ partai: [], total: 0 }),
      hitungStatistikKoleksiRingan: async () => ({}), pastikanKoleksi: async () => {},
      eksporPgnKoleksi: () => new Promise((resolve) => ekspor.push(resolve)),
      ambilPartai: () => new Promise((resolve) => partai.push(resolve)),
    },
    "../../akun/daftarAkun.js": { bacaDaftarAkun: () => [] },
    "./database/formatDatabase.js": { BARIS_PER_HALAMAN: 20 },
    "./database/toolbarTabel.jsx": { default: kosong },
    "./database/kolomKoleksi.jsx": { default: (props) => React.createElement(React.Fragment, null,
      React.createElement("button", { "data-uji": "tes-hapus", onClick: () => props.tanganiHapusKoleksi("koleksi:1") }),
      React.createElement("button", { "data-uji": "tes-ekspor", onClick: () => props.tanganiEksporPgn("koleksi:1") })) },
    "./database/panelRingkasanDatabase.jsx": { default: (props) => React.createElement("button", { "data-uji": "tes-analisa", onClick: () => props.tanganiAnalisa({ id: "partai:1" }) }) },
    "./database/panelTabelData.jsx": { default: kosong },
    "./database/dialogDatabase.jsx": { default: (props) => React.createElement("div", { "data-uji": "dialog-database-test", ...props }) },
  });
  const props = { onAnalisa: (data) => { analisis.push(data); return false; }, onTutup: () => { tutup += 1; }, onBukaAkun() {} };
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Database, { ...props, aktif: true })); await flush(); });
  const dialog = () => renderer.root.findByProps({ "data-uji": "dialog-database-test" });
  act(() => renderer.root.findByProps({ "data-uji": "tes-hapus" }).props.onClick());
  assert.equal(dialog().props.dialogHapusKoleksi, "koleksi:1");
  act(() => renderer.update(React.createElement(Database, { ...props, aktif: false })));
  assert.equal(renderer.root.findAllByProps({ "data-uji": "dialog-database-test" }).length, 0);
  act(() => renderer.update(React.createElement(Database, { ...props, aktif: true })));
  assert.equal(dialog().props.dialogHapusKoleksi, null);

  act(() => { renderer.root.findByProps({ "data-uji": "tes-ekspor" }).props.onClick(); });
  act(() => { renderer.root.findByProps({ "data-uji": "tes-analisa" }).props.onClick(); });
  act(() => renderer.update(React.createElement(Database, { ...props, aktif: false })));
  act(() => renderer.update(React.createElement(Database, { ...props, aktif: true })));
  await act(async () => { ekspor[0](""); partai[0]({ pgn: "1. e4 *" }); await flush(); });
  assert.equal(dialog().props.dialogEksporKosong, false);
  assert.deepEqual(analisis, []);
  assert.equal(tutup, 0);

  act(() => { renderer.root.findByProps({ "data-uji": "tes-analisa" }).props.onClick(); });
  await act(async () => { partai[1]({ pgn: "1. d4 *" }); await flush(); });
  assert.deepEqual(analisis, [{ format: "pgn", string: "1. d4 *" }]);
  assert.equal(tutup, 0); // onAnalisa=false defers closing to the workspace confirmation
  act(() => { renderer.root.findByProps({ "data-uji": "tes-ekspor" }).props.onClick(); });
  await act(async () => { ekspor[1](""); await flush(); });
  assert.equal(dialog().props.dialogEksporKosong, true);
  act(() => renderer.unmount());
});

test("returning to an account tab refreshes the shared list changed by another tab", async (tes) => {
  lingkungan(tes);
  const AnalyzeContext = React.createContext(null);
  let daftar = [{ platform: "chessCom", username: "Alice" }, { platform: "chessCom", username: "Bob" }];
  const Akun = kompilasi("../src/halaman/Analisa/komponen/nav/layarAkun.jsx", {
    "./PanelLayar.jsx": { default: wrapper },
    "../../akun/DaftarAkun.jsx": { default: ({ daftar: nilai }) => React.createElement("div", { "data-uji": "daftar-akun-test", daftar: nilai }) },
    "../../akun/PanelTarikPartai.jsx": { default: kosong },
    "../../akun/daftarAkun.js": { bacaDaftarAkun: () => [...daftar], tambahKeDaftar: () => [...daftar], hapusDariDaftar: () => [...daftar] },
    "../../basisData.js": { bacaRevisiBasis: () => 0, pastikanKoleksi: async () => {}, hapusKoleksi: async () => {} },
    "../../konteks/analyzeKonteks.js": { AnalyzeContext },
  });
  const analyze = { akun: [{ platform: "chessCom", username: "" }, () => {}] };
  const isi = (aktif) => React.createElement(AnalyzeContext.Provider, { value: analyze }, React.createElement(Akun, { aktif, onTutup() {} }));
  let renderer;
  await act(async () => { renderer = TestRenderer.create(isi(true)); await flush(); });
  const akun = () => renderer.root.findByProps({ "data-uji": "daftar-akun-test" }).props.daftar.map((item) => item.username);
  assert.deepEqual(akun(), ["Alice", "Bob"]);
  act(() => renderer.update(isi(false)));
  daftar = [daftar[1]];
  assert.deepEqual(akun(), ["Alice", "Bob"]);
  act(() => renderer.update(isi(true)));
  assert.deepEqual(akun(), ["Bob"]);
  act(() => renderer.unmount());
});

test("active account options refresh on database revisions and ignore stale reads", async () => {
  let akun = [{ username: "Alice" }, { username: "Bob" }];
  const pembaca = [];
  const pendengar = new Set();
  const useAkunKoleksi = kompilasi("../src/halaman/Analisa/akun/useAkunKoleksi.js", {
    "../basisData.js": {
      ambilSemuaKoleksi: () => new Promise((resolve) => pembaca.push(resolve)),
      langgananRevisi: (callback) => { pendengar.add(callback); return () => pendengar.delete(callback); },
    },
    "./daftarAkun.js": { bacaDaftarAkun: () => [...akun] },
  }, "useAkunKoleksi");
  function Panel({ aktif }) {
    const data = useAkunKoleksi(aktif);
    return React.createElement("div", { "data-uji": "akun-koleksi-test", ...data });
  }
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(Panel, { aktif: true })); });
  const nilai = () => renderer.root.findByProps({ "data-uji": "akun-koleksi-test" }).props;
  assert.equal(pendengar.size, 1);
  await act(async () => { pembaca[0]([{ username: "Alice" }, { username: "Bob" }]); await flush(); });
  assert.deepEqual(nilai().koleksi.map((a) => a.username), ["Alice", "Bob"]);
  akun = [{ username: "Bob" }];
  act(() => { for (const callback of pendengar) { callback(); callback(); } });
  await act(async () => { pembaca[2]([{ username: "Bob" }]); await flush(); });
  await act(async () => { pembaca[1]([{ username: "Alice" }, { username: "Bob" }]); await flush(); });
  assert.deepEqual(nilai().akunTersimpan.map((a) => a.username), ["Bob"]);
  assert.deepEqual(nilai().koleksi.map((a) => a.username), ["Bob"]);
  act(() => renderer.update(React.createElement(Panel, { aktif: false })));
  assert.equal(pendengar.size, 0);
  akun = [{ username: "Carol" }];
  act(() => renderer.update(React.createElement(Panel, { aktif: true })));
  await act(async () => { pembaca[3]([{ username: "Carol" }]); await flush(); });
  assert.deepEqual(nilai().akunTersimpan.map((a) => a.username), ["Carol"]);
  assert.deepEqual(nilai().koleksi.map((a) => a.username), ["Carol"]);
  act(() => renderer.unmount());
  assert.equal(pendengar.size, 0);
});

test("insights reload shared games on activation and revisions while retaining filters", async (tes) => {
  lingkungan(tes);
  const AnalyzeContext = React.createContext(null);
  const pembaca = [];
  const pendengar = new Set();
  const agregasi = [];
  const Wawasan = kompilasi("../src/halaman/Analisa/komponen/nav/layarWawasan.jsx", {
    "../../../../lib/i18n.jsx": { useI18n: () => ({ t, bahasa: "id" }) },
    "../../../../lib/pgnRingan.js": { hashPgn: () => "hash" },
    "../../konteks/analyzeKonteks.js": { AnalyzeContext },
    "../../basisData.js": {
      ambilDaftarPartai: () => new Promise((resolve) => pembaca.push(resolve)),
      langgananRevisi: (callback) => { pendengar.add(callback); return () => pendengar.delete(callback); },
    },
    "../../akun/useAkunKoleksi.js": { useAkunKoleksi: () => ({ akunTersimpan: [], koleksi: [] }) },
    "../../akun/DashboardAkun.jsx": { default: kosong },
    "../../mesin/wawasan.js": {
      agregasiWawasan: (daftar) => { agregasi.push(daftar.length); return { totalPartai: daftar.length, trenRating: [], hasilUmum: {}, sebagaiPutih: {}, sebagaiHitam: {} }; },
      filterPartaiWawasan: (daftar) => daftar, hitungPembukaanTeratas: () => [],
    },
    "../../mesin/analisisTersimpan.js": { ambilPetaAnalisis: () => ({}), langgananAnalisis: () => () => {} },
    "./PanelLayar.jsx": { default: wrapper },
    "./SelectDaftar.jsx": { default: kosong },
    "./wawasan/kartuProfil.jsx": { default: kosong },
    "./wawasan/filterBar.jsx": { default: (props) => React.createElement("div", { "data-uji": "filter-test", ...props }) },
    "./wawasan/kpiGrid.jsx": { default: ({ wawasan }) => React.createElement("div", { "data-uji": "kpi-test", total: wawasan.totalPartai }) },
    "./wawasan/grafikTrenRating.jsx": { default: kosong },
    "./wawasan/distribusiHasil.jsx": { default: kosong },
    "./wawasan/kartuPembukaan.jsx": { default: kosong },
    "./wawasan/kartuAkurasi.jsx": { default: kosong },
  });
  const context = { akun: [{ platform: "chessCom", username: "Alice" }, () => {}], game: [[]], players: [[]] };
  const isi = (aktif) => React.createElement(AnalyzeContext.Provider, { value: context }, React.createElement(Wawasan, { aktif }));
  const data = (jumlah) => ({ partai: Array.from({ length: jumlah }, (_, i) => ({ id: `partai:${i}` })) });
  let renderer;
  act(() => { renderer = TestRenderer.create(isi(true)); });
  await act(async () => { pembaca[0](data(1)); await flush(); });
  assert.equal(renderer.root.findByProps({ "data-uji": "kpi-test" }).props.total, 1);
  act(() => renderer.root.findByProps({ "data-uji": "filter-test" }).props.onWarna("white"));
  act(() => { for (const callback of pendengar) callback(); });
  act(() => renderer.update(isi(false)));
  assert.equal(pendengar.size, 0);
  await act(async () => { pembaca[1](data(99)); await flush(); });
  assert.equal(agregasi.includes(99), false);
  act(() => renderer.update(isi(true)));
  await act(async () => { pembaca[2](data(2)); await flush(); });
  assert.equal(renderer.root.findByProps({ "data-uji": "kpi-test" }).props.total, 2);
  assert.equal(renderer.root.findByProps({ "data-uji": "filter-test" }).props.filterWarna, "white");
  act(() => { for (const callback of pendengar) callback(); });
  await act(async () => { pembaca[3](data(3)); await flush(); });
  assert.equal(renderer.root.findByProps({ "data-uji": "kpi-test" }).props.total, 3);
  act(() => renderer.unmount());
  assert.equal(pendengar.size, 0);
});
