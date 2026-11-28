// Kontrak layar Teka-teki (tahap 2): alur sesi lewat hook, grup pengaturan di
// katalog "satu pintu", pemasangan layar/nav, dan paritas kamus fitur.
// Perilaku diadopsi dari puzzle En Croissant (GPL-3.0) sebagai aturan main;
// seluruh kode ditulis ulang untuk repo ini.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";

import { Chess } from "chess.js";
import * as modulTekaTeki from "../src/modul/tekaTeki/index.js";
import buatJejak from "../src/halaman/TekaTeki/logika/jejakLangkah.js";
import * as tandaBantu from "../src/halaman/TekaTeki/logika/tandaBantu.js";
import * as animasiBidak from "../src/halaman/TekaTeki/animasiBidak.js";
import { tekaTeki as kamusId } from "../src/lib/terjemahan/id/tekaTeki.js";
import { tekaTeki as kamusEn } from "../src/lib/terjemahan/en/tekaTeki.js";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;
const baca = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

function kompilasi(path, dependencies = {}) {
  const filename = new URL(path, import.meta.url);
  const out = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename.pathname,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const factory = runInThisContext(`(function (require, module, exports) {\n${out}\n})`);
  const result = { exports: {} };
  factory((id) => {
    if (id === "react" || id === "react/jsx-runtime") return require(id);
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, result, result.exports);
  return result.exports;
}

// Konvensi data sebenarnya: FEN = giliran PEMAIN dan langkah[0] adalah langkah
// pemain (Putih skakmat Re8#). Bukan konvensi "pembuka lawan" Lichess API.
const FEN_MAT = "7k/6pp/p7/8/8/8/5PPP/4R1K1 w - - 0 1";
const FEN_MAT2 = "7k/6pp/1p6/8/8/8/5PPP/4R1K1 w - - 0 1";
const DAFTAR_UJI = [
  modulTekaTeki.normalisasiSoal({ problemid: 1, fen: FEN_MAT, moves: "e1-e8", rating: 1100, tema: "mateIn1" }, "skakmat"),
  modulTekaTeki.normalisasiSoal({ problemid: 2, fen: FEN_MAT2, moves: "e1-e8", rating: 1200, tema: "mateIn1" }, "skakmat"),
];

// Soal nyata dari public/data/teka-teki.json (id 2, mat dalam dua): Hitam jalan
// lebih dulu, Putih membalas, Hitam skakmat. Dipakai uji jejak/daftar langkah.
const SOAL_PANJANG = modulTekaTeki.normalisasiSoal({
  problemid: 2, fen: "3r2k1/1B3n1p/6p1/2P2p2/1P6/2Q1P3/2P2PPP/6K1 b - - 0 31",
  moves: "d8-d1;c3-e1;d1-e1", rating: 600, tema: "backRankMate mateIn2",
}, "skakmat");

function pasangHook(tes, { daftar = DAFTAR_UJI, ...opsi } = {}) {
  const hook = kompilasi("../src/halaman/TekaTeki/logika/useSesiTekaTeki.js", {
    "../../../modul/tekaTeki/index.js": { ...modulTekaTeki, muatSoal: async () => daftar },
    "../animasiBidak.js": animasiBidak,
  }).default;
  const keluaran = { current: null };
  const props = { current: { catatWaktu: false, ...opsi } };
  function Harness() {
    keluaran.current = hook(props.current);
    return null;
  }
  let renderer;
  return {
    keluaran,
    async mount() {
      await act(async () => { renderer = TestRenderer.create(React.createElement(Harness)); });
      return keluaran.current;
    },
    async jalankan(fn) {
      await act(async () => { await fn(keluaran.current); });
      return keluaran.current;
    },
    // Ubah preferensi saat sesi berjalan (mis. sakelar "catat waktu").
    async ubah(tambahan) {
      props.current = { ...props.current, ...tambahan };
      await act(async () => { renderer.update(React.createElement(Harness)); });
      return keluaran.current;
    },
    unmount() { act(() => renderer.unmount()); },
  };
}

// Hitung interval pewaktu (jeda 200 ms) yang masih hidup, untuk memastikan tidak
// ada interval ganda atau tertinggal setelah ganti soal/unmount.
function pasangPenghitungInterval(tes) {
  const asliSet = globalThis.setInterval;
  const asliClear = globalThis.clearInterval;
  const hidup = new Set();
  globalThis.setInterval = (fn, jeda, ...sisa) => {
    const id = asliSet(fn, jeda, ...sisa);
    if (jeda === 200) hidup.add(id);
    return id;
  };
  globalThis.clearInterval = (id) => {
    hidup.delete(id);
    return asliClear(id);
  };
  tes.after(() => {
    globalThis.setInterval = asliSet;
    globalThis.clearInterval = asliClear;
  });
  return hidup;
}

test("session loads a source on the player's own turn and records one pending entry", async (tes) => {
  const sesi = pasangHook(tes);
  const keadaan = await sesi.mount();
  assert.equal(keadaan.memuat, false);
  assert.ok(keadaan.soal, "soal terpilih");
  assert.equal(keadaan.fen, keadaan.soal.fen, "papan memakai FEN soal apa adanya");
  assert.equal(modulTekaTeki.giliranDariFen(keadaan.fen), "w", "pemain jalan lebih dulu");
  assert.equal(keadaan.soal.pihak, "w", "papan diorientasikan ke pihak pemain");
  assert.equal(keadaan.indeks, 0, "langkah pertama yang diharapkan adalah langkah[0]");
  assert.equal(keadaan.riwayat.length, 1);
  assert.equal(keadaan.riwayat[0].status, "belum");
  assert.equal(keadaan.statistik.akurasi, null);
  sesi.unmount();
});

test("a wrong move marks the puzzle incorrect without advancing, but play may continue", async (tes) => {
  const sesi = pasangHook(tes, { lompatCepat: false });
  await sesi.mount();
  const sebelum = sesi.keluaran.current.fen;
  let keadaan = await sesi.jalankan((s) => s.mainkan({ from: "g2", to: "g3" }));
  assert.equal(keadaan.fen, sebelum, "posisi tidak maju");
  assert.equal(keadaan.riwayat[0].status, "salah");
  assert.equal(keadaan.pesan, "salah");
  assert.equal(keadaan.statistik.akurasi, 0);
  assert.equal(keadaan.belumSelesai, true, "paritas En Croissant: soal salah tetap boleh dilanjutkan");
  // Menuntaskan jalur setelah salah tetap tercatat salah, bukan benar.
  keadaan = await sesi.jalankan((s) => s.mainkan({ from: "e1", to: "e8" }));
  assert.equal(keadaan.riwayat[0].status, "salah", "status salah tidak berubah menjadi benar");
  assert.equal(keadaan.pesan, "selesai");
  assert.equal(keadaan.belumSelesai, false, "jalur selesai mengunci papan");
  sesi.unmount();
});

test("jump-to-next fires on any completed line, even an incorrect one", async (tes) => {
  const sesi = pasangHook(tes, { lompatCepat: true });
  await sesi.mount();
  await sesi.jalankan((s) => s.mainkan({ from: "g2", to: "g3" }));
  const keadaan = await sesi.jalankan((s) => s.mainkan({ from: "e1", to: "e8" }));
  assert.equal(keadaan.riwayat.length, 2, "lompat cepat berlaku untuk penyelesaian benar maupun salah");
  assert.equal(keadaan.riwayat[0].status, "salah");
  assert.equal(keadaan.riwayat[1].status, "belum");
  sesi.unmount();
});

test("the solving move finishes the puzzle; jump-to-next opens another one automatically", async (tes) => {
  const tetap = pasangHook(tes, { lompatCepat: false });
  await tetap.mount();
  let keadaan = await tetap.jalankan((s) => s.mainkan({ from: "e1", to: "e8" }));
  assert.equal(keadaan.riwayat[0].status, "benar");
  assert.equal(keadaan.pesan, "selesai");
  assert.equal(keadaan.riwayat.length, 1, "tanpa lompat cepat, sesi tetap di soal ini");
  assert.equal(keadaan.statistik.akurasi, 100);
  assert.equal(keadaan.belumSelesai, false);
  tetap.unmount();

  const lompat = pasangHook(tes, { lompatCepat: true });
  await lompat.mount();
  keadaan = await lompat.jalankan((s) => s.mainkan({ from: "e1", to: "e8" }));
  assert.equal(keadaan.riwayat.length, 2, "soal berikutnya langsung dibuka");
  assert.equal(keadaan.riwayat[0].status, "benar");
  assert.equal(keadaan.riwayat[1].status, "belum");
  assert.equal(keadaan.belumSelesai, true);
  lompat.unmount();
});

test("hints escalate square → arrow → cleared and cost the puzzle its correct status", async (tes) => {
  const sesi = pasangHook(tes);
  await sesi.mount();
  let keadaan = await sesi.jalankan((s) => s.ambilPetunjuk());
  assert.equal(keadaan.petunjuk.tingkat, "petak");
  assert.equal(keadaan.petunjuk.petak, "e1");
  assert.equal(keadaan.riwayat[0].status, "salah", "memakai petunjuk menandai soal salah");
  assert.equal(keadaan.belumSelesai, true, "petunjuk tidak mengunci papan");
  keadaan = await sesi.jalankan((s) => s.ambilPetunjuk());
  assert.equal(keadaan.petunjuk.tingkat, "panah");
  assert.deepEqual(keadaan.petunjuk.panah, { from: "e1", to: "e8" });
  keadaan = await sesi.jalankan((s) => s.ambilPetunjuk());
  assert.equal(keadaan.petunjuk.tingkat, "kosong", "tingkat ketiga menghapus petunjuk");
  sesi.unmount();
});

test("reopening history keeps a solved puzzle locked and an incorrect one playable", async (tes) => {
  const sesi = pasangHook(tes, { lompatCepat: false });
  await sesi.mount();
  await sesi.jalankan((s) => s.mainkan({ from: "e1", to: "e8" }));
  let keadaan = await sesi.jalankan((s) => s.pilihRiwayat(0));
  assert.equal(keadaan.belumSelesai, false, "soal benar yang dibuka ulang tetap terkunci");
  await sesi.jalankan((s) => s.bersihkanSesi());
  await sesi.jalankan((s) => s.mainkan({ from: "g2", to: "g3" }));
  keadaan = await sesi.jalankan((s) => s.pilihRiwayat(0));
  assert.equal(keadaan.belumSelesai, true, "soal salah yang dibuka ulang boleh dilanjutkan");
  assert.equal(keadaan.indeks, 0);
  sesi.unmount();
});

test("retrying the active puzzle resets it to a fresh, playable attempt", async (tes) => {
  const sesi = pasangHook(tes, { lompatCepat: false });
  await sesi.mount();
  const awalFen = sesi.keluaran.current.fen;
  await sesi.jalankan((s) => s.mainkan({ from: "e1", to: "e8" }));
  assert.equal(sesi.keluaran.current.belumSelesai, false, "terpecahkan → terkunci");
  const keadaan = await sesi.jalankan((s) => s.ulangSoal());
  assert.equal(keadaan.riwayat[0].status, "belum", "entri dicatat ulang belum dikerjakan");
  assert.equal(keadaan.belumSelesai, true, "papan terbuka lagi untuk percobaan baru");
  assert.equal(keadaan.indeks, 0);
  assert.equal(keadaan.fen, awalFen, "kembali ke posisi awal pemain");
  assert.equal(keadaan.waktu, 0);
  // Bisa dituntaskan lagi setelah diulang.
  const lagi = await sesi.jalankan((s) => s.mainkan({ from: "e1", to: "e8" }));
  assert.equal(lagi.riwayat[0].status, "benar");
  assert.equal(lagi.belumSelesai, false);
  sesi.unmount();
});

test("viewing the solution replays it and marks the puzzle incorrect", async (tes) => {
  const sesi = pasangHook(tes);
  await sesi.mount();
  const keadaan = await sesi.jalankan((s) => s.lihatSolusi());
  assert.equal(keadaan.riwayat[0].status, "salah");
  assert.equal(keadaan.solusiBerjalan, false, "pemutaran selesai");
  assert.equal(keadaan.pesan, "solusi");
  assert.equal(modulTekaTeki.giliranDariFen(keadaan.fen), "b", "posisi akhir solusi tercapai");
  // Pemutaran solusi mengikuti jalur tercatat, jadi jejak tetap sama seperti dulu.
  assert.deepEqual(keadaan.langkahNyata, keadaan.soal.langkah);
  assert.deepEqual(
    buatJejak(keadaan.soal, keadaan.indeks, keadaan.langkahNyata),
    buatJejak(keadaan.soal, keadaan.indeks),
    "jalur normal: jejak dengan jalur nyata identik dengan jejak solusi",
  );
  sesi.unmount();
});

test("clearing the session empties history and deals a fresh puzzle; history entries can be reopened", async (tes) => {
  const sesi = pasangHook(tes, { lompatCepat: true });
  await sesi.mount();
  await sesi.jalankan((s) => s.mainkan({ from: "e1", to: "e8" }));
  assert.equal(sesi.keluaran.current.riwayat.length, 2);
  let keadaan = await sesi.jalankan((s) => s.bersihkanSesi());
  assert.equal(keadaan.riwayat.length, 1, "sesi baru berisi satu soal segar");
  assert.equal(keadaan.riwayat[0].status, "belum");
  await sesi.jalankan((s) => s.mainkan({ from: "e1", to: "e8" }));
  keadaan = await sesi.jalankan((s) => s.pilihRiwayat(0));
  assert.equal(keadaan.aktif, 0);
  assert.equal(keadaan.indeks, 0, "soal lama dibuka dari awal");
  sesi.unmount();
});

// Pasang layar Teka-Teki utuh: hook sesi asli (sumber data di-stub) + papan dan
// panel di-stub agar props yang diterima layar bisa diperiksa. Dipakai uji
// sorotan langkah, penguncian saat memuat, dan pergantian sumber.
function pasangLayar(tes, { daftar = DAFTAR_UJI, prefs = {}, muat } = {}) {
  const hook = kompilasi("../src/halaman/TekaTeki/logika/useSesiTekaTeki.js", {
    "../../../modul/tekaTeki/index.js": {
      ...modulTekaTeki,
      muatSoal: muat ?? (async () => daftar),
    },
    "../animasiBidak.js": animasiBidak,
  }).default;
  let papanProps = null;
  let panelProps = null;
  let riwayatProps = null;
  const PapanStub = (props) => { papanProps = props; return React.createElement("div", { "data-papan": true }); };
  const PanelStub = (props) => { panelProps = props; return React.createElement("div", { "data-panel": true }); };
  const RiwayatStub = (props) => { riwayatProps = props; return React.createElement("div", { "data-riwayat": true }); };
  const Komponen = kompilasi("../src/halaman/TekaTeki/TekaTeki.jsx", {
    "../../lib/i18n.jsx": { useI18n: () => ({ t: (k) => k }) },
    "../Analisa/komponen/nav/PanelLayar.jsx": { default: (p) => React.createElement("div", null, p.children) },
    "./logika/useSesiTekaTeki.js": { default: hook },
    "./logika/usePreferensiTekaTeki.js": {
      default: () => ({
        ratingMin: 1000, ratingMax: 1500, tema: "", progresif: false,
        sembunyiRating: false, lompatCepat: false, catatWaktu: false, ubah() {}, ...prefs,
      }),
    },
    "./logika/useUkuranPapan.js": { default: () => 320 },
    "./logika/pgnDariSoal.js": { default: () => "" },
    "./logika/jejakLangkah.js": { default: buatJejak },
    "./komponen/papanTekaTeki.jsx": { default: PapanStub },
    "./komponen/panelTekaTeki.jsx": { default: PanelStub },
    "./komponen/riwayatLangkah.jsx": { default: RiwayatStub },
  }).default;
  let renderer;
  return {
    async mount() {
      await act(async () => { renderer = TestRenderer.create(React.createElement(Komponen)); });
      return this;
    },
    async jalankan(fn) {
      await act(async () => { await fn({ papan: papanProps, panel: panelProps, riwayat: riwayatProps }); });
      return this;
    },
    papan: () => papanProps,
    panel: () => panelProps,
    riwayat: () => riwayatProps,
    sesi: () => panelProps?.sesi,
    teks() { return JSON.stringify(renderer.toJSON()); },
    unmount() { act(() => renderer.unmount()); },
  };
}

let papanPalsuAktif = 0;
let documentPapanAsli;
function documentPapanPalsu() {
  if (papanPalsuAktif === 0) {
    documentPapanAsli = globalThis.document;
    const petaTitik = new Map();
    globalThis.document = {
      petaTitik,
      elementFromPoint(x, y) {
        const sq = petaTitik.get(`${x},${y}`);
        return sq ? { closest: () => ({ getAttribute: () => sq }) } : null;
      },
      // Papan memasang pendengar global pointer/klik; uji memanggil handler
      // lewat props, jadi pendengar cukup dicatat tanpa efek.
      addEventListener() {}, removeEventListener() {},
    };
  }
  return globalThis.document;
}

// Pasang papan interaktif untuk uji pointer. `cariPetak` memakai
// document.elementFromPoint, yang tidak ada di react-test-renderer, jadi uji ini
// memasang peta koordinat→petak terkendali. Ini uji unit handler, BUKAN uji
// browser: hit-testing nyata tidak diverifikasi di sini.
function pasangPapanInteraktif(tes, { fen = new Chess().fen(), ...props } = {}) {
  const panggilan = { panah: [], petak: [], hapus: 0, selesaiSeret: [], batal: 0 };
  const Komponen = kompilasi("../src/halaman/TekaTeki/komponen/papanInteraktif.jsx", {
    "../../Analisa/komponen/svg/piece.jsx": { default: () => React.createElement("span") },
    "../../Analisa/komponen/pengaturan/setBidak.js": { urlBidak: () => "" },
    "../../../modul/sesi/preferensi.js": { boardThemes: [{ white: "#ebecd0", black: "#779556" }] },
    "../animasiBidak.js": animasiBidak,
    "../../../lib/i18n.jsx": { useI18n: () => ({ t: (k) => k }) },
  }).default;
  const { petaTitik } = documentPapanPalsu();
  let renderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(Komponen, {
      fen, orientasi: "w",
      onTandaPanah: (from, to, warna) => panggilan.panah.push({ from, to, warna }),
      onTandaPetak: (petak, warna) => panggilan.petak.push({ petak, warna }),
      onHapusTanda: () => { panggilan.hapus++; },
      onSelesaiSeret: (from, to, klikUlang) => panggilan.selesaiSeret.push({ from, to, klikUlang }),
      onBatalSeret: () => { panggilan.batal++; },
      ...props,
    }));
  });
  // Satu document palsu dipakai bersama oleh semua papan dalam satu uji;
  // dipulihkan hanya setelah papan terakhir dilepas agar cleanup tidak gagal.
  papanPalsuAktif++;
  tes.after(() => {
    act(() => renderer.unmount());
    papanPalsuAktif--;
    if (papanPalsuAktif === 0) {
      if (documentPapanAsli === undefined) delete globalThis.document;
      else globalThis.document = documentPapanAsli;
    }
  });
  const akar = () => renderer.root.findAll((n) => typeof n.props?.onPointerMove === "function")[0];
  const petakEl = (sq) => renderer.root.findByProps({ "data-petak": sq });
  let titik = 0;
  return {
    renderer,
    panggilan,
    // Tekan tombol pada petak; kembalikan koordinat untuk gerak/lepas.
    tekan(sq, { button = 2, shiftKey = false, ctrlKey = false, altKey = false, metaKey = false } = {}) {
      titik += 10;
      const x = titik; const y = titik;
      petaTitik.set(`${x},${y}`, sq);
      const peristiwa = {
        button, shiftKey, ctrlKey, altKey, metaKey, pointerId: 1, buttons: button === 2 ? 2 : 1,
        clientX: x, clientY: y, pointerType: "mouse", preventDefault() {},
      };
      act(() => petakEl(sq).props.onPointerDown(peristiwa));
      return { x, y };
    },
    arahkan(x, y, sq) { if (sq) petaTitik.set(`${x},${y}`, sq); },
    gerak(x, y) { act(() => akar().props.onPointerMove({ clientX: x, clientY: y, buttons: 2, pointerId: 1 })); },
    lepas(x, y, button = 2) { act(() => akar().props.onPointerUp({ clientX: x, clientY: y, button, pointerId: 1 })); },
    batal() { act(() => akar().props.onPointerCancel({ pointerId: 1 })); },
    panahSementara() {
      const svg = renderer.root.findAll((n) => n.props?.className === "arrow");
      return svg.map((n) => n.props.fill);
    },
  };
}

