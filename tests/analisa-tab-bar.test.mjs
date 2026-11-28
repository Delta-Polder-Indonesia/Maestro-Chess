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
const KELAS_GULIR = "flex min-w-0 max-w-full overflow-x-auto overflow-y-hidden";

function komponenTab() {
  const terjemahan = {
    "analisa.tabKerja.baru": "New Tab",
    "analisa.tabKerja.daftar": "Tab area kerja",
    "analisa.nav.engine": "Engine",
    "analisa.tabKerja.tambah": "Tambah tab",
    "analisa.tabKerja.tutup": "Tutup tab {nama}",
    "analisa.papan.kartu.report.judul": "Report Analisa",
    "analisa.papan.kartu.impor.judul": "Impor Permainan",
    "analisa.papan.kartu.puzzle.judul": "Teka-Teki",
    "analisa.nav.deteksiEngine": "Deteksi Engine",
    "analisa.nav.wawasan": "Wawasan",
  };
  const dependencies = {
    "lucide-react": require("lucide-react"),
    "../../../lib/i18n.jsx": { useI18n: () => ({ t: (key, nilai) => (terjemahan[key] ?? key).replace("{nama}", nilai?.nama ?? "") }) },
    "../../../modul/pekerjaan/index.js": { KUNCI_FITUR },
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

test("tab bar labels each tab with its feature name, and exposes select, close and add controls", () => {
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
  assert.deepEqual(buttons.map((node) => node.children.join("")), ["New Tab", "Report Analisa", "Report Analisa", "Impor Permainan"]);
  assert.deepEqual(buttons.map((node) => node.props["aria-selected"]), [false, true, false, false]);
  assert.deepEqual(buttons.map((node) => node.props.tabIndex), [-1, 0, -1, -1]);
  assert.ok(buttons.every((node) => node.props["aria-controls"] === "konten-tab-kerja"));
  assert.equal(renderer.root.findByProps({ role: "tablist" }).props["aria-label"], "Tab area kerja");
  act(() => buttons[0].props.onClick());
  const tutup = renderer.root.findAll((node) => node.props["data-uji"] === "tab-kerja-tutup");
  assert.equal(tutup[1].props["aria-label"], "Tutup tab Report Analisa");
  act(() => tutup[1].props.onClick());
  act(() => renderer.root.findByProps({ "data-uji": "tab-kerja-tambah" }).props.onClick());
  assert.deepEqual(aksi, [["pilih", "tab:1"], ["tutup", "tab:2"], ["tambah"]]);
  act(() => renderer.update(React.createElement(TabBar, { ...props, sibuk: true })));
  assert.ok(renderer.root.findAll((node) => ["tab-kerja-pilih", "tab-kerja-tutup", "tab-kerja-tambah"].includes(node.props["data-uji"])).every((node) => node.props.disabled));
  act(() => renderer.unmount());
});

test("every Papan feature tab is labelled with its own feature name, including Teka-Teki", () => {
  const TabBar = komponenTab();
  // Fitur yang dibuka dari beranda Papan: label tab memakai nama fitur, bukan
  // kunci terjemahan mentah dan bukan judul laporan.
  const fitur = [
    ["bermain", "Report Analisa"],
    ["impor", "Impor Permainan"],
    ["teka-teki", "Teka-Teki"],
    ["deteksi-engine", "Deteksi Engine"],
    ["wawasan", "Wawasan"],
  ];
  const daftar = fitur.map(([tampilan], indeks) => ({ id: `tab:${indeks}`, tampilan }));
  let renderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(TabBar, {
      daftar, aktifId: "tab:2", sibuk: false, tampilanAktif: "teka-teki",
      onPilih() {}, onTutup() {}, onTambah() {},
    }));
  });
  const tombol = renderer.root.findAll((node) => node.props.role === "tab");
  assert.deepEqual(tombol.map((node) => node.children.join("")), fitur.map(([, nama]) => nama));
  // Tidak ada label yang bocor sebagai kunci terjemahan.
  assert.ok(tombol.every((node) => !node.children.join("").startsWith("analisa.")));
  assert.deepEqual(
    renderer.root.findAllByProps({ "data-uji": "tab-kerja-item" }).map((node) => node.props["data-tab-fitur"]),
    fitur.map(([tampilan]) => tampilan),
  );
  assert.equal(renderer.root.findAllByProps({ "data-uji": "tab-kerja-tutup" })[2].props["aria-label"], "Tutup tab Teka-Teki");
  act(() => renderer.unmount());
});

