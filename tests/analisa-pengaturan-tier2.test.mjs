// Karakterisasi preferensi Tier 2 adopsi En Croissant + fondasi "1 pintu":
// volume suara, kecepatan animasi, tampilan material, notasi langkah, dan
// katalog pengaturan terpusat. Menguji fungsi murni, provider, render nyata,
// dan persistensi kontrol — tanpa mengubah skor/analisis inti.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import * as configContext from "../src/halaman/Analisa/konteks/configKonteks.js";
import { boardThemes } from "../src/halaman/Analisa/komponen/pengaturan/boardThemes.js";
import { notasiLangkah, figurine } from "../src/halaman/Analisa/komponen/menu/analysis/moves/notasi.js";
import { aturVolumePengguna, bacaVolumePengguna } from "../src/lib/suara.js";
import { TAB_META, GRUP_META, BARIS_STATIS } from "../src/halaman/Analisa/komponen/pengaturan/katalogPengaturan.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const noop = () => {};

/* ------------------------------ Notasi ------------------------------ */

test("notation modes render letters, figurine symbols, and long algebraic form", () => {
  const movement = [{ col: 4, row: 1 }, { col: 4, row: 3 }]; // e2 -> e4
  assert.equal(notasiLangkah("e4", movement, "letters"), "e4");
  assert.equal(notasiLangkah("e4", movement, "lan"), "e2e4");
  assert.equal(notasiLangkah("Nf3", [{ col: 6, row: 0 }, { col: 5, row: 2 }], "symbols"), "♘f3");
  assert.equal(notasiLangkah("Nf3", null, "letters"), "Nf3");
  // Promosi: figurine pada huruf promosi, LAN menambah huruf promosi kecil.
  assert.equal(figurine("e8=Q"), "e8=♕");
  assert.equal(notasiLangkah("e8=Q", [{ col: 4, row: 6 }, { col: 4, row: 7 }], "lan"), "e7e8q");
  // Langkah pion dan rokade tidak berubah pada mode symbols.
  assert.equal(figurine("e4"), "e4");
  assert.equal(figurine("O-O"), "O-O");
  assert.equal(figurine("Rad1"), "♖ad1");
  // LAN tanpa movement jatuh kembali ke SAN (defensif).
  assert.equal(notasiLangkah("Nf3", null, "lan"), "Nf3");
});

/* --------------------------- Master volume --------------------------- */

test("the user volume master clamps to 0..1 and defaults to full", () => {
  const semula = bacaVolumePengguna();
  assert.equal(semula, 1);
  aturVolumePengguna(0.5);
  assert.equal(bacaVolumePengguna(), 0.5);
  aturVolumePengguna(2);
  assert.equal(bacaVolumePengguna(), 1);
  aturVolumePengguna(-1);
  assert.equal(bacaVolumePengguna(), 0);
  aturVolumePengguna("bukan angka");
  assert.equal(bacaVolumePengguna(), 1);
  aturVolumePengguna(semula);
});

/* ------------------------------ Provider ------------------------------ */

function pasangStorage(tes, awal = []) {
  const lama = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const data = new Map(awal);
  const tulisan = [];
  const storage = { data, tulisan, getItem: (k) => data.get(k) ?? null, setItem(k, v) { tulisan.push([k, v]); data.set(k, String(v)); } };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: storage });
  tes.after(() => { if (lama) Object.defineProperty(globalThis, "localStorage", lama); else delete globalThis.localStorage; });
  return storage;
}

function siapkanProvider(tes) {
  const muat = buatPemuatJsx({ "src/modul/pekerjaan/index.js": { KUNCI_FITUR: {}, ID_DRAF_IMPOR: "draf:impor", pekerjaan: {}, buatIdDrafImpor: () => "draf:uji" } });
  const provider = muat("src/halaman/Analisa/konteks/config.jsx").default;
  const konteks = muat("src/halaman/Analisa/konteks/configKonteks.js");
  const amatan = {};
  let renderer;
  function Probe() { amatan.nilai = React.useContext(konteks.ConfigContext); return null; }
  tes.after(() => { if (renderer) act(() => renderer.unmount()); });
  return { amatan, async mount() { await act(async () => { renderer = TestRenderer.create(React.createElement(provider, null, React.createElement(Probe))); await flush(); }); } };
}

