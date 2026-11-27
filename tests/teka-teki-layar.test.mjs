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

/* ------------------------------ Grup pengaturan ------------------------------ */

function pasangPengaturan(tes) {
  const tulisan = [];
  const keadaan = {};
  const Baris = ({ judul, children }) => React.createElement("div", { "data-baris": true }, judul, children);
  const Geser = ({ nilai, onChange, ariaLabel }) => React.createElement("input", { "data-geser": ariaLabel, value: nilai, onChange: (e) => onChange(e.target.value) });
  const Pilih = ({ nilai, onChange, ariaLabel, pilihan }) => React.createElement("select", { "data-pilih": ariaLabel, value: nilai, onChange: (e) => onChange(e.target.value), "data-opsi": pilihan.map((p) => p.id).join(",") });
  const Sakelar = ({ checked, onCheckedChange, "aria-label": label }) => React.createElement("button", { role: "switch", "aria-checked": checked, "aria-label": label, onClick: () => onCheckedChange(!checked) });
  const Konteks = React.createContext(null);
  const config = {
    puzzleRatingMin: [1000, (v) => { keadaan.min = v; }],
    puzzleRatingMax: [1500, (v) => { keadaan.max = v; }],
    puzzleTema: ["", (v) => { keadaan.tema = v; }],
    puzzleProgresif: [false, (v) => { keadaan.progresif = v; }],
    puzzleSembunyiRating: [false, (v) => { keadaan.sembunyi = v; }],
    puzzleLompatCepat: [true, (v) => { keadaan.lompat = v; }],
    puzzleCatatWaktu: [true, (v) => { keadaan.waktu = v; }],
  };
  const Grup = kompilasi("../src/halaman/Analisa/komponen/pengaturan/tekaTeki.jsx", {
    "../../../../modul/sesi/preferensi.js": {
      ConfigContext: Konteks,
      tulis: (kunci, nilai) => tulisan.push([kunci, nilai]),
      tulisBoolean: (kunci, nilai) => tulisan.push([kunci, nilai ? "1" : "0"]),
    },
    "../../../../modul/tekaTeki/index.js": modulTekaTeki,
    "../../../../lib/i18n.jsx": { useI18n: () => ({ t: (kunci) => kunci.split(".").reduce((acc, p) => acc?.[p], { tekaTeki: kamusEn, analisa: { pengaturan: { naikkan: "Up", turunkan: "Down", seretNilai: "Drag", opsiSebelumnya: "Prev", opsiBerikutnya: "Next" } } }) ?? kunci }) },
    "./barisPengaturan.jsx": { default: Baris },
    "./geserPengaturan.jsx": { default: Geser },
    "./pilihRingkas.jsx": { default: Pilih },
    "./sakelarPengaturan.jsx": { default: Sakelar },
  }).default;
  // Harness ber-state: nilai config benar-benar berubah setelah tiap perubahan,
  // sehingga penjepitan min/max diuji pada keadaan nyata, bukan nilai beku.
  function Harness() {
    const [min, setMin] = React.useState(1000);
    const [max, setMax] = React.useState(1500);
    const nilai = {
      ...config,
      puzzleRatingMin: [min, (v) => { keadaan.min = v; setMin(v); }],
      puzzleRatingMax: [max, (v) => { keadaan.max = v; setMax(v); }],
    };
    return React.createElement(Konteks.Provider, { value: nilai }, React.createElement(Grup));
  }
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(Harness)); });
  tes.after(() => act(() => renderer.unmount()));
  return { renderer, tulisan, keadaan };
}

test("puzzle settings group renders six rows and persists every change", (tes) => {
  const { renderer, tulisan, keadaan } = pasangPengaturan(tes);
  assert.equal(renderer.root.findAllByProps({ "data-baris": true }).length, 6);
  const geser = renderer.root.findAllByType("input");
  assert.deepEqual(geser.map((n) => n.props["data-geser"]), ["Minimum rating", "Maximum rating"]);
  act(() => geser[0].props.onChange({ target: { value: 1200 } }));
  act(() => geser[1].props.onChange({ target: { value: 1800 } }));
  assert.deepEqual(tulisan.slice(0, 2), [["puzzleRatingMin", "1200"], ["puzzleRatingMax", "1800"]]);
  assert.equal(keadaan.min, 1200);
  assert.equal(keadaan.max, 1800);

  const pilih = renderer.root.findByType("select");
  assert.ok(pilih.props["data-opsi"].startsWith("semua,"), "opsi pertama = semua tema");
  act(() => pilih.props.onChange({ target: { value: "fork" } }));
  assert.deepEqual(tulisan.at(-1), ["puzzleTema", "fork"]);
  act(() => pilih.props.onChange({ target: { value: "semua" } }));
  assert.deepEqual(tulisan.at(-1), ["puzzleTema", ""], "semua tema disimpan sebagai string kosong");

  const sakelar = renderer.root.findAllByProps({ role: "switch" });
  assert.deepEqual(sakelar.map((n) => n.props["aria-label"]), ["Progressive", "Hide rating", "Jump to next puzzle", "Track time"]);
  act(() => sakelar[0].props.onClick());
  assert.deepEqual(tulisan.at(-1), ["puzzleProgresif", "1"]);
  act(() => sakelar[2].props.onClick());
  assert.deepEqual(tulisan.at(-1), ["puzzleLompatCepat", "0"], "sakelar bawaan nyala bisa dimatikan");
});