// Sumber terkendali: setiap panggilan muatSoal mengembalikan janji yang bisa
// diselesaikan manual, untuk menguji keadaan selama memuat dan respons yang
// datang tidak berurutan.
function sumberTerkendali() {
  const permintaan = [];
  return {
    permintaan,
    muat(jenis) {
      let selesai;
      const janji = new Promise((r) => { selesai = r; });
      permintaan.push({ jenis, selesai });
      return janji;
    },
  };
}

test("switching source locks the board and clears the old puzzle, steps and timer while loading", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["Date", "setInterval"], now: 1_000_000 });
  const interval = pasangPenghitungInterval(tes);
  const kendali = sumberTerkendali();
  const layar = await pasangLayar(tes, { muat: kendali.muat, prefs: { catatWaktu: true } }).mount();
  tes.after(() => layar.unmount());
  // Soal pertama dari sumber skakmat.
  await layar.jalankan(() => kendali.permintaan[0].selesai(DAFTAR_UJI));
  assert.equal(layar.sesi().memuat, false);
  assert.equal(layar.papan().terkunci, false, "papan bisa dimainkan setelah soal terbuka");
  await layar.jalankan(() => jam.tick(3000));
  assert.equal(layar.sesi().waktu, 3000);
  await layar.jalankan(({ papan }) => papan.onLangkah({ from: "e1", to: "e8" }));
  assert.equal(layar.sesi().riwayat.length, 1);

  // Ganti sumber: selama memuat tidak ada soal/FEN lama, papan terkunci, timer mati.
  await layar.jalankan(({ panel }) => panel.onSumber("harian"));
  assert.equal(layar.sesi().memuat, true);
  assert.equal(layar.sesi().soal, null, "soal sumber lama dibersihkan saat memuat");
  assert.equal(layar.sesi().fen, "", "FEN lama tidak tersisa");
  assert.equal(layar.sesi().indeks, 0);
  assert.deepEqual(layar.sesi().langkahNyata, []);
  assert.deepEqual(layar.sesi().riwayat, [], "riwayat sesi lama tidak bercampur");
  assert.equal(layar.sesi().waktu, 0, "pewaktu lama dibersihkan");
  assert.equal(interval.size, 0, "tidak ada interval pewaktu selama memuat");
  assert.equal(layar.papan().terkunci, true, "papan terkunci selama memuat");
  assert.ok(layar.teks().includes("tekaTeki.status.memuat"), "indikator pemuatan tetap tampil");

  // Langkah yang dikirim selama memuat tidak mengubah apa pun.
  await layar.jalankan(({ papan }) => papan.onLangkah?.({ from: "e1", to: "e8" }));
  assert.equal(layar.sesi().soal, null);
  assert.deepEqual(layar.sesi().riwayat, []);

  // Sumber baru tiba: soal baru terbuka dan papan hidup kembali.
  const harian = [modulTekaTeki.normalisasiSoal({ tanggal: "2025-01-01", fen: FEN_MAT, langkah: "e1-e8" }, "harian")];
  await layar.jalankan(() => kendali.permintaan[1].selesai(harian));
  assert.equal(layar.sesi().memuat, false);
  assert.equal(layar.sesi().soal.jenis, "harian");
  assert.equal(layar.papan().terkunci, false);
  assert.equal(layar.sesi().waktu, 0, "waktu soal baru mulai dari nol");
});

test("switching source while the solution is replaying stops it and never resumes on the new source", async (tes) => {
  const kendali = sumberTerkendali();
  const layar = await pasangLayar(tes, { muat: kendali.muat, prefs: { ratingMin: 600 } }).mount();
  tes.after(() => layar.unmount());
  await layar.jalankan(() => kendali.permintaan[0].selesai([SOAL_PANJANG]));
  // Mulai pemutaran solusi tanpa menunggu selesai, lalu ganti sumber.
  let putar;
  await act(async () => { putar = layar.sesi().lihatSolusi(); });
  assert.equal(layar.sesi().solusiBerjalan, true);
  await layar.jalankan(({ panel }) => panel.onSumber("video"));
  assert.equal(layar.sesi().solusiBerjalan, false, "pemutaran solusi dihentikan");
  assert.equal(layar.sesi().soal, null);
  assert.equal(layar.papan().terkunci, true);
  await act(async () => { await putar; });
  assert.equal(layar.sesi().solusiBerjalan, false, "pemutaran lama tidak menghidupkan state lagi");
  assert.equal(layar.sesi().soal, null, "sumber lama tidak menimpa keadaan memuat");
  await layar.jalankan(() => kendali.permintaan[1].selesai(DAFTAR_UJI));
  assert.equal(layar.sesi().soal.jenis, "skakmat");
  assert.equal(layar.sesi().solusiBerjalan, false);
});

test("rapid source switches ignore out-of-order responses and keep the newest source", async (tes) => {
  const kendali = sumberTerkendali();
  const layar = await pasangLayar(tes, { muat: kendali.muat }).mount();
  tes.after(() => layar.unmount());
  // skakmat → video → harian, semua masih menggantung.
  await layar.jalankan(({ panel }) => panel.onSumber("video"));
  await layar.jalankan(({ panel }) => panel.onSumber("harian"));
  assert.equal(kendali.permintaan.length, 3);
  const harian = [modulTekaTeki.normalisasiSoal({ tanggal: "2025-02-02", fen: FEN_MAT, langkah: "e1-e8" }, "harian")];
  const video = [modulTekaTeki.normalisasiSoal({ problemid: 900, fen: FEN_MAT2, moves: "e1-e8", rating: 1200, tema: "endgame" }, "video")];

  // Respons sumber LAMA datang lebih dulu, lalu yang terbaru.
  await layar.jalankan(() => kendali.permintaan[0].selesai(DAFTAR_UJI));
  assert.equal(layar.sesi().soal, null, "respons skakmat basi diabaikan");
  assert.equal(layar.sesi().memuat, true);
  await layar.jalankan(() => kendali.permintaan[1].selesai(video));
  assert.equal(layar.sesi().soal, null, "respons video basi diabaikan");
  await layar.jalankan(() => kendali.permintaan[2].selesai(harian));
  assert.equal(layar.sesi().memuat, false);
  assert.equal(layar.sesi().soal.jenis, "harian", "hanya sumber terbaru yang dipakai");
  assert.equal(layar.sesi().soal.id, "harian-2025-02-02");

  // Respons terbaru datang lebih dulu, lalu yang basi: tetap tidak menimpa.
  await layar.jalankan(({ panel }) => panel.onSumber("video"));
  await layar.jalankan(({ panel }) => panel.onSumber("skakmat"));
  await layar.jalankan(() => kendali.permintaan[4].selesai(DAFTAR_UJI));
  assert.equal(layar.sesi().soal.jenis, "skakmat");
  await layar.jalankan(() => kendali.permintaan[3].selesai(video));
  assert.equal(layar.sesi().soal.jenis, "skakmat", "respons video yang terlambat tidak menimpa");
  assert.equal(layar.sesi().memuat, false);
});

test("an empty or failed source still reports the right message after the lock", async (tes) => {
  const kendali = sumberTerkendali();
  const layar = await pasangLayar(tes, { muat: kendali.muat }).mount();
  tes.after(() => layar.unmount());
  await layar.jalankan(() => kendali.permintaan[0].selesai([]));
  assert.equal(layar.sesi().memuat, false);
  assert.equal(layar.sesi().soal, null);
  assert.equal(layar.sesi().pesan, "gagal", "sumber gagal dimuat");
  assert.ok(layar.teks().includes("tekaTeki.status.gagal"));
  assert.equal(layar.papan().terkunci, true, "papan tetap terkunci tanpa soal");

  // Sumber berikutnya ada datanya tetapi tersaring habis → pesan "kosong".
  await layar.jalankan(({ panel }) => panel.onSumber("video"));
  assert.equal(layar.papan().terkunci, true);
  const diLuarRentang = [modulTekaTeki.normalisasiSoal({ problemid: 901, fen: FEN_MAT, moves: "e1-e8", rating: 2700, tema: "endgame" }, "video")];
  await layar.jalankan(() => kendali.permintaan[1].selesai(diLuarRentang));
  assert.equal(layar.sesi().pesan, "kosong");
  assert.ok(layar.teks().includes("tekaTeki.status.kosong"));
  assert.equal(layar.sesi().soal, null);
});

test("right-drag arrows keep the modifier colour end to end (default, Shift, Ctrl, Alt)", (tes) => {
  // Konvensi proyek: Shift=merah, Ctrl/Cmd=hijau, Alt=biru, tanpa modifier=bawaan.
  const kasus = [
    [{}, "bawaan"],
    [{ shiftKey: true }, "merah"],
    [{ ctrlKey: true }, "hijau"],
    [{ metaKey: true }, "hijau"],
    [{ altKey: true }, "biru"],
  ];
  for (const [modifier, harapan] of kasus) {
    const papan = pasangPapanInteraktif(tes);
    const { x, y } = papan.tekan("e2", modifier);
    assert.equal(papan.panahSementara().length, 0, "panah nol-panjang belum digambar");
    papan.arahkan(x + 1, y + 1, "e4");
    papan.gerak(x + 1, y + 1);
    assert.equal(papan.panahSementara().length, 1, "panah sementara tampil saat pointer pindah");
    const sementara = papan.panahSementara()[0];
    // Pointer pindah lagi: warna tetap, tidak kembali ke bawaan.
    papan.arahkan(x + 2, y + 2, "e5");
    papan.gerak(x + 2, y + 2);
    assert.deepEqual(papan.panahSementara(), [sementara], "warna panah sementara konsisten saat pointer pindah");
    papan.lepas(x + 2, y + 2);
    assert.deepEqual(papan.panggilan.panah, [{ from: "e2", to: "e5", warna: harapan }],
      `warna modifier ${JSON.stringify(modifier)} diteruskan ke panah permanen`);
    assert.equal(papan.panahSementara().length, 0, "panah sementara dibersihkan setelah lepas");

    // Warna panah sementara harus sama dengan panah permanen berwarna itu.
    const pembanding = pasangPapanInteraktif(tes, { tanda: { panah: [{ from: "e2", to: "e5", warna: harapan }], petak: {} } });
    const permanen = pembanding.renderer.root.findByProps({ "data-arrow": "e2e5" }).props.fill;
    assert.equal(sementara, permanen, "panah sementara dan permanen memakai warna yang sama");
  }
});

test("right-click without a valid target marks the square with the modifier colour", (tes) => {
  for (const [modifier, harapan] of [[{}, "bawaan"], [{ shiftKey: true }, "merah"], [{ altKey: true }, "biru"]]) {
    const papan = pasangPapanInteraktif(tes);
    const { x, y } = papan.tekan("d4", modifier);
    papan.lepas(x, y); // lepas di petak yang sama → tanda petak, bukan panah
    assert.deepEqual(papan.panggilan.panah, [], "tidak ada panah tanpa tujuan berbeda");
    assert.deepEqual(papan.panggilan.petak, [{ petak: "d4", warna: harapan }]);
  }
  // Lepas di luar papan: tidak ada panah maupun tanda petak.
  const luar = pasangPapanInteraktif(tes);
  const titik = luar.tekan("d4");
  luar.lepas(titik.x + 99, titik.y + 99);
  assert.deepEqual(luar.panggilan.panah, []);
  assert.deepEqual(luar.panggilan.petak, []);
});

test("cancelling an arrow leaves no permanent mark and no temporary arrow", (tes) => {
  const papan = pasangPapanInteraktif(tes);
  const { x, y } = papan.tekan("e2", { shiftKey: true });
  papan.arahkan(x + 1, y + 1, "e4");
  papan.gerak(x + 1, y + 1);
  assert.equal(papan.panahSementara().length, 1);
  papan.batal();
  assert.equal(papan.panahSementara().length, 0, "panah sementara hilang saat batal");
  assert.deepEqual(papan.panggilan.panah, [], "batal tidak menambah panah permanen");
  assert.deepEqual(papan.panggilan.petak, []);
  // Setelah batal, menggambar panah baru tetap berfungsi dengan warnanya.
  const lagi = papan.tekan("g1", { altKey: true });
  papan.arahkan(lagi.x + 1, lagi.y + 1, "f3");
  papan.gerak(lagi.x + 1, lagi.y + 1);
  papan.lepas(lagi.x + 1, lagi.y + 1);
  assert.deepEqual(papan.panggilan.panah, [{ from: "g1", to: "f3", warna: "biru" }]);
});

test("permanent arrows render with their stored colour, and left click clears all marks", (tes) => {
  const papan = pasangPapanInteraktif(tes, {
    tanda: { panah: [{ from: "e2", to: "e4", warna: "merah" }, { from: "g1", to: "f3", warna: "biru" }], petak: { d4: "hijau" } },
  });
  const panah = papan.renderer.root.findAll((n) => typeof n.props?.["data-arrow"] === "string");
  assert.deepEqual(panah.map((n) => n.props["data-arrow"]), ["e2e4", "g1f3"]);
  // Warna permanen dibaca dari state tanda, bukan dipaksa bawaan.
  assert.notEqual(panah[0].props.fill, panah[1].props.fill, "dua warna berbeda dirender berbeda");
  assert.ok(papan.renderer.root.findAllByProps({ "data-tanda-petak": "hijau" }).length === 1);
  act(() => papan.renderer.root.findByProps({ "data-petak": "e2" }).props.onPointerDown({
    button: 0, pointerId: 1, buttons: 1, clientX: 0, clientY: 0, pointerType: "mouse", preventDefault() {},
  }));
  assert.equal(papan.panggilan.hapus, 1, "klik kiri meminta hapus semua tanda");
});

test("board highlight follows the move actually played, not the recorded solution", async (tes) => {
  const soal = modulTekaTeki.normalisasiSoal({
    problemid: 77, fen: "6k1/5ppp/8/8/8/8/5PPP/3RR1K1 w - - 0 1",
    moves: "e1-e2;g7-g6;d1-d8", rating: 1200, tema: "mateIn1",
  }, "skakmat");
  const layar = await pasangLayar(tes, { daftar: [soal] }).mount();
  tes.after(() => layar.unmount());
  assert.equal(layar.papan().langkahAkhir, null, "belum ada langkah → tidak ada sorotan");

  // Jalur alternatif yang langsung skakmat: solusi menyebut Re2, pemain Rd8#.
  await layar.jalankan(({ papan }) => papan.onLangkah({ from: "d1", to: "d8" }));
  assert.deepEqual(layar.papan().langkahAkhir, { from: "d1", to: "d8" },
    "sorotan menunjuk langkah nyata, bukan langkah solusi");
  assert.ok(new Chess(layar.papan().fen).isCheckmate());
  assert.equal(layar.sesi().langkahNyata.length, 1);
});

