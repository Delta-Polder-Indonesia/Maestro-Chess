import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import TestRenderer from "react-test-renderer";
import * as panelAsli from "../src/halaman/Analisa/konteks/panelAktif.js";
import * as dropdownAsli from "../src/halaman/Analisa/komponen/nav/useDropdown.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const { act } = TestRenderer;
const require = createRequire(import.meta.url);
const namaState = ["terbuka", "setTerbuka", "wadahRef", "pemicuRef", "idDaftar", "tekanPemicu", "toggle", "keluarFokus", "tutupDanFokus"];

function lingkungan(tes) {
  const sebelumnya = Object.getOwnPropertyDescriptor(globalThis, "document");
  const pendengar = new Map();
  const operasi = [];
  const bersihkan = [];
  let dialog = false;
  const key = (jenis, tangkap) => `${jenis}:${Boolean(tangkap)}`;
  const document = {
    activeElement: null,
    addEventListener(jenis, callback, tangkap) {
      const id = key(jenis, tangkap);
      if (!pendengar.has(id)) pendengar.set(id, new Set());
      pendengar.get(id).add(callback);
      operasi.push(["add", jenis, Boolean(tangkap), callback]);
    },
    removeEventListener(jenis, callback, tangkap) {
      const id = key(jenis, tangkap);
      pendengar.get(id)?.delete(callback);
      if (pendengar.get(id)?.size === 0) pendengar.delete(id);
      operasi.push(["remove", jenis, Boolean(tangkap), callback]);
    },
    querySelector(selector) {
      assert.equal(selector, '[role="alertdialog"][data-state="open"]');
      return dialog ? {} : null;
    },
  };
  Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: document });
  tes.after(() => {
    for (const lepas of bersihkan.reverse()) lepas();
    if (sebelumnya) Object.defineProperty(globalThis, "document", sebelumnya);
    else delete globalThis.document;
  });
  return {
    document, pendengar, operasi,
    aturDialog(terbuka) { dialog = terbuka; },
    sebelumPulih(lepas) { bersihkan.push(lepas); },
    hitung(jenis, tangkap = false) { return pendengar.get(key(jenis, tangkap))?.size ?? 0; },
    kirim(jenis, event, tangkap = false) {
      for (const callback of [...(pendengar.get(key(jenis, tangkap)) ?? [])]) callback(event);
    },
  };
}

function elemen(ling) {
  const fokus = [];
  const buat = (nama) => ({
    nama,
    focus() { fokus.push(nama); ling.document.activeElement = this; },
  });
  const pemicu = buat("pemicu");
  const opsi = [buat("opsi-0"), buat("opsi-1"), buat("opsi-2")];
  const luar = buat("luar");
  const wadah = {
    tersembunyi: false,
    terpilih: opsi[1],
    semua: opsi,
    contains(node) { return node === this || node === pemicu || this.semua.includes(node); },
    closest(selector) { assert.equal(selector, "[hidden]"); return this.tersembunyi ? {} : null; },
    querySelector(selector) {
      if (selector === '[role="option"][aria-selected="true"]') return this.terpilih;
      if (selector === '[role="option"]') return this.semua[0] ?? null;
      if (selector === '[aria-haspopup="listbox"]') return pemicu;
      throw new Error(`Selector tak terduga: ${selector}`);
    },
    querySelectorAll(selector) { assert.equal(selector, '[role="option"]'); return this.semua; },
  };
  return { fokus, pemicu, opsi, luar, wadah };
}

function eventTombol(key, tambahan = {}) {
  return {
    key, dicegah: 0, dihentikan: 0, ...tambahan,
    preventDefault() { this.dicegah++; },
    stopPropagation() { this.dihentikan++; },
  };
}

function mountDropdown(ling, aktif = undefined) {
  let nilai;
  let renderer;
  function Probe() { nilai = dropdownAsli.useDropdown(); return null; }
  const isi = (value) => value === undefined
    ? React.createElement(Probe)
    : React.createElement(panelAsli.PanelAktifContext.Provider, { value }, React.createElement(Probe));
  act(() => { renderer = TestRenderer.create(isi(aktif)); });
  ling.sebelumPulih(() => { if (renderer) act(() => renderer.unmount()); });
  return {
    get nilai() { return nilai; },
    update(value) { act(() => renderer.update(isi(value))); },
    unmount() { if (renderer) { act(() => renderer.unmount()); renderer = null; } },
  };
}