test("rating bounds never cross each other", (tes) => {
  const { renderer, keadaan } = pasangPengaturan(tes);
  const geser = renderer.root.findAllByType("input");
  // Min dinaikkan melewati max → dijepit ke max; max diturunkan di bawah min → dijepit ke min.
  act(() => geser[0].props.onChange({ target: { value: 2000 } }));
  assert.equal(keadaan.min, 1500);
  act(() => renderer.root.findAllByType("input")[1].props.onChange({ target: { value: 700 } }));
  assert.equal(keadaan.max, 1500, "max tidak boleh turun di bawah min yang baru");
});

/* ------------------------------ Pemasangan & i18n ------------------------------ */

test("the puzzle screen is wired into navigation, the layer registry, and the settings catalog", () => {
  const konteks = baca("../src/modul/sesi/analyzeKonteks.js");
  assert.ok(konteks.includes('TEKA_TEKI: "teka-teki"'));
  const nav = baca("../src/halaman/Analisa/komponen/nav/nav.jsx");
  assert.ok(nav.includes("TAMPILAN_ANALISA.TEKA_TEKI"), "item menu teka-teki");
  assert.ok(nav.includes('t("analisa.nav.tekaTeki")'));
  const area = baca("../src/halaman/Analisa/komponen/areaKerja.jsx");
  assert.ok(area.includes('import("../../TekaTeki/TekaTeki.jsx")'), "layar dimuat malas");
  assert.ok(area.includes("layar === TAMPILAN_ANALISA.TEKA_TEKI"));
  assert.ok(area.includes("onAnalisa="), "jalur analisa posisi diteruskan");
  const katalog = baca("../src/halaman/Analisa/komponen/pengaturan/katalogPengaturan.js");
  assert.ok(katalog.includes('{ id: "teka-teki", judulKunci: "tekaTeki.pengaturan.tab"'));
  assert.ok(katalog.includes('{ id: "tekaTeki", tab: "teka-teki"'));
  const layar = baca("../src/halaman/Analisa/komponen/nav/layarPengaturan.jsx");
  assert.ok(layar.includes("tekaTeki: (props) => <TekaTekiPengaturan"));
  // Preferensi hidup di config bersama (satu pintu), bukan state liar di fitur.
  const provider = baca("../src/modul/sesi/ConfigContextProvider.jsx");
  for (const kunci of ["puzzleRatingMin", "puzzleRatingMax", "puzzleTema", "puzzleProgresif", "puzzleSembunyiRating", "puzzleLompatCepat", "puzzleCatatWaktu"]) {
    assert.ok(provider.includes(kunci), `${kunci} ada di config bersama`);
  }
});

test("the feature keeps its own shelf: entry, components, logic, and a README", () => {
  for (const berkas of [
    "../src/halaman/TekaTeki/TekaTeki.jsx",
    "../src/halaman/TekaTeki/README.md",
    "../src/halaman/TekaTeki/komponen/papanTekaTeki.jsx",
    "../src/halaman/TekaTeki/komponen/panelTekaTeki.jsx",
    "../src/halaman/TekaTeki/komponen/riwayatSesi.jsx",
    "../src/halaman/TekaTeki/logika/useSesiTekaTeki.js",
    "../src/halaman/TekaTeki/logika/pgnDariSoal.js",
  ]) assert.ok(baca(berkas).length > 0, berkas);
  // Papan dipakai ulang dari Analisa, tidak diduplikasi ke fitur ini.
  const papan = baca("../src/halaman/TekaTeki/komponen/papanTekaTeki.jsx");
  assert.ok(papan.includes('import Board from "../../Analisa/komponen/game/board.jsx"'));
  // Aturan main tetap di modul bersama, bukan ditulis ulang di hook.
  const hook = baca("../src/halaman/TekaTeki/logika/useSesiTekaTeki.js");
  assert.ok(hook.includes('../../../modul/tekaTeki/index.js'));
  assert.ok(!hook.includes('from "chess.js"'), "hook tidak memanggil chess.js langsung");
});

test("Indonesian and English puzzle dictionaries expose the same keys", () => {
  const kunci = (objek, prefix = "") => Object.entries(objek).flatMap(([nama, nilai]) => (
    nilai && typeof nilai === "object" ? kunci(nilai, `${prefix}${nama}.`) : [`${prefix}${nama}`]
  ));
  assert.deepEqual(kunci(kamusId).sort(), kunci(kamusEn).sort());
  assert.ok(kunci(kamusId).length >= 40, "kamus mencakup panel, status, pesan, riwayat, pengaturan");
});