test("provider exposes Tier 2 defaults that preserve current behaviour", async (tes) => {
  pasangStorage(tes);
  const config = siapkanProvider(tes);
  await config.mount();
  const n = config.amatan.nilai;
  assert.equal(n.volume[0], 100);
  assert.equal(n.animationSpeed[0], "normal");
  assert.equal(n.materialDisplay[0], "all");
  assert.equal(n.moveNotation[0], "letters");
});

test("provider reads Tier 2 values, clamps volume, and validates the enums", async (tes) => {
  const storage = pasangStorage(tes, [
    ["maestro-analisa-volume", "150"],
    ["maestro-analisa-animationSpeed", "slow"],
    ["maestro-analisa-materialDisplay", "diff"],
    ["maestro-analisa-moveNotation", "symbols"],
  ]);
  const config = siapkanProvider(tes);
  await config.mount();
  const n = config.amatan.nilai;
  assert.equal(n.volume[0], 100, "volume dijepit ke 100");
  assert.equal(n.animationSpeed[0], "slow");
  assert.equal(n.materialDisplay[0], "diff");
  assert.equal(n.moveNotation[0], "symbols");
  assert.deepEqual(storage.tulisan, []);
});

test("invalid Tier 2 enum values fall back to their defaults", async (tes) => {
  pasangStorage(tes, [
    ["maestro-analisa-animationSpeed", "kilat"],
    ["maestro-analisa-materialDisplay", "acak"],
    ["maestro-analisa-moveNotation", "hieroglif"],
  ]);
  const config = siapkanProvider(tes);
  await config.mount();
  const n = config.amatan.nilai;
  assert.equal(n.animationSpeed[0], "normal");
  assert.equal(n.materialDisplay[0], "all");
  assert.equal(n.moveNotation[0], "letters");
});

/* --------------------------- Material display --------------------------- */

function kompilasi(path, dependencies) {
  const filename = new URL(path, import.meta.url);
  const out = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename.pathname,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const factory = runInThisContext(`(function (require, module, exports) {\n${out}\n})`);
  const result = { exports: {} };
  factory((id) => {
    if (id === "react" || id === "react/jsx-runtime" || id === "chess.js") return require(id);
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, result, result.exports);
  return result.exports.default;
}

const CapturedPieces = kompilasi("../src/halaman/Analisa/komponen/game/capturedPieces.jsx", {
  "../../../../modul/sesi/preferensi.js": { ...configContext },
  "../../../../components/chess/ChessPiece.jsx": { ChessPiece: ({ piece }) => React.createElement("span", { "data-piece": piece }) },
});

function renderMaterial(mode, { pieces = ["p", "n"], advantage = 2 } = {}) {
  const value = { pieceSet: ["cburnett", noop], materialDisplay: [mode, noop] };
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(configContext.ConfigContext.Provider, { value }, React.createElement(CapturedPieces, { white: true, pieces, advantage }))); });
  return renderer;
}

test("material display shows all pieces, difference only, or nothing", () => {
  const semua = renderMaterial("all");
  assert.equal(semua.root.findAll((n) => n.props["data-piece"]).length, 2);
  assert.match(JSON.stringify(semua.toJSON()), /\+2/);
  act(() => semua.unmount());
  const selisih = renderMaterial("diff");
  assert.equal(selisih.root.findAll((n) => n.props["data-piece"]).length, 0);
  assert.match(JSON.stringify(selisih.toJSON()), /\+2/);
  act(() => selisih.unmount());
  const tanpa = renderMaterial("none");
  assert.equal(tanpa.toJSON(), null);
  act(() => tanpa.unmount());
});

/* ------------------------- Katalog & persistensi ------------------------- */

test("the central catalog is the single source for tabs, groups and searchable rows", () => {
  assert.deepEqual(TAB_META.map((t) => t.id), ["papan", "penilaian", "langkah", "bahasa", "dokumentasi"]);
  assert.deepEqual(GRUP_META.map((g) => g.id), ["tema", "perilaku", "tampilan", "penilaian", "langkah", "bahasa", "dokumentasi"]);
  // Semua grup merujuk tab yang sah; semua baris merujuk grup yang sah.
  const tabIds = new Set(TAB_META.map((t) => t.id));
  const grupIds = new Set(GRUP_META.map((g) => g.id));
  for (const g of GRUP_META) assert.ok(tabIds.has(g.tab), g.id);
  for (const b of BARIS_STATIS) assert.ok(grupIds.has(b.grup), b.kunci);
  // Preferensi Tier 1 & Tier 2 terdaftar di katalog (satu pintu).
  for (const kunci of ["koordinatPapan", "sorotLangkah", "autoPromosi", "hapusPanahKlik", "volume", "kecepatanAnimasi", "tampilanMaterial", "notasiLangkah"]) {
    assert.ok(BARIS_STATIS.some((b) => b.kunci === kunci), kunci);
  }
});

