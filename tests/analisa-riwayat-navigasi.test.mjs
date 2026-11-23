import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import { TAMPILAN_ANALISA } from "../src/halaman/Analisa/konteks/analyzeKonteks.js";
import { buatIdDrafImpor, buatPenyimpananPekerjaan, ID_DRAF_IMPOR, simpanDrafImpor, snapshotLaporanAman } from "../src/halaman/Analisa/pekerjaan.js";
import { catatFitur, KUNCI_FITUR } from "../src/halaman/Analisa/riwayatFitur.js";
import * as modelTab from "../src/halaman/Analisa/tabKerja.js";
import { useUkuranArea } from "../src/halaman/Analisa/komponen/useUkuranArea.js";
import { tangkapGalatDiuji } from "./bantuGalat.mjs";

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

function kompilasi(path, dependencies) {
  const filename = new URL(path, import.meta.url);
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
  return result.exports;
}

// Render the real workspace and tab provider with screen/engine boundaries replaced.
function siapkanAreaKerja(store, navigasi) {
  const Board = React.createContext(null);
  const Import = React.createContext(null);
  const Errors = React.createContext(null);
  const tab = kompilasi("../src/halaman/Analisa/konteks/tabKerja.jsx", {
    "../../../lib/titipanAnalisa.js": { adaPgnTitipan: () => Boolean(navigasi.adaTitipan) },
    "../pekerjaan.js": { ID_DRAF_IMPOR, buatIdDrafImpor, pekerjaan: store },
    "../tabKerja.js": modelTab,
    "./analyzeKonteks.js": { TAMPILAN_ANALISA },
    "./boardKonteks.js": { useTampilan: () => React.useContext(Board).tampilan },
  });
  let waktu = 0;
  const kosong = () => null;
  const translate = (key) => key;
  const pembungkus = ({ children }) => React.createElement(React.Fragment, null, children);
  const layarPapan = (props) => { navigasi.papan = props; return null; };
  const layarImpor = (props) => { navigasi.impor = props; return null; };
  function GameMock() {
    navigasi.gameRenders = (navigasi.gameRenders ?? 0) + 1;
    React.useEffect(() => {
      navigasi.gameMounts = (navigasi.gameMounts ?? 0) + 1;
      return () => { navigasi.gameUnmounts = (navigasi.gameUnmounts ?? 0) + 1; };
    }, []);
    return React.createElement("div", { "data-uji": "game-tetap-terpasang" });
  }
  const LayarDatabaseMock = ({ aktif }) => {
    const [cari, setCari] = React.useState("");
    return React.createElement("input", { "data-uji": "database-cari-test", "data-tab-aktif": aktif, value: cari, onChange: (e) => setCari(e.target.value) });
  };
  const LayarAkunTabMock = (props) => React.createElement("div", { "data-uji": "akun-tab-test", ...props });
  function TabBarMock(props) {
    navigasi.tabBar = props;
    React.useEffect(() => () => { navigasi.tabBar = null; }, []);
    return React.createElement("div", { "data-uji": "tab-kerja-bar-test" });
  }
  const layar = Object.fromEntries([
    "layarAkun", "layarDeteksiEngine", "layarWawasan",
  ].map((nama) => [`./nav/${nama}.jsx`, { default: LayarAkunTabMock }]));
  layar["./nav/layarPengaturan.jsx"] = { default: kosong };
  layar["./nav/layarEngine.jsx"] = { default: kosong };
  const dependencies = {
    "../konteks/analyzeKonteks.js": { TAMPILAN_ANALISA },
    "../konteks/boardKonteks.js": {
      useTampilan: () => React.useContext(Board).tampilan,
      useSetTampilan: () => React.useContext(Board).tampilan[1],
    },
    "../konteks/importKonteks.js": { useImport: () => React.useContext(Import) },
    "../konteks/tabKerja.jsx": tab,
    "../konteks/panelAktif.js": { PanelAktifContext: React.createContext(true) },
    "../konteks/errorsKonteks.js": { ErrorsContext: Errors },
    "../pekerjaan.js": { pekerjaan: store, snapshotLaporanAman },
    "../riwayatFitur.js": { KUNCI_FITUR, catatFitur: (fitur, target) => catatFitur(fitur, target, store, ++waktu) },
    "../usePekerjaan.js": { usePekerjaan: () => React.useSyncExternalStore(store.langganan, store.snapshot, store.snapshot) },
    "../../../lib/i18n.jsx": { useI18n: () => ({ t: translate }) },
    "../../../components/ui/alert-dialog.jsx": {
      ...Object.fromEntries([
        "AlertDialogCancel", "AlertDialogContent", "AlertDialogDescription",
        "AlertDialogFooter", "AlertDialogHeader", "AlertDialogTitle",
      ].map((nama) => [nama, pembungkus])),
      AlertDialog: (props) => { navigasi.dialog = props; return props.open ? React.createElement(React.Fragment, null, props.children) : null; },
      AlertDialogAction: ({ children, ...props }) => React.createElement("button", props, children),
    },
    "./errors/pushPageError.js": { pushPageError: () => {}, pushPageWarning: () => {} },
    "./useUkuranArea.js": { useUkuranArea },
    "./game/game.jsx": { default: GameMock },
    "./tabBar.jsx": { default: TabBarMock },
    "./boardMenu/boardMenu.jsx": { default: kosong },
    "./menu/menu.jsx": { default: kosong },
    "./menu/analysis/gameButtons.jsx": { default: kosong },
    "./nav/validasiImpor.js": { validasiPgn: () => {} },
    "../../../lib/titipanAnalisa.js": { ambilPgnTitipan: () => "" },
    "./nav/layarPapan.jsx": { default: layarPapan },
    "./nav/layarImpor.jsx": { default: layarImpor },
    "./nav/layarDatabase.jsx": { default: LayarDatabaseMock },
    ...layar,
  };
  const area = kompilasi("../src/halaman/Analisa/komponen/areaKerja.jsx", dependencies);

  function AmatiTab() {
    navigasi.tab = tab.useTabKerja();
    return null;
  }

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
        React.createElement(Errors.Provider, { value: { errors } },
          React.createElement(tab.TabKerjaProvider, null,
            React.createElement(AmatiTab), React.createElement(area.default)))));
  }
  return Providers;
}

function pasangDocument(t) {
  const oldDocument = globalThis.document;
  const pendengar = new Map();
  globalThis.document = {
    addEventListener(jenis, fn) {
      if (!pendengar.has(jenis)) pendengar.set(jenis, new Set());
      pendengar.get(jenis).add(fn);
    },
    removeEventListener(jenis, fn) { pendengar.get(jenis)?.delete(fn); },
    querySelector() { return null; },
  };
  t.after(() => { if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument; });
  return pendengar;
}

