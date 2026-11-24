import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import { analisa as english } from "../src/lib/terjemahan/en/analisa.js";

const nodeRequire = createRequire(import.meta.url);
function compile(path, dependencies) {
  const filename = new URL(path, import.meta.url);
  const source = readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    fileName: filename.pathname,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const factory = runInThisContext(`(function (require, module, exports) {\n${compiled}\n})`);
  const compiledModule = { exports: {} };
  factory((id) => {
    if (id === "react" || id === "react/jsx-runtime") return nodeRequire(id);
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, compiledModule, compiledModule.exports);
  return compiledModule.exports.default;
}

const DAFTAR = [
  { id: "sf", label: "Stockfish 18 Lite", url: "/engine/stockfish-18-lite-single.js" },
  { id: "cloud", label: "Cloud Engine", url: "/engine/cloud.js" },
];

function renderLayar({ idEngine = "sf" } = {}) {
  const translate = (key) => key.split(".").reduce((value, part) => value?.[part], { analisa: english }) ?? key;
  const keadaan = { idEngine, pilihan: [], abort: 0, setop: 0, gantiController: 0 };
  const AnalyzeContext = React.createContext(null);
  const controller = new AbortController();
  const abortAsli = controller.abort.bind(controller);
  controller.abort = () => { keadaan.abort += 1; abortAsli(); };
  const mesin = {
    get idEngine() { return keadaan.idEngine; },
    gantiEngine: (id) => { keadaan.idEngine = id; keadaan.pilihan.push(id); },
    setop: () => { keadaan.setop += 1; },
  };
  const Layar = compile("../src/halaman/Analisa/komponen/nav/layarEngine.jsx", {
    "../../../../lib/i18n.jsx": { useI18n: () => ({ t: translate }) },
    "../../../../lib/engineCatur.js": { DAFTAR_ENGINE: DAFTAR },
    "../../../../lib/asets.js": { gambar: (jalur) => jalur },
    "../../../../modul/sesi/analisa.js": { AnalyzeContext },
    "../../../../modul/sesi/mesin.js": { useMesin: () => mesin },
    "./PanelLayar.jsx": { default: ({ judul, headerKanan, children }) => React.createElement("section", null, React.createElement("h1", null, judul), headerKanan, children) },
    "../pengaturan/mesin.jsx": { default: () => React.createElement("div", { "data-uji": "pengaturan-mesin" }, "Mesin") },
    "../Gambar.jsx": { default: (props) => React.createElement("img", props) },
  });
  const buatElemen = () => React.createElement(AnalyzeContext.Provider, {
    value: { depth: [8, () => {}], analyzeController: [controller, () => { keadaan.gantiController += 1; }] },
  }, React.createElement(Layar));
  let renderer;
  TestRenderer.act(() => { renderer = TestRenderer.create(buatElemen()); });
  return {
    renderer,
    keadaan,
    segarkan: () => TestRenderer.act(() => renderer.update(buatElemen())),
  };
}

function byTestId(renderer, id) {
  return renderer.root.find((node) => node.props["data-uji"] === id);
}

function kartu(renderer) {
  return renderer.root.findAll((node) => typeof node.props["data-uji"] === "string" && node.props["data-uji"].startsWith("engine-kartu-"));
}

function text(node) {
  return node.children.map((child) => typeof child === "string" ? child : text(child)).join(" ");
}

test("engine screen keeps the two-panel layout and filters the real engine list", () => {
  const { renderer } = renderLayar();
  assert.equal(text(renderer.root.findByType("h1")), "Engines");
  assert.ok(byTestId(renderer, "pengaturan-mesin"), "the settings from Pengaturan are shown in the right panel");
  assert.equal(byTestId(renderer, "engine-tambah").props.disabled, true, "adding engines is not supported");
  assert.equal(kartu(renderer).length, 2);
  assert.match(text(kartu(renderer)[0]), /Stockfish 18 Lite/);
  assert.match(text(kartu(renderer)[0]), /stockfish-18-lite-single\.js/);
  const gambarKartu = kartu(renderer)[0].findByType("img");
  assert.equal(gambarKartu.props.src, "/images/stockfish.webp", "the card uses the same Stockfish image as the settings panel");
  assert.equal(gambarKartu.props.alt, "Stockfish");
  assert.equal(kartu(renderer)[0].props["aria-pressed"], true);
  assert.match(byTestId(renderer, "engine-cari").props.placeholder, /Search/);

  const cari = byTestId(renderer, "engine-cari");
  TestRenderer.act(() => cari.props.onChange({ target: { value: "Cloud" } }));
  assert.equal(kartu(renderer).length, 1);
  assert.match(text(kartu(renderer)[0]), /Cloud Engine/);
  TestRenderer.act(() => cari.props.onChange({ target: { value: "tidak ada" } }));
  assert.equal(kartu(renderer).length, 0);
  assert.match(text(renderer.root.findByType("section")), /No engines match your search/);
  TestRenderer.act(() => cari.props.onChange({ target: { value: "" } }));
  assert.equal(kartu(renderer).length, 2);
  renderer.unmount();
});

test("selecting another card cancels the running search before switching engine", () => {
  const { renderer, keadaan, segarkan } = renderLayar();
  const pilih = () => byTestId(renderer, "engine-kartu-cloud").props.onClick();
  TestRenderer.act(pilih);
  assert.equal(keadaan.abort, 1);
  assert.equal(keadaan.setop, 1);
  assert.equal(keadaan.gantiController, 1);
  assert.deepEqual(keadaan.pilihan, ["cloud"]);

  segarkan();
  TestRenderer.act(pilih);
  assert.deepEqual(keadaan.pilihan, ["cloud"], "the active engine is not switched twice");
  assert.equal(keadaan.abort, 1);
  renderer.unmount();
});