function muatKomponen() {
  // Package yang sudah menjadi dependensi proyek dipasok secara eksplisit;
  // context dan hook tidak ditiru, dan berbagi cache registry pemuat JSX.
  return buatPemuatJsx({
    "src/components/ui/tooltip.jsx": { TooltipLabel: ({ children }) => children },
  }, {
    "lucide-react": require("lucide-react"),
    "@tanstack/react-table": require("@tanstack/react-table"),
  });
}

function renderKomponen(ling, Component, Context, props, aktif = true) {
  const item = elemen(ling);
  let renderer;
  const isi = (value, componentProps) => React.createElement(Context.Provider, { value }, React.createElement(Component, componentProps));
  const options = { createNodeMock(node) {
    if (node.type === "div" && node.props.onBlur) return item.wadah;
    if (node.type === "button" && node.props["aria-haspopup"] === "listbox") return item.pemicu;
    return null;
  } };
  act(() => { renderer = TestRenderer.create(isi(aktif, props), options); });
  ling.sebelumPulih(() => { if (renderer) act(() => renderer.unmount()); });
  return {
    item,
    get root() { return renderer.root; },
    update(value, componentProps = props) { act(() => renderer.update(isi(value, componentProps))); },
  };
}

test("the original panel and dropdown files expose only their named APIs and the panel defaults to true", (tes) => {
  assert.deepEqual(Object.keys(panelAsli), ["PanelAktifContext"]);
  assert.deepEqual(Object.keys(dropdownAsli).sort(), ["tekanPanahOpsi", "useDropdown"]);
  assert.equal(typeof dropdownAsli.tekanPanahOpsi, "function");
  assert.equal(typeof dropdownAsli.useDropdown, "function");
  let dibaca;
  function Probe() { dibaca = React.useContext(panelAsli.PanelAktifContext); return null; }
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(Probe)); });
  tes.after(() => act(() => renderer.unmount()));
  assert.equal(dibaca, true);
  act(() => renderer.update(React.createElement(panelAsli.PanelAktifContext.Provider, { value: false }, React.createElement(Probe))));
  assert.equal(dibaca, false);
  act(() => renderer.update(React.createElement(panelAsli.PanelAktifContext.Provider, { value: "nilai-asli" }, React.createElement(Probe))));
  assert.equal(dibaca, "nilai-asli");
});

test("hook state, refs and IDs are isolated per mount, and setters, refs and IDs stay stable on rerender", (tes) => {
  const ling = lingkungan(tes);
  const satu = mountDropdown(ling);
  const dua = mountDropdown(ling);
  const awal = satu.nilai;
  assert.deepEqual(Object.keys(awal), namaState);
  assert.equal(awal.terbuka, false);
  assert.equal(awal.wadahRef.current, null);
  assert.equal(awal.pemicuRef.current, null);
  assert.equal(typeof awal.idDaftar, "string");
  assert.notEqual(awal.idDaftar, dua.nilai.idDaftar);
  assert.notStrictEqual(awal.wadahRef, dua.nilai.wadahRef);
  assert.notStrictEqual(awal.pemicuRef, dua.nilai.pemicuRef);
  act(() => satu.nilai.setTerbuka(true));
  assert.equal(satu.nilai.terbuka, true);
  assert.equal(dua.nilai.terbuka, false);
  assert.strictEqual(satu.nilai.setTerbuka, awal.setTerbuka);
  assert.strictEqual(satu.nilai.wadahRef, awal.wadahRef);
  assert.strictEqual(satu.nilai.pemicuRef, awal.pemicuRef);
  assert.equal(satu.nilai.idDaftar, awal.idDaftar);
  assert.equal(ling.hitung("mousedown"), 1);
  assert.equal(ling.hitung("keydown", true), 1);
});

