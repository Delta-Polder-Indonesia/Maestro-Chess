import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import * as koordinasi from "../src/halaman/Analisa/akun/koordinasiAkun.js";
import { pesanPenyimpananPartai } from "../src/halaman/Analisa/database/statusSimpan.js";
import { hashPgn } from "../src/lib/pgnRingan.js";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const t = (key) => key;
const wrapper = ({ children }) => React.createElement(React.Fragment, null, children);
const kosong = () => null;

function kompilasi(path, dependencies) {
  const filename = new URL(path, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename.pathname,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = { exports: {} };
  runInThisContext(`(function (require, module, exports) {\n${compiled}\n})`)((id) => {
    if (["react", "react/jsx-runtime", "lucide-react"].includes(id)) return require(id);
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, result, result.exports);
  return result.exports.default;
}

test("account deletion waits for each step; failures retain the account and warn, success updates tabs", async () => {
  const AnalyzeContext = React.createContext(null);
  let daftar = [{ platform: "chessCom", username: "Alice" }, { platform: "chessCom", username: "Bob" }];
  let resolveHapus;
  let cacheBerhasil = true;
  let daftarBerhasil = true;
  let hapusDaftar = 0;
  let navigasi = 0;
  const pemberitahuan = [];
  const warnings = [];
  const Akun = kompilasi("../src/halaman/Analisa/komponen/nav/layarAkun.jsx", {
    "../../../../lib/i18n.jsx": { useI18n: () => ({ t }) },
    "./PanelLayar.jsx": { default: wrapper },
    "../../akun/DaftarAkun.jsx": { default: (props) => React.createElement("div", { "data-uji": "account-list", ...props }) },
    "../../akun/PanelTarikPartai.jsx": { default: kosong },
    "../../akun/daftarAkun.js": {
      bacaDaftarAkun: () => [...daftar], tambahKeDaftar: () => [...daftar],
      hapusDariDaftar: (platform, nama) => {
        hapusDaftar++;
        if (!daftarBerhasil) return { tersimpan: false, daftar: [] };
        daftar = daftar.filter((a) => !(a.platform === platform && String(a.username).toLowerCase() === String(nama).toLowerCase()));
        return { tersimpan: true, daftar: [...daftar] };
      },
    },
    "../../database/migrasi.js": { bukaDB: async () => null },
    "../../basisData.js": {
      bacaRevisiBasis: () => 0, langgananRevisi: () => () => {}, pastikanKoleksi: async () => null,
      hapusKoleksi: () => new Promise((resolve) => { resolveHapus = resolve; }),
    },
    "../../../../modul/sesi/analisa.js": { AnalyzeContext },
    "../../../../modul/sesi/galat.js": {
      ErrorsContext: React.createContext({ errors: [[], () => {}] }),
      pushPageWarning: (_set, judul, pesan, opsi) => warnings.push({ judul, pesan, opsi }),
    },
    "../../akun/antiCheatRiwayat.js": { bersihkanCacheAntiCheat: () => cacheBerhasil },
    "../../akun/koordinasiAkun.js": koordinasi,
  });
  let akun;
  function Harness({ aktif = true }) {
    akun = React.useState({ platform: "chessCom", username: "Alice" });
    return React.createElement(AnalyzeContext.Provider, { value: { akun } }, React.createElement(Akun, {
      aktif,
      onTutup: () => { navigasi++; }, onAkunDihapus: (...args) => pemberitahuan.push(args),
    }));
  }
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness)); await flush(); });
  const panel = () => renderer.root.findByProps({ "data-uji": "account-list" }).props;
  const mulai = async () => {
    let janji;
    await act(async () => { janji = panel().onHapus("chessCom", "Alice"); await flush(); });
    assert.equal(panel().disabled, true);
    assert.equal(panel().daftar.length, 2);
    assert.equal(pemberitahuan.length, 0);
    return { janji };
  };
  const operasi = koordinasi.daftarkanOperasiAkun("chessCom", "ALICE");
  let { janji } = await mulai();
  assert.equal(operasi.signal.aborted, true);
  await act(async () => { resolveHapus(false); await janji; });
  operasi.selesai();
  assert.equal(panel().daftar.length, 2);
  assert.equal(akun[0].username, "Alice");
  assert.equal(hapusDaftar, 0);
  assert.equal(renderer.root.findByProps({ "data-uji": "hapus-akun-gagal" }).props.role, "alert");
  assert.deepEqual(warnings, []); // the active panel already contains the alert

  ({ janji } = await mulai());
  await act(async () => { renderer.update(React.createElement(Harness, { aktif: false })); await flush(); });
  await act(async () => { resolveHapus(false); await janji; });
  assert.deepEqual(warnings, [{ judul: "analisa.akun.hapus", pesan: "analisa.akun.hapusGagal", opsi: { persisten: true } }]);
  await act(async () => { renderer.update(React.createElement(Harness, { aktif: true })); await flush(); });

  cacheBerhasil = false;
  ({ janji } = await mulai());
  await act(async () => { resolveHapus(true); await janji; });
  assert.equal(hapusDaftar, 0);
  assert.equal(panel().daftar.length, 2);
  assert.equal(pemberitahuan.length, 0);

  cacheBerhasil = true;
  daftarBerhasil = false;
  ({ janji } = await mulai());
  await act(async () => { resolveHapus(true); await janji; });
  assert.equal(panel().daftar.length, 2);
  assert.equal(akun[0].username, "Alice");
  assert.equal(pemberitahuan.length, 0);

  daftarBerhasil = true;
  ({ janji } = await mulai());
  await act(async () => { resolveHapus(true); await janji; });
  assert.deepEqual(panel().daftar.map((a) => a.username), ["Bob"]);
  assert.equal(akun[0].username, "Bob");
  assert.equal(pemberitahuan.length, 1);
  assert.equal(navigasi, 0);
  assert.equal(renderer.root.findAllByProps({ "data-uji": "hapus-akun-gagal" }).length, 0);

  // Menghapus akun terakhir harus meninggalkan panel Akun dengan daftar kosong,
  // bukan membuka papan catur.
  let janjiTerakhir;
  await act(async () => { janjiTerakhir = panel().onHapus("chessCom", "Bob"); await flush(); });
  await act(async () => { resolveHapus(true); await janjiTerakhir; });
  assert.deepEqual(panel().daftar, []);
  assert.deepEqual(akun[0], { platform: "", username: "" });
  assert.equal(pemberitahuan.length, 2);
  assert.equal(navigasi, 0);
  act(() => renderer.unmount());
});