test("Tier 2 controls persist volume, animation speed, material and notation", async (tes) => {
  const lama = globalThis.document;
  globalThis.document = { addEventListener() {}, removeEventListener() {} };
  tes.after(() => { if (lama === undefined) delete globalThis.document; else globalThis.document = lama; });
  const tulisan = [];
  const preferensi = { ...configContext, boardThemes, bacaTeks: () => null, tulis: (k, v) => tulisan.push([k, v]) };
  const i18n = { useI18n: () => ({ t: (key) => key }) };
  const kosong = () => null;
  const Baris = kompilasi("../src/halaman/Analisa/komponen/pengaturan/barisPengaturan.jsx", {});
  const Sakelar = kompilasi("../src/halaman/Analisa/komponen/pengaturan/sakelarPengaturan.jsx", {});
  const Pilih = kompilasi("../src/halaman/Analisa/komponen/pengaturan/pilihRingkas.jsx", {});
  const Geser = kompilasi("../src/halaman/Analisa/komponen/pengaturan/geserPengaturan.jsx", {});
  const umum = { "../../../../modul/sesi/preferensi.js": preferensi, "../../../../lib/i18n.jsx": i18n, "./barisPengaturan.jsx": { default: Baris } };
  const Moves = kompilasi("../src/halaman/Analisa/komponen/pengaturan/moves.jsx", { ...umum, "./sakelarPengaturan.jsx": { default: Sakelar }, "./pilihRingkas.jsx": { default: Pilih }, "./geserPengaturan.jsx": { default: Geser }, "../svg/piece.jsx": { default: kosong }, "../svg/soundMax.jsx": { default: kosong }, "../svg/sound-mute.jsx": { default: kosong } });
  const BestMoves = kompilasi("../src/halaman/Analisa/komponen/pengaturan/bestMoves.jsx", { ...umum, "./sakelarPengaturan.jsx": { default: Sakelar }, "./pilihRingkas.jsx": { default: Pilih }, "../svg/piece.jsx": { default: kosong }, "../game/board.jsx": { Arrow: kosong } });
  function Harness() {
    const value = {
      boardTheme: React.useState(0), pieceSet: React.useState("cburnett"), usedRatings: React.useState(configContext.defaultUsedRatings),
      highlightByRating: React.useState(true), showArrows: React.useState(true), arrowAfterMove: React.useState(true),
      showLegalMoves: React.useState(true), animateMoves: React.useState(true), boardSounds: React.useState(true),
      moveHighlight: React.useState(true), autoPromote: React.useState(false), eraseArrowsOnClick: React.useState(true),
      volume: React.useState(100), animationSpeed: React.useState("normal"), materialDisplay: React.useState("all"), moveNotation: React.useState("letters"),
    };
    return React.createElement(configContext.ConfigContext.Provider, { value }, React.createElement(Moves, { aktif: false }), React.createElement(BestMoves));
  }
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness)); });
  // Kontrol angka volume (NumberField) menulis angka 0..100.
  const slider = renderer.root.findByProps({ type: "number", "aria-label": "analisa.pengaturan.volume" });
  await act(async () => { slider.props.onChange({ target: { value: "40" } }); });
  assert.deepEqual(tulisan.at(-1), ["volume", "40"]);
  // Dropdown kecepatan animasi, material, dan notasi menulis nilai enum.
  const pilihEnum = async (label, indeks, kunci, nilai) => {
    const trigger = renderer.root.findAllByProps({ "aria-haspopup": "listbox" }).find((n) => n.props["aria-label"] === label);
    await act(async () => { trigger.props.onClick(); });
    const listbox = renderer.root.findAllByProps({ role: "listbox" }).find((n) => n.props["aria-label"] === label);
    const opsi = listbox.findAllByProps({ role: "option" });
    await act(async () => { opsi[indeks].findByType("button").props.onClick(); });
    assert.deepEqual(tulisan.at(-1), [kunci, nilai]);
  };
  await pilihEnum("analisa.pengaturan.kecepatanAnimasi", 2, "animationSpeed", "slow");
  await pilihEnum("analisa.pengaturan.tampilanMaterial", 0, "materialDisplay", "diff");
  await pilihEnum("analisa.pengaturan.notasiLangkah", 1, "moveNotation", "symbols");
  await act(async () => { renderer.unmount(); });
});