test("option navigation wraps arrows and honors Home/End using document.activeElement", (tes) => {
  const ling = lingkungan(tes);
  const item = elemen(ling);
  for (const [tombol, awal, hasil] of [
    ["ArrowDown", 2, 0], ["ArrowUp", 0, 2], ["ArrowDown", 0, 1], ["ArrowUp", 2, 1],
    ["Home", 2, 0], ["End", 0, 2],
  ]) {
    ling.document.activeElement = item.opsi[awal];
    const event = eventTombol(tombol, { currentTarget: item.wadah });
    dropdownAsli.tekanPanahOpsi(event);
    assert.equal(event.dicegah, 1, tombol);
    assert.strictEqual(ling.document.activeElement, item.opsi[hasil], tombol);
  }
  ling.document.activeElement = item.luar;
  for (const tombol of ["ArrowUp", "ArrowDown"]) {
    ling.document.activeElement = item.luar;
    const event = eventTombol(tombol, { currentTarget: item.wadah });
    dropdownAsli.tekanPanahOpsi(event);
    assert.equal(event.dicegah, 1);
    assert.strictEqual(ling.document.activeElement, item.opsi[0]);
  }
});

test("option navigation ignores other keys and does not prevent recognized keys for an empty list", (tes) => {
  const ling = lingkungan(tes);
  const item = elemen(ling);
  const lain = eventTombol("Tab", { currentTarget: { querySelectorAll() { throw new Error("tidak boleh mencari opsi"); } } });
  dropdownAsli.tekanPanahOpsi(lain);
  assert.equal(lain.dicegah, 0);
  item.wadah.semua = [];
  const kosong = eventTombol("ArrowDown", { currentTarget: item.wadah });
  dropdownAsli.tekanPanahOpsi(kosong);
  assert.equal(kosong.dicegah, 0);
  assert.deepEqual(item.fokus, []);
});

test("pointer toggling adds only active-open listeners; inside clicks stay open and outside clicks close and remove the same callbacks", (tes) => {
  const ling = lingkungan(tes);
  const item = elemen(ling);
  const dropdown = mountDropdown(ling);
  dropdown.nilai.wadahRef.current = item.wadah;
  dropdown.nilai.pemicuRef.current = item.pemicu;
  assert.equal(ling.pendengar.size, 0);
  act(() => dropdown.nilai.toggle({ detail: 1 }));
  assert.equal(dropdown.nilai.terbuka, true);
  assert.deepEqual(item.fokus, []);
  assert.equal(ling.hitung("mousedown"), 1);
  assert.equal(ling.hitung("keydown", true), 1);
  act(() => ling.kirim("mousedown", { target: item.opsi[0] }));
  assert.equal(dropdown.nilai.terbuka, true);
  act(() => ling.kirim("mousedown", { target: item.luar }));
  assert.equal(dropdown.nilai.terbuka, false);
  assert.equal(ling.pendengar.size, 0);
  const masuk = ling.operasi.filter(([nama]) => nama === "add");
  const keluar = ling.operasi.filter(([nama]) => nama === "remove");
  assert.deepEqual(masuk.map(([, jenis, tangkap]) => [jenis, tangkap]), [["mousedown", false], ["keydown", true]]);
  assert.deepEqual(keluar.map(([, jenis, tangkap]) => [jenis, tangkap]), [["mousedown", false], ["keydown", true]]);
  assert.strictEqual(keluar[0][3], masuk[0][3]);
  assert.strictEqual(keluar[1][3], masuk[1][3]);
});

test("arrow keys on a closed trigger open the dropdown and focus the selected option, or the first option as fallback", (tes) => {
  const ling = lingkungan(tes);
  const item = elemen(ling);
  const dropdown = mountDropdown(ling, true);
  dropdown.nilai.wadahRef.current = item.wadah;
  dropdown.nilai.pemicuRef.current = item.pemicu;
  const selainPanah = eventTombol("Enter");
  act(() => dropdown.nilai.tekanPemicu(selainPanah));
  assert.equal(selainPanah.dicegah, 0);
  assert.equal(dropdown.nilai.terbuka, false);
  const pertama = eventTombol("ArrowDown");
  act(() => dropdown.nilai.tekanPemicu(pertama));
  assert.equal(pertama.dicegah, 1);
  assert.equal(dropdown.nilai.terbuka, true);
  assert.deepEqual(item.fokus, ["opsi-1"]);
  const saatTerbuka = eventTombol("ArrowUp");
  act(() => dropdown.nilai.tekanPemicu(saatTerbuka));
  assert.equal(saatTerbuka.dicegah, 1);
  assert.deepEqual(item.fokus, ["opsi-1", "opsi-1"]);
  act(() => dropdown.nilai.setTerbuka(false));
  item.wadah.terpilih = null;
  const fallback = eventTombol("ArrowUp");
  act(() => dropdown.nilai.tekanPemicu(fallback));
  assert.equal(fallback.dicegah, 1);
  assert.equal(dropdown.nilai.terbuka, true);
  assert.deepEqual(item.fokus, ["opsi-1", "opsi-1", "opsi-0"]);
});