function pasangSession(t, awal = null) {
  const sebelumnya = globalThis.sessionStorage;
  const nilai = new Map();
  if (awal !== null) nilai.set(modelTab.KUNCI_SESI_TAB, JSON.stringify(awal));
  globalThis.sessionStorage = { getItem: (key) => nilai.get(key) ?? null, setItem: (key, value) => nilai.set(key, value) };
  t.after(() => { if (sebelumnya === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = sebelumnya; });
  return nilai;
}

test("screen changes and Escape keep the board mounted without rebuilding it", async (t) => {
  const pendengar = pasangDocument(t);
  pasangSession(t);
  const store = buatPenyimpananPekerjaan(adapterMemori());
  await store.init();
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); });
  const awal = navigasi.gameRenders;
  assert.equal(navigasi.gameMounts, 1);
  for (const layar of ["pengaturan", "database", "papan", "bermain", "pengaturan"]) {
    await act(async () => { navigasi.setTampilan(layar); await flush(); });
    assert.equal(navigasi.gameRenders, awal, `papan unexpectedly rebuilt for ${layar}`);
    assert.equal(renderer.root.findAllByProps({ "data-uji": "game-tetap-terpasang" }).length, 1);
  }
  await act(async () => {
    for (const fn of pendengar.get("keydown") ?? []) fn({ key: "Escape", defaultPrevented: false });
    await flush();
  });
  assert.equal(navigasi.tampilan, "bermain");
  assert.equal(navigasi.gameRenders, awal);
  assert.equal(navigasi.gameMounts, 1);
  assert.equal(navigasi.gameUnmounts ?? 0, 0);
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
  assert.equal(navigasi.gameUnmounts, 1);
});

