// Pengunci dropdown pengaturan gaya NumberField reui (PilihRingkas): area teks
// yang klik-nya membuka listbox + kolom chevron ▲/▼ yang memindah pilihan
// sebelumnya/berikutnya (membungkus) TANPA membuka daftar. Semua select
// pengaturan (koleksi suara, kecepatan, material, notasi, format skor, tema
// papan, koordinat, set bidak, dan konfigurasi mesin) memakai komponen ini.
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
const baca = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

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

const Pilih = kompilasi("../src/halaman/Analisa/komponen/pengaturan/pilihRingkas.jsx", {}).default;
const PILIHAN = [
  { id: "standard", label: "Standard" },
  { id: "futuristic", label: "Futuristic" },
  { id: "lisp", label: "Lisp" },
];

function Harness({ nilai: awal, onChange, ...props }) {
  const [nilai, setNilai] = React.useState(awal);
  return React.createElement(Pilih, { ...props, nilai, onChange: (v) => { onChange(v); setNilai(v); } });
}
async function render(props) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness, props)); });
  return renderer;
}
const noop = () => {};
const cegah = () => {};

function stubDocument(tes) {
  const lama = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: { addEventListener() {}, removeEventListener() {} } });
  tes.after(() => { if (lama) Object.defineProperty(globalThis, "document", lama); else delete globalThis.document; });
}

test("renders a text-area listbox trigger plus two data-stepper chevron buttons", async () => {
  const renderer = await render({ nilai: "standard", pilihan: PILIHAN, onChange: noop, ariaLabel: "Koleksi suara", id: "koleksi", labelNaik: "Pilihan sebelumnya", labelTurun: "Pilihan berikutnya" });
  const trigger = renderer.root.findByProps({ "aria-haspopup": "listbox" });
  assert.equal(trigger.props["aria-label"], "Koleksi suara");
  assert.equal(trigger.props["aria-expanded"], false);
  assert.equal(trigger.props.id, "koleksi", "id diteruskan ke trigger agar label htmlFor terkait");
  assert.equal(trigger.props.type, "button");
  const stepper = renderer.root.findAllByProps({ "data-stepper": "true" });
  assert.deepEqual(stepper.map((b) => b.props["aria-label"]), ["Pilihan sebelumnya", "Pilihan berikutnya"]);
  assert.ok(stepper.every((b) => b.props.type === "button"));
  // Daftar tertutup saat awal.
  assert.equal(renderer.root.findAllByProps({ role: "listbox" }).length, 0);
  await act(async () => { renderer.unmount(); });
});

test("chevrons cycle options with wrap-around without opening the list", async () => {
  const panggilan = [];
  const renderer = await render({ nilai: "standard", pilihan: PILIHAN, onChange: (v) => panggilan.push(v), ariaLabel: "Koleksi suara" });
  const [naik, turun] = renderer.root.findAllByProps({ "data-stepper": "true" });
  await act(async () => { turun.props.onClick(); });   // standard → futuristic
  await act(async () => { turun.props.onClick(); });   // futuristic → lisp
  await act(async () => { turun.props.onClick(); });   // lisp → standard (membungkus)
  await act(async () => { naik.props.onClick(); });    // standard → lisp (membungkus mundur)
  assert.deepEqual(panggilan, ["futuristic", "lisp", "standard", "lisp"]);
  // Daftar tidak pernah terbuka selama stepping.
  assert.equal(renderer.root.findAllByProps({ role: "listbox" }).length, 0);
  await act(async () => { renderer.unmount(); });
});

test("clicking the text area opens the listbox and picking an option commits and closes", async (tes) => {
  stubDocument(tes);
  const panggilan = [];
  const renderer = await render({ nilai: "standard", pilihan: PILIHAN, onChange: (v) => panggilan.push(v), ariaLabel: "Koleksi suara" });
  const trigger = renderer.root.findByProps({ "aria-haspopup": "listbox" });
  await act(async () => { trigger.props.onClick(); });
  const listbox = renderer.root.findByProps({ role: "listbox" });
  assert.equal(listbox.props["aria-label"], "Koleksi suara");
  const opsi = listbox.findAllByProps({ role: "option" });
  assert.deepEqual(opsi.map((o) => o.props["aria-selected"]), [true, false, false]);
  await act(async () => { opsi[2].findByType("button").props.onClick(); });
  assert.deepEqual(panggilan, ["lisp"]);
  assert.equal(renderer.root.findAllByProps({ role: "listbox" }).length, 0, "tertutup setelah memilih");
  await act(async () => { renderer.unmount(); });
});