test("keyboard-generated toggle focuses an option, while a pointer toggle does not", (tes) => {
  const ling = lingkungan(tes);
  const item = elemen(ling);
  const dropdown = mountDropdown(ling);
  dropdown.nilai.wadahRef.current = item.wadah;
  act(() => dropdown.nilai.toggle({ detail: 0 }));
  assert.equal(dropdown.nilai.terbuka, true);
  assert.deepEqual(item.fokus, ["opsi-1"]);
  act(() => dropdown.nilai.toggle({ detail: 0 }));
  assert.equal(dropdown.nilai.terbuka, false);
  act(() => dropdown.nilai.toggle({ detail: 1 }));
  assert.equal(dropdown.nilai.terbuka, true);
  assert.deepEqual(item.fokus, ["opsi-1"]);
  act(() => dropdown.nilai.toggle({ detail: 1 }));
  assert.equal(dropdown.nilai.terbuka, false);
});

test("blur closes only when focus leaves the wrapper; close-and-focus restores the trigger even if already closed", (tes) => {
  const ling = lingkungan(tes);
  const item = elemen(ling);
  const dropdown = mountDropdown(ling);
  dropdown.nilai.wadahRef.current = item.wadah;
  dropdown.nilai.pemicuRef.current = item.pemicu;
  act(() => dropdown.nilai.setTerbuka(true));
  act(() => dropdown.nilai.keluarFokus({ currentTarget: item.wadah, relatedTarget: item.opsi[0] }));
  assert.equal(dropdown.nilai.terbuka, true);
  act(() => dropdown.nilai.keluarFokus({ currentTarget: item.wadah, relatedTarget: null }));
  assert.equal(dropdown.nilai.terbuka, false);
  act(() => dropdown.nilai.tutupDanFokus());
  assert.deepEqual(item.fokus, ["pemicu"]);
  act(() => dropdown.nilai.setTerbuka(true));
  act(() => dropdown.nilai.tutupDanFokus());
  assert.equal(dropdown.nilai.terbuka, false);
  assert.deepEqual(item.fokus, ["pemicu", "pemicu"]);
});

test("Escape yields to hidden panels and open alert dialogs, otherwise prevents default and restores focus from inside", (tes) => {
  const ling = lingkungan(tes);
  const item = elemen(ling);
  const dropdown = mountDropdown(ling, true);
  dropdown.nilai.wadahRef.current = item.wadah;
  dropdown.nilai.pemicuRef.current = item.pemicu;
  act(() => dropdown.nilai.setTerbuka(true));
  ling.document.activeElement = item.opsi[1];
  const selainEscape = eventTombol("Enter");
  act(() => ling.kirim("keydown", selainEscape, true));
  assert.equal(selainEscape.dicegah, 0);
  assert.equal(dropdown.nilai.terbuka, true);
  item.wadah.tersembunyi = true;
  const tersembunyi = eventTombol("Escape");
  act(() => ling.kirim("keydown", tersembunyi, true));
  assert.equal(tersembunyi.dicegah, 0);
  assert.equal(dropdown.nilai.terbuka, true);
  item.wadah.tersembunyi = false;
  ling.aturDialog(true);
  const dialog = eventTombol("Escape");
  act(() => ling.kirim("keydown", dialog, true));
  assert.equal(dialog.dicegah, 0);
  assert.equal(dropdown.nilai.terbuka, true);
  ling.aturDialog(false);
  const escape = eventTombol("Escape");
  act(() => ling.kirim("keydown", escape, true));
  assert.equal(escape.dicegah, 1);
  assert.equal(escape.dihentikan, 0);
  assert.equal(dropdown.nilai.terbuka, false);
  assert.deepEqual(item.fokus, ["pemicu"]);
  assert.equal(ling.pendengar.size, 0);
});

