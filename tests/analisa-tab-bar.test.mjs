import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import { KUNCI_FITUR } from "../src/halaman/Analisa/riwayatFitur.js";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;

function komponenTab() {
  const terjemahan = {
    "analisa.tabKerja.baru": "New Tab",
    "analisa.tabKerja.daftar": "Tab area kerja",
    "analisa.tabKerja.tambah": "Tambah tab",
    "analisa.tabKerja.tutup": "Tutup tab {nama}",
    "analisa.papan.kartu.report.judul": "Report Analisa",
    "analisa.papan.kartu.impor.judul": "Impor Permainan",
  };
  const dependencies = {
    "lucide-react": require("lucide-react"),
    "../../../lib/i18n.jsx": { useI18n: () => ({ t: (key, nilai) => (terjemahan[key] ?? key).replace("{nama}", nilai?.nama ?? "") }) },
    "../riwayatFitur.js": { KUNCI_FITUR },
    "../usePekerjaan.js": { usePekerjaan: () => ({ daftar: [{ id: "laporan:1", jenis: "laporan", judul: "Alice vs Bob" }] }) },
  };
  const filename = new URL("../src/halaman/Analisa/komponen/tabBar.jsx", import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename.pathname,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = { exports: {} };
  runInThisContext(`(function (require, module, exports) {\n${compiled}\n})`)((id) => {
    if (id === "react" || id === "react/jsx-runtime") return require(id);
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected tab dependency: ${id}`);
  }, result, result.exports);
  return result.exports.default;
}

test("tab bar labels features and reports, and exposes select, close and add controls", () => {
  const TabBar = komponenTab();
  const aksi = [];
  const daftar = [
    { id: "tab:1", tampilan: "papan" },
    { id: "tab:2", tampilan: "bermain", laporanId: "laporan:1" },
    { id: "tab:3", tampilan: "bermain", laporanId: "laporan:other" },
    { id: "tab:4", tampilan: "impor" },
  ];
  const props = { daftar, aktifId: "tab:2", sibuk: false, onPilih: (id) => aksi.push(["pilih", id]), onTutup: (id) => aksi.push(["tutup", id]), onTambah: () => aksi.push(["tambah"]) };
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(TabBar, props)); });
  const buttons = renderer.root.findAll((node) => node.props.role === "tab");
  assert.deepEqual(buttons.map((node) => node.children.join("")), ["New Tab", "Alice vs Bob", "Report Analisa", "Impor Permainan"]);
  assert.deepEqual(buttons.map((node) => node.props["aria-selected"]), [false, true, false, false]);
  assert.deepEqual(buttons.map((node) => node.props.tabIndex), [-1, 0, -1, -1]);
  assert.ok(buttons.every((node) => node.props["aria-controls"] === "konten-tab-kerja"));
  assert.equal(renderer.root.findByProps({ role: "tablist" }).props["aria-label"], "Tab area kerja");
  act(() => buttons[0].props.onClick());
  const tutup = renderer.root.findAll((node) => node.props["data-uji"] === "tab-kerja-tutup");
  assert.equal(tutup[1].props["aria-label"], "Tutup tab Alice vs Bob");
  act(() => tutup[1].props.onClick());
  act(() => renderer.root.findByProps({ "data-uji": "tab-kerja-tambah" }).props.onClick());
  assert.deepEqual(aksi, [["pilih", "tab:1"], ["tutup", "tab:2"], ["tambah"]]);
  act(() => renderer.update(React.createElement(TabBar, { ...props, sibuk: true })));
  assert.ok(renderer.root.findAll((node) => ["tab-kerja-pilih", "tab-kerja-tutup", "tab-kerja-tambah"].includes(node.props["data-uji"])).every((node) => node.props.disabled));
  act(() => renderer.unmount());
});

test("arrow, Home and End keys move focus within the tab list", (t) => {
  const previous = globalThis.document;
  const document = { activeElement: null };
  globalThis.document = document;
  t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
  const buttons = Array.from({ length: 3 }, () => ({ focus() { document.activeElement = this; } }));
  document.activeElement = buttons[0];
  const TabBar = komponenTab();
  const renderer = TestRenderer.create(React.createElement(TabBar, {
    daftar: [{ id: "tab:1", tampilan: "papan" }], aktifId: "tab:1", onPilih() {}, onTutup() {}, onTambah() {},
  }));
  const tablist = renderer.root.findByProps({ role: "tablist" });
  function tekan(key) {
    let dicegah = false;
    tablist.props.onKeyDown({ key, currentTarget: { querySelectorAll: () => buttons }, preventDefault: () => { dicegah = true; } });
    assert.equal(dicegah, true);
  }
  tekan("ArrowLeft");
  assert.equal(document.activeElement, buttons[2]);
  tekan("Home");
  assert.equal(document.activeElement, buttons[0]);
  tekan("End");
  assert.equal(document.activeElement, buttons[2]);
  tekan("ArrowRight");
  assert.equal(document.activeElement, buttons[0]);
  act(() => renderer.unmount());
});

test("active tab and its close button stay visible on resize and focus returns after close", (t) => {
  const lama = globalThis.ResizeObserver;
  let onResize;
  let diamati;
  let dilepas = false;
  globalThis.ResizeObserver = class {
    constructor(callback) { onResize = callback; }
    observe(target) { diamati = target; }
    disconnect() { dilepas = true; }
  };
  t.after(() => { if (lama === undefined) delete globalThis.ResizeObserver; else globalThis.ResizeObserver = lama; });
  let digulir = 0;
  let fokus = 0;
  const item = { scrollIntoView: (opsi) => { assert.deepEqual(opsi, { block: "nearest", inline: "nearest" }); digulir += 1; } };
  const tombolAktif = { closest: () => item, focus: () => { fokus += 1; } };
  const list = { querySelector: () => tombolAktif };
  const TabBar = komponenTab();
  const props = { daftar: [{ id: "tab:1", tampilan: "papan" }, { id: "tab:2", tampilan: "akun" }], aktifId: "tab:1", onPilih() {}, onTutup() {}, onTambah() {} };
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(TabBar, props), { createNodeMock: (element) => element.props.role === "tablist" ? list : null }); });
  assert.equal(diamati, list);
  assert.equal(digulir, 1);
  act(() => onResize());
  assert.equal(digulir, 2);
  act(() => renderer.root.findAllByProps({ "data-uji": "tab-kerja-tutup" })[0].props.onClick());
  act(() => renderer.update(React.createElement(TabBar, { ...props, aktifId: "tab:2" })));
  assert.equal(digulir, 3);
  assert.equal(fokus, 1);
  act(() => renderer.unmount());
  assert.equal(dilepas, true);
});
