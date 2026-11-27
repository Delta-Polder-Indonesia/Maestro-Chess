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
  await act(async () => { opsi[2].props.onClick(); });
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
  const opsi = listbox.findAllByProps({ role: "option" })[0];
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

// ── Pengunci hasil audit: fokus, posisi lolos kliping, gulir opsi, semantik ──

// Node mock memberi elemen pura-pura (focus/scrollIntoView/getBoundingClientRect)
// supaya perilaku DOM nyata bisa diuji tanpa peramban.
function pasangNodeMock(kotak, catatan) {
  return (el) => {
    if (el.type === "div" && String(el.props.className || "").startsWith("relative")) {
      return { getBoundingClientRect: () => kotak, contains: () => false };
    }
    if (el.type === "ul") return { focus: () => catatan.fokus.push("daftar") };
    if (el.type === "button") {
      return {
        focus: () => catatan.fokus.push(el.props["aria-haspopup"] === "listbox" ? "trigger" : `opsi:${el.props.id}`),
        scrollIntoView: (opsi) => catatan.gulir.push([el.props.id, opsi]),
      };
    }
    return null;
  };
}

async function renderNode(props, kotak, catatan) {
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Harness, props), { createNodeMock: pasangNodeMock(kotak, catatan) });
  });
  return renderer;
}

function stubWindow(tes, { tinggi = 800, lebar = 1200 } = {}) {
  const lama = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true, writable: true,
    value: { innerHeight: tinggi, innerWidth: lebar, addEventListener() {}, removeEventListener() {} },
  });
  tes.after(() => { if (lama) Object.defineProperty(globalThis, "window", lama); else delete globalThis.window; });
}

test("options are buttons with role=option inside presentational li (no nested interactive)", async (tes) => {
  stubDocument(tes);
  const renderer = await render({ nilai: "standard", pilihan: PILIHAN, onChange: noop, ariaLabel: "Koleksi suara" });
  const trigger = renderer.root.findByProps({ "aria-haspopup": "listbox" });
  await act(async () => { trigger.props.onClick(); });
  const listbox = renderer.root.findByProps({ role: "listbox" });
  assert.equal(trigger.props["aria-controls"], listbox.props.id, "trigger menautkan daftar via aria-controls");
  const li = listbox.findAllByType("li");
  assert.equal(li.length, 3);
  assert.ok(li.every((n) => n.props.role === "presentation"), "li presentation, bukan option");
  const opsi = listbox.findAllByProps({ role: "option" });
  assert.ok(opsi.every((o) => o.type === "button"), "option adalah tombol (pola SelectDaftar)");
  // Tidak ada interactive bersarang di dalam option.
  for (const o of opsi) assert.equal(o.findAllByType("button").filter((b) => b !== o).length, 0, "option tidak memuat tombol lain");
  assert.equal(listbox.props["aria-activedescendant"], opsi[0].props.id, "opsi aktif tertaut");
  await act(async () => { renderer.unmount(); });
});

test("closing via Escape or picking an option returns focus to the trigger", async (tes) => {
  stubDocument(tes);
  const catatan = { fokus: [], gulir: [] };
  const kotak = { top: 100, bottom: 132, right: 400, width: 190 };
  const renderer = await renderNode({ nilai: "standard", pilihan: PILIHAN, onChange: noop, ariaLabel: "Koleksi suara" }, kotak, catatan);
  const trigger = renderer.root.findByProps({ "aria-haspopup": "listbox" });
  await act(async () => { trigger.props.onClick(); });
  assert.ok(catatan.fokus.includes("daftar"), "fokus masuk daftar saat buka");
  await act(async () => { renderer.root.findByProps({ role: "listbox" }).props.onKeyDown({ key: "Escape", preventDefault: cegah }); });
  assert.equal(catatan.fokus.at(-1), "trigger", "Escape mengembalikan fokus ke trigger");
  assert.equal(renderer.root.findAllByProps({ role: "listbox" }).length, 0);
  // Memilih opsi juga mengembalikan fokus.
  await act(async () => { trigger.props.onClick(); });
  await act(async () => { renderer.root.findAllByProps({ role: "option" })[1].props.onClick(); });
  assert.equal(catatan.fokus.at(-1), "trigger", "memilih opsi mengembalikan fokus ke trigger");
  await act(async () => { renderer.unmount(); });
});