test("Escape with focus outside closes the dropdown without moving that focus", (tes) => {
  const ling = lingkungan(tes);
  const item = elemen(ling);
  const dropdown = mountDropdown(ling);
  dropdown.nilai.wadahRef.current = item.wadah;
  ling.document.activeElement = item.luar;
  act(() => dropdown.nilai.setTerbuka(true));
  const event = eventTombol("Escape");
  act(() => ling.kirim("keydown", event, true));
  assert.equal(event.dicegah, 1);
  assert.equal(dropdown.nilai.terbuka, false);
  assert.strictEqual(ling.document.activeElement, item.luar);
  assert.deepEqual(item.fokus, []);
});

test("hiding a panel closes and detaches listeners, but explicitly reopening while already inactive remains open without listeners", (tes) => {
  const ling = lingkungan(tes);
  const dropdown = mountDropdown(ling, true);
  act(() => dropdown.nilai.setTerbuka(true));
  assert.equal(ling.hitung("mousedown"), 1);
  dropdown.update(false);
  assert.equal(dropdown.nilai.terbuka, false);
  assert.equal(ling.pendengar.size, 0);
  act(() => dropdown.nilai.setTerbuka(true));
  assert.equal(dropdown.nilai.terbuka, true);
  assert.equal(ling.pendengar.size, 0);
  dropdown.update(true);
  assert.equal(dropdown.nilai.terbuka, true);
  assert.equal(ling.hitung("mousedown"), 1);
  assert.equal(ling.hitung("keydown", true), 1);
  dropdown.update(false);
  assert.equal(dropdown.nilai.terbuka, false);
  assert.equal(ling.pendengar.size, 0);
});

test("an absent wrapper is treated as an outside click, and unmount removes every remaining listener", (tes) => {
  const ling = lingkungan(tes);
  const satu = mountDropdown(ling);
  const dua = mountDropdown(ling);
  act(() => { satu.nilai.setTerbuka(true); dua.nilai.setTerbuka(true); });
  assert.equal(ling.hitung("mousedown"), 2);
  assert.equal(ling.hitung("keydown", true), 2);
  satu.unmount();
  assert.equal(ling.hitung("mousedown"), 1);
  assert.equal(ling.hitung("keydown", true), 1);
  act(() => ling.kirim("mousedown", { target: {} }));
  assert.equal(dua.nilai.terbuka, false);
  assert.equal(ling.pendengar.size, 0);
  dua.unmount();
  assert.equal(ling.pendengar.size, 0);
});

test("real SelectDaftar consumes the panel context and dropdown behavior without changing its native or custom selection contract", (tes) => {
  const ling = lingkungan(tes);
  const muat = muatKomponen();
  const { PanelAktifContext } = muat("src/halaman/Analisa/konteks/panelAktif.js");
  const SelectDaftar = muat("src/halaman/Analisa/komponen/nav/SelectDaftar.jsx").default;
  const pilihan = [];
  const props = { labelTeks: "Kategori", dataUji: "kategori", nilai: 2,
    opsi: [{ nilai: 1, label: "Satu" }, { nilai: 2, label: "Dua" }], onPilih: (nilai) => pilihan.push(nilai) };
  const view = renderKomponen(ling, SelectDaftar, PanelAktifContext, props);
  const trigger = () => view.root.findByProps({ "aria-haspopup": "listbox" });
  assert.equal(trigger().props["aria-label"], "Kategori: Dua");
  assert.equal(trigger().props["aria-expanded"], false);
  const select = view.root.findByType("select");
  assert.equal(select.props["data-uji"], "kategori");
  assert.equal(select.props["aria-hidden"], "true");
  act(() => select.props.onChange({ target: { value: "1" } }));
  assert.deepEqual(pilihan, ["1"]);
  act(() => trigger().props.onClick({ detail: 1 }));
  const daftar = view.root.findByProps({ role: "listbox" });
  assert.equal(trigger().props["aria-expanded"], true);
  assert.equal(trigger().props["aria-controls"], daftar.props.id);
  const opsi = view.root.findAllByProps({ role: "option" });
  assert.deepEqual(opsi.map((node) => node.props["aria-selected"]), [false, true]);
  act(() => opsi[0].props.onClick());
  assert.deepEqual(pilihan, ["1", 1]);
  assert.equal(trigger().props["aria-expanded"], false);
  assert.deepEqual(view.item.fokus, ["pemicu"]);
  const panah = eventTombol("ArrowDown");
  act(() => trigger().props.onKeyDown(panah));
  assert.equal(panah.dicegah, 1);
  assert.equal(trigger().props["aria-expanded"], true);
  assert.deepEqual(view.item.fokus, ["pemicu", "opsi-1"]);
  view.update(false);
  assert.equal(trigger().props["aria-expanded"], false);
  assert.equal(ling.pendengar.size, 0);
});

