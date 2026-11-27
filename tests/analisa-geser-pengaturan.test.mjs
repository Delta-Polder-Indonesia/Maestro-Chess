// Pengunci kontrol angka pengaturan gaya NumberField reui/Base UI (GeserPengaturan):
// input spinbutton native + chevron naik/turun bertumpuk + scrub area (readout
// nilai yang digeser horizontal untuk mengubah nilai tanpa slider). Menggantikan
// kontrak slider tick-marks lama setelah permintaan pengguna menyeragamkan semua
// slider pengaturan ke pola NumberField. Cakupan diperluas: semantik input,
// jepit rentang, keyboard, draft hybrid, scrub pointer, call site, dan CSS.
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

const Geser = kompilasi("../src/halaman/Analisa/komponen/pengaturan/geserPengaturan.jsx", {}).default;

// Harness stateful: onChange memperbarui nilai prop seperti induk sebenarnya,
// sehingga operasi beruntun (chevron/keyboard/scrub) terakumulasi realistis.
function Harness({ nilai: awal, onChange, ...props }) {
  const [nilai, setNilai] = React.useState(awal);
  return React.createElement(Geser, {
    ...props, nilai,
    onChange: (v) => { onChange(v); setNilai(v); },
  });
}

async function render(props) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness, props)); });
  return renderer;
}
const noop = () => {};
const cegah = () => {};

test("renders a native number input with min/max/step, suffix, and two labelled chevron buttons", async () => {
  const renderer = await render({ nilai: 80, onChange: noop, ariaLabel: "Volume suara", satuan: "%", labelNaik: "Naikkan", labelTurun: "Turunkan", hintSeret: "Seret" });
  const input = renderer.root.findByType("input");
  assert.equal(input.props.type, "number");
  assert.equal(input.props.min, 0);
  assert.equal(input.props.max, 100);
  assert.equal(input.props.step, 1);
  assert.equal(input.props.value, "80");
  assert.equal(input.props["aria-label"], "Volume suara");
  assert.equal(input.props.inputMode, "numeric");
  assert.ok(String(input.props.className).includes("angka-input"));
  // Suffiks "%" tampil sebagai adornment, bukan bagian nilai input.
  const sufiks = renderer.root.findAllByType("span").find((n) => n.children?.[0] === "%");
  assert.ok(sufiks);
  // Dua tombol chevron berlabel naik/turun.
  const tombol = renderer.root.findAllByType("button");
  assert.deepEqual(tombol.map((b) => b.props["aria-label"]), ["Naikkan", "Turunkan"]);
  assert.ok(tombol.every((b) => b.props.type === "button"));
  // Scrub area: readout nilai yang bisa digeser (aria-hidden, judul hint).
  const scrub = renderer.root.findByProps({ title: "Seret" });
  assert.equal(scrub.props["aria-hidden"], "true");
  assert.deepEqual(scrub.children.map(String), ["80", "%"]);
  assert.ok(String(scrub.props.className).includes("cursor-ew-resize"));
  await act(async () => { renderer.unmount(); });
});

test("chevron buttons step the value and clamp to the range", async () => {
  const panggilan = [];
  const renderer = await render({ nilai: 100, onChange: (v) => panggilan.push(v), min: 50, max: 200, step: 10, ariaLabel: "Font" });
  const [naik, turun] = renderer.root.findAllByType("button");
  await act(async () => { naik.props.onClick(); });
  await act(async () => { turun.props.onClick(); });
  assert.deepEqual(panggilan, [110, 100]);
  // Di maksimum: naik tidak melebihi max; di minimum: turun tidak kurang dari min.
  const maks = await render({ nilai: 200, onChange: (v) => panggilan.push(v), min: 50, max: 200, step: 10, ariaLabel: "Font" });
  await act(async () => { maks.root.findAllByType("button")[0].props.onClick(); });
  const min = await render({ nilai: 50, onChange: (v) => panggilan.push(v), min: 50, max: 200, step: 10, ariaLabel: "Font" });
  await act(async () => { min.root.findAllByType("button")[1].props.onClick(); });
  assert.deepEqual(panggilan, [110, 100], "chevron di batas rentang tidak memanggil onChange");
  await act(async () => { renderer.unmount(); maks.unmount(); min.unmount(); });
});

test("typing commits valid in-range integers immediately, defers partial input, and clamps on blur", async () => {
  const panggilan = [];
  const renderer = await render({ nilai: 100, onChange: (v) => panggilan.push(v), min: 50, max: 200, step: 10, ariaLabel: "Font" });
  const input = renderer.root.findByType("input");
  // Angka sah langsung disimpan (pola kedalaman/Elo) — memenuhi kontrak tier.
  await act(async () => { input.props.onChange({ target: { value: "150" } }); });
  assert.deepEqual(panggilan, [150]);
  // Teks parsial di bawah rentang tidak dijepit prematur.
  await act(async () => { input.props.onChange({ target: { value: "2" } }); });
  assert.deepEqual(panggilan, [150]);
  assert.equal(renderer.root.findByType("input").props.value, "2");
  // Blur menjepit ke rentang.
  await act(async () => { input.props.onBlur(); });
  assert.deepEqual(panggilan, [150, 50]);
  assert.equal(renderer.root.findByType("input").props.value, "50");
  await act(async () => { renderer.unmount(); });
});