test("board highlight stays correct on the normal line and while reviewing history", async (tes) => {
  // SOAL_PANJANG berating 600 → rentang prefs harus mencakupnya.
  const layar = await pasangLayar(tes, { daftar: [SOAL_PANJANG], prefs: { ratingMin: 600 } }).mount();
  tes.after(() => layar.unmount());
  // Jalur normal: Hitam Rd1+, Putih Qe1, Hitam Rxe1#.
  await layar.jalankan(({ papan }) => papan.onLangkah({ from: "d8", to: "d1" }));
  assert.deepEqual(layar.papan().langkahAkhir, { from: "c3", to: "e1" }, "balasan lawan jadi sorotan terakhir");
  assert.equal(layar.sesi().indeks, 2);

  await layar.jalankan(({ papan }) => papan.onLangkah({ from: "d1", to: "e1" }));
  assert.deepEqual(layar.papan().langkahAkhir, { from: "d1", to: "e1" });
  const fenLive = layar.papan().fen;
  assert.ok(new Chess(fenLive).isCheckmate());

  // Tinjau langkah pertama: FEN dan sorotan ikut mundur bersama.
  await layar.jalankan(({ riwayat }) => riwayat.onTinjau(1));
  assert.deepEqual(layar.papan().langkahAkhir, { from: "d8", to: "d1" }, "sorotan langkah yang ditinjau");
  assert.equal(layar.papan().terkunci, true, "papan terkunci saat meninjau");
  assert.notEqual(layar.papan().fen, fenLive, "FEN tinjauan berbeda dari live");
  assert.equal(new Chess(layar.papan().fen).isCheckmate(), false);

  // Kembali ke posisi terbaru: sorotan dan FEN pulih seperti semula.
  await layar.jalankan(({ riwayat }) => riwayat.onNavigasi("akhir"));
  assert.deepEqual(layar.papan().langkahAkhir, { from: "d1", to: "e1" });
  assert.equal(layar.papan().fen, fenLive);

  // Navigasi bertahap mundur lalu maju tetap konsisten dengan jejak.
  await layar.jalankan(({ riwayat }) => riwayat.onNavigasi("awal"));
  assert.equal(layar.papan().langkahAkhir, null, "posisi awal tidak punya sorotan");
  await layar.jalankan(({ riwayat }) => riwayat.onNavigasi("berikut"));
  assert.deepEqual(layar.papan().langkahAkhir, { from: "d8", to: "d1" });
  await layar.jalankan(({ riwayat }) => riwayat.onNavigasi("berikut"));
  assert.deepEqual(layar.papan().langkahAkhir, { from: "c3", to: "e1" });
});

test("an alternative move that does not end the game leaves the highlight untouched", async (tes) => {
  const soal = modulTekaTeki.normalisasiSoal({
    problemid: 79, fen: "6k1/5ppp/8/8/8/8/5PPP/3RR1K1 w - - 0 1",
    moves: "e1-e2;g7-g6;d1-d8", rating: 1200, tema: "mateIn1",
  }, "skakmat");
  const layar = await pasangLayar(tes, { daftar: [soal] }).mount();
  tes.after(() => layar.unmount());
  // Langkah solusi dulu supaya ada sorotan yang bisa dibandingkan.
  await layar.jalankan(({ papan }) => papan.onLangkah({ from: "e1", to: "e2" }));
  const sorotan = layar.papan().langkahAkhir;
  const fen = layar.papan().fen;
  assert.deepEqual(sorotan, { from: "g7", to: "g6" }, "balasan lawan tersorot");

  // Alternatif yang bukan skakmat dinilai salah: posisi & sorotan tidak maju.
  await layar.jalankan(({ papan }) => papan.onLangkah({ from: "d1", to: "d5" }));
  assert.equal(layar.sesi().status, "salah");
  assert.deepEqual(layar.papan().langkahAkhir, sorotan, "sorotan tidak berubah");
  assert.equal(layar.papan().fen, fen, "posisi tidak maju");
  assert.equal(layar.sesi().langkahNyata.length, 2, "tidak ada langkah palsu tercatat");
});

test("viewing the solution after an alternative line restores the recorded line and its highlight", async (tes) => {
  const soal = modulTekaTeki.normalisasiSoal({
    problemid: 78, fen: "6k1/5ppp/8/8/8/8/5PPP/3RR1K1 w - - 0 1",
    moves: "e1-e2;g7-g6;d1-d8", rating: 1200, tema: "mateIn1",
  }, "skakmat");
  const layar = await pasangLayar(tes, { daftar: [soal] }).mount();
  tes.after(() => layar.unmount());
  await layar.jalankan(({ papan }) => papan.onLangkah({ from: "d1", to: "d8" }));
  assert.deepEqual(layar.papan().langkahAkhir, { from: "d1", to: "d8" });

  // Lihat Solusi memutar jalur tercatat dari awal: sorotan mengikuti jalur itu.
  await layar.jalankan(({ panel }) => panel.sesi.lihatSolusi());
  assert.deepEqual(layar.sesi().langkahNyata, soal.langkah, "jalur solusi asli diputar ulang");
  assert.deepEqual(layar.papan().langkahAkhir, { from: "d1", to: "d8" }, "langkah terakhir jalur solusi");
  assert.equal(layar.sesi().indeks, 3);
  assert.equal(layar.papan().fen, layar.sesi().fen);
});

test("an alternative mate ends the session cleanly: no illegal reply, index and trace stay honest", async (tes) => {
  // Jalur solusi tercatat 3 langkah, tetapi Rd8# langsung skakmat di langkah 1.
  const soal = modulTekaTeki.normalisasiSoal({
    problemid: 77, fen: "6k1/5ppp/8/8/8/8/5PPP/3RR1K1 w - - 0 1",
    moves: "e1-e2;g7-g6;d1-d8", rating: 1200, tema: "mateIn1",
  }, "skakmat");
  const sesi = pasangHook(tes, { daftar: [soal], lompatCepat: false });
  await sesi.mount();
  const akhir = await sesi.jalankan((s) => s.mainkan({ from: "d1", to: "d8" }));
  assert.ok(new Chess(akhir.fen).isCheckmate(), "papan berada pada posisi skakmat");
  assert.equal(akhir.indeks, 1, "indeks maju satu langkah nyata, bukan dua");
  assert.equal(akhir.status, "benar", "skakmat alternatif tercatat benar");
  assert.equal(akhir.pesan, "selesai");
  assert.equal(akhir.belumSelesai, false, "papan terkunci setelah soal selesai");
  // Jejak langkah memuat posisi awal + langkah yang benar-benar dimainkan:
  // bukan langkah solusi awal (Re2) yang tidak pernah dimainkan.
  assert.deepEqual(akhir.langkahNyata, [{ from: "d1", to: "d8", promotion: undefined }]);
  const jejak = buatJejak(akhir.soal, akhir.indeks, akhir.langkahNyata);
  assert.equal(jejak.length, 2, "posisi awal + satu langkah nyata");
  assert.equal(jejak[1].san, "Rd8#");
  assert.equal(jejak[1].fen, akhir.fen, "posisi tinjauan sama dengan papan");
  assert.ok(new Chess(jejak[1].fen).isCheckmate());
  // Langkah lanjutan ditolak: tidak ada gerakan ilegal sesudah permainan berakhir.
  const tetap = await sesi.jalankan((s) => s.mainkan({ from: "g7", to: "g6" }));
  assert.equal(tetap.fen, akhir.fen, "FEN tidak berubah setelah soal selesai");
  assert.equal(tetap.indeks, 1);
  sesi.unmount();
});

test("the daily source deals a puzzle under the default rating range and an active theme", async (tes) => {
  // Soal harian tidak punya rating/tema; konfigurasi bawaan layar (1000–1500)
  // tidak boleh membuat sumber ini tampil kosong.
  const harian = modulTekaTeki.normalisasiSoal({
    tanggal: "2025-01-01", fen: FEN_MAT, langkah: "e1-e8",
  }, "harian");
  assert.equal(harian.rating, null);
  assert.deepEqual(harian.tema, []);
  const sesi = pasangHook(tes, {
    daftar: [harian], sumber: "harian", ratingMin: 1000, ratingMax: 1500, tema: "mateIn3",
  });
  const keadaan = await sesi.mount();
  assert.equal(keadaan.memuat, false);
  assert.ok(keadaan.soal, "sumber harian tetap menghasilkan soal pada konfigurasi bawaan");
  assert.equal(keadaan.soal.id, "harian-2025-01-01");
  assert.notEqual(keadaan.pesan, "kosong", "tidak boleh melaporkan sumber kosong");
  assert.equal(keadaan.fen, harian.fen);
  // Soal harian tetap bisa dimainkan normal.
  const akhir = await sesi.jalankan((s) => s.mainkan({ from: "e1", to: "e8" }));
  assert.equal(akhir.riwayat[0].status, "benar");
  sesi.unmount();
});

test("an empty source reports a readable state instead of crashing", async (tes) => {
  const sesi = pasangHook(tes, { daftar: [] });
  const keadaan = await sesi.mount();
  assert.equal(keadaan.memuat, false);
  assert.equal(keadaan.soal, null);
  assert.equal(keadaan.pesan, "gagal");
  assert.equal(keadaan.fen, "");
  sesi.unmount();
});

/* ------------------- Preferensi milik fitur (di dalam layar) ------------------- */

const tUji = (kunci) => kunci.split(".").reduce((acc, p) => acc?.[p], {
  tekaTeki: kamusEn,
  analisa: { pengaturan: { opsiSebelumnya: "Prev", opsiBerikutnya: "Next" } },
}) ?? kunci;

function pasangPrefs(tes, baca = {}) {
  const tulisan = [];
  const hook = kompilasi("../src/halaman/TekaTeki/logika/usePreferensiTekaTeki.js", {
    "../../../modul/sesi/preferensi.js": {
      bacaAngka: (k, d) => (k in baca ? baca[k] : d),
      bacaTeks: (k, d) => (k in baca ? baca[k] : d),
      bacaBoolean: (k, d) => (k in baca ? baca[k] : d),
      tulis: (k, v) => tulisan.push([k, v]),
      tulisBoolean: (k, v) => tulisan.push([k, v ? "1" : "0"]),
    },
  }).default;
  const keluaran = { current: null };
  function Harness() { keluaran.current = hook(); return null; }
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(Harness)); });
  tes.after(() => act(() => renderer.unmount()));
  return {
    keluaran, tulisan,
    async jalankan(fn) { await act(async () => { await fn(keluaran.current); }); return keluaran.current; },
  };
}

test("turning time tracking off freezes the clock and turning it back on does not count the pause", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["Date", "setInterval"], now: 1_000_000 });
  const interval = pasangPenghitungInterval(tes);
  const sesi = pasangHook(tes, { catatWaktu: true, lompatCepat: false });
  await sesi.mount();
  assert.equal(sesi.keluaran.current.waktu, 0);
  assert.equal(interval.size, 1, "tepat satu interval pewaktu saat soal berjalan");

  await sesi.jalankan(() => jam.tick(1000));
  assert.equal(sesi.keluaran.current.waktu, 1000);

  // Dimatikan: waktu beku dan interval dilepas.
  await sesi.ubah({ catatWaktu: false });
  assert.equal(interval.size, 0, "tidak ada interval saat pencatatan mati");
  await sesi.jalankan(() => jam.tick(5000));
  assert.equal(sesi.keluaran.current.waktu, 1000, "jeda tidak menambah waktu");

  // Dinyalakan lagi: lanjut dari 1000, bukan menghitung ulang sejak awal.
  await sesi.ubah({ catatWaktu: true });
  assert.equal(interval.size, 1, "tetap satu interval, tidak ganda");
  await sesi.jalankan(() => jam.tick(1000));
  assert.equal(sesi.keluaran.current.waktu, 2000, "jeda 5000 ms tidak ikut terhitung");

  // Waktu yang tercatat saat soal selesai juga tidak memuat jeda.
  const akhir = await sesi.jalankan((s) => s.mainkan({ from: "e1", to: "e8" }));
  assert.equal(akhir.riwayat[0].waktu, 2000);
  assert.equal(interval.size, 0, "interval dilepas setelah soal selesai");
  await sesi.jalankan(() => jam.tick(3000));
  assert.equal(sesi.keluaran.current.waktu, 2000, "waktu tidak berjalan setelah selesai");
  sesi.unmount();
  assert.equal(interval.size, 0);
});

test("time tracking switched on mid-puzzle starts counting from zero", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["Date", "setInterval"], now: 1_000_000 });
  const interval = pasangPenghitungInterval(tes);
  const sesi = pasangHook(tes, { catatWaktu: false, lompatCepat: false });
  await sesi.mount();
  await sesi.jalankan(() => jam.tick(500));
  assert.equal(sesi.keluaran.current.waktu, 0, "pencatatan mati: waktu tetap nol");
  assert.equal(interval.size, 0);

  await sesi.ubah({ catatWaktu: true });
  assert.equal(interval.size, 1, "pewaktu hidup saat dinyalakan di tengah soal");
  await sesi.jalankan(() => jam.tick(1000));
  assert.equal(sesi.keluaran.current.waktu, 1000, "dihitung sejak dinyalakan, bukan sejak soal dibuka");
  sesi.unmount();
  assert.equal(interval.size, 0, "tidak ada interval tertinggal setelah unmount");
});

test("dealing another puzzle while the clock runs resets the timer state", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["Date", "setInterval"], now: 1_000_000 });
  const interval = pasangPenghitungInterval(tes);
  const sesi = pasangHook(tes, { catatWaktu: true, lompatCepat: false });
  await sesi.mount();
  const pertama = sesi.keluaran.current.soal.id;
  await sesi.jalankan(() => jam.tick(4000));
  assert.equal(sesi.keluaran.current.waktu, 4000);
  await sesi.jalankan((s) => s.mainkan({ from: "e1", to: "e8" }));
  assert.equal(sesi.keluaran.current.riwayat[0].waktu, 4000);
  assert.equal(interval.size, 0, "pewaktu berhenti saat soal pertama selesai");

  // Pindah soal saat sesi hidup: waktu mulai nol dan hanya satu interval.
  const baru = await sesi.jalankan((s) => s.soalBaru());
  assert.notEqual(baru.soal.id, pertama, "soal baru terbuka");
  assert.equal(baru.waktu, 0, "waktu soal baru mulai dari nol");
  assert.equal(interval.size, 1, "interval lama dibersihkan, tepat satu yang baru");
  await sesi.jalankan(() => jam.tick(1000));
  assert.equal(sesi.keluaran.current.waktu, 1000, "waktu soal lama tidak bocor ke soal baru");

  // Soal yang sudah benar dibuka ulang dari riwayat: pewaktu tidak hidup lagi.
  const ulang = await sesi.jalankan((s) => s.pilihRiwayat(0));
  assert.equal(ulang.waktu, 4000, "waktu tersimpan soal lama dipulihkan");
  assert.equal(interval.size, 0, "soal yang sudah benar tidak menjalankan pewaktu");
  sesi.unmount();
  assert.equal(interval.size, 0);
});

test("case A: requesting a puzzle with no match stops the running clock and freezes time", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["Date", "setInterval"], now: 1_000_000 });
  const interval = pasangPenghitungInterval(tes);
  const sesi = pasangHook(tes, { catatWaktu: true, lompatCepat: false });
  await sesi.mount();
  assert.equal(interval.size, 1, "pewaktu hidup saat soal berjalan");
  await sesi.jalankan(() => jam.tick(1000));
  assert.equal(sesi.keluaran.current.waktu, 1000);

  // Filter diubah sehingga tidak ada soal yang cocok, lalu minta soal baru.
  await sesi.ubah({ ratingMin: 2700, ratingMax: 2800 });
  const kosong = await sesi.jalankan((s) => s.soalBaru());
  assert.equal(kosong.pesan, "kosong");
  assert.equal(kosong.soal, null);
  assert.equal(interval.size, 0, "interval pewaktu lama dilepas saat sesi kosong");
  assert.equal(kosong.waktu, 0, "waktu sesi lama tidak dibawa ke keadaan kosong");
  await sesi.jalankan(() => jam.tick(5000));
  assert.equal(sesi.keluaran.current.waktu, 0, "waktu tidak bertambah setelah sesi kosong");
  assert.equal(interval.size, 0);
  sesi.unmount();
});

test("case B: an empty result clears the old puzzle's progress and completion state", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["Date", "setInterval"], now: 1_000_000 });
  const sesi = pasangHook(tes, { daftar: [SOAL_PANJANG], ratingMin: 600, catatWaktu: true, lompatCepat: false });
  await sesi.mount();
  // Mainkan satu langkah (pemain + balasan lawan) sehingga ada progres nyata.
  await sesi.jalankan((s) => s.mainkan({ from: "d8", to: "d1" }));
  assert.equal(sesi.keluaran.current.indeks, 2);
  assert.equal(sesi.keluaran.current.langkahNyata.length, 2);
  await sesi.jalankan(() => jam.tick(2000));
  assert.equal(sesi.keluaran.current.waktu, 2000);

  await sesi.ubah({ ratingMin: 2700, ratingMax: 2800 });
  const kosong = await sesi.jalankan((s) => s.soalBaru());
  assert.equal(kosong.pesan, "kosong");
  assert.equal(kosong.indeks, 0, "indeks progres soal lama dibersihkan");
  assert.deepEqual(kosong.langkahNyata, [], "jejak langkah lama tidak dianggap sesi aktif");
  assert.deepEqual(buatJejak(kosong.soal, kosong.indeks, kosong.langkahNyata), [], "tidak ada jejak saat kosong");
  assert.equal(kosong.belumSelesai, false, "sesi kosong tidak menyatakan sesi lama masih berjalan");
  assert.equal(kosong.solusiBerjalan, false);
  assert.deepEqual(kosong.petunjuk, { tingkat: "kosong", petak: null, panah: null }, "petunjuk lama dibersihkan");
  assert.equal(kosong.aktif, -1, "tidak ada entri riwayat yang dianggap aktif");
  assert.equal(kosong.fen, "");
  sesi.unmount();
});

