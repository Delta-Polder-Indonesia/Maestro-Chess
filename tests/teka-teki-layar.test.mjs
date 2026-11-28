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

function pasangPengaturanLayar(tes, prefsOverride = {}) {
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
  act(() => { renderer = TestRenderer.create(React.createElement(Komponen, { prefs, t: tUji })); });
  tes.after(() => act(() => renderer.unmount()));
  return { renderer, panggilan };
}

test("in-screen settings show range + theme + four switches and write through prefs.ubah", (tes) => {
  const { renderer, panggilan } = pasangPengaturanLayar(tes);
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
  const keping = renderer.root.findAllByProps({ role: "listitem" });
  assert.equal(keping.length, 3, "posisi awal bukan keping; tiga langkah dimainkan");
  assert.ok(keping[2].props.children.join("").includes("Rxe1#"));
  assert.equal(keping[2].props["aria-current"], true, "langkah live ditandai aktif");
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
  assert.equal(renderer.root.findAllByProps({ role: "listitem" }).length, 0);
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
