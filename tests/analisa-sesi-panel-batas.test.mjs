import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import * as panelLama from "../src/halaman/Analisa/konteks/panelAktif.js";
import * as dropdownLama from "../src/halaman/Analisa/komponen/nav/useDropdown.js";
import * as fasad from "../src/modul/sesi/panel.js";
import * as panelImpl from "../src/modul/sesi/panelAktif.js";
import * as dropdownImpl from "../src/modul/sesi/useDropdown.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const { act } = TestRenderer;
const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(akar, "src");
const modul = resolve(src, "modul/sesi");
const ekstensi = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];
const namaPanel = ["PanelAktifContext"];
const namaDropdown = ["tekanPanahOpsi", "useDropdown"];
const namaPublik = [...namaPanel, ...namaDropdown].sort();
const pathPanelLama = "src/halaman/Analisa/konteks/panelAktif.js";
const pathDropdownLama = "src/halaman/Analisa/komponen/nav/useDropdown.js";

function berkasKode(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entri) => {
    const path = resolve(dir, entri.name);
    if (entri.isDirectory()) return berkasKode(path);
    return entri.isFile() && ekstensi.includes(extname(path)) ? [path] : [];
  });
}

function astBerkas(path) {
  return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
}

function referensi(path) {
  const hasil = [];
  function kunjungi(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (ts.isStringLiteralLike(node.moduleSpecifier)) hasil.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node)) {
      const impor = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const require = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (impor || require) {
        const argumen = node.arguments[0];
        assert.ok(argumen && ts.isStringLiteralLike(argumen), `Import nonliteral: ${relative(akar, path)}`);
        hasil.push(argumen.text);
      }
    }
    ts.forEachChild(node, kunjungi);
  }
  kunjungi(astBerkas(path));
  return hasil;
}