test("arrow keys on the closed trigger cycle options like a native select", async () => {
  const panggilan = [];
  const renderer = await render({ nilai: "futuristic", pilihan: PILIHAN, onChange: (v) => panggilan.push(v), ariaLabel: "Koleksi suara" });
  const trigger = renderer.root.findByProps({ "aria-haspopup": "listbox" });
  await act(async () => { trigger.props.onKeyDown({ key: "ArrowDown", preventDefault: cegah }); }); // futuristic → lisp
  await act(async () => { trigger.props.onKeyDown({ key: "ArrowUp", preventDefault: cegah }); });   // lisp → futuristic
  assert.deepEqual(panggilan, ["lisp", "futuristic"]);
  await act(async () => { renderer.unmount(); });
});

test("all settings dropdowns and the engine config selects use PilihRingkas (no native select left in mesin)", () => {
  const mesin = baca("../src/halaman/Analisa/komponen/pengaturan/mesin.jsx");
  assert.ok(!/<select/.test(mesin), "select native mesin dikonversi ke PilihRingkas");
  assert.equal((mesin.match(/<PilihRingkas/g) || []).length, 5, "mode/waktu/node/hash/skill");
  assert.ok(mesin.includes('import PilihRingkas from "./pilihRingkas.jsx";'));
  for (const berkas of ["bestMoves.jsx", "moves.jsx", "ratings.jsx", "themes.jsx"]) {
    const isi = baca(`../src/halaman/Analisa/komponen/pengaturan/${berkas}`);
    assert.ok(isi.includes('labelNaik={t("analisa.pengaturan.opsiSebelumnya")}'), `${berkas} label naik`);
    assert.ok(isi.includes('labelTurun={t("analisa.pengaturan.opsiBerikutnya")}'), `${berkas} label turun`);
  }
  // Komponen tetap mandiri (hanya react) agar deps-map pengaturan sederhana.
  const sumber = baca("../src/halaman/Analisa/komponen/pengaturan/pilihRingkas.jsx");
  const impor = [...sumber.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(impor, ["react"]);
  // i18n paritas: kunci pilihan sebelumnya/berikutnya ada di ID dan EN.
  assert.ok(baca("../src/lib/terjemahan/id/analisa.js").includes('opsiSebelumnya: "Pilihan sebelumnya"'));
  assert.ok(baca("../src/lib/terjemahan/en/analisa.js").includes('opsiSebelumnya: "Previous option"'));
});

test("popover background is opaque (solid dropdown token) so underlying text does not bleed through", async (tes) => {
  stubDocument(tes);
  const renderer = await render({ nilai: "standard", pilihan: PILIHAN, onChange: noop, ariaLabel: "Koleksi suara" });
  await act(async () => { renderer.root.findByProps({ "aria-haspopup": "listbox" }).props.onClick(); });
  const listbox = renderer.root.findByProps({ role: "listbox" });
  const kelas = String(listbox.props.className).split(/\s+/);
  // Latar popover memakai token dropdown solid, bukan backgroundBox transparan.
  assert.ok(kelas.includes("bg-backgroundDropdown"), "popover pakai bg-backgroundDropdown");
  assert.ok(!kelas.includes("bg-backgroundBox"), "tidak memakai bg-backgroundBox (transparan)");
  // Sorotan opsi juga solid (konsisten dengan SelectDaftar).
  const opsi = listbox.findAllByProps({ role: "option" })[0].findByType("button");
  assert.ok(String(opsi.props.className).includes("hover:bg-backgroundDropdownHover"), "hover opsi solid");
  await act(async () => { renderer.unmount(); });

  // Sumber token: --analisa-backgroundDropdown heks 6-digit (opaque) di kedua
  // tema, sedangkan --analisa-backgroundBox memang ber-alpha (transparan).
  const css = baca("../src/halaman/Analisa/analisa.css");
  const dropdown = [...css.matchAll(/--analisa-backgroundDropdown:\s*(#[0-9a-fA-F]+)\s*;/g)].map((m) => m[1]);
  assert.ok(dropdown.length >= 2, "token dropdown ada di tema gelap dan terang");
  for (const nilai of dropdown) assert.equal(nilai.length, 7, `${nilai} heks 6-digit opaque`);
  const box = [...css.matchAll(/--analisa-backgroundBox:\s*(#[0-9a-fA-F]+)\s*;/g)].map((m) => m[1]);
  assert.ok(box.every((n) => n.length === 9), "backgroundBox ber-alpha (alasan popover tidak memakainya)");
});