test("case C: after an empty result, widening the filter starts a normal playable session", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["Date", "setInterval"], now: 1_000_000 });
  const interval = pasangPenghitungInterval(tes);
  const sesi = pasangHook(tes, { catatWaktu: true, lompatCepat: false });
  await sesi.mount();
  await sesi.jalankan(() => jam.tick(1500));
  await sesi.ubah({ ratingMin: 2700, ratingMax: 2800 });
  const kosong = await sesi.jalankan((s) => s.soalBaru());
  assert.equal(kosong.pesan, "kosong");
  assert.equal(interval.size, 0);

  // Filter dibuka lagi → soal baru harus bisa dimainkan seperti biasa.
  await sesi.ubah({ ratingMin: 1000, ratingMax: 1500 });
  const pulih = await sesi.jalankan((s) => s.soalBaru());
  assert.ok(pulih.soal, "soal baru terbuka setelah kondisi kosong");
  assert.equal(pulih.pesan, "", "pesan kosong dibersihkan");
  assert.equal(pulih.indeks, 0);
  assert.deepEqual(pulih.langkahNyata, []);
  assert.equal(pulih.belumSelesai, true, "sesi baru berjalan");
  assert.equal(pulih.aktif, pulih.riwayat.length - 1, "entri baru menjadi aktif");
  assert.equal(interval.size, 1, "pewaktu sesi baru hidup tepat satu");
  assert.equal(pulih.waktu, 0, "waktu mulai dari nol, bukan sisa sesi lama");
  await sesi.jalankan(() => jam.tick(1000));
  assert.equal(sesi.keluaran.current.waktu, 1000);

  const akhir = await sesi.jalankan((s) => s.mainkan({ from: "e1", to: "e8" }));
  assert.equal(akhir.riwayat.at(-1).status, "benar");
  assert.equal(akhir.riwayat.at(-1).waktu, 1000);
  assert.equal(akhir.indeks, 1);
  assert.equal(akhir.langkahNyata.length, 1);
  assert.equal(interval.size, 0, "pewaktu berhenti setelah soal selesai");
  sesi.unmount();
});

test("case D: a source that is empty from the start reports it without starting a clock", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["Date", "setInterval"], now: 1_000_000 });
  const interval = pasangPenghitungInterval(tes);
  const sesi = pasangHook(tes, { daftar: [], catatWaktu: true });
  const keadaan = await sesi.mount();
  assert.equal(keadaan.memuat, false);
  assert.equal(keadaan.soal, null);
  assert.equal(keadaan.pesan, "gagal");
  assert.equal(keadaan.waktu, 0);
  assert.equal(keadaan.belumSelesai, false, "sumber kosong tidak dianggap sesi berjalan");
  assert.equal(interval.size, 0, "tidak ada interval untuk sumber kosong");
  await sesi.jalankan(() => jam.tick(4000));
  assert.equal(sesi.keluaran.current.waktu, 0);
  assert.equal(interval.size, 0);
  // Minta soal baru pada sumber kosong tetap aman.
  const lagi = await sesi.jalankan((s) => s.soalBaru());
  assert.equal(lagi.soal, null);
  assert.equal(interval.size, 0);
  sesi.unmount();
});

test("progressive mode also cleans up when its raised range has no candidate, and recovers", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["Date", "setInterval"], now: 1_000_000 });
  const interval = pasangPenghitungInterval(tes);
  // Soal pertama berating 2500; rentang progresifnya [2550, 2600] tidak punya
  // kandidat. Soal 1100 dipakai untuk membuktikan pemulihan.
  const tinggi = modulTekaTeki.normalisasiSoal({ problemid: 1, fen: FEN_MAT, moves: "e1-e8", rating: 2500, tema: "mateIn1" }, "skakmat");
  const rendah = modulTekaTeki.normalisasiSoal({ problemid: 2, fen: FEN_MAT2, moves: "e1-e8", rating: 1100, tema: "mateIn1" }, "skakmat");
  const sesi = pasangHook(tes, {
    daftar: [tinggi, rendah], progresif: true, catatWaktu: true, lompatCepat: true,
    ratingMin: 2400, ratingMax: 2600,
  });
  await sesi.mount();
  assert.equal(sesi.keluaran.current.soal.rating, 2500);
  await sesi.jalankan(() => jam.tick(1200));
  assert.equal(sesi.keluaran.current.waktu, 1200);

  // Menyelesaikan soal memicu lompat cepat dengan dasar rating 2500 → kosong.
  const kosong = await sesi.jalankan((s) => s.mainkan({ from: "e1", to: "e8" }));
  assert.equal(kosong.pesan, "kosong");
  assert.equal(kosong.soal, null);
  assert.equal(interval.size, 0, "pewaktu mati pada rentang progresif kosong");
  assert.equal(kosong.belumSelesai, false);
  assert.equal(kosong.indeks, 0);
  assert.deepEqual(kosong.langkahNyata, []);
  await sesi.jalankan(() => jam.tick(3000));
  assert.equal(sesi.keluaran.current.waktu, 0, "waktu tidak berjalan saat kosong");
  // Riwayat beserta waktu soal yang sudah benar tetap tersimpan.
  assert.equal(kosong.riwayat[0].status, "benar");
  assert.equal(kosong.riwayat[0].waktu, 1200);

  // Rentang dibuka lagi → soal baru bisa dimainkan (dasar rating null karena
  // tidak ada soal aktif, jadi memakai rentang manual).
  await sesi.ubah({ ratingMin: 1000, ratingMax: 1500 });
  const pulih = await sesi.jalankan((s) => s.soalBaru());
  assert.ok(pulih.soal, "progresif pulih dari kondisi kosong");
  assert.equal(pulih.soal.rating, 1100);
  assert.equal(pulih.indeks, 0);
  assert.equal(pulih.belumSelesai, true);
  assert.equal(interval.size, 1);
  assert.equal(pulih.waktu, 0);
  sesi.unmount();
});

test("feature-local prefs default like En Croissant and persist every change", async (tes) => {
  const p = pasangPrefs(tes);
  const awal = p.keluaran.current;
  assert.equal(awal.ratingMin, 1000);
  assert.equal(awal.ratingMax, 1500);
  assert.equal(awal.tema, "");
  assert.equal(awal.progresif, false);
  assert.equal(awal.sembunyiRating, false);
  assert.equal(awal.lompatCepat, true);
  assert.equal(awal.catatWaktu, true);
  let k = await p.jalankan((s) => s.ubah("progresif", true));
  assert.equal(k.progresif, true);
  assert.deepEqual(p.tulisan.at(-1), ["puzzleProgresif", "1"]);
  k = await p.jalankan((s) => s.ubah("tema", "fork"));
  assert.equal(k.tema, "fork");
  assert.deepEqual(p.tulisan.at(-1), ["puzzleTema", "fork"]);
  k = await p.jalankan((s) => s.ubah("lompatCepat", false));
  assert.deepEqual(p.tulisan.at(-1), ["puzzleLompatCepat", "0"], "sakelar bawaan nyala bisa dimatikan");
});

test("rating bounds clamp against each other and stay within 600–2800", async (tes) => {
  const p = pasangPrefs(tes);
  let k = await p.jalankan((s) => s.ubah("ratingMin", 2000));
  assert.equal(k.ratingMin, 1500, "min dijepit ke max");
  k = await p.jalankan((s) => s.ubah("ratingMax", 700));
  assert.equal(k.ratingMax, 1500, "max tidak boleh turun di bawah min");
  const tersimpan = pasangPrefs(tes, { puzzleRatingMin: 9999, puzzleRatingMax: -5 });
  assert.equal(tersimpan.keluaran.current.ratingMin, 2800, "nilai tersimpan dijepit ke atas");
  assert.equal(tersimpan.keluaran.current.ratingMax, 600, "nilai tersimpan dijepit ke bawah");
});

function pasangPengaturanLayar(tes, prefsOverride = {}, temaTersedia = []) {
  const panggilan = [];
  const prefs = {
    ratingMin: 1000, ratingMax: 1500, tema: "", progresif: false,
    sembunyiRating: false, lompatCepat: true, catatWaktu: true,
    ubah: (k, v) => panggilan.push([k, v]), ...prefsOverride,
  };
  const Pilih = ({ nilai, onChange, ariaLabel, pilihan }) => React.createElement("select", { "data-pilih": ariaLabel, value: nilai, "data-opsi": pilihan.map((p) => p.id).join(","), onChange: (e) => onChange(e.target.value) });
  const Sakelar = ({ checked, onCheckedChange, "aria-label": label }) => React.createElement("button", { role: "switch", "aria-checked": checked, "aria-label": label, onClick: () => onCheckedChange(!checked) });
  const Rentang = (props) => React.createElement("div", { "data-rentang": true, "data-disabled": props.disabled || false });
  const Komponen = kompilasi("../src/halaman/TekaTeki/komponen/pengaturanTekaTeki.jsx", {
    "../../../modul/tekaTeki/index.js": modulTekaTeki,
    "../../Analisa/komponen/pengaturan/pilihRingkas.jsx": { default: Pilih },
    "./sakelarRingkas.jsx": { default: Sakelar },
    "./rentangRating.jsx": { default: Rentang },
    "../logika/usePreferensiTekaTeki.js": { RATING_BAWAH: 600, RATING_ATAS: 2800 },
  }).default;
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(Komponen, { prefs, t: tUji, temaTersedia })); });
  tes.after(() => act(() => renderer.unmount()));
  return { renderer, panggilan };
}

// Lingkungan fokus terkendali untuk uji aksesibilitas dialog. react-test-renderer
// tidak punya DOM, jadi uji ini menyediakan activeElement/contains/querySelector
// minimal. Ini uji unit perilaku fokus, BUKAN uji browser/screen reader.
function pasangDialogPromosi(tes, { onPilih, onBatal } = {}) {
  const tombol = ["q", "r", "b", "n", "batal"].map((nama) => ({
    nama,
    fokus: false,
    focus() { this.fokus = true; lingkungan.activeElement = this; },
  }));
  const wadah = {
    querySelector: (sel) => (sel === "button" ? tombol[0] : null),
    querySelectorAll: (sel) => (sel === "button" ? tombol : []),
    contains: (el) => tombol.includes(el),
  };
  const pemicu = { nama: "pemicu", focus() { this.fokus = true; lingkungan.activeElement = this; } };
  const pendengar = new Map();
  const lingkungan = {
    activeElement: pemicu,
    addEventListener: (jenis, fn) => pendengar.set(jenis, fn),
    removeEventListener: (jenis) => pendengar.delete(jenis),
    contains: (el) => el === pemicu || tombol.includes(el),
  };
  const asli = globalThis.document;
  globalThis.document = lingkungan;
  const Komponen = kompilasi("../src/halaman/TekaTeki/komponen/dialogPromosi.jsx", {
    "../../Analisa/komponen/svg/piece.jsx": { default: () => React.createElement("span") },
    "../../../lib/i18n.jsx": { useI18n: () => ({ t: (k) => k }) },
  }).default;
  let renderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(Komponen, {
      warna: "w", onPilih: onPilih ?? (() => {}), onBatal: onBatal ?? (() => {}),
    }), {
      // Ref wadah dialog diisi mock agar querySelector/contains bisa dipakai.
      createNodeMock: (el) => (typeof el.props?.className === "string" && el.props.className.includes("flex flex-col") ? wadah : null),
    });
  });
  tes.after(() => {
    act(() => renderer.unmount());
    if (asli === undefined) delete globalThis.document; else globalThis.document = asli;
  });
  return {
    renderer, tombol, pemicu, wadah, lingkungan,
    tekan(key, shiftKey = false) {
      const fn = pendengar.get("keydown");
      let dicegah = false;
      act(() => fn?.({ key, shiftKey, preventDefault() { dicegah = true; } }));
      return dicegah;
    },
    aktif: () => lingkungan.activeElement,
  };
}

test("promotion dialog moves focus to the first choice and traps Tab and Shift+Tab", (tes) => {
  const dialog = pasangDialogPromosi(tes);
  assert.equal(dialog.aktif().nama, "q", "fokus awal ke pilihan promosi pertama");
  // Tab dari tombol terakhir kembali ke pertama.
  dialog.tombol.at(-1).focus();
  assert.equal(dialog.tekan("Tab"), true, "Tab di tombol terakhir dicegah agar tidak keluar dialog");
  assert.equal(dialog.aktif().nama, "q");
  // Shift+Tab dari tombol pertama lompat ke tombol terakhir.
  dialog.tombol[0].focus();
  assert.equal(dialog.tekan("Tab", true), true);
  assert.equal(dialog.aktif().nama, "batal");
  // Fokus di luar dialog ditarik masuk.
  dialog.pemicu.focus();
  dialog.tekan("Tab");
  assert.equal(dialog.aktif().nama, "q", "Tab dari luar dialog masuk ke pilihan pertama");
  dialog.pemicu.focus();
  dialog.tekan("Tab", true);
  assert.equal(dialog.aktif().nama, "batal", "Shift+Tab dari luar dialog masuk ke tombol terakhir");
  // Tab di tengah dialog dibiarkan berjalan alami (tidak dicegah).
  dialog.tombol[1].focus();
  assert.equal(dialog.tekan("Tab"), false, "Tab di tengah tidak dicegah");
});

test("promotion dialog cancels on Escape and restores focus to the trigger on close", (tes) => {
  let batal = 0;
  const dialog = pasangDialogPromosi(tes, { onBatal: () => { batal++; } });
  assert.equal(dialog.tekan("Escape"), true, "Escape dicegah agar tidak merembet");
  assert.equal(batal, 1, "Escape membatalkan dialog");
  // Penutupan (unmount) memulihkan fokus ke pemicu.
  dialog.tombol[2].focus();
  act(() => dialog.renderer.unmount());
  assert.equal(dialog.aktif().nama, "pemicu", "fokus kembali ke elemen pemicu");
});

test("promotion dialog keeps its four choices and cancel button wired", (tes) => {
  const pilihan = [];
  let batal = 0;
  const dialog = pasangDialogPromosi(tes, { onPilih: (tipe) => pilihan.push(tipe), onBatal: () => { batal++; } });
  const root = dialog.renderer.root;
  assert.equal(root.findAllByProps({ role: "dialog" }).length, 1);
  const kotak = root.findByProps({ role: "dialog" });
  assert.equal(String(kotak.props["aria-modal"]), "true", "dialog ditandai modal");
  const tombol = root.findAllByType("button");
  assert.equal(tombol.length, 5, "empat bidak + tombol batal");
  for (const tipe of ["q", "r", "b", "n"]) {
    const target = tombol.find((b) => b.props["aria-label"] === `tekaTeki.promosi.${tipe}`);
    act(() => target.props.onClick());
    assert.equal(pilihan.at(-1), tipe);
  }
  act(() => tombol.at(-1).props.onClick());
  assert.equal(batal, 1, "tombol batal membatalkan");
  // Klik latar membatalkan; klik isi dialog tidak.
  act(() => kotak.props.onMouseDown({ target: kotak, currentTarget: kotak }));
  assert.equal(batal, 2);
  const isi = {};
  act(() => kotak.props.onMouseDown({ target: isi, currentTarget: kotak }));
  assert.equal(batal, 2, "klik di dalam dialog tidak membatalkan");
});

test("the theme catalog offers every theme the active source actually has", () => {
  const skakmat = modulTekaTeki.normalisasiBerkas(JSON.parse(baca("../public/data/teka-teki.json")), "skakmat");
  const video = modulTekaTeki.normalisasiBerkas(JSON.parse(baca("../public/data/teka-teki-video.json")), "video");
  const temaSkakmat = modulTekaTeki.daftarTema(skakmat);
  const temaVideo = modulTekaTeki.daftarTema(video);
  assert.equal(temaSkakmat.length, 50, "data skakmat punya 50 tema");
  assert.equal(temaVideo.length, 9, "data video punya 9 tema");
  // Tema yang dulu tidak terjangkau daftar statis 13 tema.
  for (const nama of ["smotheredMate", "hangingPiece", "master", "promotion", "anastasiaMate", "enPassant"]) {
    assert.ok(temaSkakmat.includes(nama), `${nama} ada di data skakmat`);
  }
  // Katalog tidak boleh mencampur tema sumber lain.
  assert.ok(!temaVideo.includes("mateIn1"), "video tidak punya mateIn1");
  assert.ok(temaSkakmat.includes("mateIn1"));
  assert.notDeepEqual(temaSkakmat, temaVideo);
});

test("settings list the active source's themes, keep 'all themes', and fall back for unavailable ones", (tes) => {
  const skakmat = modulTekaTeki.normalisasiBerkas(JSON.parse(baca("../public/data/teka-teki.json")), "skakmat");
  const temaSkakmat = modulTekaTeki.daftarTema(skakmat);
  const layar = pasangPengaturanLayar(tes, {}, temaSkakmat);
  const pilih = layar.renderer.root.findByProps({ "data-pilih": tUji("tekaTeki.pengaturan.tema") });
  const opsi = pilih.props["data-opsi"].split(",");
  assert.equal(opsi[0], "semua", "pilihan semua tema tetap ada");
  assert.deepEqual(opsi.slice(1), temaSkakmat, "seluruh tema sumber aktif tersedia");
  assert.equal(opsi.length, 51);

  // Tema terpilih yang tidak ada di sumber ini ditampilkan sebagai semua tema.
  const basi = pasangPengaturanLayar(tes, { tema: "mateIn1" }, modulTekaTeki.daftarTema(
    modulTekaTeki.normalisasiBerkas(JSON.parse(baca("../public/data/teka-teki-video.json")), "video"),
  ));
  const pilihVideo = basi.renderer.root.findByProps({ "data-pilih": tUji("tekaTeki.pengaturan.tema") });
  assert.equal(pilihVideo.props.value, "semua", "tema tak tersedia tidak ditampilkan sebagai pilihan aktif");
  assert.ok(!pilihVideo.props["data-opsi"].split(",").includes("mateIn1"));

  // Sumber harian tidak punya tema → hanya "semua tema".
  const harian = pasangPengaturanLayar(tes, { tema: "mateIn1" }, []);
  const pilihHarian = harian.renderer.root.findByProps({ "data-pilih": tUji("tekaTeki.pengaturan.tema") });
  assert.equal(pilihHarian.props["data-opsi"], "semua");
  assert.equal(pilihHarian.props.value, "semua");

  // Memilih tema tetap menulis lewat prefs.ubah; "semua" mengosongkan tema.
  act(() => pilih.props.onChange({ target: { value: "smotheredMate" } }));
  assert.deepEqual(layar.panggilan.at(-1), ["tema", "smotheredMate"]);
  act(() => pilih.props.onChange({ target: { value: "semua" } }));
  assert.deepEqual(layar.panggilan.at(-1), ["tema", ""]);
});