test("deleting the last account in another tab keeps the account screen open", async (tes) => {
  const doc = globalThis.document;
  const win = globalThis.window;
  const pendengar = new Map();
  globalThis.document = { querySelector: () => null };
  globalThis.window = {
    addEventListener: (nama, callback) => pendengar.set(nama, callback),
    removeEventListener: (nama) => pendengar.delete(nama),
  };
  tes.after(() => {
    if (doc === undefined) delete globalThis.document; else globalThis.document = doc;
    if (win === undefined) delete globalThis.window; else globalThis.window = win;
  });

  const AnalyzeContext = React.createContext(null);
  let daftar = [{ platform: "chessCom", username: "Alice" }];
  let navigasi = 0;
  const pemberitahuan = [];
  const Akun = kompilasi("../src/halaman/Analisa/komponen/nav/layarAkun.jsx", {
    "../../../../lib/i18n.jsx": { useI18n: () => ({ t }) },
    "./PanelLayar.jsx": { default: wrapper },
    "../../akun/DaftarAkun.jsx": { default: (props) => React.createElement("div", { "data-uji": "account-list", ...props }) },
    "../../akun/PanelTarikPartai.jsx": { default: kosong },
    "../../akun/daftarAkun.js": { bacaDaftarAkun: () => [...daftar], tambahKeDaftar: () => [...daftar], hapusDariDaftar: () => ({ tersimpan: true, daftar: [] }) },
    "../../database/migrasi.js": { bukaDB: async () => null },
    "../../basisData.js": {
      bacaRevisiBasis: () => 0, langgananRevisi: () => () => {}, pastikanKoleksi: async () => null,
      hapusKoleksi: async () => true,
    },
    "../../../../modul/sesi/analisa.js": { AnalyzeContext },
    "../../../../modul/sesi/galat.js": { ErrorsContext: React.createContext({ errors: [[], () => {}] }), pushPageWarning: () => {} },
    "../../akun/antiCheatRiwayat.js": { bersihkanCacheAntiCheat: () => true },
    "../../akun/koordinasiAkun.js": {
      ...koordinasi,
      akunSedangDihapus: () => true,
      denganKunciAkun: async (kerja) => kerja(),
    },
  });
  let akun;
  function Harness() {
    akun = React.useState({ platform: "chessCom", username: "Alice" });
    return React.createElement(AnalyzeContext.Provider, { value: { akun } },
      React.createElement(Akun, { aktif: true, onTutup: () => { navigasi++; }, onAkunDihapus: (...args) => pemberitahuan.push(args) }));
  }
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Harness));
    await flush();
  });
  const panel = () => renderer.root.findByProps({ "data-uji": "account-list" }).props;
  assert.deepEqual(panel().daftar.map((item) => item.username), ["Alice"]);
  daftar = [];
  await act(async () => {
    pendengar.get("storage")({ key: "maestro-analisa-daftar-akun", newValue: "[]" });
    await flush();
  });
  assert.deepEqual(panel().daftar, []);
  assert.equal(pemberitahuan.length, 1);
  assert.deepEqual(akun[0], { platform: "", username: "" });
  assert.equal(navigasi, 0);
  act(() => renderer.unmount());
});

