// Pengunci slider pengaturan gaya "Slider with tick marks" (reui.io): track +
// thumb bulat via input range asli, deret tick utama (tinggi + berangka) dan
// minor (pendek, tanpa angka) di bawah, nilai kini di kanan atas. Memastikan
// ukuran font & volume memakai interval tick yang sesuai dan tetap aksesibel.
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

async function render(props) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Geser, props)); });
  return renderer;
}

function kolomTick(renderer) {
  return renderer.root.findAllByType("span").filter((n) => String(n.props.className || "").includes("w-0"));
}
function labelTick(kolom) {
  return kolom.map((k) => k.findAllByType("span").find((s) => /tabular-nums|opacity-0/.test(String(s.props.className || ""))));
}

test("font slider keeps native range semantics and draws 16 ticks labelled 50/100/150/200", async () => {
  const panggilan = [];
  const renderer = await render({ nilai: 100, onChange: (v) => panggilan.push(v), min: 50, max: 200, step: 10, ariaLabel: "Ukuran font", satuan: "%", tickMajor: 50, tickMinor: 10 });
  const input = renderer.root.findByType("input");
  assert.equal(input.props.type, "range");
  assert.equal(input.props.min, 50);
  assert.equal(input.props.max, 200);
  assert.equal(input.props.step, 10);
  assert.equal(input.props["aria-label"], "Ukuran font");
  assert.ok(String(input.props.className).includes("geser-pengaturan"));
  // Deret tick disembunyikan dari pembaca layar.
  const baris = renderer.root.findByProps({ "aria-hidden": "true" });
  assert.ok(baris);
  const kolom = kolomTick(renderer);
  assert.equal(kolom.length, 16, "50..200 langkah 10 = 16 tick");
  const label = labelTick(kolom);
  const utama = label.filter((l) => l.props.className === "tabular-nums");
  assert.deepEqual(utama.map((l) => String(l.children[0])), ["50", "100", "150", "200"]);
  // Tick minor tidak berangka (opacity-0).
  assert.equal(label.filter((l) => l.props.className === "opacity-0").length, 12);
  // onChange mengirim angka, bukan string.
  await act(async () => { input.props.onChange({ target: { value: "150" } }); });
  assert.deepEqual(panggilan, [150]);
  await act(async () => { renderer.unmount(); });
});

test("volume slider draws 21 ticks labelled 0/25/50/75/100 and shows the current value", async () => {
  const renderer = await render({ nilai: 80, onChange: () => {}, ariaLabel: "Volume suara", satuan: "%", tickMajor: 25, tickMinor: 5 });
  const input = renderer.root.findByType("input");
  assert.equal(input.props.min, 0);
  assert.equal(input.props.max, 100);
  const kolom = kolomTick(renderer);
  assert.equal(kolom.length, 21, "0..100 langkah 5 = 21 tick");
  const utama = labelTick(kolom).filter((l) => l.props.className === "tabular-nums");
  assert.deepEqual(utama.map((l) => String(l.children[0])), ["0", "25", "50", "75", "100"]);
  // Nilai kini tampil di badge kanan atas.
  const badge = renderer.root.findAllByType("span").find((n) => String(n.props.className || "").includes("self-end"));
  assert.deepEqual(badge.children.map(String), ["80", "%"]);
  await act(async () => { renderer.unmount(); });
});

test("call sites pass tick intervals and the stylesheet styles the track/thumb", () => {
  const moves = baca("../src/halaman/Analisa/komponen/pengaturan/moves.jsx");
  const tampilan = baca("../src/halaman/Analisa/komponen/pengaturan/tampilan.jsx");
  assert.ok(/GeserPengaturan nilai=\{volume\}[^>]*tickMajor=\{25\}[^>]*tickMinor=\{5\}/.test(moves), "volume tick 25/5");
  assert.ok(/GeserPengaturan nilai=\{fontSize\}[^>]*tickMajor=\{50\}[^>]*tickMinor=\{10\}/.test(tampilan), "font tick 50/10");
  const css = baca("../src/halaman/Analisa/analisa.css");
  assert.ok(css.includes(".analisa-root .geser-pengaturan::-webkit-slider-thumb"), "thumb webkit");
  assert.ok(css.includes(".analisa-root .geser-pengaturan::-moz-range-thumb"), "thumb firefox");
  assert.ok(css.includes(".analisa-root .geser-pengaturan::-webkit-slider-runnable-track"), "track webkit");
  // Thumb mengikuti tema (kontras di terang/gelap), track token tema.
  assert.ok(/geser-pengaturan::-webkit-slider-thumb[\s\S]*?background: var\(--foreground\)/.test(css), "thumb pakai --foreground");
});