test("the session exposes the active source's theme catalog and refreshes it on source change", async (tes) => {
  const kendali = sumberTerkendali();
  const layar = await pasangLayar(tes, { muat: kendali.muat }).mount();
  tes.after(() => layar.unmount());
  const skakmat = modulTekaTeki.normalisasiBerkas(JSON.parse(baca("../public/data/teka-teki.json")), "skakmat");
  await layar.jalankan(() => kendali.permintaan[0].selesai(skakmat));
  assert.deepEqual(layar.sesi().temaTersedia, modulTekaTeki.daftarTema(skakmat));
  assert.equal(layar.sesi().temaTersedia.length, 50);

  // Ganti sumber: katalog ikut berubah, tidak mencampur tema skakmat.
  const video = modulTekaTeki.normalisasiBerkas(JSON.parse(baca("../public/data/teka-teki-video.json")), "video");
  await layar.jalankan(({ panel }) => panel.onSumber("video"));
  assert.deepEqual(layar.sesi().temaTersedia, [], "katalog dikosongkan selama memuat");
  await layar.jalankan(() => kendali.permintaan[1].selesai(video));
  assert.deepEqual(layar.sesi().temaTersedia, modulTekaTeki.daftarTema(video));
  assert.equal(layar.sesi().temaTersedia.length, 9);
  assert.ok(!layar.sesi().temaTersedia.includes("mateIn1"));

  // Sumber harian: katalog kosong dan soal tetap terbuka (filter tema diabaikan).
  const harian = [modulTekaTeki.normalisasiSoal({ tanggal: "2025-03-03", fen: FEN_MAT, langkah: "e1-e8" }, "harian")];
  await layar.jalankan(({ panel }) => panel.onSumber("harian"));
  await layar.jalankan(() => kendali.permintaan[2].selesai(harian));
  assert.deepEqual(layar.sesi().temaTersedia, []);
  assert.ok(layar.sesi().soal, "soal harian tetap terpilih tanpa tema");
});

test("a theme the new source does not offer no longer empties the puzzle pool", async (tes) => {
  const video = modulTekaTeki.normalisasiBerkas(JSON.parse(baca("../public/data/teka-teki-video.json")), "video");
  // mateIn1 ada di skakmat tetapi tidak di video: dulu membuat sumber video kosong.
  const sesi = pasangHook(tes, { daftar: video, tema: "mateIn1", lompatCepat: false });
  const keadaan = await sesi.mount();
  assert.ok(keadaan.soal, "tema yang tidak ditawarkan sumber tidak mengosongkan kolam");
  assert.notEqual(keadaan.pesan, "kosong");
  assert.ok(!keadaan.temaTersedia.includes("mateIn1"));
  // Tema yang benar-benar ditawarkan tetap menyaring.
  const temas = pasangHook(tes, { daftar: video, tema: "endgame", lompatCepat: false });
  const akhir = await temas.mount();
  assert.ok(akhir.soal.tema.includes("endgame"), "tema valid tetap diterapkan");
  sesi.unmount(); temas.unmount();
});

test("in-screen settings show range + theme + four switches and write through prefs.ubah", (tes) => {
  // Katalog tema kini datang dari sumber aktif; pakai tema skakmat sebenarnya.
  const temaSkakmat = modulTekaTeki.daftarTema(
    modulTekaTeki.normalisasiBerkas(JSON.parse(baca("../public/data/teka-teki.json")), "skakmat"),
  );
  const { renderer, panggilan } = pasangPengaturanLayar(tes, {}, temaSkakmat);
  assert.ok(renderer.root.findByProps({ "data-rentang": true }), "rentang rating tampil");
  const pilih = renderer.root.findByType("select");
  assert.ok(pilih.props["data-opsi"].startsWith("semua,"), "opsi pertama = semua tema");
  act(() => pilih.props.onChange({ target: { value: "fork" } }));
  assert.deepEqual(panggilan.at(-1), ["tema", "fork"]);
  act(() => pilih.props.onChange({ target: { value: "semua" } }));
  assert.deepEqual(panggilan.at(-1), ["tema", ""], "semua tema = string kosong");
  const sakelar = renderer.root.findAllByProps({ role: "switch" });
  assert.deepEqual(sakelar.map((n) => n.props["aria-label"]), ["Progressive", "Hide rating", "Jump to next puzzle", "Track time"]);
  act(() => sakelar[0].props.onClick());
  assert.deepEqual(panggilan.at(-1), ["progresif", true]);
  act(() => sakelar[3].props.onClick());
  assert.deepEqual(panggilan.at(-1), ["catatWaktu", false]);
});

test("progressive mode disables the manual rating range", (tes) => {
  const { renderer } = pasangPengaturanLayar(tes, { progresif: true });
  assert.equal(renderer.root.findByProps({ "data-rentang": true }).props["data-disabled"], true);
});

test("range slider thumbs move by keyboard and clamp at the other thumb", (tes) => {
  const perubahan = [];
  const Rentang = kompilasi("../src/halaman/TekaTeki/komponen/rentangRating.jsx", {}).default;
  let renderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(Rentang, {
      nilaiMin: 1000, nilaiMax: 1500,
      onChangeMin: (n) => perubahan.push(["min", n]), onChangeMax: (n) => perubahan.push(["max", n]),
      labelMin: "Min", labelMax: "Max", labelRentang: "Range",
    }));
  });
  tes.after(() => act(() => renderer.unmount()));
  const min = renderer.root.findByProps({ "data-uji": "rentang-min" });
  const max = renderer.root.findByProps({ "data-uji": "rentang-max" });
  assert.equal(min.props["aria-valuenow"], 1000);
  assert.equal(min.props.role, "slider");
  act(() => min.props.onKeyDown({ key: "ArrowRight", preventDefault() {} }));
  assert.deepEqual(perubahan.at(-1), ["min", 1050]);
  act(() => max.props.onKeyDown({ key: "ArrowLeft", preventDefault() {} }));
  assert.deepEqual(perubahan.at(-1), ["max", 1450]);
  act(() => min.props.onKeyDown({ key: "End", preventDefault() {} }));
  assert.deepEqual(perubahan.at(-1), ["min", 1500], "min dijepit ke max");
  act(() => max.props.onKeyDown({ key: "Home", preventDefault() {} }));
  assert.deepEqual(perubahan.at(-1), ["max", 1000], "max dijepit ke min");
});

test("range slider is inert when disabled", (tes) => {
  const perubahan = [];
  const Rentang = kompilasi("../src/halaman/TekaTeki/komponen/rentangRating.jsx", {}).default;
  let renderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(Rentang, {
      nilaiMin: 1000, nilaiMax: 1500, disabled: true,
      onChangeMin: (n) => perubahan.push(["min", n]), onChangeMax: (n) => perubahan.push(["max", n]),
      labelMin: "Min", labelMax: "Max", labelRentang: "Range",
    }));
  });
  tes.after(() => act(() => renderer.unmount()));
  const min = renderer.root.findByProps({ "data-uji": "rentang-min" });
  act(() => min.props.onKeyDown({ key: "ArrowRight", preventDefault() {} }));
  act(() => min.props.onPointerDown({ preventDefault() {}, currentTarget: {}, pointerId: 1 }));
  assert.equal(perubahan.length, 0, "kenop tidak berubah saat dinonaktifkan");
  assert.equal(min.props.tabIndex, -1);
});

/* --------------------------- Jejak langkah & navigasi --------------------------- */

test("jejak langkah builds positions + SAN from the start to the played index", () => {
  const soal = SOAL_PANJANG;
  const awal = buatJejak(soal, 0);
  assert.equal(awal.length, 1, "posisi awal saja — pemain belum jalan");
  assert.equal(awal[0].fen, soal.fen);
  assert.equal(awal[0].san, null);
  const satu = buatJejak(soal, 1);
  assert.equal(satu.length, 2);
  assert.equal(satu[1].san, "Rd1+", "langkah pertama PEMAIN tercatat");
  assert.equal(satu[1].warna, "b", "pihak pemain = giliran FEN");
  assert.equal(satu[1].nomor, 31);
  const tiga = buatJejak(soal, 3);
  assert.equal(tiga.length, 4);
  assert.equal(tiga[2].san, "Qe1", "balasan lawan di indeks ganjil");
  assert.equal(tiga[2].warna, "w");
  assert.equal(tiga[3].san, "Rxe1#", "langkah penyelesaian skakmat");
  assert.equal(tiga[3].warna, "b");
  assert.notEqual(tiga[2].fen, tiga[3].fen, "tiap entri menyimpan posisi sendiri");
  assert.deepEqual(buatJejak(null, 0), [], "tanpa soal tidak ada jejak");
});

test("move list shows clickable SAN chips and four navigation buttons", (tes) => {
  const Komponen = kompilasi("../src/halaman/TekaTeki/komponen/riwayatLangkah.jsx", {}).default;
  const jejak = buatJejak(SOAL_PANJANG, 3); // [awal, Rd1+, Qe1, Rxe1#]
  const tinjauan = [];
  const nav = [];
  let renderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(Komponen, {
      t: tUji, jejak, tinjau: 3,
      onTinjau: (i) => tinjauan.push(i), onNavigasi: (a) => nav.push(a),
    }));
  });
  tes.after(() => act(() => renderer.unmount()));
  // Struktur list asli: ul > li > button (bukan role=listitem di atas tombol).
  const daftar = renderer.root.findAllByType("ul");
  assert.equal(daftar.length, 1, "daftar langkah memakai elemen ul");
  const butir = renderer.root.findAllByType("li");
  assert.equal(butir.length, 3, "posisi awal bukan butir; tiga langkah dimainkan");
  const keping = butir.map((li) => li.findByType("button"));
  assert.equal(keping.length, 3, "setiap butir memuat tombol");
  for (const tombol of keping) {
    assert.equal(tombol.props.type, "button", "tetap tombol semantik");
    assert.equal(tombol.props.role, undefined, "peran tombol tidak ditimpa");
    assert.notEqual(tombol.props.tabIndex, -1, "langkah bisa dicapai keyboard");
  }
  assert.ok(keping[2].props.children.join("").includes("Rxe1#"));
  assert.equal(keping[2].props["aria-current"], "step", "langkah live ditandai langkah aktif");
  assert.equal(keping[0].props["aria-current"], undefined, "langkah lain tidak ditandai aktif");
  act(() => keping[0].props.onClick());
  assert.equal(tinjauan.at(-1), 1, "klik keping meninjau posisi itu");
  const tombolNav = renderer.root.findAllByType("button").filter((b) => ["To start", "Previous move", "Next move", "To end"].includes(b.props["aria-label"]));
  assert.equal(tombolNav.length, 4, "baris navigasi « ‹ › »");
  // Di langkah terakhir: maju/akhir mati, mundur/awal hidup.
  assert.equal(tombolNav[0].props.disabled, false);
  assert.equal(tombolNav[1].props.disabled, false);
  assert.equal(tombolNav[2].props.disabled, true);
  assert.equal(tombolNav[3].props.disabled, true);
  act(() => tombolNav[0].props.onClick());
  assert.equal(nav.at(-1), "awal");
  act(() => tombolNav[1].props.onClick());
  assert.equal(nav.at(-1), "sebelum");
});

test("empty move list disables every navigation button", (tes) => {
  const Komponen = kompilasi("../src/halaman/TekaTeki/komponen/riwayatLangkah.jsx", {}).default;
  let renderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(Komponen, {
      t: tUji, jejak: buatJejak(DAFTAR_UJI[0], 0), tinjau: 0,
      onTinjau: () => {}, onNavigasi: () => {},
    }));
  });
  tes.after(() => act(() => renderer.unmount()));
  assert.equal(renderer.root.findAllByType("li").length, 0);
  const tombolNav = renderer.root.findAllByType("button").filter((b) => ["To start", "Previous move", "Next move", "To end"].includes(b.props["aria-label"]));
  assert.ok(tombolNav.every((b) => b.props.disabled === true), "tanpa langkah, semua navigasi mati");
});

/* ---------------------- Papan interaktif (adopsi ChessClub) ---------------------- */

test("marks helper toggles square marks by color and arrows by pair", () => {
  let t = tandaBantu.tandaKosong();
  t = tandaBantu.togglePetak(t, "e4", "bawaan");
  assert.equal(t.petak.e4, "bawaan");
  t = tandaBantu.togglePetak(t, "e4", "bawaan");
  assert.equal(t.petak.e4, undefined, "warna sama → hapus mark itu");
  t = tandaBantu.togglePetak(t, "d5", "merah");
  t = tandaBantu.togglePetak(t, "d5", "hijau");
  assert.equal(t.petak.d5, "hijau", "warna beda → ganti warna");
  t = tandaBantu.togglePanah(t, "e2", "e4", "bawaan");
  assert.equal(t.panah.length, 1);
  t = tandaBantu.togglePanah(t, "e2", "e4", "bawaan");
  assert.equal(t.panah.length, 0, "pasangan sama → hapus panah");
});

function pasangPapan(tes, { fen, terkunci = false } = {}) {
  const panggilan = [];
  const ConfigContext = React.createContext(null);
  let papanProps = null;
  const PapanStub = (props) => { papanProps = props; return React.createElement("div", { "data-papan": true }); };
  const DialogStub = (props) => React.createElement("div", { "data-dialog": true, "data-warna": props.warna },
    ...["q", "r", "b", "n"].map((tipe) => React.createElement(
      "button", { "data-pilih": tipe, onClick: () => props.onPilih(tipe) },
    )),
    React.createElement("button", { "data-batal": true, onClick: props.onBatal }));
  const Komponen = kompilasi("../src/halaman/TekaTeki/komponen/papanTekaTeki.jsx", {
    "chess.js": require("chess.js"),
    "../../../modul/sesi/preferensi.js": { ConfigContext },
    "../../Analisa/mesin/engine.js": { formatSquare: (x) => x },
    "./papanInteraktif.jsx": { default: PapanStub },
    "./dialogPromosi.jsx": { default: DialogStub },
    "../logika/tandaBantu.js": tandaBantu,
  }).default;
  const nilai = { boardTheme: [0], pieceSet: ["cburnett"], coordinates: ["edge"] };
  let renderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(ConfigContext.Provider, { value: nilai },
      React.createElement(Komponen, { fen, pihak: "w", ukuran: 320, onLangkah: (l) => panggilan.push(l), petunjuk: null, terkunci })));
  });
  tes.after(() => act(() => renderer.unmount()));
  const pasang = (fenBaru, kunciBaru = terkunci) => React.createElement(
    ConfigContext.Provider, { value: nilai },
    React.createElement(Komponen, {
      fen: fenBaru, pihak: "w", ukuran: 320, onLangkah: (l) => panggilan.push(l),
      petunjuk: null, terkunci: kunciBaru,
    }),
  );
  return {
    renderer,
    panggilan,
    props: () => papanProps,
    // Soal berganti / solusi diputar / riwayat ditinjau: FEN papan berubah.
    gantiFen(fenBaru, kunciBaru) { act(() => renderer.update(pasang(fenBaru, kunciBaru))); },
    adaDialog() { return renderer.root.findAllByProps({ "data-dialog": true }).length > 0; },
  };
}

test("a shipped mate-in-one opens playable, not already checkmated (regression: wrong player side)", (tes) => {
  // Soal nyata "Mate in One": bila langkah[0] dimainkan otomatis sebagai
  // "pembuka lawan", papan langsung skakmat dan tidak ada bidak bisa bergerak.
  const soal = modulTekaTeki.normalisasiSoal({
    problemid: 6, fen: "3r1k2/p5pp/2p2p2/P7/2R5/8/1P3PPP/6K1 b - - 0 32",
    moves: "d8-d1", rating: 1200, type: "Mate in One",
  }, "skakmat");
  const sesi = pasangHook(tes, { daftar: [soal], lompatCepat: false });
  return sesi.mount().then(async (keadaan) => {
    assert.equal(keadaan.soal.pihak, "b", "pemain = pihak yang harus skakmat");
    assert.equal(keadaan.indeks, 0);
    const papan = new Chess(keadaan.fen);
    assert.equal(papan.isCheckmate(), false, "papan tidak boleh sudah skakmat saat soal dibuka");
    assert.ok(papan.moves().length > 0, "ada langkah legal yang bisa dimainkan");
    // Papan menampilkan titik langkah sah untuk bidak pemain.
    const { props } = pasangPapan(tes, { fen: keadaan.fen });
    act(() => props().onKlik("d8"));
    assert.equal(props().terpilih, "d8");
    assert.ok(props().sasaran.includes("d1"), "klik benteng menunjukkan titik langkah sah");
    // Langkah solusi diterima dan menuntaskan soal.
    const akhir = await sesi.jalankan((s) => s.mainkan({ from: "d8", to: "d1" }));
    assert.equal(akhir.riwayat[0].status, "benar");
    assert.equal(akhir.belumSelesai, false);
    assert.ok(new Chess(akhir.fen).isCheckmate(), "pemain yang memberikan skakmat");
    sesi.unmount();
  });
});

test("puzzle board: click a piece shows legal targets, click a target plays the move", (tes) => {
  const { panggilan, props } = pasangPapan(tes, { fen: new Chess().fen() });
  act(() => props().onKlik("e2"));
  assert.equal(props().terpilih, "e2");
  assert.ok(props().sasaran.includes("e4"), "titik langkah sah tampil");
  act(() => props().onKlik("e4"));
  assert.deepEqual(panggilan.at(-1), { from: "e2", to: "e4" });
});

test("puzzle board: re-clicking the selected piece deselects it", (tes) => {
  const { props } = pasangPapan(tes, { fen: new Chess().fen() });
  act(() => props().onKlik("e2"));
  assert.equal(props().terpilih, "e2");
  act(() => props().onKlik("e2"));
  assert.equal(props().terpilih, null);
});