test("account fetch panel distinguishes committed, temporary, and failed storage", async () => {
  let penyimpanan = { tersimpan: 1, sementara: 0, media: "indexedDB" };
  const Panel = kompilasi("../src/halaman/Analisa/akun/PanelTarikPartai.jsx", {
    "../../../components/ui/tabs.jsx": { Tabs: wrapper, TabsContent: wrapper, TabsList: wrapper, TabsTrigger: wrapper },
    "../../../lib/i18n.jsx": { useI18n: () => ({ t }) },
    "../../../modul/sesi/preferensi.js": { bacaTeks: () => "", tulis: () => true },
    "./muatPartaiAkun.js": {
      muatPartaiChessCom: async () => ({ partai: [{}], penyimpanan }),
      muatPartaiLichess: async () => ({ partai: [{}], penyimpanan }),
    },
    "../database/statusSimpan.js": { pesanPenyimpananPartai },
    "./PemilihRentang.jsx": { default: kosong },
    "./rentangTanggal.js": { PRESET_RENTANG: ["30hari"], rentangPreset: () => ({ dari: "2026-01-01", sampai: "2026-01-31" }) },
  });
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Panel, { akun: { platform: "chessCom", username: "Alice" }, abortRef: { current: null } })); });
  // Kedua tab memakai hijau yang sama dengan tombol pilihan aktif.
  const tabSlanted = renderer.root.findAllByType(wrapper).filter((node) => /(?:^|\s)slanted-tab(?:\s|$)/.test(String(node.props.className)));
  assert.equal(tabSlanted.length, 2);
  for (const tab of tabSlanted) {
    assert.match(tab.props.className, /data-\[state=active\]:!bg-backgroundBoxBoxHighlighted/);
    assert.match(tab.props.className, /data-\[state=active\]:!text-foregroundBlackDark/);
  }
  const muat = () => renderer.root.findAllByType("button").find((node) => node.children.includes("analisa.akun.tarik.muat"));
  await act(async () => { muat().props.onClick(); await flush(); });
  assert.equal(renderer.root.findAllByProps({ role: "status" }).some((node) => node.children.includes("analisa.akun.tarik.sukses")), true);
  penyimpanan = { tersimpan: 0, sementara: 1, media: "memori" };
  await act(async () => { muat().props.onClick(); await flush(); });
  assert.equal(renderer.root.findByProps({ role: "alert" }).children.includes("analisa.basisData.simpanSementara"), true);
  penyimpanan = { tersimpan: 0, sementara: 0, media: "gagal" };
  await act(async () => { muat().props.onClick(); await flush(); });
  assert.equal(renderer.root.findByProps({ role: "alert" }).children.includes("analisa.basisData.simpanGagal"), true);
  act(() => renderer.unmount());
});

