import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import { analisa as indonesia } from "../src/lib/terjemahan/id/analisa.js";
import { analisa as english } from "../src/lib/terjemahan/en/analisa.js";
import { daftarRiwayat, KUNCI_FITUR } from "../src/halaman/Analisa/riwayatFitur.js";

// Node's test runner cannot import JSX directly. Compile the two UI components
// and substitute only the storage/i18n boundaries.
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
    if (id === "react" || id === "react/jsx-runtime" || id === "lucide-react") return nodeRequire(id);
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected dashboard dependency: ${id}`);
  }, compiledModule, compiledModule.exports);
  return compiledModule.exports.default;
}

function renderPapan(dictionary, handlers = {}, work = { siap: true, tersedia: true, menyimpan: false, daftar: [], aktif: {} }) {
  const translate = (key) => key.split(".").reduce((value, part) => value?.[part], { analisa: dictionary }) ?? key;
  const i18n = { useI18n: () => ({ t: translate, bahasa: dictionary === english ? "en" : "id" }) };
  const Daftar = compile("../src/halaman/Analisa/komponen/nav/daftarPekerjaan.jsx", {
    "../../../../lib/i18n.jsx": i18n,
    "../../riwayatFitur.js": { daftarRiwayat, KUNCI_FITUR },
    "../../usePekerjaan.js": { usePekerjaan: () => work },
  });
  const Papan = compile("../src/halaman/Analisa/komponen/nav/layarPapan.jsx", {
    "./PanelLayar.jsx": { default: ({ children }) => React.createElement("section", null, children) },
    "./daftarPekerjaan.jsx": { default: Daftar },
    "../../../../lib/i18n.jsx": i18n,
  });
  return TestRenderer.create(React.createElement(Papan, handlers));
}

function byTestId(renderer, id) {
  return renderer.root.find((node) => node.props["data-uji"] === id);
}

function item(renderer, id) {
  return renderer.root.find((node) => node.props["data-pekerjaan-id"] === id);
}

function text(node) {
  return node.children.map((child) => typeof child === "string" ? child : text(child)).join(" ");
}

test("dashboard has one report button and opens recent features or saved work", () => {
  const calls = [];
  const work = {
    siap: true, tersedia: true, menyimpan: false,
    aktif: { id: "running", digunakan: true, berjalan: true },
    daftar: [
      { id: "draft", jenis: "draf", status: "draf", waktu: 1 },
      { id: "done", jenis: "laporan", status: "selesai", judul: "Alice vs Bob", adaHasil: true, waktu: 2 },
      { id: "interrupted", jenis: "laporan", status: "berjalan", judul: "Carol vs Dan", adaHasil: false, waktu: 3 },
      { id: "previous", jenis: "laporan", status: "terputus", judul: "Eve vs Fox", adaHasil: true, waktu: 4 },
      { id: "running", jenis: "laporan", status: "berjalan", judul: "Gina vs Han", adaHasil: false, waktu: 5 },
      { id: "fitur:akun", jenis: "fitur", fitur: "akun", waktu: 6 },
    ],
  };
  const renderer = renderPapan(indonesia, {
    onReport: () => calls.push("report"),
    onImpor: () => calls.push("impor"),
    onBukaPekerjaan: (record) => calls.push(`buka:${record.id}`),
  }, work);
  const cards = renderer.root.findAll((node) => node.props["data-uji"]?.startsWith("papan-kartu-"));
  assert.equal(cards.length, 6);
  const report = byTestId(renderer, "papan-kartu-report");
  assert.equal(report.findByType("h2").children.join(""), "Report Analisa");
  assert.equal(report.findAllByType("button").length, 1);
  assert.match(text(byTestId(renderer, "pekerjaan-daftar")), /File Terbaru/);
  assert.match(text(item(renderer, "fitur:akun")), /Akun/);
  assert.match(text(item(renderer, "interrupted")), /Terputus/);
  assert.match(text(item(renderer, "previous")), /Terputus/);
  const previousOpen = item(renderer, "previous").find((node) => node.props["data-uji"] === "pekerjaan-buka");
  assert.match(previousOpen.props["aria-label"], /hasil sebelumnya tersedia/);
  assert.match(text(item(renderer, "running")), /Proses/);
  assert.equal(item(renderer, "previous").findAllByType("button").length, 1);

  TestRenderer.act(() => {
    byTestId(renderer, "papan-tombol-report").props.onClick();
    byTestId(renderer, "papan-tombol-impor").props.onClick();
    for (const id of ["draft", "done", "interrupted", "previous", "running", "fitur:akun"]) {
      item(renderer, id).find((node) => node.props["data-uji"] === "pekerjaan-buka").props.onClick();
    }
  });
  assert.deepEqual(calls, ["report", "impor", "buka:draft", "buka:done", "buka:interrupted", "buka:previous", "buka:running", "buka:fitur:akun"]);
  for (const key of ["main", "analisa", "repertoar", "puzzle"]) {
    assert.equal(byTestId(renderer, `papan-tombol-${key}`).props.disabled, true);
  }
  renderer.unmount();
});

test("dashboard and board controls retain Indonesian and English labels", () => {
  for (const [dictionary, title, button, recent, flip, settings, promotion] of [
    [indonesia, "Report Analisa", "Buka laporan", "File Terbaru", "Balik papan", "Pengaturan", "Pilih bidak promosi"],
    [english, "Analysis Report", "View report", "Recent Files", "Flip board", "Settings", "Choose promotion piece"],
  ]) {
    const renderer = renderPapan(dictionary);
    assert.equal(byTestId(renderer, "papan-kartu-report").findByType("h2").children.join(""), title);
    assert.equal(byTestId(renderer, "papan-tombol-report").children.join(""), button);
    assert.equal(byTestId(renderer, "pekerjaan-daftar").findByType("h2").children.join(""), recent);
    assert.equal(dictionary.papan.balik, flip);
    assert.equal(dictionary.papan.pengaturan, settings);
    assert.equal(dictionary.papan.promosi, promotion);
    renderer.unmount();
  }
});

test("recent files use the original compact panel and empty state without explanatory copy", () => {
  const renderer = renderPapan(indonesia);
  const panel = byTestId(renderer, "pekerjaan-daftar");
  assert.match(panel.props.className, /rounded-lg border border-border bg-backgroundBoxBox p-4/);
  assert.match(text(panel), /Belum ada file yang dibuka/);
  assert.doesNotMatch(text(panel), /Laporan dan draf disimpan otomatis/);
  assert.doesNotMatch(text(panel), /Impor partai atau mulai laporan/);
  assert.equal(byTestId(renderer, "pekerjaan-lihat-semua").props.disabled, true);
  assert.equal(byTestId(renderer, "pekerjaan-status").props.className, "sr-only");
  renderer.unmount();
});

test("stored feature names follow the current language", () => {
  const work = {
    siap: true, tersedia: true, menyimpan: false, aktif: {},
    daftar: [{ id: "fitur:pengaturan", jenis: "fitur", fitur: "pengaturan", waktu: Date.now() }],
  };
  for (const [dictionary, label] of [[indonesia, "Pengaturan"], [english, "Settings"]]) {
    const renderer = renderPapan(dictionary, {}, work);
    assert.match(text(item(renderer, "fitur:pengaturan")), new RegExp(label));
    renderer.unmount();
  }
});

test("recent files retain the same height and scroll vertically when populated", () => {
  const empty = renderPapan(indonesia);
  const emptyPanel = byTestId(empty, "pekerjaan-daftar");
  assert.ok(emptyPanel.findAllByType("div").some((node) => node.props.className?.includes("h-[200px]")));
  empty.unmount();

  const work = {
    siap: true, tersedia: true, menyimpan: false, aktif: {},
    daftar: [{ id: "fitur:akun", jenis: "fitur", fitur: "akun", waktu: Date.now() }],
  };
  const populated = renderPapan(indonesia, {}, work);
  const scroll = byTestId(populated, "pekerjaan-scroll");
  assert.match(scroll.props.className, /h-\[200px\].*overflow-y-auto/);
  assert.equal(scroll.props.role, "region");
  assert.equal(scroll.props.tabIndex, 0);
  assert.equal(scroll.props["aria-labelledby"], "judul-pekerjaan");
  populated.unmount();
});

test("compact timestamps keep the full relative time accessible in both languages", () => {
  const waktu = Date.now() - 2 * 60 * 60 * 1000;
  const work = {
    siap: true, tersedia: true, menyimpan: false, aktif: {},
    daftar: [{ id: "previous", jenis: "laporan", status: "terputus", judul: "Alice vs Bob", adaHasil: true, waktu }],
  };
  for (const [dictionary, singkat, lengkap, status] of [
    [indonesia, "2j", "2 jam yang lalu", "Analisis terputus · hasil sebelumnya tersedia"],
    [english, "2h", "2 hours ago", "Analysis interrupted · previous result available"],
  ]) {
    const renderer = renderPapan(dictionary, {}, work);
    const row = item(renderer, "previous");
    const open = row.find((node) => node.props["data-uji"] === "pekerjaan-buka");
    assert.ok(open.props["aria-label"].includes(status));
    assert.ok(open.props["aria-label"].includes(lengkap));
    const time = row.findByType("time");
    assert.equal(time.props.dateTime, new Date(waktu).toISOString());
    const [mobile, desktop] = time.findAllByType("span");
    assert.equal(mobile.children.join(""), singkat);
    assert.match(mobile.props.className, /sm:hidden/);
    assert.equal(desktop.children.join(""), lengkap);
    assert.match(desktop.props.className, /hidden sm:inline/);
    renderer.unmount();
  }
});

test("recent-file timestamps reuse Intl formatters across rows and rerenders", () => {
  const tanggalAsli = Intl.DateTimeFormat;
  const relatifAsli = Intl.RelativeTimeFormat;
  let tanggalDibuat = 0;
  let relatifDibuat = 0;
  Intl.DateTimeFormat = function (...args) { tanggalDibuat++; return new tanggalAsli(...args); };
  Intl.RelativeTimeFormat = function (...args) { relatifDibuat++; return new relatifAsli(...args); };
  let renderer;
  try {
    const work = {
      siap: true, tersedia: true, menyimpan: false, aktif: {},
      daftar: Array.from({ length: 12 }, (_, n) => ({
        id: `draf-${n}`, jenis: "draf", status: "draf", waktu: Date.now() - n * 60000,
      })),
    };
    renderer = renderPapan(indonesia, {}, work);
    assert.equal(tanggalDibuat, 1);
    assert.equal(relatifDibuat, 1);
    TestRenderer.act(() => byTestId(renderer, "pekerjaan-lihat-semua").props.onClick());
    TestRenderer.act(() => byTestId(renderer, "pekerjaan-lihat-semua").props.onClick());
    assert.equal(tanggalDibuat, 1);
    assert.equal(relatifDibuat, 1);
  } finally {
    renderer?.unmount();
    Intl.DateTimeFormat = tanggalAsli;
    Intl.RelativeTimeFormat = relatifAsli;
  }
});

test("see all expands only the work history, including entries beyond the first ten", () => {
  const work = {
    siap: true, tersedia: true, menyimpan: false, aktif: {},
    daftar: Array.from({ length: 12 }, (_, n) => ({ id: `item-${n}`, jenis: "draf", status: "draf", judul: `Draft ${n}`, waktu: n + 1 })),
  };
  const renderer = renderPapan(indonesia, {}, work);
  const rows = () => renderer.root.findAll((node) => node.props["data-uji"] === "pekerjaan-item");
  assert.equal(rows().length, 10);
  assert.equal(byTestId(renderer, "pekerjaan-lihat-semua").props.disabled, false);
  TestRenderer.act(() => byTestId(renderer, "pekerjaan-lihat-semua").props.onClick());
  assert.equal(rows().length, 12);
  assert.equal(byTestId(renderer, "pekerjaan-lihat-semua").props["aria-expanded"], true);
  assert.equal(byTestId(renderer, "pekerjaan-lihat-semua").children.join(""), "Lihat lebih sedikit");
  TestRenderer.act(() => byTestId(renderer, "pekerjaan-lihat-semua").props.onClick());
  assert.equal(rows().length, 10);
  renderer.unmount();
});