test("Papan feature screens leave their name to the tab bar instead of an in-screen explanation header", () => {
  const baca = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  // Bilah tab tetap tampil di seluruh fitur yang dibuka dari beranda Papan.
  const area = baca("../src/halaman/Analisa/komponen/areaKerja.jsx");
  const aturan = area.slice(area.indexOf("function tampilkanBilahTab"), area.indexOf("\n}", area.indexOf("function tampilkanBilahTab")));
  for (const layar of ["PAPAN", "BERMAIN", "IMPOR", "TEKA_TEKI", "DETEKSI_ENGINE", "WAWASAN"]) {
    assert.ok(aturan.includes(`TAMPILAN_ANALISA.${layar}`), `${layar} memakai bilah tab`);
  }
  // Menu bilah samping bukan fitur Papan: tetap tanpa bilah tab.
  for (const layar of ["AKUN", "BASIS_DATA", "ENGINE", "PENGATURAN"]) {
    assert.ok(!aturan.includes(`TAMPILAN_ANALISA.${layar},`), `${layar} tanpa bilah tab`);
  }
  // Kepala penjelasan (judul besar + deskripsi) dihapus; nama fitur cukup di tab.
  // Judul tetap tersedia sebagai h1 sr-only agar pembaca layar tidak kehilangan konteks.
  const layarFitur = [
    ["../src/halaman/TekaTeki/TekaTeki.jsx", "tekaTeki.judul"],
    ["../src/halaman/Analisa/komponen/nav/layarImpor.jsx", "analisa.impor.judul"],
    ["../src/halaman/Analisa/komponen/nav/layarDeteksiEngine.jsx", "analisa.antiCheat.judul"],
    ["../src/halaman/Analisa/komponen/nav/layarWawasan.jsx", "analisa.wawasan.judul"],
  ];
  for (const [berkas, kunciJudul] of layarFitur) {
    const sumber = baca(berkas);
    assert.ok(!sumber.includes("subjudul="), `${berkas} tanpa subjudul penjelasan`);
    assert.ok(sumber.includes(`<h1 className="sr-only">{t("${kunciJudul}")}</h1>`), `${berkas} menyimpan judul untuk pembaca layar`);
    // Satu-satunya h1 layar adalah judul tersembunyi: tidak ada kepala terlihat.
    assert.deepEqual(sumber.match(/<h1[^>]*>/g), ['<h1 className="sr-only">'], `${berkas} tanpa judul terlihat`);
    assert.ok(!sumber.includes(`judul={t("${kunciJudul}")}`), `${berkas} tidak mengirim judul ke kepala panel`);
  }
  // Kunci deskripsi yang tidak lagi dipakai dibuang dari kedua kamus.
  const tekaTekiId = baca("../src/lib/terjemahan/id/tekaTeki.js");
  const tekaTekiEn = baca("../src/lib/terjemahan/en/tekaTeki.js");
  assert.ok(!tekaTekiId.includes("deskripsi:") && !tekaTekiEn.includes("deskripsi:"), "kamus teka-teki tanpa deskripsi layar");
  for (const bahasa of ["id", "en"]) {
    const analisa = baca(`../src/lib/terjemahan/${bahasa}/analisa.js`);
    const impor = analisa.slice(analisa.indexOf("\n    impor: {"), analisa.indexOf("\n    akun: {"));
    assert.ok(!impor.includes("tipe:"), `kamus ${bahasa} tanpa subjudul tipe impor`);
    const wawasan = analisa.slice(analisa.indexOf("\n    wawasan: {"), analisa.indexOf("\n    wawasan: {") + 400);
    assert.ok(!wawasan.includes("deskripsi:"), `kamus ${bahasa} tanpa deskripsi wawasan`);
  }
});

test("active tab follows the live screen before the recorded tab feature catches up", () => {
  const TabBar = komponenTab();
  const daftar = [
    { id: "tab:1", tampilan: "engine" },
    { id: "tab:2", tampilan: "bermain", laporanId: "laporan:other" },
  ];
  const props = {
    daftar,
    aktifId: "tab:1",
    sibuk: false,
    tampilanAktif: "papan",
    onPilih() {}, onTutup() {}, onTambah() {},
  };
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(TabBar, props)); });
  const tombol = renderer.root.findAll((node) => node.props.role === "tab");
  assert.deepEqual(tombol.map((node) => node.children.join("")), ["New Tab", "Report Analisa"]);
  assert.deepEqual(renderer.root.findAllByProps({ "data-uji": "tab-kerja-item" }).map((node) => node.props["data-tab-fitur"]), ["papan", "bermain"]);

  act(() => renderer.update(React.createElement(TabBar, {
    ...props,
    aktifId: "tab:2",
    tampilanAktif: "bermain",
  })));
  assert.deepEqual(renderer.root.findAll((node) => node.props.role === "tab").map((node) => node.children.join("")), ["Engine", "Report Analisa"]);
  act(() => renderer.unmount());
});

