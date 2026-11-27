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

import * as modulTekaTeki from "../src/modul/tekaTeki/index.js";
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

const FEN_MAT = "7k/6pp/p7/8/8/8/5PPP/4R1K1 b - - 0 1";
const FEN_MAT2 = "7k/6pp/1p6/8/8/8/5PPP/4R1K1 b - - 0 1";
const DAFTAR_UJI = [
  modulTekaTeki.normalisasiSoal({ problemid: 1, fen: FEN_MAT, moves: "a6-a5;e1-e8", rating: 1100, tema: "mateIn1" }, "skakmat"),
  modulTekaTeki.normalisasiSoal({ problemid: 2, fen: FEN_MAT2, moves: "b6-b5;e1-e8", rating: 1200, tema: "mateIn1" }, "skakmat"),
];

function pasangHook(tes, { daftar = DAFTAR_UJI, ...opsi } = {}) {
  const hook = kompilasi("../src/halaman/TekaTeki/logika/useSesiTekaTeki.js", {
    "../../../modul/tekaTeki/index.js": { ...modulTekaTeki, muatSoal: async () => daftar },
  }).default;
  const keluaran = { current: null };
  function Harness() {
    keluaran.current = hook({ catatWaktu: false, ...opsi });
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
    unmount() { act(() => renderer.unmount()); },
  };
}

test("session loads a source, plays the opponent's opening move, and records one pending entry", async (tes) => {
  const sesi = pasangHook(tes);
  const keadaan = await sesi.mount();
  assert.equal(keadaan.memuat, false);
  assert.ok(keadaan.soal, "soal terpilih");
  assert.equal(modulTekaTeki.giliranDariFen(keadaan.fen), "w", "pembuka hitam sudah dimainkan");
  assert.equal(keadaan.indeks, 1);
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
  assert.equal(keadaan.indeks, 1);
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
  assert.equal(keadaan.indeks, 1, "soal lama dibuka dari awal");
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
    "../../Analisa/komponen/pengaturan/sakelarPengaturan.jsx": { default: Sakelar },
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
    "../src/halaman/TekaTeki/komponen/riwayatSesi.jsx",
    "../src/halaman/TekaTeki/logika/useSesiTekaTeki.js",
    "../src/halaman/TekaTeki/logika/usePreferensiTekaTeki.js",
    "../src/halaman/TekaTeki/logika/pgnDariSoal.js",
  ]) assert.ok(baca(berkas).length > 0, berkas);
  // Papan dipakai ulang dari Analisa, tidak diduplikasi ke fitur ini.
  const papan = baca("../src/halaman/TekaTeki/komponen/papanTekaTeki.jsx");
  assert.ok(papan.includes('import Board from "../../Analisa/komponen/game/board.jsx"'));
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
});

test("Indonesian and English puzzle dictionaries expose the same keys", () => {
  const kunci = (objek, prefix = "") => Object.entries(objek).flatMap(([nama, nilai]) => (
    nilai && typeof nilai === "object" ? kunci(nilai, `${prefix}${nama}.`) : [`${prefix}${nama}`]
  ));
  assert.deepEqual(kunci(kamusId).sort(), kunci(kamusEn).sort());
  assert.ok(kunci(kamusId).length >= 40, "kamus mencakup panel, status, pesan, riwayat, pengaturan");
});