function tujuan(source, ref) {
  const bersih = ref.split(/[?#]/, 1)[0];
  let dasar;
  if (bersih.startsWith("@/")) dasar = resolve(src, bersih.slice(2));
  else if (bersih.startsWith(".")) dasar = resolve(dirname(source), bersih);
  else return null;
  const kandidat = [dasar, ...ekstensi.map((ext) => dasar + ext), ...ekstensi.map((ext) => resolve(dasar, `index${ext}`))];
  const ditemukan = kandidat.find((path) => existsSync(path) && statSync(path).isFile());
  assert.ok(ditemukan, `Import tidak terpecahkan: ${relative(akar, source)} -> ${ref}`);
  return ditemukan;
}

function grafDari(awal) {
  const antrean = [resolve(akar, awal)];
  const diperiksa = new Set();
  const paket = new Set();
  while (antrean.length) {
    const path = antrean.shift();
    if (diperiksa.has(path)) continue;
    diperiksa.add(path);
    for (const ref of referensi(path)) {
      const target = tujuan(path, ref);
      if (target === null) paket.add(ref);
      else {
        assert.ok(target.startsWith(modul + sep), `Keluar dari batas panel: ${relative(akar, path)} -> ${relative(akar, target)}`);
        antrean.push(target);
      }
    }
  }
  return { files: [...diperiksa].map((path) => relative(akar, path)).sort(), paket: [...paket].sort() };
}

test("native lightweight facade, original paths and implementations have exactly the same exported identities", () => {
  assert.deepEqual(Object.keys(panelLama), namaPanel);
  assert.deepEqual(Object.keys(panelImpl), namaPanel);
  assert.deepEqual(Object.keys(dropdownLama).sort(), namaDropdown);
  assert.deepEqual(Object.keys(dropdownImpl).sort(), namaDropdown);
  assert.deepEqual(Object.keys(fasad).sort(), namaPublik);
  for (const nama of namaPanel) {
    assert.strictEqual(panelLama[nama], panelImpl[nama]);
    assert.strictEqual(panelLama[nama], fasad[nama]);
  }
  for (const nama of namaDropdown) {
    assert.strictEqual(dropdownLama[nama], dropdownImpl[nama]);
    assert.strictEqual(dropdownLama[nama], fasad[nama]);
  }
  assert.strictEqual(panelLama.PanelAktifContext.Provider, fasad.PanelAktifContext.Provider);
  assert.strictEqual(panelLama.PanelAktifContext.Consumer, fasad.PanelAktifContext.Consumer);
});

test("the main facade, both compatibility paths and light facade share one context and hook registry", () => {
  // index.js mengekspos JSX; loader bercache menguji seluruh jalur dalam satu
  // registry tanpa menganggap instance CJS dan ESM native itu sama.
  const muat = buatPemuatJsx({
    "src/modul/pekerjaan/index.js": {
      KUNCI_FITUR: {}, ID_DRAF_IMPOR: "draf:impor", buatIdDrafImpor: () => "draf:uji",
      buatIdPekerjaan: () => "laporan:uji", pekerjaan: { snapshot: () => ({ daftar: [], aktif: { id: null } }) },
      simpanLaporanAktif: () => {},
    },
  });
  const lamaPanel = muat(pathPanelLama);
  const lamaDropdown = muat(pathDropdownLama);
  const ringan = muat("src/modul/sesi/panel.js");
  const utama = muat("src/modul/sesi/index.js");
  const implementasiPanel = muat("src/modul/sesi/panelAktif.js");
  const implementasiDropdown = muat("src/modul/sesi/useDropdown.js");
  assert.deepEqual(Object.keys(lamaPanel), namaPanel);
  assert.deepEqual(Object.keys(lamaDropdown).sort(), namaDropdown);
  assert.deepEqual(Object.keys(ringan).sort(), namaPublik);
  for (const nama of namaPanel) {
    assert.strictEqual(lamaPanel[nama], ringan[nama]);
    assert.strictEqual(utama[nama], ringan[nama]);
    assert.strictEqual(implementasiPanel[nama], ringan[nama]);
  }
  for (const nama of namaDropdown) {
    assert.strictEqual(lamaDropdown[nama], ringan[nama]);
    assert.strictEqual(utama[nama], ringan[nama]);
    assert.strictEqual(implementasiDropdown[nama], ringan[nama]);
  }
});

test("old and public hooks honor the same provider while retaining independent state and listener lifetimes", (tes) => {
  const sebelumnya = Object.getOwnPropertyDescriptor(globalThis, "document");
  const pendengar = new Map();
  const kunci = (jenis, capture) => `${jenis}:${Boolean(capture)}`;
  Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: {
    addEventListener(jenis, callback, capture) {
      const key = kunci(jenis, capture);
      if (!pendengar.has(key)) pendengar.set(key, new Set());
      pendengar.get(key).add(callback);
    },
    removeEventListener(jenis, callback, capture) {
      const key = kunci(jenis, capture);
      pendengar.get(key)?.delete(callback);
      if (pendengar.get(key)?.size === 0) pendengar.delete(key);
    },
    querySelector: () => null,
  } });
  let renderer;
  tes.after(() => {
    if (renderer) act(() => renderer.unmount());
    if (sebelumnya) Object.defineProperty(globalThis, "document", sebelumnya);
    else delete globalThis.document;
  });
  let lama;
  let publik;
  function Probe() { lama = dropdownLama.useDropdown(); publik = fasad.useDropdown(); return null; }
  const pohon = (Context, aktif) => React.createElement(Context.Provider, { value: aktif }, React.createElement(Probe));
  act(() => { renderer = TestRenderer.create(pohon(panelLama.PanelAktifContext, false)); });
  assert.notEqual(lama.idDaftar, publik.idDaftar);
  act(() => { lama.setTerbuka(true); publik.setTerbuka(true); });
  assert.equal(lama.terbuka, true);
  assert.equal(publik.terbuka, true);
  assert.equal(pendengar.size, 0);
  act(() => renderer.update(pohon(fasad.PanelAktifContext, true)));
  assert.equal(pendengar.get("mousedown:false").size, 2);
  assert.equal(pendengar.get("keydown:true").size, 2);
  act(() => lama.setTerbuka(false));
  assert.equal(lama.terbuka, false);
  assert.equal(publik.terbuka, true);
  assert.equal(pendengar.get("mousedown:false").size, 1);
  act(() => renderer.update(pohon(panelLama.PanelAktifContext, false)));
  assert.equal(publik.terbuka, false);
  assert.equal(pendengar.size, 0);
});