test("session recovery uses saved tab labels until the live screen is ready", () => {
  const TabBar = komponenTab();
  const props = {
    daftar: [
      { id: "tab:1", tampilan: "engine" },
      { id: "tab:2", tampilan: "bermain", laporanId: "laporan:1" },
    ],
    aktifId: "tab:2",
    sibuk: true,
    tampilanAktif: null,
    onPilih() {}, onTutup() {}, onTambah() {},
  };
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(TabBar, props)); });
  assert.deepEqual(renderer.root.findAll((node) => node.props.role === "tab").map((node) => node.children.join("")), ["Engine", "Report Analisa"]);
  assert.deepEqual(renderer.root.findAllByProps({ "data-uji": "tab-kerja-item" }).map((node) => node.props["data-tab-fitur"]), ["engine", "bermain"]);
  assert.ok(renderer.root.findAll((node) => ["tab-kerja-pilih", "tab-kerja-tutup", "tab-kerja-tambah"].includes(node.props["data-uji"])).every((node) => node.props.disabled));

  act(() => renderer.update(React.createElement(TabBar, { ...props, sibuk: false, tampilanAktif: "papan" })));
  assert.deepEqual(renderer.root.findAll((node) => node.props.role === "tab").map((node) => node.children.join("")), ["Engine", "New Tab"]);
  assert.equal(renderer.root.findAllByProps({ "data-uji": "tab-kerja-tutup" })[1].props["aria-label"], "Tutup tab New Tab");
  act(() => renderer.unmount());
});

test("tab list owns only tab controls, while close buttons remain available next to them", () => {
  const TabBar = komponenTab();
  const daftar = [
    { id: "tab:1", tampilan: "papan" },
    { id: "tab with space", tampilan: "impor" },
    { id: "tab:3", tampilan: "akun" },
  ];
  const props = { daftar, aktifId: "tab:1", sibuk: false, onPilih() {}, onTutup() {}, onTambah() {} };
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(TabBar, props)); });

  function periksa(diharapkan) {
    const tablist = renderer.root.findByProps({ role: "tablist" });
    const item = renderer.root.findAllByProps({ "data-uji": "tab-kerja-item" });
    const pemilik = (tablist.props["aria-owns"] ?? "").split(/\s+/).filter(Boolean);
    assert.deepEqual(item.map((node) => [node.props["data-tab-id"], node.props["data-tab-fitur"]]), diharapkan.map((tab) => [tab.id, tab.tampilan]));
    assert.equal(pemilik.length, diharapkan.length);
    assert.equal(new Set(pemilik).size, diharapkan.length);
    assert.equal(tablist.props["aria-hidden"], undefined);
    assert.equal(tablist.findAllByProps({ "data-uji": "tab-kerja-tutup" }).length, 0);
    pemilik.forEach((id, indeks) => {
      const wadah = renderer.root.findByProps({ id });
      const tutup = item[indeks].findByProps({ "data-uji": "tab-kerja-tutup" });
      assert.equal(wadah.props.role, "presentation");
      assert.equal(wadah.findByProps({ role: "tab" }), item[indeks].findByProps({ "data-uji": "tab-kerja-pilih" }));
      assert.equal(wadah.findAllByProps({ "data-uji": "tab-kerja-tutup" }).length, 0);
      assert.equal(tutup.parent, item[indeks]);
      assert.equal(tutup.props.role, undefined);
      assert.equal(tutup.props["aria-hidden"], undefined);
    });
    assert.equal(renderer.root.findByProps({ "data-uji": "tab-kerja-tambah" }).parent, tablist.parent);
  }

  periksa(daftar);
  act(() => renderer.update(React.createElement(TabBar, { ...props, daftar: daftar.slice(1), aktifId: daftar[1].id })));
  periksa(daftar.slice(1));
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
  const gulir = renderer.root.findByProps({ className: KELAS_GULIR });
  function tekan(key) {
    let dicegah = false;
    gulir.props.onKeyDown({ key, currentTarget: { querySelectorAll: () => buttons }, preventDefault: () => { dicegah = true; } });
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
  act(() => { renderer = TestRenderer.create(React.createElement(TabBar, props), { createNodeMock: (element) => element.props.className === KELAS_GULIR ? list : null }); });
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