test("puzzle board: drag release plays the move; re-drop on origin deselects without moving", (tes) => {
  const { panggilan, props } = pasangPapan(tes, { fen: new Chess().fen() });
  act(() => props().onMulaiSeret("e2"));
  assert.equal(props().terpilih, "e2");
  act(() => props().onSelesaiSeret("e2", "e4", false));
  assert.deepEqual(panggilan.at(-1), { from: "e2", to: "e4" });
  const sebelum = panggilan.length;
  act(() => props().onSelesaiSeret("e2", "e2", true));
  assert.equal(panggilan.length, sebelum, "klik ulang tidak memainkan langkah");
  assert.equal(props().terpilih, null);
});

test("puzzle board: pawn to last rank opens promotion dialog and plays the chosen piece", (tes) => {
  const { renderer, panggilan, props } = pasangPapan(tes, { fen: "7k/P7/8/8/8/8/8/7K w - - 0 1" });
  act(() => props().onSelesaiSeret("a7", "a8", false));
  const dialog = renderer.root.findByProps({ "data-dialog": true });
  assert.equal(dialog.props["data-warna"], "w");
  assert.equal(panggilan.length, 0, "belum main sampai bidak promosi dipilih");
  act(() => dialog.findByProps({ "data-pilih": "q" }).props.onClick());
  assert.deepEqual(panggilan.at(-1), { from: "a7", to: "a8", promotion: "q" });
});

test("puzzle board: a new position closes a pending promotion dialog instead of carrying it over", (tes) => {
  const FEN_PROMOSI = "7k/P7/8/8/8/8/8/7K w - - 0 1";
  const papan = pasangPapan(tes, { fen: FEN_PROMOSI });
  act(() => papan.props().onSelesaiSeret("a7", "a8", false));
  assert.ok(papan.adaDialog(), "dialog promosi terbuka");
  assert.equal(papan.panggilan.length, 0);

  // Soal baru terbuka saat dialog masih menggantung.
  papan.gantiFen(FEN_MAT);
  assert.equal(papan.adaDialog(), false, "dialog soal lama tidak boleh muncul di soal baru");
  assert.equal(papan.props().terpilih, null, "pilihan lama dibersihkan");
  assert.equal(papan.panggilan.length, 0, "tidak ada langkah yang terkirim ke soal baru");

  // Dialog yang sudah ditutup tidak bisa lagi mengirim langkah promosi basi.
  const lama = papan.renderer.root.findAllByProps({ "data-pilih": "q" });
  assert.equal(lama.length, 0, "tombol promosi soal lama tidak ada lagi");

  // Papan baru tetap bisa dimainkan normal.
  act(() => papan.props().onKlik("e1"));
  assert.equal(papan.props().terpilih, "e1");
  act(() => papan.props().onSelesaiSeret("e1", "e8", false));
  assert.deepEqual(papan.panggilan.at(-1), { from: "e1", to: "e8" });

  // Papan terkunci tanpa ganti FEN (mis. "lihat solusi" pada posisi awal):
  // dialog tidak boleh menggantung di atas papan yang tidak menerima langkah.
  const kunci = pasangPapan(tes, { fen: FEN_PROMOSI });
  act(() => kunci.props().onSelesaiSeret("a7", "a8", false));
  assert.ok(kunci.adaDialog());
  kunci.gantiFen(FEN_PROMOSI, true);
  assert.equal(kunci.adaDialog(), false, "dialog ditutup saat papan terkunci");
  assert.equal(kunci.panggilan.length, 0);
});

test("puzzle board: promotion still offers every piece and cancelling leaves the board usable", (tes) => {
  const FEN_PROMOSI = "7k/P7/8/8/8/8/8/7K w - - 0 1";
  for (const tipe of ["q", "r", "b", "n"]) {
    const papan = pasangPapan(tes, { fen: FEN_PROMOSI });
    act(() => papan.props().onSelesaiSeret("a7", "a8", false));
    assert.ok(papan.adaDialog(), `dialog terbuka untuk pilihan ${tipe}`);
    const dialog = papan.renderer.root.findByProps({ "data-dialog": true });
    act(() => dialog.findByProps({ "data-pilih": tipe }).props.onClick());
    assert.deepEqual(papan.panggilan.at(-1), { from: "a7", to: "a8", promotion: tipe });
    assert.equal(papan.adaDialog(), false, "dialog tertutup setelah bidak dipilih");
  }

  // Batal: tidak ada langkah terkirim, dialog tertutup, papan tetap bisa dipakai.
  const batal = pasangPapan(tes, { fen: FEN_PROMOSI });
  act(() => batal.props().onSelesaiSeret("a7", "a8", false));
  const dialog = batal.renderer.root.findByProps({ "data-dialog": true });
  act(() => dialog.findByProps({ "data-batal": true }).props.onClick());
  assert.equal(batal.adaDialog(), false);
  assert.equal(batal.panggilan.length, 0, "batal tidak mengirim langkah");
  assert.equal(batal.props().terpilih, null);
  act(() => batal.props().onSelesaiSeret("a7", "a8", false));
  assert.ok(batal.adaDialog(), "promosi bisa diminta lagi setelah batal");
});

test("puzzle board: a locked board ignores clicks and drags", (tes) => {
  const { panggilan, props } = pasangPapan(tes, { fen: new Chess().fen(), terkunci: true });
  act(() => props().onKlik("e2"));
  assert.equal(props().terpilih, null);
  act(() => props().onSelesaiSeret("e2", "e4", false));
  assert.equal(panggilan.length, 0);
});

/* ------------------------------ Pemasangan & i18n ------------------------------ */

test("puzzle enters only via the Papan card; its settings live in-screen, not in nav or general settings", () => {
  const konteks = baca("../src/modul/sesi/analyzeKonteks.js");
  assert.ok(konteks.includes('TEKA_TEKI: "teka-teki"'), "konstanta layar tetap ada");
  // Tidak ada item teka-teki di bilah nav kiri.
  const nav = baca("../src/halaman/Analisa/komponen/nav/nav.jsx");
  assert.ok(!nav.includes("TAMPILAN_ANALISA.TEKA_TEKI"), "nav tidak memuat item teka-teki");
  assert.ok(!nav.includes("nav.tekaTeki"), "nav tidak memakai label teka-teki");
  // Pintu masuk: kartu beranda Papan yang hidup (bukan "segera hadir").
  const area = baca("../src/halaman/Analisa/komponen/areaKerja.jsx");
  assert.ok(area.includes('import("../../TekaTeki/TekaTeki.jsx")'), "layar dimuat malas");
  assert.ok(area.includes("layar === TAMPILAN_ANALISA.TEKA_TEKI"));
  assert.ok(area.includes("onAnalisa="), "jalur analisa posisi diteruskan");
  assert.ok(area.includes("onTekaTeki="), "beranda Papan meneruskan pembuka layar teka-teki");
  const papan = baca("../src/halaman/Analisa/komponen/nav/layarPapan.jsx");
  const kartuPuzzle = papan.slice(papan.indexOf('kunci: "puzzle"'), papan.indexOf('kunci: "deteksi-engine"'));
  assert.ok(kartuPuzzle.includes("onClick: onTekaTeki"), "kartu puzzle memakai onClick");
  assert.ok(!kartuPuzzle.includes("segera: true"), "kartu puzzle tidak lagi ditandai segera hadir");
  // Katalog & layar Pengaturan umum TIDAK memuat teka-teki (pengaturan personal fitur).
  const katalog = baca("../src/halaman/Analisa/komponen/pengaturan/katalogPengaturan.js");
  assert.ok(!katalog.includes('id: "teka-teki"'), "katalog tanpa tab teka-teki");
  assert.ok(!katalog.includes('id: "tekaTeki"'), "katalog tanpa grup tekaTeki");
  assert.ok(!katalog.includes("puzzleRentangRating"), "katalog tanpa baris puzzle");
  const layar = baca("../src/halaman/Analisa/komponen/nav/layarPengaturan.jsx");
  assert.ok(!layar.includes("TekaTekiPengaturan"), "layar Pengaturan umum tanpa renderer teka-teki");
  // Preferensi TIDAK di config bersama; ia milik fitur.
  const provider = baca("../src/modul/sesi/ConfigContextProvider.jsx");
  for (const kunci of ["puzzleRatingMin", "puzzleRatingMax", "puzzleTema", "puzzleProgresif", "puzzleSembunyiRating", "puzzleLompatCepat", "puzzleCatatWaktu"]) {
    assert.ok(!provider.includes(kunci), `${kunci} tidak lagi di config bersama`);
  }
  // Pengaturan latihan hidup di dalam layar: tombol gigi + panel buka/tutup.
  const panel = baca("../src/halaman/TekaTeki/komponen/panelTekaTeki.jsx");
  assert.ok(panel.includes("onTogglePengaturan"), "panel punya tombol gigi buka/tutup");
  assert.ok(panel.includes("<PengaturanTekaTeki"), "panel merender pengaturan di tempat");
  const entri = baca("../src/halaman/TekaTeki/TekaTeki.jsx");
  assert.ok(entri.includes("usePreferensiTekaTeki"), "layar memakai preferensi milik fitur");
  assert.ok(!entri.includes("ConfigContext"), "layar tidak membaca config umum untuk preferensinya");
});

test("the feature keeps its own shelf: entry, components, logic, and a README", () => {
  for (const berkas of [
    "../src/halaman/TekaTeki/TekaTeki.jsx",
    "../src/halaman/TekaTeki/README.md",
    "../src/halaman/TekaTeki/komponen/papanTekaTeki.jsx",
    "../src/halaman/TekaTeki/komponen/panelTekaTeki.jsx",
    "../src/halaman/TekaTeki/komponen/pengaturanTekaTeki.jsx",
    "../src/halaman/TekaTeki/komponen/rentangRating.jsx",
    "../src/halaman/TekaTeki/komponen/sakelarRingkas.jsx",
    "../src/halaman/TekaTeki/komponen/riwayatLangkah.jsx",
    "../src/halaman/TekaTeki/komponen/papanInteraktif.jsx",
    "../src/halaman/TekaTeki/komponen/dialogPromosi.jsx",
    "../src/halaman/TekaTeki/logika/useSesiTekaTeki.js",
    "../src/halaman/TekaTeki/logika/usePreferensiTekaTeki.js",
    "../src/halaman/TekaTeki/logika/jejakLangkah.js",
    "../src/halaman/TekaTeki/logika/tandaBantu.js",
    "../src/halaman/TekaTeki/logika/pgnDariSoal.js",
  ]) assert.ok(baca(berkas).length > 0, berkas);
  // Papan teka-teki kini papan interaktif sendiri (diadopsi dari ChessClub):
  // pembungkus memiliki terpilih/sasaran/promosi dan meneruskan drag/klik ke sesi.
  const papan = baca("../src/halaman/TekaTeki/komponen/papanTekaTeki.jsx");
  assert.ok(papan.includes('import PapanInteraktif from "./papanInteraktif.jsx"'), "pembungkus memakai papan interaktif");
  assert.ok(papan.includes("ConfigContext"), "tema/set bidak/koordinat dibaca dari pengaturan umum");
  assert.ok(papan.includes("onSelesaiSeret") && papan.includes("cobaLangkah"), "seret/klik diteruskan ke sesi");
  // Perilaku drag/klik ChessClub: bidak hantu, pointer capture, slop, select-none,
  // preventDefault non-sentuh, klik-kanan batal seret. Aset Maestro dipakai ulang.
  const interaktif = baca("../src/halaman/TekaTeki/komponen/papanInteraktif.jsx");
  assert.ok(interaktif.includes("select-none"), "papan non-seleksi teks");
  assert.ok(interaktif.includes('e.pointerType !== "touch"') && interaktif.includes("e.preventDefault()"), "preventDefault seret non-sentuh");
  assert.ok(interaktif.includes("setPointerCapture"), "pointer capture pada akar papan");
  assert.ok(interaktif.includes("jarak > 5"), "slop 5px membedakan klik dari seret");
  assert.ok(interaktif.includes("batalkanSeretInternal"), "klik kanan membatalkan seret");
  assert.ok(interaktif.includes('import PieceSVG from "../../Analisa/komponen/svg/piece.jsx"'), "bidak memakai ulang PieceSVG Maestro");
  assert.ok(interaktif.includes("../animasiBidak.js"), "luncuran memakai ulang animasiBidak Maestro");
  // Aturan main tetap di modul bersama, bukan ditulis ulang di hook.
  const hook = baca("../src/halaman/TekaTeki/logika/useSesiTekaTeki.js");
  assert.ok(hook.includes('../../../modul/tekaTeki/index.js'));
  assert.ok(!hook.includes('from "chess.js"'), "hook tidak memanggil chess.js langsung");
  // Preferensi fitur memakai fasad penyimpanan sesi, bukan config bersama.
  const prefs = baca("../src/halaman/TekaTeki/logika/usePreferensiTekaTeki.js");
  assert.ok(prefs.includes('../../../modul/sesi/preferensi.js'), "preferensi lewat fasad sesi");
  assert.ok(!prefs.includes("ConfigContext"), "preferensi tidak memakai config bersama");
  // Renderer grup lama di folder pengaturan Analisa sudah dihapus.
  assert.throws(() => baca("../src/halaman/Analisa/komponen/pengaturan/tekaTeki.jsx"), "renderer grup lama tidak ada lagi");
  // Keping riwayat sesi lama diganti daftar langkah + navigasi (mockup En Croissant).
  assert.throws(() => baca("../src/halaman/TekaTeki/komponen/riwayatSesi.jsx"), "panel riwayat sesi lama tidak ada lagi");
  const entriLayar = baca("../src/halaman/TekaTeki/TekaTeki.jsx");
  assert.ok(entriLayar.includes("<RiwayatLangkah"), "layar merender daftar langkah + navigasi");
  assert.ok(entriLayar.includes("buatJejak"), "layar membangun jejak langkah untuk ditinjau");
});

test("Indonesian and English puzzle dictionaries expose the same keys", () => {
  const kunci = (objek, prefix = "") => Object.entries(objek).flatMap(([nama, nilai]) => (
    nilai && typeof nilai === "object" ? kunci(nilai, `${prefix}${nama}.`) : [`${prefix}${nama}`]
  ));
  assert.deepEqual(kunci(kamusId).sort(), kunci(kamusEn).sort());
  assert.ok(kunci(kamusId).length >= 40, "kamus mencakup panel, status, pesan, riwayat, pengaturan");
});

/* ==========================================================================
 * Animasi perpindahan bidak — integrasi sesi × papan interaktif.
 *
 * Yang diuji di sini adalah RANGKAIAN penerbitan FEN (hook) bersama efek
 * luncuran papan (papanInteraktif), bukan utilitas diff-FEN saja: papan nyata
 * dipasang di dalam layar nyata, dan `animate()` direkam lewat DOM palsu.
 *
 * BATAS VERIFIKASI: DOM palsu hanya menyediakan yang dipakai efek animasi
 * (getBoundingClientRect, querySelector, animate). Tidak ada peramban di sini —
 * kelancaran visual/kedip nyata tidak diukur; yang dibuktikan adalah jumlah,
 * urutan, asal-tujuan, durasi, dan pembatalan pemanggilan animasi.
 * ========================================================================== */
const KOTAK_PALSU = 40; // papan 320 px → 8 × 40 px

const FILE_UJI = ["a", "b", "c", "d", "e", "f", "g", "h"];
function geometriPalsu(sq, orientasi) {
  const lajur = FILE_UJI.indexOf(sq[0]);
  const baris = Number(sq[1]);
  const kolom = orientasi === "w" ? lajur : 7 - lajur;
  const barisTampil = orientasi === "w" ? 8 - baris : baris - 1;
  return { left: kolom * KOTAK_PALSU, top: barisTampil * KOTAK_PALSU, width: KOTAK_PALSU, height: KOTAK_PALSU };
}

// DOM palsu dengan simpul STABIL per petak: `createNodeMock` react-test-renderer
// membuat mock baru setiap kali `.instance` dibaca, jadi identitas simpul harus
// dipegang sendiri supaya peta animasi papan (el → gerak) berperilaku seperti DOM.
function domAnimasi({ bacaFen, bacaOrientasi, log, aktif, puncak }) {
  const petakNode = new Map();
  const bidakNode = new Map();
  const anak = new Map();

  const nodeBidak = (sq) => {
    if (bidakNode.has(sq)) return bidakNode.get(sq);
    const node = {
      style: {},
      animate(kunci, opsi) {
        const [, dx, dy] = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(kunci[0].transform) ?? [];
        const kode = animasiBidak.petaBidak(bacaFen())[sq] ?? "";
        const rekaman = { petak: sq, kode, dx: Number(dx), dy: Number(dy), durasi: opsi.duration, easing: opsi.easing };
        log.push({ jenis: "mulai", ...rekaman });
        let selesai;
        const finished = new Promise((r) => { selesai = r; });
        const gerak = {
          finished,
          oncancel: null,
          cancel() {
            if (!aktif.has(gerak)) return;
            aktif.delete(gerak);
            log.push({ jenis: "batal", ...rekaman });
            gerak.oncancel?.();
            selesai();
          },
        };
        gerak.selesaikan = () => {
          if (!aktif.has(gerak)) return;
          aktif.delete(gerak);
          log.push({ jenis: "selesai", ...rekaman });
          selesai();
        };
        aktif.add(gerak);
        puncak.nilai = Math.max(puncak.nilai, aktif.size);
        return gerak;
      },
    };
    bidakNode.set(sq, node);
    return node;
  };

  const nodePetak = (sq) => {
    if (petakNode.has(sq)) return petakNode.get(sq);
    const node = {
      style: {},
      getBoundingClientRect: () => geometriPalsu(sq, bacaOrientasi()),
      querySelector(pilih) {
        if (pilih !== "[data-bidak]") return null;
        // Hanya ada bidak bila FEN yang SEDANG tampil memang menaruhnya di situ.
        return animasiBidak.petaBidak(bacaFen())[sq] ? nodeBidak(sq) : null;
      },
      querySelectorAll: () => [],
      appendChild(el) {
        if (!anak.has(sq)) anak.set(sq, []);
        anak.get(sq).push(el);
        el.remove = () => node.removeChild(el);
        return el;
      },
      removeChild(el) { anak.set(sq, (anak.get(sq) ?? []).filter((x) => x !== el)); return el; },
    };
    petakNode.set(sq, node);
    return node;
  };

  const akarNode = {
    style: {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: KOTAK_PALSU * 8, height: KOTAK_PALSU * 8 }),
    querySelector(pilih) {
      const sq = /\[data-petak="([a-h][1-8])"\]/.exec(pilih)?.[1];
      return sq ? nodePetak(sq) : null;
    },
    querySelectorAll: () => [],
    setPointerCapture() {}, releasePointerCapture() {},
  };

  const dokumen = {
    addEventListener() {}, removeEventListener() {},
    elementFromPoint: () => null,
    createElement() {
      const el = { style: {}, setAttribute() {}, appendChild() {}, remove() {} };
      return el;
    },
  };
  return { dokumen, akarNode, nodePetak, anakGhost: anak };
}