test("keyboard: arrows step, PageUp/Down jump ten steps, Home/End hit bounds, Enter commits, Escape resets", async () => {
  const panggilan = [];
  const renderer = await render({ nilai: 100, onChange: (v) => panggilan.push(v), min: 50, max: 200, step: 10, ariaLabel: "Font" });
  const input = renderer.root.findByType("input");
  const tekan = (key) => act(async () => { input.props.onKeyDown({ key, preventDefault: cegah }); });
  await tekan("ArrowUp");
  await tekan("ArrowDown");
  await tekan("PageUp");
  await tekan("Home");
  await tekan("End");
  assert.deepEqual(panggilan, [110, 100, 200, 50, 200]);
  // Escape mengembalikan draf ke nilai tersimpan tanpa onChange.
  await act(async () => { input.props.onChange({ target: { value: "7" } }); });
  await tekan("Escape");
  assert.equal(renderer.root.findByType("input").props.value, "200");
  await act(async () => { renderer.unmount(); });
});

test("scrub area drag changes the value one step per 2px and clamps, without a slider", async () => {
  const panggilan = [];
  const renderer = await render({ nilai: 100, onChange: (v) => panggilan.push(v), min: 50, max: 200, step: 10, ariaLabel: "Font", hintSeret: "Seret" });
  const scrub = renderer.root.findByProps({ title: "Seret" });
  const target = { setPointerCapture: noop, releasePointerCapture: noop };
  await act(async () => { scrub.props.onPointerDown({ button: 0, pointerId: 1, preventDefault: cegah, currentTarget: target }); });
  // +4px → 2 langkah naik; −6px → 3 langkah turun (net −1 langkah dari 120).
  await act(async () => { scrub.props.onPointerMove({ movementX: 4, currentTarget: target }); });
  await act(async () => { scrub.props.onPointerMove({ movementX: -6, currentTarget: target }); });
  await act(async () => { scrub.props.onPointerUp({ pointerId: 1, currentTarget: target }); });
  assert.deepEqual(panggilan, [120, 90]);
  // Setelah lepas, gerakan tidak lagi mengubah nilai.
  await act(async () => { scrub.props.onPointerMove({ movementX: 40, currentTarget: target }); });
  assert.deepEqual(panggilan, [120, 90]);
  await act(async () => { renderer.unmount(); });
});