test("the board and report panel use overflow-safe centering only when the workspace is wide enough", async (t) => {
  pasangDocument(t);
  pasangSession(t);
  const store = buatPenyimpananPekerjaan(adapterMemori());
  await store.init();
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); });

  const main = renderer.root.findByType("main");
  const wrapper = main.find((node) => node.type === "div" && node.props["data-panel-sejajar"] !== undefined);
  const kelas = wrapper.props.className.split(" ");
  for (const nama of ["flex-col", "items-center", "justify-start", "overflow-y-auto", "data-[panel-sejajar=true]:flex-row"]) {
    assert.ok(kelas.includes(nama), `missing ${nama}`);
  }
  const grupPapan = wrapper.find((node) => node.type === "div" && node.props.className?.split(" ").includes("w-min"));
  assert.ok(grupPapan.props.className.split(" ").includes("min-h-fit"), "short screens must scroll rather than overlap the panel");

  // Compile the actual classes with the project config: an unsupported
  // Tailwind utility would otherwise pass a class-name-only test.
  const postcss = require("postcss");
  const tailwind = require("tailwindcss");
  const config = require("tailwindcss/loadConfig")(fileURLToPath(new URL("../tailwind.config.ts", import.meta.url)));
  const css = await postcss([tailwind({ ...config, content: [{ raw: `<div class="${wrapper.props.className} ${grupPapan.props.className}"></div>` }] })])
    .process("@tailwind utilities;", { from: undefined });
  const rules = [];
  postcss.parse(css.css).walkRules((rule) => {
    if (rule.nodes.some((node) => node.prop === "justify-content" && node.value === "safe center")) rules.push(rule);
  });
  assert.equal(rules.length, 1);
  assert.equal(rules[0].parent.type, "root");
  assert.match(rules[0].selector, /\[data-panel-sejajar="true"\]/);
  let minHeightFit = false;
  postcss.parse(css.css).walkDecls("min-height", (declaration) => { if (declaration.value === "fit-content") minHeightFit = true; });
  assert.equal(minHeightFit, true, "the short-screen minimum height utility must be generated");

  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("opened screens enter history and their rows return to the corresponding feature or saved target", async (t) => {
  pasangDocument(t);
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
    assert.ok(records().some((record) => record.fitur === fitur && record.waktu > item.waktu), fitur);
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

test("the workspace tab bar appears only on board screens without deleting tab data", async (t) => {
  pasangDocument(t);
  const nilai = pasangSession(t);
  const store = buatPenyimpananPekerjaan(adapterMemori());
  await store.init();
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); });
  const tab1 = navigasi.tab.aktifId;
  await act(async () => {
    navigasi.tab.catat(tab1, { laporanId: "laporan:1", drafId: "draf:1", akun: { platform: "chessCom", username: "Alice" } });
    navigasi.tabBar.onTambah();
    await flush();
  });
  const tab2 = navigasi.tab.aktifId;
  await act(async () => { navigasi.tab.catat(tab2, { laporanId: "laporan:aktif", drafId: "draf:2" }); await flush(); });
  const pertama = structuredClone(navigasi.tab.daftar[0]);
  const tabBar = () => renderer.root.findAllByProps({ "data-uji": "tab-kerja-bar-test" });
  const konten = () => renderer.root.findByProps({ id: "konten-tab-kerja" });
  function periksaBilah(terlihat) {
    assert.equal(tabBar().length, terlihat ? 1 : 0);
    assert.equal(Boolean(navigasi.tabBar), terlihat);
    assert.equal(konten().props.role, terlihat ? "tabpanel" : undefined);
    assert.equal(konten().props["aria-labelledby"], terlihat ? `tab-kerja-${tab2}` : undefined);
  }
  periksaBilah(true);
  for (const fitur of ["akun", "database", "impor", "deteksi-engine", "wawasan", "pengaturan"]) {
    await act(async () => { navigasi.setTampilan(fitur); await flush(); });
    periksaBilah(false);
    assert.equal(navigasi.tab.aktifId, tab2);
    assert.deepEqual(navigasi.tab.daftar[0], pertama);
    assert.equal(navigasi.tab.daftar[1].laporanId, "laporan:aktif");
    assert.equal(navigasi.tab.daftar[1].drafId, "draf:2");
    await act(async () => { navigasi.setTampilan("papan"); await flush(); });
    periksaBilah(true);
  }
  await act(async () => { navigasi.setTampilan("bermain"); await flush(); });
  periksaBilah(true); // the analysis board is also part of Papan
  const tersimpan = JSON.parse(nilai.get(modelTab.KUNCI_SESI_TAB));
  assert.deepEqual(tersimpan.daftar.map((tab) => tab.id), [tab1, tab2]);
  assert.deepEqual(tersimpan.daftar[0], pertama);
  assert.equal(tersimpan.daftar[1].drafId, "draf:2");
  assert.equal(tersimpan.daftar[1].laporanId, "laporan:aktif");
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("restoring a feature session does not flash a board tab bar while storage is loading", async (t) => {
  pasangDocument(t);
  pasangSession(t, { versi: 1, aktifId: "tab:akun", daftar: [{ id: "tab:akun", tampilan: "akun" }] });
  const adapter = adapterMemori();
  let lanjut;
  adapter.daftar = () => new Promise((resolve) => { lanjut = () => resolve([]); });
  const store = buatPenyimpananPekerjaan(adapter);
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); });
  assert.equal(typeof lanjut, "function");
  assert.equal(navigasi.tab.perluPulih, true);
  assert.equal(navigasi.tampilan, "papan"); // initial screen before recovery finishes
  assert.equal(navigasi.tabBar, undefined);
  assert.equal(renderer.root.findAllByProps({ "data-uji": "tab-kerja-bar-test" }).length, 0);
  assert.equal(renderer.root.findByProps({ id: "konten-tab-kerja" }).props.role, undefined);
  await act(async () => { lanjut(); await flush(); });
  assert.equal(navigasi.tab.perluPulih, false);
  assert.equal(navigasi.tampilan, "akun");
  assert.equal(renderer.root.findAllByProps({ "data-uji": "tab-kerja-bar-test" }).length, 0);
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("focus moves between feature screens and the board when the tab bar disappears or returns", async (t) => {
  const pendengar = pasangDocument(t);
  pasangSession(t, { versi: 1, aktifId: "tab:home", daftar: [
    { id: "tab:home", tampilan: "papan" },
    { id: "tab:akun", tampilan: "akun" },
  ] });
  const store = buatPenyimpananPekerjaan(adapterMemori());
  const navigasi = {};
  const fokus = [];
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi)), {
      createNodeMock: (element) => element.props["data-layar"]
        ? { focus: (options) => fokus.push([element.props["data-layar"], options]) }
        : null,
    });
    await flush();
  });
  await act(async () => { await navigasi.tabBar.onPilih("tab:akun"); await flush(); });
  assert.equal(navigasi.tabBar, null);
  assert.equal(navigasi.tampilan, "akun");
  assert.deepEqual(fokus.at(-1), ["akun", { preventScroll: true }]);
  globalThis.document.body = {};
  globalThis.document.activeElement = globalThis.document.body;
  globalThis.document.getElementById = (id) => ({ focus: (options) => fokus.push([id, options]) });
  await act(async () => {
    for (const fn of pendengar.get("keydown") ?? []) fn({ key: "Escape", defaultPrevented: false });
    await flush();
  });
  assert.equal(navigasi.tampilan, "bermain");
  assert.ok(navigasi.tabBar);
  assert.deepEqual(fokus.at(-1), ["tab-kerja-tab:akun", { preventScroll: true }]);
  await act(async () => { navigasi.setTampilan("papan"); await flush(); });
  assert.deepEqual(fokus.at(-1), ["papan", { preventScroll: true }]);
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("switching import tabs never changes the other tab's draft pointer", async (t) => {
  pasangDocument(t);
  pasangSession(t);
  const store = buatPenyimpananPekerjaan(adapterMemori());
  await store.init();
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); });
  assert.equal(navigasi.tab.daftar.length, 1);
  const idTab1 = navigasi.tab.aktifId;
  await act(async () => { await navigasi.tab.bukaImpor(); await flush(); });
  const idDraf1 = navigasi.tab.daftar[0].drafId;
  assert.equal(navigasi.impor.drafId, idDraf1);
  assert.equal(navigasi.tabBar, null);
  simpanDrafImpor({ tipe: "pgn", pgn: "draft first" }, idDraf1, store);
  await act(async () => { navigasi.setTampilan("papan"); await flush(); });
  await act(async () => { navigasi.tabBar.onTambah(); await flush(); });
  const idTab2 = navigasi.tab.aktifId;
  await act(async () => { await navigasi.tab.bukaImpor(); await flush(); });
  const idDraf2 = navigasi.tab.daftar[1].drafId;
  assert.notEqual(idDraf1, idDraf2);
  simpanDrafImpor({ tipe: "pgn", pgn: "draft second" }, idDraf2, store);

  await act(async () => { navigasi.setTampilan("papan"); await flush(); });
  await act(async () => { await navigasi.tabBar.onPilih(idTab1); await flush(); });
  await act(async () => { await navigasi.tab.bukaImpor(); await flush(); });
  assert.equal(navigasi.tab.aktifId, idTab1);
  assert.equal(navigasi.impor.drafId, idDraf1);
  assert.equal(navigasi.tab.daftar[1].drafId, idDraf2);
  await act(async () => { navigasi.setTampilan("papan"); await flush(); });
  await act(async () => { await navigasi.tabBar.onPilih(idTab2); await flush(); });
  await act(async () => { await navigasi.tab.bukaImpor(); await flush(); });
  assert.equal(navigasi.impor.drafId, idDraf2);
  assert.equal((await store.ambil(idDraf1)).isi.pgn, "draft first");
  assert.equal((await store.ambil(idDraf2)).isi.pgn, "draft second");

  await act(async () => { navigasi.setTampilan("papan"); await flush(); });
  await act(async () => { navigasi.tabBar.onTutup(idTab1); await flush(); });
  assert.deepEqual(navigasi.tab.daftar.map((item) => item.id), [idTab2]);
  await act(async () => { navigasi.tabBar.onTutup(idTab2); await flush(); });
  assert.equal(navigasi.tab.daftar.length, 1);
  assert.notEqual(navigasi.tab.aktifId, idTab2);
  assert.equal(navigasi.tampilan, "papan");
  assert.equal((await store.ambil(idDraf1)).isi.pgn, "draft first");
  assert.equal((await store.ambil(idDraf2)).isi.pgn, "draft second");
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("independent feature panels retain their local state while another tab is selected", async (t) => {
  pasangDocument(t);
  pasangSession(t);
  const store = buatPenyimpananPekerjaan(adapterMemori());
  await store.init();
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); });
  const tab1 = navigasi.tab.aktifId;
  await act(async () => { navigasi.setTampilan("database"); await flush(); });
  const panel = () => renderer.root.findAll((node) => node.props["data-layar"] === "database");
  assert.equal(panel()[0].props.tabIndex, -1);
  await act(async () => { panel()[0].findByProps({ "data-uji": "database-cari-test" }).props.onChange({ target: { value: "one" } }); });
  await act(async () => { navigasi.setTampilan("papan"); await flush(); });
  assert.equal(panel()[0].props.hidden, true);
  assert.equal(panel()[0].props.tabIndex, -1, "a hidden panel must retain its programmatic focus target");
  await act(async () => { navigasi.tabBar.onTambah(); await flush(); });
  const tab2 = navigasi.tab.aktifId;
  await act(async () => { navigasi.setTampilan("database"); await flush(); });
  assert.equal(panel().length, 2);
  await act(async () => { panel()[1].findByProps({ "data-uji": "database-cari-test" }).props.onChange({ target: { value: "two" } }); });
  await act(async () => { navigasi.setTampilan("papan"); await flush(); });
  await act(async () => { await navigasi.tabBar.onPilih(tab1); await flush(); });
  await act(async () => { navigasi.setTampilan("database"); await flush(); });
  assert.deepEqual(panel().map((item) => [item.props.hidden, item.findByProps({ "data-uji": "database-cari-test" }).props["data-tab-aktif"], item.findByProps({ "data-uji": "database-cari-test" }).props.value]), [
    [false, true, "one"], [true, false, "two"],
  ]);
  await act(async () => { navigasi.setTampilan("papan"); await flush(); });
  await act(async () => { await navigasi.tabBar.onPilih(tab2); await flush(); });
  await act(async () => { navigasi.setTampilan("database"); await flush(); });
  assert.deepEqual(panel().map((item) => [item.props.hidden, item.findByProps({ "data-uji": "database-cari-test" }).props.value]), [
    [true, "one"], [false, "two"],
  ]);
  await act(async () => { navigasi.setTampilan("papan"); await flush(); });
  await act(async () => { navigasi.tabBar.onTutup(tab1); await flush(); });
  assert.equal(panel().length, 1); // closing a tab also releases its cached panels
  assert.equal(panel()[0].findByProps({ "data-uji": "database-cari-test" }).props.value, "two");
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("blocked session storage warns while tabs remain usable and recovers after a successful save", async (t) => {
  pasangDocument(t);
  const galat = tangkapGalatDiuji(t, "Gagal menyimpan sesi tab Analisa:");
  const nilai = pasangSession(t);
  let diblokir = true;
  globalThis.sessionStorage = {
    getItem: (key) => nilai.get(key) ?? null,
    setItem(key, value) { if (diblokir) throw new Error("blocked"); nilai.set(key, value); },
  };
  const store = buatPenyimpananPekerjaan(adapterMemori());
  await store.init();
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); });
  assert.equal(navigasi.tab.sesiTersedia, false);
  assert.equal(renderer.root.findAllByProps({ "data-uji": "sesi-tab-gagal" }).length, 1);
  assert.ok(galat.length > 0);
  assert.match(String(galat[0][1]), /blocked/);
  await act(async () => { navigasi.tabBar.onTambah(); await flush(); });
  assert.equal(navigasi.tab.daftar.length, 2);
  diblokir = false;
  await act(async () => { navigasi.tabBar.onTambah(); await flush(); });
  assert.equal(navigasi.tab.daftar.length, 3);
  assert.equal(navigasi.tab.sesiTersedia, true);
  assert.equal(renderer.root.findAllByProps({ "data-uji": "sesi-tab-gagal" }).length, 0);
  assert.equal(JSON.parse(nilai.get(modelTab.KUNCI_SESI_TAB)).daftar.length, 3);
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("feature tabs keep independent account selections while sharing deliberate deletions", async (t) => {
  pasangDocument(t);
  pasangSession(t);
  const store = buatPenyimpananPekerjaan(adapterMemori());
  await store.init();
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); });
  const tab1 = navigasi.tab.aktifId;
  const aktif = () => renderer.root.findAllByProps({ "data-uji": "akun-tab-test" }).find((node) => node.props.aktif);
  const akun = (id) => navigasi.tab.daftar.find((tab) => tab.id === id).akun;
  await act(async () => { navigasi.setTampilan("akun"); await flush(); });
  await act(async () => { aktif().props.akunTab[1]({ platform: "chessCom", username: "Alice" }); await flush(); });
  await act(async () => { navigasi.setTampilan("papan"); await flush(); });
  await act(async () => { navigasi.tabBar.onTambah(); await flush(); });
  const tab2 = navigasi.tab.aktifId;
  assert.equal(akun(tab2).username, "Alice"); // a new tab starts from the current selection
  await act(async () => { navigasi.setTampilan("deteksi-engine"); await flush(); });
  await act(async () => { aktif().props.akunTab[1]({ platform: "chessCom", username: "Bob" }); await flush(); });
  assert.equal(akun(tab1).username, "Alice");
  assert.equal(akun(tab2).username, "Bob");
  await act(async () => { navigasi.setTampilan("wawasan"); await flush(); });
  assert.equal(aktif().props.akunTab[0].username, "Bob");
  await act(async () => { navigasi.setTampilan("papan"); await flush(); });
  await act(async () => { await navigasi.tabBar.onPilih(tab1); await flush(); });
  await act(async () => { navigasi.setTampilan("akun"); await flush(); });
  assert.equal(aktif().props.akunTab[0].username, "Alice");
  await act(async () => { aktif().props.onAkunDihapus("chessCom", "alice", { platform: "chessCom", username: "Bob" }); await flush(); });
  assert.equal(akun(tab1).username, "Bob");
  assert.equal(akun(tab2).username, "Bob");
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("returning from a feature or the board home restores the selected tab's report", async (t) => {
  const pendengar = pasangDocument(t);
  pasangSession(t, { versi: 1, aktifId: "tab:1", daftar: [
    { id: "tab:1", tampilan: "bermain", laporanId: "laporan:1" },
    { id: "tab:2", tampilan: "papan", laporanId: "laporan:2" },
  ] });
  const store = buatPenyimpananPekerjaan(adapterMemori());
  const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const record = (id, nama) => ({
    id, jenis: "laporan", status: "selesai", judul: nama,
    sumber: { format: "fen", string: fen },
    snapshot: { versi: 1, game: [{ fen }], customLine: { moves: [] }, players: [{ name: nama }] },
  });
  store.simpan(record("laporan:1", "first"));
  store.simpan(record("laporan:2", "second"));
  await store.tungguTulis();
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); });
  assert.equal(navigasi.data.pekerjaanId, "laporan:1");
  await act(async () => { await navigasi.tabBar.onPilih("tab:2"); await flush(); });
  await act(async () => { navigasi.setTampilan("database"); await flush(); });
  assert.equal(navigasi.tabBar, null);
  store.tetapkanAktif({ id: "laporan:1", digunakan: true, berjalan: true });
  const escape = () => { for (const fn of pendengar.get("keydown") ?? []) fn({ key: "Escape", defaultPrevented: false }); };
  await act(async () => { escape(); await flush(); });
  assert.equal(navigasi.dialog.open, true);
  assert.equal(navigasi.data.pekerjaanId, "laporan:1");
  await act(async () => { navigasi.dialog.onOpenChange(false); await flush(); });
  assert.equal(navigasi.tampilan, "database");
  await act(async () => { escape(); await flush(); });
  await act(async () => { renderer.root.findByProps({ "data-uji": "pekerjaan-konfirmasi" }).props.onClick(); await flush(); });
  assert.equal(navigasi.tampilan, "bermain");
  assert.equal(navigasi.data.pekerjaanId, "laporan:2");
  assert.equal(navigasi.data.pemulihan.snapshot.players[0].name, "second");
  assert.equal(navigasi.data.rekamAwal, undefined);

  // The home screen is the route back to the hidden tab bar. Reopening the
  // second tab's report must not adopt whichever report another tab displayed.
  store.tetapkanAktif({ id: "laporan:2", digunakan: true, berjalan: false });
  await act(async () => { navigasi.setTampilan("database"); await flush(); });
  await act(async () => { navigasi.setTampilan("papan"); await flush(); });
  await act(async () => { await navigasi.tabBar.onPilih("tab:1"); await flush(); });
  assert.equal(navigasi.data.pekerjaanId, "laporan:1");
  store.tetapkanAktif({ id: "laporan:1", digunakan: true, berjalan: false });
  await act(async () => { await navigasi.tabBar.onPilih("tab:2"); await flush(); });
  assert.equal(navigasi.tampilan, "papan");
  await act(async () => { navigasi.papan.onReport(); await flush(); });
  assert.equal(navigasi.tampilan, "bermain");
  assert.equal(navigasi.data.pekerjaanId, "laporan:2");
  assert.equal(navigasi.data.pemulihan.snapshot.players[0].name, "second");
  assert.deepEqual(navigasi.tab.daftar.map((tab) => tab.laporanId), ["laporan:1", "laporan:2"]);

  const sudahTerpasang = navigasi.data;
  await act(async () => { navigasi.setTampilan("akun"); await flush(); });
  await act(async () => { escape(); await flush(); });
  assert.equal(navigasi.tampilan, "bermain");
  assert.equal(navigasi.data, sudahTerpasang); // the same board stays mounted
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("a restored feature tab asks before retrying its interrupted report", async (t) => {
  const pendengar = pasangDocument(t);
  const id = "laporan:terputus";
  pasangSession(t, { versi: 1, aktifId: "tab:akun", daftar: [{ id: "tab:akun", tampilan: "akun", laporanId: id }] });
  const store = buatPenyimpananPekerjaan(adapterMemori());
  store.simpan({ id, jenis: "laporan", status: "terputus", sumber: { format: "pgn", string: "1. e4 *" }, snapshot: null });
  await store.tungguTulis();
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); });
  assert.equal(navigasi.tampilan, "akun");
  assert.ok(!navigasi.tabBar);
  const escape = () => { for (const fn of pendengar.get("keydown") ?? []) fn({ key: "Escape", defaultPrevented: false }); };
  await act(async () => { escape(); await flush(); });
  assert.equal(navigasi.dialog.open, true);
  assert.equal(navigasi.data.pekerjaanId, "laporan:aktif");
  await act(async () => { navigasi.dialog.onOpenChange(false); await flush(); });
  assert.equal(navigasi.tampilan, "akun");
  assert.equal(navigasi.tab.daftar[0].laporanId, id);
  await act(async () => { escape(); await flush(); });
  await act(async () => { renderer.root.findByProps({ "data-uji": "pekerjaan-konfirmasi" }).props.onClick(); await flush(); });
  assert.equal(navigasi.tampilan, "bermain");
  assert.equal(navigasi.data.pekerjaanId, id);
  assert.equal(navigasi.data.rekamAwal.status, "terputus");
  assert.ok(navigasi.tabBar);
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("a delayed report lookup from board home cannot override later feature navigation", async (t) => {
  pasangDocument(t);
  const id = "laporan:lambat";
  const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  pasangSession(t, { versi: 1, aktifId: "tab:home", daftar: [{ id: "tab:home", tampilan: "papan", laporanId: id }] });
  const adapter = adapterMemori();
  const seed = buatPenyimpananPekerjaan(adapter);
  seed.simpan({ id, jenis: "laporan", status: "selesai", sumber: { format: "fen", string: fen }, snapshot: { versi: 1, game: [{ fen }], customLine: { moves: [] } } });
  await seed.tungguTulis();
  const ambil = adapter.ambil;
  adapter.daftar = async () => []; // an orphaned record requires an explicit read
  let lanjut;
  adapter.ambil = (key) => key === id ? new Promise((resolve) => { lanjut = async () => resolve(await ambil(key)); }) : ambil(key);
  const store = buatPenyimpananPekerjaan(adapter);
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); });
  await act(async () => { navigasi.papan.onReport(); await flush(); });
  assert.equal(typeof lanjut, "function");
  await act(async () => { navigasi.setTampilan("database"); await flush(); });
  await act(async () => { await lanjut(); await flush(); });
  assert.equal(navigasi.tampilan, "database");
  assert.equal(navigasi.data.pekerjaanId, "laporan:aktif");
  assert.equal(navigasi.tab.daftar[0].laporanId, id);
  assert.equal(navigasi.dialog.open, false);
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("switching report tabs restores the selected snapshot and confirms interruption", async (t) => {
  pasangDocument(t);
  pasangSession(t);
  const store = buatPenyimpananPekerjaan(adapterMemori());
  const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const record = (id, nama) => ({
    id, jenis: "laporan", status: "selesai", judul: nama,
    sumber: { format: "fen", string: fen },
    snapshot: { versi: 1, game: [{ fen }], customLine: { moves: [] }, players: [{ name: nama }] },
  });
  store.simpan(record("laporan:1", "first"));
  store.simpan(record("laporan:2", "second"));
  await store.tungguTulis();
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); });
  const tab1 = navigasi.tab.aktifId;
  await act(async () => { navigasi.papan.onBukaPekerjaan({ id: "laporan:1", jenis: "laporan", status: "selesai" }); await flush(); });
  assert.equal(navigasi.data.pemulihan.snapshot.players[0].name, "first");
  await act(async () => { navigasi.tabBar.onTambah(); await flush(); });
  const tab2 = navigasi.tab.aktifId;
  assert.equal(navigasi.tab.daftar[0].laporanId, "laporan:1");
  assert.equal(navigasi.tab.daftar[1].laporanId, null); // a new tab must not inherit the visible report
  await act(async () => { navigasi.papan.onBukaPekerjaan({ id: "laporan:2", jenis: "laporan", status: "selesai" }); await flush(); });
  assert.equal(navigasi.data.pemulihan.snapshot.players[0].name, "second");
  assert.equal(navigasi.tab.daftar[0].laporanId, "laporan:1");
  assert.equal(navigasi.tab.daftar[1].laporanId, "laporan:2");

  store.tetapkanAktif({ id: "laporan:2", digunakan: true, berjalan: true });
  await act(async () => { await navigasi.tabBar.onPilih(tab1); await flush(); });
  assert.equal(navigasi.dialog.open, true);
  assert.equal(navigasi.tab.aktifId, tab2);
  await act(async () => { navigasi.dialog.onOpenChange(false); await flush(); });
  assert.equal(navigasi.tab.aktifId, tab2);
  assert.equal(navigasi.data.pekerjaanId, "laporan:2");
  await act(async () => { await navigasi.tabBar.onPilih(tab1); await flush(); });
  await act(async () => { renderer.root.findByProps({ "data-uji": "pekerjaan-konfirmasi" }).props.onClick(); await flush(); });
  assert.equal(navigasi.tab.aktifId, tab1);
  assert.equal(navigasi.data.pekerjaanId, "laporan:1");
  assert.equal(navigasi.data.pemulihan.snapshot.players[0].name, "first");
  assert.equal((await store.ambil("laporan:2")).judul, "second");
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("an interrupted session retains its original tab until the user chooses to retry", async (t) => {
  pasangDocument(t);
  const id = "laporan:terputus";
  pasangSession(t, { versi: 1, aktifId: "tab:lama", daftar: [{ id: "tab:lama", tampilan: "bermain", laporanId: id }] });
  const store = buatPenyimpananPekerjaan(adapterMemori());
  store.simpan({ id, jenis: "laporan", status: "terputus", sumber: { format: "pgn", string: "1. e4 *" }, snapshot: null });
  await store.tungguTulis();
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); await flush(); });
  assert.equal(navigasi.tab.perluPulih, false);
  assert.equal(navigasi.tab.daftar.length, 2);
  assert.equal(navigasi.tab.daftar[0].laporanId, id);
  assert.equal(navigasi.tab.daftar[0].tampilan, "bermain");
  assert.equal(navigasi.tampilan, "papan");
  const tabBaru = navigasi.tab.aktifId;
  await act(async () => { await navigasi.tabBar.onPilih("tab:lama"); await flush(); });
  assert.equal(navigasi.dialog.open, true);
  await act(async () => { navigasi.dialog.onOpenChange(false); await flush(); });
  assert.equal(navigasi.tab.aktifId, tabBaru);
  assert.equal(navigasi.tab.daftar[0].laporanId, id);
  await act(async () => { await navigasi.tabBar.onPilih("tab:lama"); await flush(); });
  await act(async () => { renderer.root.findByProps({ "data-uji": "pekerjaan-konfirmasi" }).props.onClick(); await flush(); });
  assert.equal(navigasi.tab.aktifId, "tab:lama");
  assert.equal(navigasi.data.pekerjaanId, id);
  assert.equal(navigasi.data.rekamAwal.status, "terputus");
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("closing an inactive tab cancels its pending report load", async (t) => {
  pasangDocument(t);
  const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const id = "laporan:lambat";
  pasangSession(t, { versi: 1, aktifId: "tab:home", daftar: [
    { id: "tab:home", tampilan: "papan" },
    { id: "tab:lambat", tampilan: "bermain", laporanId: id },
  ] });
  const adapter = adapterMemori();
  const seed = buatPenyimpananPekerjaan(adapter);
  seed.simpan({ id, jenis: "laporan", status: "selesai", sumber: { format: "fen", string: fen }, snapshot: { versi: 1, game: [{ fen }], customLine: { moves: [] } } });
  await seed.tungguTulis();
  const ambilAsli = adapter.ambil;
  let lanjut;
  adapter.ambil = (key) => key === id ? new Promise((resolve) => { lanjut = async () => resolve(await ambilAsli(key)); }) : ambilAsli(key);
  const store = buatPenyimpananPekerjaan(adapter);
  await store.init();
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); });
  await act(async () => { navigasi.tabBar.onPilih("tab:lambat"); await flush(); });
  assert.equal(typeof lanjut, "function");
  await act(async () => { navigasi.tabBar.onTutup("tab:lambat"); await flush(); });
  await act(async () => { await lanjut(); await flush(); });
  assert.deepEqual(navigasi.tab.daftar.map((tab) => tab.id), ["tab:home"]);
  assert.equal(navigasi.tab.aktifId, "tab:home");
  assert.equal(navigasi.tampilan, "papan");
  assert.equal(navigasi.data.pekerjaanId, "laporan:aktif");
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("a completed session report restores its snapshot without requesting a new analysis", async (t) => {
  pasangDocument(t);
  const id = "laporan:selesai";
  const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  pasangSession(t, { versi: 1, aktifId: "tab:laporan", daftar: [{ id: "tab:laporan", tampilan: "bermain", laporanId: id }] });
  const store = buatPenyimpananPekerjaan(adapterMemori());
  store.simpan({ id, jenis: "laporan", status: "selesai", sumber: { format: "fen", string: fen }, snapshot: { versi: 1, game: [{ fen }], customLine: { moves: [] } } });
  await store.tungguTulis();
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); await flush(); });
  assert.equal(navigasi.tab.perluPulih, false);
  assert.equal(navigasi.tab.daftar.length, 1);
  assert.equal(navigasi.tab.aktifId, "tab:laporan");
  assert.equal(navigasi.data.pekerjaanId, id);
  assert.equal(navigasi.data.pemulihan.snapshot.game[0].fen, fen);
  assert.equal(navigasi.data.rekamAwal, undefined);
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("an unreadable session report is not replaced or overwritten by an empty board", async (t) => {
  pasangDocument(t);
  const galat = tangkapGalatDiuji(t, "Gagal membaca pekerjaan Analisa:");
  const id = "laporan:berharga";
  pasangSession(t, { versi: 1, aktifId: "tab:berharga", daftar: [{ id: "tab:berharga", tampilan: "bermain", laporanId: id }] });
  const adapter = adapterMemori();
  const seed = buatPenyimpananPekerjaan(adapter);
  seed.simpan({ id, jenis: "laporan", status: "selesai", sumber: { format: "pgn", string: "1. e4 *" }, snapshot: null });
  await seed.tungguTulis();
  const ambilAsli = adapter.ambil;
  adapter.ambil = async () => { throw new Error("blocked"); };
  const store = buatPenyimpananPekerjaan(adapter);
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); await flush(); });
  assert.equal(store.snapshot().tersedia, false);
  assert.ok(galat.length > 0);
  assert.match(String(galat[0][1]), /blocked/);
  assert.equal(navigasi.tab.daftar.length, 2);
  assert.equal(navigasi.tab.daftar[0].id, "tab:berharga");
  assert.equal(navigasi.tab.daftar[0].laporanId, id);
  assert.equal(navigasi.tab.daftar[0].tampilan, "bermain");
  assert.notEqual(navigasi.tab.aktifId, "tab:berharga");
  assert.equal(navigasi.data.pekerjaanId, "laporan:aktif");
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
  assert.equal((await ambilAsli(id)).sumber.string, "1. e4 *");
});