test("popover escapes the scrolling settings pane: fixed position, flips up near the bottom, height clamped", async (tes) => {
  stubDocument(tes);
  stubWindow(tes, { tinggi: 800, lebar: 1200 });
  const catatan = { fokus: [], gulir: [] };
  // Baris atas: ruang bawah lapang → daftar ke bawah, tinggi maksimum 200.
  const atas = await renderNode({ nilai: "standard", pilihan: PILIHAN, onChange: noop, ariaLabel: "Tema" }, { top: 100, bottom: 132, right: 400, width: 192 }, catatan);
  await act(async () => { atas.root.findByProps({ "aria-haspopup": "listbox" }).props.onClick(); });
  const daftarAtas = atas.root.findByProps({ role: "listbox" });
  assert.equal(daftarAtas.props.style.position, "fixed", "fixed agar tidak terpotong panel overflow-y-auto");
  assert.equal(daftarAtas.props.style.top, 136, "muncul di bawah trigger");
  assert.equal(daftarAtas.props.style.bottom, undefined);
  assert.equal(daftarAtas.props.style.maxHeight, 200);
  assert.equal(daftarAtas.props.style.right, 800, "kanan sejajar trigger (1200 − 400)");
  assert.equal(daftarAtas.props.style.width, 192, "lebar mengikuti trigger");
  assert.ok(!String(daftarAtas.props.className).includes("absolute"), "kelas absolut dilepas saat terukur");
  await act(async () => { atas.unmount(); });

  // Baris bawah layar: ruang bawah sempit → daftar membalik ke atas dan
  // tingginya dijepit ke ruang tersedia.
  const bawah = await renderNode({ nilai: "standard", pilihan: PILIHAN, onChange: noop, ariaLabel: "Set bidak" }, { top: 700, bottom: 732, right: 400, width: 160 }, catatan);
  await act(async () => { bawah.root.findByProps({ "aria-haspopup": "listbox" }).props.onClick(); });
  const daftarBawah = bawah.root.findByProps({ role: "listbox" });
  assert.equal(daftarBawah.props.style.position, "fixed");
  assert.equal(daftarBawah.props.style.top, undefined, "tidak dipaksa ke bawah");
  assert.equal(daftarBawah.props.style.bottom, 104, "membalik ke atas (800 − 700 + 4)");
  assert.ok(daftarBawah.props.style.maxHeight <= 200 && daftarBawah.props.style.maxHeight >= 96);
  await act(async () => { bawah.unmount(); });
});

test("arrow navigation scrolls the active option into view", async (tes) => {
  stubDocument(tes);
  const catatan = { fokus: [], gulir: [] };
  const renderer = await renderNode({ nilai: "standard", pilihan: PILIHAN, onChange: noop, ariaLabel: "Koleksi suara" }, { top: 100, bottom: 132, right: 400, width: 190 }, catatan);
  await act(async () => { renderer.root.findByProps({ "aria-haspopup": "listbox" }).props.onClick(); });
  const daftar = () => renderer.root.findByProps({ role: "listbox" });
  const idOpsi = renderer.root.findAllByProps({ role: "option" }).map((o) => o.props.id);
  await act(async () => { daftar().props.onKeyDown({ key: "End", preventDefault: cegah }); });
  assert.deepEqual(catatan.gulir.at(-1), [idOpsi[2], { block: "nearest" }], "End menggulir opsi terakhir ke area tampak");
  await act(async () => { daftar().props.onKeyDown({ key: "Home", preventDefault: cegah }); });
  assert.deepEqual(catatan.gulir.at(-1), [idOpsi[0], { block: "nearest" }]);
  await act(async () => { renderer.unmount(); });
});

test("outside pointerdown closes the list and document listeners are cleaned up", async (tes) => {
  const lama = Object.getOwnPropertyDescriptor(globalThis, "document");
  const pendengar = new Map();
  Object.defineProperty(globalThis, "document", {
    configurable: true, writable: true,
    value: {
      addEventListener: (jenis, fn) => { pendengar.set(jenis, fn); },
      removeEventListener: (jenis) => { pendengar.delete(jenis); },
    },
  });
  tes.after(() => { if (lama) Object.defineProperty(globalThis, "document", lama); else delete globalThis.document; });
  const catatan = { fokus: [], gulir: [] };
  const renderer = await renderNode({ nilai: "standard", pilihan: PILIHAN, onChange: noop, ariaLabel: "Koleksi suara" }, { top: 100, bottom: 132, right: 400, width: 190 }, catatan);
  assert.equal(pendengar.size, 0, "tertutup: tidak ada pendengar dokumen");
  await act(async () => { renderer.root.findByProps({ "aria-haspopup": "listbox" }).props.onClick(); });
  assert.ok(pendengar.has("pointerdown"), "pakai pointerdown (mencakup sentuh), bukan hanya mousedown");
  await act(async () => { pendengar.get("pointerdown")({ target: {} }); });
  assert.equal(renderer.root.findAllByProps({ role: "listbox" }).length, 0, "klik luar menutup daftar");
  assert.equal(pendengar.size, 0, "pendengar dilepas saat tertutup (tanpa kebocoran)");
  await act(async () => { renderer.unmount(); });
});