test("the visible 'analyze again' action bypasses the cache and changing engine clears old results", async (tes) => {
  const doc = globalThis.document;
  const win = globalThis.window;
  const pendengar = new Map();
  globalThis.document = { querySelector: () => null };
  globalThis.window = { addEventListener: (nama, callback) => pendengar.set(nama, callback) };
  tes.after(() => {
    if (doc === undefined) delete globalThis.document; else globalThis.document = doc;
    if (win === undefined) delete globalThis.window; else globalThis.window = win;
  });
  const AnalyzeContext = React.createContext(null);
  const mesin = { idEngine: "engine-a", opsi: { hash: 32 }, siapkan: async () => ({ idEngine: mesin.idEngine }), setop() {} };
  const calls = [];
  const Deteksi = kompilasi("../src/halaman/Analisa/komponen/nav/layarDeteksiEngine.jsx", {
    "../../../../lib/i18n.jsx": { useI18n: () => ({ t }) },
    "../../../../lib/asets.js": { gambar: (x) => x },
    "../../../../modul/analisis/mesin.js": { DAFTAR_ENGINE: [{ id: "engine-a", label: "Stockfish 18" }], cariEngine: () => ({ label: "Stockfish 18" }), hashUntukEngine: () => 32 },
    "../../../../modul/sesi/analisa.js": { AnalyzeContext },
    "../../../../modul/sesi/mesin.js": { useMesin: () => mesin },
    "../../basisData.js": { ambilDaftarPartai: async () => ({ partai: [{ pgn: "1. e4 *" }] }) },
    "../../akun/useAkunKoleksi.js": { useAkunKoleksi: () => ({ akunTersimpan: [], koleksi: [] }) },
    "../../akun/koordinasiAkun.js": koordinasi,
    "../../akun/antiCheatRiwayat.js": {
      BATAS_PARTAI: 12, KEDALAMAN_AGGREGAT: 8, batasPartaiDariInput: (value) => Number(value) || 12,
      analisisRiwayatAntiCheat: async (opsi) => { calls.push(opsi); return { agregat: { jumlahPartai: 1 }, galat: [], dibatalkan: false }; },
    },
    "../../../../modul/analisis/multiPv.js": { MULTI_PV: 5 },
    "../../mesin/laporanPeninjauan.js": { unduhLaporanPeninjauan() {} },
    "./PanelLayar.jsx": { default: wrapper },
    "./ringkasanAntiCheat.jsx": { default: kosong },
    "./SelectDaftar.jsx": { default: kosong },
    "../Gambar.jsx": { default: kosong },
    "../../../../components/ui/alert-dialog.jsx": {
      AlertDialog: wrapper, AlertDialogAction: wrapper, AlertDialogContent: wrapper, AlertDialogDescription: wrapper,
      AlertDialogFooter: wrapper, AlertDialogHeader: wrapper, AlertDialogTitle: wrapper,
    },
  });
  const analyze = { akun: [{ platform: "chessCom", username: "Alice" }, () => {}], pageState: ["default"], analyzingMove: [false] };
  const isi = () => React.createElement(AnalyzeContext.Provider, { value: analyze }, React.createElement(Deteksi));
  let renderer;
  await act(async () => { renderer = TestRenderer.create(isi()); await flush(); });
  const button = (key) => renderer.root.findAllByType("button").find((node) => node.children.includes(key));
  await act(async () => { button("analisa.antiCheat.riwayat.mulai").props.onClick(); await flush(); });
  assert.equal(calls[0].paksa, false);
  await act(async () => { button("analisa.antiCheat.riwayat.mulaiUlang").props.onClick(); await flush(); });
  assert.equal(calls[1].paksa, true);
  mesin.idEngine = "engine-b";
  await act(async () => { renderer.update(isi()); await flush(); });
  assert.ok(button("analisa.antiCheat.riwayat.mulai"));
  assert.equal(button("analisa.antiCheat.riwayat.mulaiUlang"), undefined);
  await act(async () => { button("analisa.antiCheat.riwayat.mulai").props.onClick(); await flush(); });
  assert.equal(calls[2].paksa, false);
  assert.equal(calls[2].mesin.idEngine, "engine-b");
  const eventHapus = (nama) => ({
    key: `maestro-analisa-generasi-akun-${hashPgn(`chesscom:${nama}`)}`,
    newValue: JSON.stringify({ versi: "another-tab", status: "terhapus" }),
  });
  // Simulate events while localStorage is absent: unrelated accounts must not
  // clear the result, but deletion of Alice must still clear it.
  await act(async () => { pendengar.get("storage")(eventHapus("bob")); await flush(); });
  assert.ok(button("analisa.antiCheat.riwayat.mulaiUlang"));
  await act(async () => { pendengar.get("storage")(eventHapus("alice")); await flush(); });
  assert.ok(button("analisa.antiCheat.riwayat.mulai"));
  assert.equal(button("analisa.antiCheat.riwayat.mulaiUlang"), undefined);
  await act(async () => { button("analisa.antiCheat.riwayat.mulai").props.onClick(); await flush(); });
  let selesai;
  await act(async () => { selesai = koordinasi.mulaiPenghapusanAkun("chessCom", "Alice"); await flush(); });
  assert.ok(button("analisa.antiCheat.riwayat.mulai"));
  assert.equal(button("analisa.antiCheat.riwayat.mulaiUlang"), undefined);
  selesai();
  act(() => renderer.unmount());
});