test("a report without list metadata is read before deciding that it is an empty board", async (t) => {
  pasangDocument(t);
  const id = "laporan:orphan";
  const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  pasangSession(t, { versi: 1, aktifId: "tab:home", daftar: [
    { id: "tab:home", tampilan: "papan" },
    { id: "tab:orphan", tampilan: "bermain", laporanId: id },
  ] });
  const record = { id, jenis: "laporan", status: "selesai", sumber: { format: "fen", string: fen }, snapshot: { versi: 1, game: [{ fen }], customLine: { moves: [] } } };
  const adapter = { ...adapterMemori(), async daftar() { return []; }, async ambil(key) { return key === id ? structuredClone(record) : null; } };
  const store = buatPenyimpananPekerjaan(adapter);
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); });
  await act(async () => { await navigasi.tabBar.onPilih("tab:orphan"); await flush(); });
  assert.equal(navigasi.tab.aktifId, "tab:orphan");
  assert.equal(navigasi.data.pekerjaanId, id);
  assert.equal(navigasi.data.pemulihan.snapshot.game[0].fen, fen);
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("a PGN handoff keeps the saved tabs and opens a fresh one", async (t) => {
  pasangDocument(t);
  pasangSession(t, { versi: 1, aktifId: "tab:lama", daftar: [{ id: "tab:lama", tampilan: "akun" }] });
  const store = buatPenyimpananPekerjaan(adapterMemori());
  const navigasi = { adaTitipan: true };
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); });
  assert.equal(navigasi.tab.perluPulih, false);
  assert.equal(navigasi.tab.daftar.length, 2);
  assert.equal(navigasi.tab.daftar[0].id, "tab:lama");
  assert.equal(navigasi.tab.daftar[0].tampilan, "akun");
  assert.notEqual(navigasi.tab.aktifId, "tab:lama");
  assert.equal(navigasi.tab.daftar[1].tampilan, "papan");
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("a late report read cannot undo a newer tab selection", async (t) => {
  pasangDocument(t);
  const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const id = "laporan:lambat";
  pasangSession(t, { versi: 1, aktifId: "tab:home", daftar: [
    { id: "tab:home", tampilan: "papan" },
    { id: "tab:lambat", tampilan: "bermain", laporanId: id },
    { id: "tab:akun", tampilan: "akun" },
  ] });
  const adapter = adapterMemori();
  const seed = buatPenyimpananPekerjaan(adapter);
  seed.simpan({ id, jenis: "laporan", status: "selesai", sumber: { format: "fen", string: fen }, snapshot: { versi: 1, game: [{ fen }], customLine: { moves: [] } } });
  await seed.tungguTulis();
  const ambilAsli = adapter.ambil;
  let lanjut;
  adapter.ambil = (key) => key === id ? new Promise((resolve) => { lanjut = async () => resolve(await ambilAsli(key)); }) : ambilAsli(key);
  const store = buatPenyimpananPekerjaan(adapter);
  await store.init();
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); });
  await act(async () => { navigasi.tabBar.onPilih("tab:lambat"); await flush(); });
  assert.equal(typeof lanjut, "function");
  await act(async () => { await navigasi.tabBar.onPilih("tab:akun"); await flush(); });
  await act(async () => { await lanjut(); await flush(); });
  assert.equal(navigasi.tab.aktifId, "tab:akun");
  assert.equal(navigasi.tampilan, "akun");
  assert.equal(navigasi.data.pekerjaanId, "laporan:aktif");
  assert.equal(navigasi.dialog.open, false);
  assert.equal(navigasi.tab.daftar[1].laporanId, id);
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("sidebar screens preserve and return to the selected report tab without reloading its board", async (t) => {
  pasangDocument(t);
  const nilai = pasangSession(t, { versi: 1, aktifId: "tab:report", daftar: [
    { id: "tab:report", tampilan: "bermain", laporanId: "laporan:1" },
  ] });
  const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const store = buatPenyimpananPekerjaan(adapterMemori());
  store.simpan({
    id: "laporan:1", jenis: "laporan", status: "selesai", judul: "Alice vs Bob",
    sumber: { format: "fen", string: fen },
    snapshot: { versi: 1, game: [{ fen }], customLine: { moves: [] } },
  });
  await store.tungguTulis();
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); await flush(); });
  const laporan = navigasi.data;
  const renderAwal = navigasi.gameRenders;
  assert.equal(navigasi.tampilan, "bermain");

  for (const fitur of ["pengaturan", "database", "engine", "akun"]) {
    await act(async () => { navigasi.setTampilan(fitur); await flush(); });
    assert.equal(navigasi.tab.daftar[0].tampilanPapan, "bermain");
    assert.equal(JSON.parse(nilai.get(modelTab.KUNCI_SESI_TAB)).daftar[0].tampilanPapan, "bermain");
    await act(async () => { await navigasi.tab.bukaPapan(); await flush(); });
    assert.equal(navigasi.tampilan, "bermain", fitur);
    assert.equal(navigasi.tab.aktifId, "tab:report");
    assert.equal(navigasi.tab.daftar[0].tampilan, "bermain");
    assert.equal(navigasi.tab.daftar[0].laporanId, "laporan:1");
    assert.equal(navigasi.data, laporan, "the existing board data must not be reloaded");
    assert.equal(navigasi.gameRenders, renderAwal);
    assert.equal(navigasi.gameMounts, 1);
  }
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("a report tab returns after reload while settings is open", async (t) => {
  pasangDocument(t);
  const nilai = pasangSession(t, { versi: 1, aktifId: "tab:report", daftar: [
    { id: "tab:report", tampilan: "bermain", laporanId: "laporan:1" },
  ] });
  const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const store = buatPenyimpananPekerjaan(adapterMemori());
  store.simpan({
    id: "laporan:1", jenis: "laporan", status: "selesai",
    sumber: { format: "fen", string: fen },
    snapshot: { versi: 1, game: [{ fen }], customLine: { moves: [] }, players: [{ name: "Alice" }] },
  });
  await store.tungguTulis();
  let navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); await flush(); });
  await act(async () => { navigasi.setTampilan("pengaturan"); await flush(); });
  assert.equal(JSON.parse(nilai.get(modelTab.KUNCI_SESI_TAB)).daftar[0].tampilanPapan, "bermain");
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });

  navigasi = {};
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); await flush(); });
  assert.equal(navigasi.tampilan, "pengaturan");
  assert.equal(navigasi.data.pekerjaanId, "laporan:aktif"); // not yet restored while the feature is visible
  await act(async () => { await navigasi.tab.bukaPapan(); await flush(); await flush(); });
  assert.equal(navigasi.tampilan, "bermain");
  assert.equal(navigasi.tab.aktifId, "tab:report");
  assert.equal(navigasi.data.pekerjaanId, "laporan:1");
  assert.equal(navigasi.data.pemulihan.snapshot.players[0].name, "Alice");
  assert.equal(navigasi.data.rekamAwal, undefined);
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("returning to a new board tab does not replace a separate report tab", async (t) => {
  pasangDocument(t);
  pasangSession(t, { versi: 1, aktifId: "tab:report", daftar: [
    { id: "tab:report", tampilan: "bermain", laporanId: "laporan:1" },
  ] });
  const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const store = buatPenyimpananPekerjaan(adapterMemori());
  store.simpan({ id: "laporan:1", jenis: "laporan", status: "selesai", sumber: { format: "fen", string: fen }, snapshot: { versi: 1, game: [{ fen }], customLine: { moves: [] } } });
  await store.tungguTulis();
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); await flush(); });
  await act(async () => { navigasi.tabBar.onTambah(); await flush(); });
  const tabHome = navigasi.tab.aktifId;
  assert.equal(navigasi.tampilan, "papan");
  await act(async () => { navigasi.setTampilan("pengaturan"); await flush(); });
  await act(async () => { await navigasi.tab.bukaPapan(); await flush(); });
  assert.equal(navigasi.tampilan, "papan");
  assert.equal(navigasi.tab.aktifId, tabHome);
  assert.deepEqual(navigasi.tab.daftar.map((tab) => tab.tampilan), ["bermain", "papan"]);

  await act(async () => { await navigasi.tabBar.onPilih("tab:report"); await flush(); });
  await act(async () => { navigasi.setTampilan("pengaturan"); await flush(); });
  await act(async () => { await navigasi.tab.bukaPapan(); await flush(); });
  assert.equal(navigasi.tampilan, "bermain");
  assert.equal(navigasi.tab.aktifId, "tab:report");
  assert.deepEqual(navigasi.tab.daftar.map((tab) => tab.tampilan), ["bermain", "papan"]);

  // Papan still offers its dashboard when already viewing a report, without
  // turning the report itself into a new tab.
  await act(async () => { await navigasi.tab.bukaPapan(); await flush(); });
  assert.equal(navigasi.tampilan, "papan");
  assert.equal(navigasi.tab.aktifId, tabHome);
  assert.deepEqual(navigasi.tab.daftar.map((tab) => tab.tampilan), ["bermain", "papan"]);
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("returning to an interrupted report still asks before reanalysis", async (t) => {
  pasangDocument(t);
  const id = "laporan:terputus";
  pasangSession(t, { versi: 1, aktifId: "tab:report", daftar: [
    { id: "tab:report", tampilan: "pengaturan", tampilanPapan: "bermain", laporanId: id },
  ] });
  const store = buatPenyimpananPekerjaan(adapterMemori());
  store.simpan({ id, jenis: "laporan", status: "terputus", sumber: { format: "pgn", string: "1. e4 *" }, snapshot: null });
  await store.tungguTulis();
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); await flush(); });
  assert.equal(navigasi.tampilan, "pengaturan");
  await act(async () => { await navigasi.tab.bukaPapan(); await flush(); });
  assert.equal(navigasi.dialog.open, true);
  assert.equal(navigasi.tampilan, "pengaturan");
  assert.equal(navigasi.data.pekerjaanId, "laporan:aktif");
  await act(async () => { navigasi.dialog.onOpenChange(false); await flush(); });
  assert.equal(navigasi.tab.daftar[0].laporanId, id);
  assert.equal(navigasi.tab.daftar[0].tampilanPapan, "bermain");
  await act(async () => { await navigasi.tab.bukaPapan(); await flush(); });
  await act(async () => { renderer.root.findByProps({ "data-uji": "pekerjaan-konfirmasi" }).props.onClick(); await flush(); });
  assert.equal(navigasi.tampilan, "bermain");
  assert.equal(navigasi.data.pekerjaanId, id);
  assert.equal(navigasi.data.rekamAwal.status, "terputus");
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("a late report lookup from sidebar navigation cannot undo a newer screen choice", async (t) => {
  pasangDocument(t);
  const id = "laporan:lambat";
  const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  pasangSession(t, { versi: 1, aktifId: "tab:report", daftar: [
    { id: "tab:report", tampilan: "pengaturan", tampilanPapan: "bermain", laporanId: id },
  ] });
  const adapter = adapterMemori();
  const seed = buatPenyimpananPekerjaan(adapter);
  seed.simpan({ id, jenis: "laporan", status: "selesai", sumber: { format: "fen", string: fen }, snapshot: { versi: 1, game: [{ fen }], customLine: { moves: [] } } });
  await seed.tungguTulis();
  const ambil = adapter.ambil;
  adapter.daftar = async () => [];
  let lanjut;
  adapter.ambil = (key) => key === id ? new Promise((resolve) => { lanjut = async () => resolve(await ambil(key)); }) : ambil(key);
  const store = buatPenyimpananPekerjaan(adapter);
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); });
  await act(async () => { void navigasi.tab.bukaPapan(); await flush(); });
  assert.equal(typeof lanjut, "function");
  await act(async () => { navigasi.setTampilan("database"); await flush(); });
  await act(async () => { await lanjut(); await flush(); });
  assert.equal(navigasi.tampilan, "database");
  assert.equal(navigasi.data.pekerjaanId, "laporan:aktif");
  assert.equal(navigasi.tab.daftar[0].laporanId, id);
  assert.equal(navigasi.tab.daftar[0].tampilanPapan, "bermain");
  assert.equal(navigasi.dialog.open, false);
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});

test("a pending import request is canceled when leaving and returning to the same screen", async (t) => {
  pasangDocument(t);
  pasangSession(t);
  const adapter = adapterMemori();
  let lanjut;
  adapter.daftar = () => new Promise((resolve) => { lanjut = () => resolve([]); });
  const store = buatPenyimpananPekerjaan(adapter);
  const navigasi = {};
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(siapkanAreaKerja(store, navigasi))); await flush(); });
  let permintaan;
  await act(async () => { permintaan = navigasi.tab.bukaImpor(); await flush(); });
  assert.equal(typeof lanjut, "function");
  await act(async () => { navigasi.setTampilan("database"); await flush(); });
  await act(async () => { navigasi.setTampilan("papan"); await flush(); });
  await act(async () => { lanjut(); await flush(); });
  assert.equal(await permintaan, false);
  assert.equal(navigasi.tampilan, "papan");
  assert.equal(navigasi.tab.daftar[0].drafId, null);
  await act(async () => { renderer.unmount(); await store.tungguTulis(); });
});