test("the two old paths are direct named re-exports of exactly their original APIs", () => {
  const paths = [
    [pathPanelLama, "src/modul/sesi/panelAktif.js", namaPanel],
    [pathDropdownLama, "src/modul/sesi/useDropdown.js", namaDropdown],
  ];
  for (const [file, target, names] of paths) {
    const path = resolve(akar, file);
    const statements = astBerkas(path).statements;
    assert.equal(statements.length, 1, file);
    const declaration = statements[0];
    assert.ok(ts.isExportDeclaration(declaration), file);
    assert.equal(tujuan(path, declaration.moduleSpecifier.text), resolve(akar, target), file);
    assert.ok(declaration.exportClause && ts.isNamedExports(declaration.exportClause), file);
    assert.deepEqual(declaration.exportClause.elements.map((element) => element.name.text).sort(), [...names].sort(), file);
  }
});

test("panel and dropdown light paths load only their implementations and React, with no JSX or Pekerjaan", () => {
  const panel = "src/modul/sesi/panelAktif.js";
  const dropdown = "src/modul/sesi/useDropdown.js";
  for (const [awal, internal] of [
    ["src/modul/sesi/panel.js", [panel, dropdown]],
    [pathPanelLama, [panel]],
    [pathDropdownLama, [panel, dropdown]],
  ]) {
    const hasil = grafDari(awal);
    assert.deepEqual(hasil.files, [awal, ...internal].sort(), awal);
    assert.deepEqual(hasil.paket, ["react"], awal);
    assert.ok(hasil.files.every((file) => extname(file) === ".js"), awal);
  }
});

test("the panel context, dropdown hook and key helper each have one source definition", () => {
  const definisi = { PanelAktifContext: [], useDropdown: [], tekanPanahOpsi: [] };
  for (const path of berkasKode(src)) {
    function kunjungi(node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "PanelAktifContext") {
        definisi.PanelAktifContext.push(relative(akar, path));
      }
      if (ts.isFunctionDeclaration(node) && node.name && Object.hasOwn(definisi, node.name.text)) {
        definisi[node.name.text].push(relative(akar, path));
      }
      ts.forEachChild(node, kunjungi);
    }
    kunjungi(astBerkas(path));
  }
  assert.deepEqual(definisi, {
    PanelAktifContext: ["src/modul/sesi/panelAktif.js"],
    useDropdown: ["src/modul/sesi/useDropdown.js"],
    tekanPanahOpsi: ["src/modul/sesi/useDropdown.js"],
  });
});

test("all three mapped application consumers import the exact named API from the lightweight facade", () => {
  const entry = resolve(modul, "panel.js");
  const konsumen = [
    ["src/halaman/Analisa/komponen/areaKerja.jsx", namaPanel],
    ["src/halaman/Analisa/komponen/nav/SelectDaftar.jsx", namaDropdown],
    ["src/halaman/Analisa/komponen/nav/database/tabelPartai.jsx", namaDropdown],
  ];
  for (const [file, names] of konsumen) {
    const path = resolve(akar, file);
    const imports = astBerkas(path).statements.filter((node) =>
      ts.isImportDeclaration(node) && node.moduleSpecifier && tujuan(path, node.moduleSpecifier.text) === entry);
    assert.equal(imports.length, 1, file);
    const binding = imports[0].importClause?.namedBindings;
    assert.ok(binding && ts.isNamedImports(binding), file);
    assert.deepEqual(binding.elements.map((element) => (element.propertyName ?? element.name).text).sort(), [...names].sort(), file);
  }
});

test("no source imports the legacy panel paths, and external callers cannot bypass the public panel facade", () => {
  const legacy = new Set([resolve(akar, pathPanelLama), resolve(akar, pathDropdownLama)]);
  const internal = new Set([resolve(modul, "panelAktif.js"), resolve(modul, "useDropdown.js")]);
  const konsumen = [];
  for (const source of berkasKode(src)) {
    for (const ref of referensi(source)) {
      const target = tujuan(source, ref);
      if (!target) continue;
      assert.equal(legacy.has(target), false, `Pemanggil memakai path lama: ${relative(akar, source)} -> ${ref}`);
      if (internal.has(target) && !source.startsWith(modul + sep)) {
        assert.ok(legacy.has(source), `Pemanggil melewati fasad: ${relative(akar, source)} -> ${ref}`);
      }
      if (target === resolve(modul, "panel.js") && !source.startsWith(modul + sep)) konsumen.push(relative(akar, source));
    }
  }
  assert.deepEqual(konsumen.sort(), [
    "src/halaman/Analisa/komponen/areaKerja.jsx",
    "src/halaman/Analisa/komponen/nav/SelectDaftar.jsx",
    "src/halaman/Analisa/komponen/nav/database/tabelPartai.jsx",
  ].sort());
});