test("critical background storage warnings remain visible until explicitly dismissed", (tes) => {
  const timerAsli = globalThis.setTimeout;
  const clearAsli = globalThis.clearTimeout;
  const timers = [];
  globalThis.setTimeout = (callback, ms) => { const timer = { callback, ms }; timers.push(timer); return timer; };
  globalThis.clearTimeout = () => {};
  tes.after(() => { globalThis.setTimeout = timerAsli; globalThis.clearTimeout = clearAsli; });
  const ErrorsContext = React.createContext(null);
  const PageErrors = kompilasi("../src/halaman/Analisa/komponen/errors/pageErrors.jsx", {
    "../../../../modul/sesi/galat.js": { ErrorsContext },
    "../../../../lib/i18n.jsx": { useI18n: () => ({ t }) },
  });
  function Harness() {
    const errors = React.useState([{ errorKey: 1, type: "warning", title: "Not saved", description: "Retry", persisten: true }]);
    return React.createElement(ErrorsContext.Provider, { value: { errors } }, React.createElement(PageErrors));
  }
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(Harness)); });
  assert.equal(renderer.root.findByProps({ role: "alert" }).children.length > 0, true);
  assert.equal(timers.some((timer) => timer.ms === 7500), false);
  act(() => renderer.root.findByProps({ "aria-label": "analisa.status.tutupPeringatan" }).props.onClick());
  const tutup = timers.find((timer) => timer.ms === 150);
  assert.ok(tutup);
  act(() => tutup.callback());
  assert.equal(renderer.root.findAllByProps({ role: "alert" }).length, 0);
  act(() => renderer.unmount());
});