test("real DropdownPilih keeps strict selection, fallback label, direction and focus behavior", (tes) => {
  const ling = lingkungan(tes);
  const muat = muatKomponen();
  const { PanelAktifContext } = muat("src/halaman/Analisa/konteks/panelAktif.js");
  const { DropdownPilih } = muat("src/halaman/Analisa/komponen/nav/database/tabelPartai.jsx");
  const pilihan = [];
  const props = { ariaLabel: "Periode", nilai: 2, opsi: [{ nilai: "1", label: "Satu" }, { nilai: "2", label: "Dua" }],
    onPilih: (nilai) => pilihan.push(nilai), sejajar: "kanan", keAtas: true };
  const view = renderKomponen(ling, DropdownPilih, PanelAktifContext, props);
  const trigger = () => view.root.findByProps({ "aria-haspopup": "listbox" });
  assert.equal(trigger().props["aria-label"], "Periode: Satu");
  act(() => trigger().props.onClick({ detail: 1 }));
  let daftar = view.root.findByProps({ role: "listbox" });
  assert.equal(trigger().props["aria-controls"], daftar.props.id);
  assert.match(daftar.parent.props.className, /bottom-full/);
  assert.match(daftar.parent.props.className, /right-0/);
  assert.deepEqual(view.root.findAllByProps({ role: "option" }).map((node) => node.props["aria-selected"]), [false, false]);
  view.update(true, { ...props, nilai: "2" });
  assert.equal(trigger().props["aria-label"], "Periode: Dua");
  assert.deepEqual(view.root.findAllByProps({ role: "option" }).map((node) => node.props["aria-selected"]), [false, true]);
  act(() => view.root.findAllByProps({ role: "option" })[0].props.onClick());
  assert.deepEqual(pilihan, ["1"]);
  assert.equal(trigger().props["aria-expanded"], false);
  assert.deepEqual(view.item.fokus, ["pemicu"]);
  view.update(true, { ...props, labelKhusus: "" });
  assert.equal(trigger().props["aria-label"], "Periode: ");
  act(() => trigger().props.onClick({ detail: 1 }));
  daftar = view.root.findByProps({ role: "listbox" });
  assert.equal(daftar.props["aria-label"], "Periode");
  view.update(false, { ...props, labelKhusus: "" });
  assert.equal(trigger().props["aria-expanded"], false);
  assert.equal(ling.pendengar.size, 0);
});

test("real MenuKolom uses the same dropdown lifecycle and reports its selected period", (tes) => {
  const ling = lingkungan(tes);
  const muat = muatKomponen();
  const { PanelAktifContext } = muat("src/halaman/Analisa/konteks/panelAktif.js");
  const { MenuKolom } = muat("src/halaman/Analisa/komponen/nav/database/tabelPartai.jsx");
  const pilihan = [];
  const props = { t: (key) => key, nilai: "bulanan", onPilih: (nilai) => pilihan.push(nilai) };
  const view = renderKomponen(ling, MenuKolom, PanelAktifContext, props);
  const trigger = () => view.root.findByProps({ "aria-haspopup": "listbox" });
  assert.equal(trigger().props["aria-expanded"], false);
  assert.equal(trigger().props["aria-label"], "analisa.basisData.kolom: analisa.basisData.periodeBulanan");
  act(() => trigger().props.onClick({ detail: 1 }));
  const daftar = view.root.findByProps({ role: "listbox" });
  assert.equal(trigger().props["aria-controls"], daftar.props.id);
  const opsi = view.root.findAllByProps({ role: "option" });
  assert.equal(opsi.length, 4);
  assert.deepEqual(opsi.map((node) => node.props["aria-selected"]), [false, true, false, false]);
  act(() => opsi[2].props.onClick());
  assert.deepEqual(pilihan, ["tahunan"]);
  assert.equal(trigger().props["aria-expanded"], false);
  assert.deepEqual(view.item.fokus, ["pemicu"]);
});