// Layar nyata + papan nyata; hanya panel/riwayat/i18n/prefs yang dipalsukan.
function pasangLayarAnimasi(tes, { daftar = [SOAL_PANJANG], prefs = {}, muat, jam } = {}) {
  const log = [];
  const aktif = new Set();
  const puncak = { nilai: 0 };
  let papanProps = null;
  let panelProps = null;
  let riwayatProps = null;
  let renderer = null;
  const bacaFen = () => papanProps?.fen ?? "";
  const bacaOrientasi = () => papanProps?.orientasi ?? "w";
  const dom = domAnimasi({ bacaFen, bacaOrientasi, log, aktif, puncak });
  const dokumenAsli = globalThis.document;
  globalThis.document = dom.dokumen;

  const ConfigContext = React.createContext(null);
  const PapanAsli = kompilasi("../src/halaman/TekaTeki/komponen/papanInteraktif.jsx", {
    "../../Analisa/komponen/svg/piece.jsx": { default: () => React.createElement("span") },
    "../../Analisa/komponen/pengaturan/setBidak.js": { urlBidak: (set, kode) => `/bidak/${set}/${kode}.svg` },
    "../../../modul/sesi/preferensi.js": { boardThemes: [{ white: "#ebecd0", black: "#779556" }] },
    "../animasiBidak.js": animasiBidak,
    "../../../lib/i18n.jsx": { useI18n: () => ({ t: (k) => k }) },
  }).default;
  const PapanSpy = (props) => { papanProps = props; return React.createElement(PapanAsli, props); };
  const DialogStub = (props) => React.createElement("div", { "data-dialog": true, "data-warna": props.warna },
    ...["q", "r", "b", "n"].map((tipe) => React.createElement("button", { "data-pilih": tipe, onClick: () => props.onPilih(tipe) })));
  const PapanTekaTekiAsli = kompilasi("../src/halaman/TekaTeki/komponen/papanTekaTeki.jsx", {
    "chess.js": require("chess.js"),
    "../../../modul/sesi/preferensi.js": { ConfigContext },
    "../../Analisa/mesin/engine.js": { formatSquare: (x) => x },
    "./papanInteraktif.jsx": { default: PapanSpy },
    "./dialogPromosi.jsx": { default: DialogStub },
    "../logika/tandaBantu.js": tandaBantu,
  }).default;
  // Pembungkus asli dipakai apa adanya; `onLangkah` hanya dibungkus untuk
  // menangkap janji rangkaian balasan (klik papan tidak mengembalikannya).
  const PapanWrapperSpy = (props) => React.createElement(PapanTekaTekiAsli, {
    ...props,
    onLangkah: (l) => { janjiMain = props.onLangkah(l); return janjiMain; },
  });
  const hook = kompilasi("../src/halaman/TekaTeki/logika/useSesiTekaTeki.js", {
    "../../../modul/tekaTeki/index.js": { ...modulTekaTeki, muatSoal: muat ?? (async () => daftar) },
    "../animasiBidak.js": animasiBidak,
  }).default;
  const Komponen = kompilasi("../src/halaman/TekaTeki/TekaTeki.jsx", {
    "../../lib/i18n.jsx": { useI18n: () => ({ t: (k) => k }) },
    "../Analisa/komponen/nav/PanelLayar.jsx": { default: (p) => React.createElement("div", null, p.children) },
    "./logika/useSesiTekaTeki.js": { default: hook },
    "./logika/usePreferensiTekaTeki.js": {
      default: () => ({
        ratingMin: 600, ratingMax: 1500, tema: "", progresif: false,
        sembunyiRating: false, lompatCepat: false, catatWaktu: false, ubah() {}, ...prefs,
      }),
    },
    "./logika/useUkuranPapan.js": { default: () => KOTAK_PALSU * 8 },
    "./logika/pgnDariSoal.js": { default: () => "" },
    "./logika/jejakLangkah.js": { default: buatJejak },
    "./komponen/papanTekaTeki.jsx": { default: PapanWrapperSpy },
    "./komponen/panelTekaTeki.jsx": { default: (p) => { panelProps = p; return React.createElement("div"); } },
    "./komponen/riwayatLangkah.jsx": { default: (p) => { riwayatProps = p; return React.createElement("div"); } },
  }).default;

  const nilaiConfig = { boardTheme: [0], pieceSet: ["cburnett"], coordinates: ["edge"] };
  const pohon = () => React.createElement(ConfigContext.Provider, { value: nilaiConfig }, React.createElement(Komponen));
  let janjiMain = null;
  const pulihkan = () => {
    if (dokumenAsli === undefined) delete globalThis.document;
    else globalThis.document = dokumenAsli;
  };
  tes.after(() => { if (renderer) act(() => renderer.unmount()); pulihkan(); });

  return {
    log,
    dom,
    async mount() {
      await act(async () => { renderer = TestRenderer.create(pohon(), { createNodeMock: (el) => {
        if (el.props?.["data-petak"]) return dom.nodePetak(el.props["data-petak"]);
        if (String(el.props?.className ?? "").includes("aspect-square")) return dom.akarNode;
        return { style: {}, focus() {}, querySelectorAll: () => [] };
      } }); });
      return this;
    },
    papan: () => papanProps,
    sesi: () => panelProps?.sesi,
    riwayat: () => riwayatProps,
    mulai: () => log.filter((x) => x.jenis === "mulai"),
    aktif: () => aktif.size,
    puncakAktif: () => puncak.nilai,
    ghost: (sq) => (dom.anakGhost.get(sq) ?? []).length,
    // Langkah pemain TIDAK ditunggu sampai rangkaian selesai: justru urutan
    // penerbitannya yang diuji. Janjinya disimpan untuk ditutup di akhir uji.
    async main(langkah) {
      // Jalur nyata: klik bidak lalu klik petak tujuan pada papan.
      await act(async () => { papanProps.onKlik(langkah.from); });
      await act(async () => { papanProps.onKlik(langkah.to); });
      return this;
    },
    async klik(sq) { await act(async () => { papanProps.onKlik(sq); }); return this; },
    async pilihPromosi(tipe) {
      await act(async () => {
        renderer.root.findByProps({ "data-pilih": tipe }).props.onClick();
      });
      return this;
    },
    async tick(ms) { await act(async () => { jam.tick(ms); }); return this; },
    // Tandai luncuran yang sedang jalan sebagai selesai (pengganti selesainya
    // animasi peramban), supaya urutan "pemain selesai → balasan mulai" terbukti.
    async selesaiAnimasi() {
      await act(async () => { for (const g of [...aktif]) g.selesaikan(); });
      return this;
    },
    async rangkaianSelesai() {
      // Seperti peramban: luncuran yang sedang jalan selesai dulu, baru jeda
      // rangkaian habis dan tahap berikutnya diterbitkan. Dua putaran menutup
      // jalur lompat-cepat yang menunggu luncuran balasan sebelum ganti soal.
      for (let i = 0; i < 2; i++) {
        await this.selesaiAnimasi();
        await this.tick(animasiBidak.GESER_ISEPIC.durasi);
      }
      await this.selesaiAnimasi();
      await act(async () => { await janjiMain; });
      janjiMain = null;
      return this;
    },
    async navigasi(arah) { await act(async () => { riwayatProps.onNavigasi(arah); }); return this; },
    // Pemutaran solusi memakai jeda 450 ms per langkah; tiap langkah harus
    // menerbitkan FEN sendiri supaya tidak ada luncuran dua warna sekaligus.
    async solusi() {
      let janji;
      await act(async () => { janji = this.sesi().lihatSolusi(); });
      for (let i = 0; i < 6; i++) { await this.selesaiAnimasi(); await this.tick(450); }
      await act(async () => { await janji; });
      return this;
    },
    async jalankan(fn) { await act(async () => { await fn({ sesi: this.sesi(), papan: papanProps, panel: panelProps, riwayat: riwayatProps }); }); return this; },
    async tutup() { await act(async () => { if (janjiMain) await janjiMain; janjiMain = null; }); return this; },
    unmount() { act(() => renderer.unmount()); renderer = null; pulihkan(); },
  };
}

// FEN khusus rangkaian animasi (semua langkahnya sudah dicek legal chess.js).
const SOAL_EP = modulTekaTeki.normalisasiSoal({
  problemid: 91, fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2", moves: "e5-d6;e8-f7;d6-d7", rating: 1100, tema: "enPassant",
}, "skakmat");
const SOAL_ROKADE = modulTekaTeki.normalisasiSoal({
  problemid: 92, fen: "4k3/8/8/8/8/8/8/4K2R w K - 0 1", moves: "e1-g1;e8-d8;f1-f8", rating: 1100, tema: "castling",
}, "skakmat");
const SOAL_PROMOSI = modulTekaTeki.normalisasiSoal({
  problemid: 93, fen: "7k/P7/8/8/8/8/8/7K w - - 0 1", moves: "a7-a8q;h8-h7;a8-a7", rating: 1100, tema: "promotion",
}, "skakmat");

test("animasi 1: langkah tanpa balasan meluncurkan satu bidak lalu berhenti", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["setTimeout"], now: 1_000_000 });
  const layar = await pasangLayarAnimasi(tes, { daftar: [DAFTAR_UJI[0]], jam }).mount();
  assert.equal(layar.papan().fen, FEN_MAT);
  assert.deepEqual(layar.mulai(), [], "belum ada langkah → belum ada luncuran");

  await layar.main({ from: "e1", to: "e8" });
  const luncuran = layar.mulai();
  assert.equal(luncuran.length, 1, "tepat satu bidak meluncur");
  assert.equal(luncuran[0].petak, "e8");
  assert.equal(luncuran[0].kode, "R");
  // Asal e1 → tujuan e8 pada orientasi putih: lurus ke atas 7 baris.
  assert.equal(luncuran[0].dx, 0);
  assert.equal(luncuran[0].dy, 7 * KOTAK_PALSU);
  assert.equal(luncuran[0].durasi, animasiBidak.GESER_ISEPIC.durasi, "durasi tetap 300 ms");
  assert.equal(luncuran[0].easing, animasiBidak.GESER_ISEPIC.kurva, "kurva tetap ease");

  await layar.selesaiAnimasi();
  await layar.tick(1000);
  await layar.tutup();
  assert.equal(layar.mulai().length, 1, "tidak ada luncuran tambahan tanpa balasan");
  assert.equal(layar.aktif(), 0, "tidak ada animasi tertinggal");
  assert.equal(layar.sesi().fen, modulTekaTeki.terapkanLangkah(FEN_MAT, { from: "e1", to: "e8" }));
  assert.equal(layar.sesi().status, modulTekaTeki.STATUS_SOAL.BENAR);
});

test("animasi 2: balasan lawan meluncur terpisah setelah luncuran pemain selesai", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["setTimeout"], now: 1_000_000 });
  const layar = await pasangLayarAnimasi(tes, { jam }).mount();
  const awal = layar.sesi().soal.fen;
  const pemain = { from: "d8", to: "d1" };
  const balasan = { from: "c3", to: "e1" };
  const fenPemain = modulTekaTeki.terapkanLangkah(awal, pemain);
  const fenAkhir = modulTekaTeki.terapkanLangkah(fenPemain, balasan);

  await layar.main(pemain);
  // Tahap 1: HANYA bidak pemain yang meluncur, FEN balasan belum diterapkan.
  assert.equal(layar.mulai().length, 1, "satu luncuran, bukan gabungan pemain+balasan");
  assert.equal(layar.mulai()[0].petak, "d1");
  assert.equal(layar.mulai()[0].kode, "r", "benteng hitam milik pemain");
  assert.equal(layar.papan().fen, fenPemain, "FEN tahap 1 = langkah pemain saja");
  assert.equal(layar.sesi().indeks, 1);
  assert.equal(layar.sesi().balasanBerjalan, true);
  assert.equal(layar.papan().terkunci, true, "papan dikunci selama rangkaian berlangsung");
  assert.deepEqual(layar.papan().langkahAkhir, pemain, "sorotan mengikuti langkah yang sedang meluncur");

  // Belum 300 ms → balasan belum boleh menyusul (jeda terikat durasi luncuran).
  await layar.tick(animasiBidak.GESER_ISEPIC.durasi - 1);
  assert.equal(layar.mulai().length, 1, "balasan tidak menyusul sebelum luncuran pemain selesai");
  await layar.selesaiAnimasi();
  await layar.tick(1);

  // Tahap 2: balasan lawan sebagai luncuran KEDUA.
  assert.equal(layar.mulai().length, 2, "balasan punya luncurannya sendiri");
  assert.equal(layar.mulai()[1].petak, "e1");
  assert.equal(layar.mulai()[1].kode, "Q", "menteri putih milik lawan");
  assert.equal(layar.mulai()[1].durasi, animasiBidak.GESER_ISEPIC.durasi);
  assert.equal(layar.mulai()[1].easing, animasiBidak.GESER_ISEPIC.kurva);
  assert.deepEqual(layar.log.map((x) => `${x.jenis}:${x.petak}`), ["mulai:d1", "selesai:d1", "mulai:e1"],
    "urutan wajib: pemain mulai → pemain selesai → balasan mulai");
  assert.equal(layar.puncakAktif(), 1, "tidak pernah dua bidak meluncur bersamaan");

  await layar.selesaiAnimasi();
  await layar.tutup();
  assert.equal(layar.papan().fen, fenAkhir, "posisi akhir sama persis dengan hasil aturan catur");
  assert.equal(layar.sesi().fen, fenAkhir);
  assert.equal(layar.sesi().indeks, 2);
  assert.deepEqual(layar.sesi().langkahNyata, [
    { from: "d8", to: "d1", promotion: undefined }, { from: "c3", to: "e1" },
  ], "jejak langkah tetap lengkap dan berurutan");
  assert.deepEqual(layar.papan().langkahAkhir, balasan, "sorotan langkah terakhir = balasan");
  assert.equal(layar.sesi().balasanBerjalan, false);
  assert.equal(layar.papan().terkunci, false, "papan terbuka lagi setelah rangkaian selesai");
  assert.equal(layar.aktif(), 0, "tidak ada animasi tertinggal");
});

test("animasi 3: langkah salah tidak menggerakkan bidak sama sekali", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["setTimeout"], now: 1_000_000 });
  const layar = await pasangLayarAnimasi(tes, { jam }).mount();
  const awal = layar.sesi().soal.fen;
  await layar.main({ from: "g6", to: "g5" }); // legal, tetapi bukan langkah solusi
  await layar.tick(1000);
  await layar.tutup();
  assert.deepEqual(layar.mulai(), [], "tidak ada luncuran untuk langkah salah");
  assert.equal(layar.papan().fen, awal, "posisi tidak berubah");
  assert.equal(layar.sesi().indeks, 0);
  assert.equal(layar.sesi().status, modulTekaTeki.STATUS_SOAL.SALAH);
  assert.equal(layar.sesi().balasanBerjalan, false);
  assert.equal(layar.aktif(), 0);
});

test("animasi 4: langkah menangkap meluncurkan satu bidak dan hantu bidak tertangkap dibersihkan", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["setTimeout"], now: 1_000_000 });
  const layar = await pasangLayarAnimasi(tes, { jam }).mount();
  await layar.main({ from: "d8", to: "d1" });
  await layar.rangkaianSelesai();
  const sebelum = layar.mulai().length;
  const fenSebelum = layar.papan().fen;
  assert.equal(animasiBidak.petaBidak(fenSebelum).e1, "Q", "menteri putih masih di e1 sebelum ditangkap");

  await layar.main({ from: "d1", to: "e1" }); // Rxe1# — menangkap, tanpa balasan
  const baru = layar.mulai().slice(sebelum);
  assert.equal(baru.length, 1, "satu luncuran untuk langkah menangkap");
  assert.equal(baru[0].petak, "e1");
  assert.equal(baru[0].kode, "r");
  assert.equal(layar.ghost("e1"), 1, "bidak tertangkap ditahan sebentar sebagai hantu");
  await layar.selesaiAnimasi();
  await layar.tick(1000);
  await layar.tutup();
  assert.equal(layar.ghost("e1"), 0, "hantu dibersihkan setelah luncuran selesai");
  assert.equal(layar.mulai().length, sebelum + 1, "tidak ada luncuran tambahan");
  assert.equal(animasiBidak.petaBidak(layar.papan().fen).e1, "r", "posisi akhir benar");
  assert.equal(layar.sesi().status, modulTekaTeki.STATUS_SOAL.BENAR);
  assert.equal(layar.puncakAktif(), 1);
});

