// Pengunci pass palet tema terang/gelap (adopsi En Croissant ThemeButton):
// kontrak CSS (tema gelap tidak berubah, tema terang hanya memetakan ulang
// permukaan — warna semantik catur tetap), pemetaan token Tailwind, hasil
// migrasi hex permukaan ke token, semantik UI pemilih tema, dan komposisi
// efek provider (tema + aksen + ukuran font hidup bersamaan).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const baca = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

const cssAnalisa = baca("../src/halaman/Analisa/analisa.css");
const cssGlobal = baca("../src/app/globals.css");
const tailwind = baca("../tailwind.config.ts");

function kompilasi(path, dependencies) {
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

// Nilai gelap token baru = warna hard-coded lama (tanpa regresi visual).
const TOKEN_BARU = {
  backgroundDropdown: "#272727",
  backgroundDropdownHover: "#090909",
  backgroundPanel: "#2a2a2a",
  backgroundPanelHover: "#3a3a3a",
  backgroundTrack: "#363636",
  foregroundMuted: "#aaaaaa",
  foregroundSwitchOff: "#b8b8b8",
  foregroundDestructive: "#ffaaa2",
  backgroundSlanted: "#2c2d30",
  borderSlanted: "#52555a",
};

// Variabel yang TIDAK boleh dipetakan ulang oleh tema terang: identitas catur
// (papan, jam, profil, evaluation bar), label penilaian, panah, menang/kalah,
// galat/peringatan, sorotan papan, dan teks-di-atas-terang/aksen.
const SEMANTIK_TETAP = [
  "blackBoard", "whiteBoard",
  "backgroundWhiteClock", "backgroundBlackClock",
  "foregroundProfileWhite", "foregroundProfileBlack", "backgroundProfileWhite", "backgroundProfileBlack",
  "evaluationBarWhite", "evaluationBarBlack",
  "highlightBrilliant", "highlightGreat", "highlightBest", "highlightExcellent", "highlightGood",
  "highlightBook", "highlightInaccuracy", "highlightMistake", "highlightMiss", "highlightBlunder",
  "normalArrow", "bestArrow", "badArrow",
  "winGreen", "lossRed", "error", "warning",
  "foregroundBlack", "foregroundBlackDark", "highlightBoard",
];

function blokTerang() {
  const cocok = cssAnalisa.match(/\.analisa-root\[data-tema="terang"\]\s*\{([\s\S]*?)\n\}/);
  assert.ok(cocok, "blok palet terang ada di analisa.css");
  return cocok[1];
}

test("light theme block remaps surfaces and never touches semantic chess colours", () => {
  const blok = blokTerang();
  const permukaan = [
    "background", "foreground", "foregroundHighlighted", "foregroundGrey", "placeholder",
    "backgroundBox", "backgroundBoxDarker", "backgroundBoxHover", "backgroundBoxBox",
    "backgroundBoxBoxDisabled", "backgroundBoxBoxHover", "border", "borderHighlighted",
    ...Object.keys(TOKEN_BARU),
  ];
  for (const nama of permukaan) {
    assert.ok(new RegExp(`--analisa-${nama}:`).test(blok), `terang memetakan --analisa-${nama}`);
  }
  for (const nama of SEMANTIK_TETAP) {
    assert.ok(!new RegExp(`--(analisa-)?${nama}:`).test(blok), `terang tidak mengubah --${nama}`);
  }
  // Aksen dikendalikan preferensi terpisah, bukan oleh tema.
  assert.ok(!/backgroundBoxBoxHighlighted/.test(blok), "terang tidak menulis ulang aksen");
});

test("light palette keeps WCAG contrast: dark text on light surfaces (AA/AAA)", () => {
  const blok = blokTerang();
  const nilai = (nama) => blok.match(new RegExp(`--analisa-${nama}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
  // Luminansi relatif WCAG (sRGB terlinearisasi) + rasio kontras.
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const kontras = (a, b) => {
    const [terang, gelap] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (terang + 0.05) / (gelap + 0.05);
  };
  const latar = nilai("background");
  assert.ok(luminance(latar) > 0.8, "latar terang benar-benar terang");
  assert.ok(luminance(nilai("backgroundDropdown")) > 0.8, "dropdown terang");
  assert.ok(kontras(nilai("foreground"), latar) >= 7, "teks utama AAA di atas latar");
  assert.ok(kontras(nilai("foregroundGrey"), latar) >= 4.5, "teks sekunder AA");
  assert.ok(kontras(nilai("foregroundMuted"), latar) >= 4.5, "teks redam AA");
  assert.ok(kontras(nilai("foregroundDestructive"), latar) >= 4.5, "teks destruktif AA");
  assert.ok(kontras(nilai("foregroundSwitchOff"), nilai("backgroundTrack")) >= 3, "label sakelar mati terbaca di track");
});

test("dark theme is untouched: new tokens equal the legacy hard-coded values in both stylesheets", () => {
  for (const [nama, nilai] of Object.entries(TOKEN_BARU)) {
    assert.ok(cssGlobal.includes(`--${nama}: ${nilai};`), `globals.css --${nama} = ${nilai}`);
    assert.ok(cssAnalisa.includes(`--analisa-${nama}: ${nilai};`), `analisa.css --analisa-${nama} = ${nilai}`);
    assert.ok(cssAnalisa.includes(`--${nama}: var(--analisa-${nama});`), `alias --${nama} di .analisa-root`);
  }
  // Nilai lama surfaces utama tidak berubah.
  assert.ok(cssAnalisa.includes("--analisa-background: #302e2b;"));
  assert.ok(cssAnalisa.includes("--analisa-foreground: #dedede;"));
  assert.ok(cssAnalisa.includes("--analisa-backgroundBoxBoxHighlighted: #81b64c;"));
  // CSS slanted-header kini lewat token (bukan hex lepas).
  assert.ok(cssGlobal.includes("background-color: var(--borderSlanted);"));
  assert.ok(cssGlobal.includes("background-color: var(--backgroundSlanted);"));
  assert.ok(!/background-color: #52555a|background-color: #2c2d30/.test(cssGlobal));
});

test("tailwind maps every new theme token so utilities follow the palette", () => {
  for (const nama of Object.keys(TOKEN_BARU)) {
    assert.ok(tailwind.includes(`${nama}: variableColor("${nama}")`), `tailwind colors.${nama}`);
  }
});

test("palette pass: migrated surfaces use tokens; semantic colours keep their literals", () => {
  const permukaanLama = /#1e1d1c|#5d5d5d|#dedede|#2a2a2a|#2A2A2A|#3a3a3a|#272727|#090909|#e2e2e2|#52555a|#45474b|#ffaaa2|#b8b8b8/;
  const dimigrasi = [
    "akun/KartuAkun.jsx", "komponen/areaKerja.jsx", "komponen/nav/database/dialogDatabase.jsx",
    "komponen/nav/layarDeteksiEngine.jsx", "komponen/nav/SelectDaftar.jsx", "komponen/nav/database/tabelPartai.jsx",
    "komponen/nav/layarEngine.jsx", "komponen/nav/layarPengaturan.jsx", "komponen/pengaturan/mesin.jsx",
    "komponen/pengaturan/pilihRingkas.jsx", "komponen/nav/layarPapan.jsx", "akun/PanelTarikPartai.jsx",
    "akun/PemilihRentang.jsx", "komponen/nav/database/kolomKoleksi.jsx", "komponen/nav/database/panelRingkasanDatabase.jsx",
    "komponen/pengaturan/sakelarPengaturan.jsx", "komponen/pengaturan/geserPengaturan.jsx",
  ];
  for (const berkas of dimigrasi) {
    const isi = baca(`../src/halaman/Analisa/${berkas}`);
    assert.ok(!permukaanLama.test(isi), `${berkas} bebas hex permukaan lama`);
  }
  // Judul/label permukaan memakai token foreground, bukan putih lepas.
  for (const berkas of ["akun/KartuAkun.jsx", "komponen/nav/database/dialogDatabase.jsx", "komponen/nav/layarEngine.jsx"]) {
    const isi = baca(`../src/halaman/Analisa/${berkas}`);
    assert.ok(!/text-white/.test(isi), `${berkas} tanpa text-white lepas`);
    assert.ok(/text-foreground/.test(isi), `${berkas} memakai token foreground`);
  }
  // Warna semantik sengaja dipertahankan.
  assert.ok(baca("../src/halaman/Analisa/komponen/menu/analysis/gameChart.jsx").includes("#ffffff"), "grafik evaluasi tetap jalur putih");
  assert.ok(baca("../src/halaman/Analisa/komponen/menu/analysis/moves/comments.jsx").includes("bg-white"), "kartu komentar tetap kertas putih");
  assert.ok(baca("../src/halaman/Analisa/komponen/nav/wawasan/kartuAkurasi.jsx").includes("#1b1c1e"), "viz akurasi tetap gelap mandiri");
  assert.ok(baca("../src/halaman/Analisa/komponen/svg/ChessComLogo.jsx").length > 0, "logo merek tidak disentuh");
  // Teks di atas tombol aksen tetap gelap di kedua tema.
  assert.ok(baca("../src/halaman/Analisa/komponen/nav/database/dialogDatabase.jsx").includes("text-black"), "label tombol aksen tetap gelap");
  // Track sakelar/slider memakai token tema, knob tetap putih.
  const sakelar = baca("../src/halaman/Analisa/komponen/pengaturan/sakelarPengaturan.jsx");
  assert.ok(sakelar.includes("bg-backgroundTrack") && sakelar.includes("bg-white"), "track bertema, knob putih");
});

/* ------------------------------ UI tema ------------------------------ */

const PILIHAN = [{ id: "auto", label: "Auto" }, { id: "light", label: "Light" }, { id: "dark", label: "Dark" }];

test("theme picker is a three-option radiogroup with roving focus and arrow wrap", async () => {
  const PilihTema = kompilasi("../src/halaman/Analisa/komponen/pengaturan/pilihTema.jsx", {}).default;
  const panggilan = [];
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(PilihTema, { nilai: "dark", onChange: (v) => panggilan.push(v), ariaLabel: "Theme", pilihan: PILIHAN }));
  });
  const grup = renderer.root.findByProps({ role: "radiogroup" });
  assert.equal(grup.props["aria-label"], "Theme");
  const radio = grup.findAllByProps({ role: "radio" });
  assert.deepEqual(radio.map((r) => r.props["aria-label"]), ["Auto", "Light", "Dark"]);
  assert.deepEqual(radio.map((r) => r.props["aria-checked"]), [false, false, true]);
  assert.deepEqual(radio.map((r) => r.props.tabIndex), [-1, -1, 0], "focus roving hanya di pilihan aktif");
  await act(async () => { radio[1].props.onClick(); });
  assert.deepEqual(panggilan, ["light"]);
  // Panah kiri dari auto membungkus ke dark; panah kanan dari dark ke auto.
  await act(async () => { radio[0].props.onKeyDown({ key: "ArrowLeft", preventDefault: () => {} }); });
  await act(async () => { radio[2].props.onKeyDown({ key: "ArrowRight", preventDefault: () => {} }); });
  assert.deepEqual(panggilan, ["light", "dark", "auto"]);
  // Tombol non-panah tidak memanggil onChange.
  await act(async () => { radio[2].props.onKeyDown({ key: "Enter", preventDefault: () => {} }); });
  assert.deepEqual(panggilan, ["light", "dark", "auto"]);
  await act(async () => { renderer.unmount(); });
});

/* --------------------------- Komposisi efek --------------------------- */

function pasangStorage(tes, awal = []) {
  const lama = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const data = new Map(awal);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: { getItem: (k) => data.get(k) ?? null, setItem(k, v) { data.set(k, String(v)); } } });
  tes.after(() => { if (lama) Object.defineProperty(globalThis, "localStorage", lama); else delete globalThis.localStorage; });
  return data;
}

test("theme, accent and font size compose on the analisa root and clean up together", async (tes) => {
  pasangStorage(tes, [["maestro-analisa-theme", "light"], ["maestro-analisa-accentColor", "ungu"], ["maestro-analisa-fontSize", "120"]]);
  const lama = Object.getOwnPropertyDescriptor(globalThis, "document");
  const style = { fontSize: "", setProperty() {}, removeProperty() { this.fontSize = ""; } };
  const akar = {
    style: { props: new Map(), setProperty(k, v) { this.props.set(k, v); }, removeProperty(k) { this.props.delete(k); } },
    attrs: new Map(),
    setAttribute(k, v) { this.attrs.set(k, v); },
    removeAttribute(k) { this.attrs.delete(k); },
  };
  Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: { documentElement: { style }, querySelector: (s) => (s === ".analisa-root" ? akar : null) } });
  tes.after(() => { if (lama) Object.defineProperty(globalThis, "document", lama); else delete globalThis.document; });

  const muat = buatPemuatJsx({ "src/modul/pekerjaan/index.js": { KUNCI_FITUR: {}, ID_DRAF_IMPOR: "draf:impor", pekerjaan: {}, buatIdDrafImpor: () => "draf:uji" } });
  const Provider = muat("src/halaman/Analisa/konteks/config.jsx").default;
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Provider)); await flush(); });
  assert.equal(style.fontSize, "120%");
  assert.equal(akar.attrs.get("data-tema"), "terang");
  assert.equal(akar.style.props.get("--analisa-backgroundBoxBoxHighlighted"), "#8b5cf6");
  assert.equal(akar.style.props.get("--analisa-backgroundBoxBoxHighlightedHover"), "#a78bfa");
  await act(async () => { renderer.unmount(); await flush(); });
  assert.equal(style.fontSize, "", "font pulih");
  assert.equal(akar.attrs.size, 0, "atribut tema pulih");
  assert.equal(akar.style.props.size, 0, "aksen pulih");
});

test("settings catalog registers the theme row in the appearance group (27 static rows)", async () => {
  const { BARIS_STATIS, GRUP_META } = await import("../src/halaman/Analisa/komponen/pengaturan/katalogPengaturan.js");
  assert.equal(BARIS_STATIS.length, 27);
  const baris = BARIS_STATIS.find((b) => b.kunci === "tema");
  assert.ok(baris, "baris tema terdaftar");
  assert.equal(baris.grup, "tampilan");
  assert.equal(baris.labelKunci, "analisa.pengaturan.tema");
  assert.ok(GRUP_META.some((g) => g.id === "tampilan" && g.tab === "papan"));
  // Baris tema mendahului ukuran font & aksen (urutan tampil grup tampilan).
  const idx = (k) => BARIS_STATIS.findIndex((b) => b.kunci === k);
  assert.ok(idx("tema") < idx("ukuranFont") && idx("ukuranFont") < idx("warnaAksen"));
});