test("font and volume call sites use the NumberField with translated labels and no tick props", () => {
  const tampilan = baca("../src/halaman/Analisa/komponen/pengaturan/tampilan.jsx");
  const moves = baca("../src/halaman/Analisa/komponen/pengaturan/moves.jsx");
  assert.ok(/GeserPengaturan nilai=\{fontSize\}[^>]*min=\{50\}[^>]*max=\{200\}[^>]*step=\{10\}/.test(tampilan), "font 50–200 langkah 10");
  assert.ok(/GeserPengaturan nilai=\{volume\}[^>]*ariaLabel=\{labelVolume\}/.test(moves), "volume pakai GeserPengaturan");
  for (const isi of [tampilan, moves]) {
    assert.ok(isi.includes('labelNaik={t("analisa.pengaturan.naikkan")}'), "label naik diterjemahkan");
    assert.ok(isi.includes('labelTurun={t("analisa.pengaturan.turunkan")}'), "label turun diterjemahkan");
    assert.ok(isi.includes('hintSeret={t("analisa.pengaturan.seretNilai")}'), "hint scrub diterjemahkan");
    assert.ok(!/tickMajor|tickMinor/.test(isi), "prop tick slider lama dihapus");
  }
  // Komponen tetap mandiri: hanya react yang diimpor (deps-map pengaturan sederhana).
  const sumber = baca("../src/halaman/Analisa/komponen/pengaturan/geserPengaturan.jsx");
  const impor = [...sumber.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(impor, ["react"], "tanpa lucide/paket lain agar kontrak deps-map tetap");
});

test("stylesheet hides native spin buttons and the old range-slider CSS is gone", () => {
  const css = baca("../src/halaman/Analisa/analisa.css");
  assert.ok(css.includes(".analisa-root .angka-input::-webkit-inner-spin-button"), "spin button webkit disembunyikan");
  assert.ok(css.includes(".analisa-root .angka-input::-webkit-outer-spin-button"), "spin button luar disembunyikan");
  assert.ok(/angka-input\s*\{[^}]*-moz-appearance:\s*textfield/.test(css), "firefox textfield");
  assert.ok(!css.includes("geser-pengaturan::-webkit-slider-thumb"), "CSS thumb slider lama dihapus");
  assert.ok(!css.includes("geser-pengaturan::-moz-range-track"), "CSS track slider lama dihapus");
});

test("i18n adds increase/decrease/scrub keys in both Indonesian and English", () => {
  const id = baca("../src/lib/terjemahan/id/analisa.js");
  const en = baca("../src/lib/terjemahan/en/analisa.js");
  for (const isi of [id, en]) {
    assert.ok(/naikkan:/.test(isi) && /turunkan:/.test(isi) && /seretNilai:/.test(isi));
  }
  assert.ok(id.includes('seretNilai: "Seret kiri/kanan untuk mengubah nilai"'));
  assert.ok(en.includes('seretNilai: "Drag left/right to change the value"'));
});

// ── Pengunci hasil audit scrub: batas, pointer lepas, dan cadangan sentuh ──

test("scrubbing past a clamp does not spam onChange with unchanged values", async () => {
  const panggilan = [];
  const renderer = await render({ nilai: 200, onChange: (v) => panggilan.push(v), min: 50, max: 200, step: 10, ariaLabel: "Font", hintSeret: "Seret" });
  const scrub = renderer.root.findByProps({ title: "Seret" });
  const target = { setPointerCapture() {}, releasePointerCapture() {} };
  await act(async () => { scrub.props.onPointerDown({ button: 0, pointerId: 1, preventDefault: cegah, currentTarget: target }); });
  // Sudah di maksimum: menahan geser ke kanan tidak menulis ulang nilai sama.
  await act(async () => { scrub.props.onPointerMove({ movementX: 40, currentTarget: target }); });
  await act(async () => { scrub.props.onPointerMove({ movementX: 40, currentTarget: target }); });
  assert.deepEqual(panggilan, [], "tidak ada onChange saat nilai terjepit di max");
  // Arah sebaliknya tetap mengubah nilai.
  await act(async () => { scrub.props.onPointerMove({ movementX: -4, currentTarget: target }); });
  assert.deepEqual(panggilan, [180]);
  await act(async () => { scrub.props.onPointerUp({ pointerId: 1, currentTarget: target }); });
  await act(async () => { renderer.unmount(); });
});

test("scrub stops when the pointer was released elsewhere (buttons 0 / lost capture)", async () => {
  const panggilan = [];
  const renderer = await render({ nilai: 100, onChange: (v) => panggilan.push(v), min: 0, max: 100, step: 1, ariaLabel: "Volume", hintSeret: "Seret" });
  const scrub = renderer.root.findByProps({ title: "Seret" });
  let pegang = true;
  const target = {
    setPointerCapture() { pegang = true; },
    hasPointerCapture() { return pegang; },
    releasePointerCapture() { pegang = false; },
  };
  await act(async () => { scrub.props.onPointerDown({ button: 0, pointerId: 1, preventDefault: cegah, currentTarget: target }); });
  // Pointer dilepas di luar elemen: buttons 0 → scrub berhenti, bukan lanjut.
  await act(async () => { scrub.props.onPointerMove({ movementX: 10, buttons: 0, currentTarget: target }); });
  assert.deepEqual(panggilan, [], "gerakan tanpa tombol tertahan tidak mengubah nilai");
  assert.equal(pegang, false, "capture dilepas");
  await act(async () => { scrub.props.onPointerMove({ movementX: 10, currentTarget: target }); });
  assert.deepEqual(panggilan, [], "scrub tidak nyangkut setelah pointer lepas");
  // lostpointercapture juga mengakhiri scrub (idempoten, tanpa rilis ganda).
  await act(async () => { scrub.props.onPointerDown({ button: 0, pointerId: 2, preventDefault: cegah, currentTarget: target }); });
  pegang = false; // peramban melepas capture lebih dulu
  await act(async () => { scrub.props.onLostPointerCapture({ pointerId: 2, currentTarget: target }); });
  await act(async () => { scrub.props.onPointerMove({ movementX: 10, currentTarget: target }); });
  assert.deepEqual(panggilan, [], "setelah lostpointercapture, gerakan diabaikan");
  await act(async () => { renderer.unmount(); });
});

test("touch scrub falls back to clientX deltas when movementX is unavailable", async () => {
  const panggilan = [];
  const renderer = await render({ nilai: 100, onChange: (v) => panggilan.push(v), min: 50, max: 200, step: 10, ariaLabel: "Font", hintSeret: "Seret" });
  const scrub = renderer.root.findByProps({ title: "Seret" });
  const target = { setPointerCapture() {}, releasePointerCapture() {} };
  // Peramban sentuh tertentu tidak menyediakan movementX → pakai clientX.
  await act(async () => { scrub.props.onPointerDown({ button: 0, pointerId: 1, clientX: 100, preventDefault: cegah, currentTarget: target }); });
  await act(async () => { scrub.props.onPointerMove({ clientX: 104, currentTarget: target }); }); // +4px → +20
  await act(async () => { scrub.props.onPointerMove({ clientX: 98, currentTarget: target }); });  // −6px → −30
  assert.deepEqual(panggilan, [120, 90]);
  await act(async () => { scrub.props.onPointerUp({ pointerId: 1, currentTarget: target }); });
  await act(async () => { renderer.unmount(); });
});