test("animasi 5: en passant meluncurkan pion pemain lalu balasan terpisah", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["setTimeout"], now: 1_000_000 });
  const layar = await pasangLayarAnimasi(tes, { daftar: [SOAL_EP], jam }).mount();
  await layar.main({ from: "e5", to: "d6" });
  assert.equal(layar.mulai().length, 1);
  assert.equal(layar.mulai()[0].petak, "d6");
  assert.equal(layar.mulai()[0].kode, "P");
  assert.equal(animasiBidak.petaBidak(layar.papan().fen).d5, undefined, "pion yang ditangkap lewat en passant sudah hilang");
  await layar.rangkaianSelesai();
  assert.equal(layar.mulai().length, 2, "balasan raja meluncur sendiri");
  assert.equal(layar.mulai()[1].petak, "f7");
  assert.equal(layar.mulai()[1].kode, "k");
  assert.equal(layar.papan().fen, new Chess(new Chess(SOAL_EP.fen).move({ from: "e5", to: "d6" }).after).move({ from: "e8", to: "f7" }).after,
    "posisi akhir en passant + balasan sama dengan chess.js");
  assert.equal(layar.puncakAktif(), 1);
  assert.equal(layar.aktif(), 0);
});

test("animasi 6: rokade meluncurkan raja+benteng sewarna, balasan lawan menyusul terpisah", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["setTimeout"], now: 1_000_000 });
  const layar = await pasangLayarAnimasi(tes, { daftar: [SOAL_ROKADE], jam }).mount();
  await layar.main({ from: "e1", to: "g1" });
  const tahap1 = layar.mulai();
  assert.equal(tahap1.length, 2, "rokade = raja dan benteng, satu langkah sewarna");
  assert.deepEqual(tahap1.map((x) => x.petak).sort(), ["f1", "g1"]);
  assert.deepEqual(tahap1.map((x) => x.kode).sort(), ["K", "R"], "keduanya bidak putih");
  assert.equal(layar.sesi().balasanBerjalan, true);
  await layar.rangkaianSelesai();
  const tahap2 = layar.mulai().slice(2);
  assert.equal(tahap2.length, 1, "balasan raja hitam meluncur sendiri");
  assert.equal(tahap2[0].petak, "d8");
  assert.equal(tahap2[0].kode, "k");
  assert.equal(layar.papan().fen, new Chess(new Chess(SOAL_ROKADE.fen).move({ from: "e1", to: "g1" }).after).move({ from: "e8", to: "d8" }).after);
  assert.equal(layar.aktif(), 0);
});

test("animasi 7: promosi meluncurkan bidak hasil promosi tanpa kedip pion di petak tujuan", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["setTimeout"], now: 1_000_000 });
  const layar = await pasangLayarAnimasi(tes, { daftar: [SOAL_PROMOSI], jam }).mount();
  await layar.klik("a7");
  await layar.klik("a8");
  assert.deepEqual(layar.mulai(), [], "dialog promosi terbuka dulu, belum ada luncuran");
  assert.equal(layar.papan().fen, SOAL_PROMOSI.fen, "posisi belum berubah selama memilih");
  await layar.pilihPromosi("q");
  const tahap1 = layar.mulai();
  assert.equal(tahap1.length, 1, "satu luncuran untuk langkah promosi");
  assert.equal(tahap1[0].petak, "a8");
  assert.equal(tahap1[0].kode, "Q", "yang meluncur langsung menteri, bukan pion lalu bertukar");
  assert.equal(animasiBidak.petaBidak(layar.papan().fen).a8, "Q", "tidak ada keadaan antara pion di a8");
  await layar.rangkaianSelesai();
  assert.equal(layar.mulai().length, 2);
  assert.equal(layar.mulai()[1].petak, "h7");
  assert.equal(layar.mulai()[1].kode, "k");
  assert.equal(layar.papan().fen, new Chess(new Chess(SOAL_PROMOSI.fen).move({ from: "a7", to: "a8", promotion: "q" }).after).move({ from: "h8", to: "h7" }).after);
  assert.equal(layar.puncakAktif(), 1);
});

test("animasi 8: pemutaran solusi meluncurkan satu langkah per tahap, tidak pernah dua warna", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["setTimeout"], now: 1_000_000 });
  const layar = await pasangLayarAnimasi(tes, { jam }).mount();
  const awal = layar.sesi().soal.fen;
  await layar.solusi();
  const luncuran = layar.mulai();
  assert.deepEqual(luncuran.map((x) => x.petak), ["d1", "e1", "e1"], "tiga langkah solusi, tiga luncuran");
  assert.deepEqual(luncuran.map((x) => x.kode), ["r", "Q", "r"], "warna bergantian per tahap, bukan digabung");
  assert.equal(layar.puncakAktif(), 1, "tidak ada dua bidak meluncur bersamaan");
  // Setiap tahap hanya menggerakkan satu warna — pengaman dua warna tetap utuh.
  let posisi = awal;
  for (const langkah of layar.sesi().soal.langkah) {
    const berikut = modulTekaTeki.terapkanLangkah(posisi, langkah);
    const geseran = animasiBidak.geseranDariFen(posisi, berikut);
    assert.ok(geseran.length > 0, `tahap ${langkah.from}-${langkah.to} tetap bisa dianimasikan`);
    assert.equal(new Set(geseran.map((g) => (g.bidak === g.bidak.toUpperCase() ? "w" : "b"))).size, 1);
    posisi = berikut;
  }
  assert.equal(layar.papan().fen, posisi, "posisi akhir pemutaran solusi sesuai aturan");
  assert.equal(layar.sesi().solusiBerjalan, false);
  assert.equal(layar.aktif(), 0);
});

test("animasi 9: navigasi riwayat tidak menciptakan luncuran palsu", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["setTimeout"], now: 1_000_000 });
  const layar = await pasangLayarAnimasi(tes, { jam }).mount();
  const awal = layar.sesi().soal.fen;
  await layar.main({ from: "d8", to: "d1" });
  await layar.rangkaianSelesai();
  const fenPemain = modulTekaTeki.terapkanLangkah(awal, { from: "d8", to: "d1" });
  const fenAkhir = layar.papan().fen;
  const jumlah = layar.mulai().length;

  // Mundur satu langkah: perbedaan posisi memang satu langkah nyata (balasan
  // yang ditarik kembali), jadi luncuran yang muncul harus cocok dengan diff itu.
  await layar.navigasi("sebelum");
  assert.equal(layar.papan().fen, fenPemain, "papan menampilkan posisi yang ditinjau");
  assert.equal(layar.papan().terkunci, true, "papan terkunci saat meninjau");
  for (const g of layar.mulai().slice(jumlah)) {
    const diff = animasiBidak.geseranDariFen(fenAkhir, fenPemain);
    assert.ok(diff.some((d) => d.ke === g.petak && d.bidak === g.kode),
      `luncuran ${g.kode}@${g.petak} harus berasal dari perbedaan posisi nyata`);
    assert.equal(new Set(diff.map((d) => (d.bidak === d.bidak.toUpperCase() ? "w" : "b"))).size, 1);
  }
  await layar.selesaiAnimasi();

  // Lompat ke posisi awal: dua langkah ditarik sekaligus → TIDAK boleh ada
  // luncuran gabungan dua warna; papan langsung menampilkan posisi awal.
  const sebelumLompat = layar.mulai().length;
  await layar.navigasi("awal");
  assert.equal(layar.papan().fen, awal);
  assert.equal(layar.mulai().length, sebelumLompat, "lompat multi-langkah tidak dianimasikan palsu");
  assert.equal(layar.puncakAktif(), 1);

  // Kembali ke posisi live: tidak ada langkah baru yang dimainkan.
  await layar.navigasi("akhir");
  assert.equal(layar.papan().fen, fenAkhir);
  assert.equal(layar.papan().terkunci, false);
  assert.equal(layar.sesi().indeks, 2, "navigasi tidak mengubah progres soal");
  assert.deepEqual(layar.sesi().langkahNyata.length, 2);
  await layar.selesaiAnimasi();
  assert.equal(layar.aktif(), 0);
});

test("animasi 10: ganti soal di tengah luncuran membatalkan balasan yang belum diterbitkan", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["setTimeout"], now: 1_000_000 });
  const layar = await pasangLayarAnimasi(tes, { daftar: [SOAL_PANJANG, SOAL_EP], jam }).mount();
  // Pemilih soal acak: langkah diambil dari soal yang benar-benar terbuka.
  const soalLama = layar.sesi().soal;
  const pemainLama = soalLama.langkah[0];
  const balasanLama = soalLama.langkah[1];
  const kodeBalasan = animasiBidak.petaBidak(modulTekaTeki.terapkanLangkah(soalLama.fen, pemainLama))[balasanLama.from];
  await layar.main(pemainLama);
  assert.equal(layar.mulai().length, 1);
  assert.equal(layar.sesi().balasanBerjalan, true);

  // Soal berganti SEBELUM luncuran pemain selesai.
  await layar.jalankan(({ sesi }) => sesi.soalBaru());
  await layar.tick(2000);
  await layar.selesaiAnimasi();
  await layar.tutup();
  const luncuran = layar.mulai();
  assert.ok(!luncuran.some((g) => g.kode === kodeBalasan && g.petak === balasanLama.to),
    "balasan soal lama tidak boleh meluncur setelah soal berganti");
  assert.equal(layar.sesi().balasanBerjalan, false, "bendera rangkaian dibersihkan");
  assert.equal(layar.aktif(), 0, "tidak ada animasi tertinggal dari soal lama");
  assert.equal(layar.papan().fen, layar.sesi().soal.fen, "papan menampilkan soal baru, bukan sisa animasi lama");
  assert.equal(layar.sesi().indeks, 0);
  assert.deepEqual(layar.sesi().langkahNyata, []);
  assert.equal(layar.papan().terkunci, false, "soal baru langsung bisa dimainkan");
});

test("animasi 11: orientasi papan berubah di tengah luncuran tidak menyisakan animasi basi", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["setTimeout"], now: 1_000_000 });
  // Sumber hitam → sumber putih: orientasi papan benar-benar berbalik.
  const layar = await pasangLayarAnimasi(tes, {
    jam, muat: async (jenis) => (jenis === "skakmat" ? [SOAL_PANJANG] : [DAFTAR_UJI[0]]),
  }).mount();
  assert.equal(layar.papan().orientasi, "b", "pemain hitam → papan dibalik");
  await layar.main({ from: "d8", to: "d1" });
  assert.equal(layar.mulai().length, 1);

  await layar.jalankan(({ panel }) => panel.onSumber("harian"));
  assert.equal(layar.sesi().balasanBerjalan, false, "rangkaian dibatalkan saat sumber berganti");
  await layar.tick(2000);
  await layar.selesaiAnimasi();
  await layar.tutup();
  assert.equal(layar.papan().orientasi, "w", "orientasi berbalik mengikuti pihak pemain soal baru");
  assert.equal(layar.papan().fen, FEN_MAT);
  assert.ok(!layar.mulai().some((g) => g.kode === "Q" && g.petak === "e1"), "balasan lama tidak meluncur di orientasi baru");
  assert.equal(layar.aktif(), 0);
  assert.ok(layar.log.some((x) => x.jenis === "batal"), "luncuran yang sedang jalan dibatalkan, bukan dibiarkan menggantung");

  // Soal baru tetap bisa dianimasikan dengan geometri orientasi yang baru.
  await layar.main({ from: "e1", to: "e8" });
  const terakhir = layar.mulai().at(-1);
  assert.equal(terakhir.petak, "e8");
  assert.equal(terakhir.dy, 7 * KOTAK_PALSU, "arah luncuran memakai geometri orientasi putih");
  await layar.selesaiAnimasi();
  await layar.tutup();
  assert.equal(layar.aktif(), 0);
});

test("animasi 12: ulang soal di tengah luncuran mengembalikan posisi awal dan tetap bisa dianimasikan", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["setTimeout"], now: 1_000_000 });
  const layar = await pasangLayarAnimasi(tes, { jam }).mount();
  const awal = layar.sesi().soal.fen;
  await layar.main({ from: "d8", to: "d1" });
  assert.equal(layar.sesi().balasanBerjalan, true);

  await layar.jalankan(({ sesi }) => sesi.ulangSoal());
  await layar.tick(2000);
  await layar.selesaiAnimasi();
  await layar.tutup();
  assert.equal(layar.papan().fen, awal, "posisi kembali ke awal soal");
  assert.equal(layar.sesi().indeks, 0);
  assert.deepEqual(layar.sesi().langkahNyata, []);
  assert.equal(layar.sesi().balasanBerjalan, false);
  assert.equal(layar.aktif(), 0, "animasi lama dibersihkan");
  assert.ok(!layar.mulai().some((g) => g.kode === "Q" && g.petak === "e1"), "balasan lama tidak menyusul setelah ulang soal");
  assert.equal(layar.papan().terkunci, false);

  // Ulangi langkah yang sama: rangkaian harus berjalan normal lagi.
  const sebelum = layar.mulai().length;
  await layar.main({ from: "d8", to: "d1" });
  assert.equal(layar.mulai().length, sebelum + 1, "luncuran pemain berjalan lagi");
  await layar.rangkaianSelesai();
  assert.equal(layar.mulai().length, sebelum + 2, "balasan menyusul terpisah seperti semula");
  assert.equal(layar.mulai().at(-1).petak, "e1");
  assert.equal(layar.sesi().indeks, 2);
  assert.equal(layar.aktif(), 0);
  assert.equal(layar.puncakAktif(), 1, "tidak pernah dua bidak meluncur bersamaan");
});

// Soal jalur GENAP (sebagian soal harian berakhir pada balasan lawan) membuat
// `selesai` datang bersama balasan. Dengan lompat cepat, soal berikutnya tidak
// boleh membuka sebelum luncuran balasan itu terlihat. Dua fixture berbagi
// langkah pertama supaya uji tetap sah apa pun hasil pemilih acak.
const FEN_GENAP = "4k3/8/8/8/8/8/8/4K2R w - - 0 1";
const SOAL_GENAP = modulTekaTeki.normalisasiSoal({
  problemid: 94, fen: FEN_GENAP, moves: "h1-h5;e8-d8", rating: 1100, tema: "endgame",
}, "skakmat");
const SOAL_GENAP2 = modulTekaTeki.normalisasiSoal({
  problemid: 95, fen: FEN_GENAP, moves: "h1-h5;e8-f8", rating: 1100, tema: "endgame",
}, "skakmat");

test("animasi 13: jalur genap + lompat cepat menampilkan balasan terakhir sebelum soal berikutnya", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["setTimeout"], now: 1_000_000 });
  const layar = await pasangLayarAnimasi(tes, {
    daftar: [SOAL_GENAP, SOAL_GENAP2], prefs: { lompatCepat: true }, jam,
  }).mount();
  const soalAwal = layar.sesi().soal;
  const balasanAwal = soalAwal.langkah[1];
  const fenAkhir = modulTekaTeki.terapkanLangkah(
    modulTekaTeki.terapkanLangkah(FEN_GENAP, { from: "h1", to: "h5" }), balasanAwal,
  );
  await layar.main({ from: "h1", to: "h5" });
  assert.equal(layar.mulai().length, 1, "luncuran pemain");
  assert.equal(layar.sesi().status, modulTekaTeki.STATUS_SOAL.BENAR, "status dicatat saat langkah pemain, bukan setelah animasi");
  assert.equal(layar.sesi().balasanBerjalan, true);

  await layar.selesaiAnimasi();
  await layar.tick(animasiBidak.GESER_ISEPIC.durasi);
  assert.equal(layar.mulai().length, 2, "balasan terakhir tetap diluncurkan");
  assert.equal(layar.mulai()[1].petak, balasanAwal.to);
  assert.equal(layar.mulai()[1].kode, "k");
  assert.equal(layar.sesi().soal, soalAwal, "soal belum berganti selama balasan meluncur");
  assert.equal(layar.papan().fen, fenAkhir, "posisi akhir jalur genap benar");

  // Luncuran balasan selesai → baru soal berikutnya dibuka.
  await layar.selesaiAnimasi();
  await layar.tick(animasiBidak.GESER_ISEPIC.durasi - 1);
  assert.equal(layar.sesi().soal, soalAwal, "tidak memotong luncuran balasan");
  await layar.tick(1);
  await layar.tutup();
  assert.equal(layar.sesi().indeks, 0, "lompat cepat membuka sesi soal berikutnya");
  assert.deepEqual(layar.sesi().langkahNyata, []);
  assert.equal(layar.papan().fen, FEN_GENAP, "papan kembali ke posisi awal soal, bukan posisi akhir soal lama");
  assert.notEqual(layar.papan().fen, fenAkhir);
  assert.equal(layar.sesi().balasanBerjalan, false);
  assert.equal(layar.papan().terkunci, false);
  assert.equal(layar.puncakAktif(), 1);
  await layar.selesaiAnimasi();
  assert.equal(layar.aktif(), 0);
});

test("animasi 14: dua klik cepat tidak menumpuk rangkaian dan petunjuk tidak menunjuk langkah lawan", async (tes) => {
  const jam = tes.mock.timers;
  jam.enable({ apis: ["setTimeout"], now: 1_000_000 });
  const layar = await pasangLayarAnimasi(tes, { jam }).mount();
  await layar.main({ from: "d8", to: "d1" });
  const jumlah = layar.mulai().length;
  // Langkah berikutnya dikirim sebelum rangkaian selesai (papan sudah terkunci,
  // jadi dipanggil lewat sesi untuk menembus lapisan UI dan menguji penjaga hook).
  await layar.jalankan(({ sesi }) => sesi.mainkan({ from: "d1", to: "e1" }));
  await layar.jalankan(({ sesi }) => sesi.ambilPetunjuk());
  assert.equal(layar.mulai().length, jumlah, "tidak ada luncuran baru di tengah rangkaian");
  assert.deepEqual(layar.sesi().petunjuk, { tingkat: "kosong", petak: null, panah: null },
    "petunjuk tidak menunjuk langkah lawan yang sedang meluncur");
  assert.equal(layar.sesi().indeks, 1, "indeks tidak maju karena langkah kedua");
  await layar.rangkaianSelesai();
  assert.equal(layar.sesi().indeks, 2, "rangkaian asli tetap tuntas");
  assert.equal(layar.mulai().length, jumlah + 1);
  assert.equal(layar.puncakAktif(), 1);
  assert.equal(layar.aktif(), 0);
});
