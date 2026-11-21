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

test("dashboard has six cards, a separate new action, and a usable recent-work list", () => {
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
    ],
  };
  const renderer = renderPapan(indonesia, {
    onReport: () => calls.push("report"),
    onBaru: () => calls.push("baru"),
    onImpor: () => calls.push("impor"),
    onBukaPekerjaan: (record) => calls.push(`buka:${record.id}`),
    onUlangPekerjaan: (record) => calls.push(`ulang:${record.id}`),
  }, work);
  const cards = renderer.root.findAll((node) => node.props["data-uji"]?.startsWith("papan-kartu-"));
  assert.equal(cards.length, 6);
  assert.equal(byTestId(renderer, "papan-kartu-report").findByType("h2").children.join(""), "Report Analisa");
  assert.match(text(byTestId(renderer, "pekerjaan-daftar")), /File Terbaru/);
  assert.match(text(item(renderer, "interrupted")), /Terputus/);
  assert.match(text(item(renderer, "previous")), /Terputus/);
  const previousOpen = item(renderer, "previous").find((node) => node.props["data-uji"] === "pekerjaan-buka");
  assert.match(previousOpen.props["aria-label"], /hasil sebelumnya tersedia/);
  assert.match(text(item(renderer, "running")), /Proses/);
  // Each row remains compact; interrupted results have a labelled retry icon.
  assert.match(item(renderer, "previous").props.className, /\bflex\b.*\bitems-center\b/);
  assert.match(item(renderer, "previous").find((node) => node.props["data-uji"] === "pekerjaan-ulang").props["aria-label"], /Analisis ulang/);

  TestRenderer.act(() => {
    byTestId(renderer, "papan-tombol-report").props.onClick();
    byTestId(renderer, "papan-tombol-baru").props.onClick();
    byTestId(renderer, "papan-tombol-impor").props.onClick();
    for (const id of ["draft", "done", "interrupted", "previous", "running"]) {
      item(renderer, id).find((node) => node.props["data-uji"] === "pekerjaan-buka").props.onClick();
    }
    item(renderer, "previous").find((node) => node.props["data-uji"] === "pekerjaan-ulang").props.onClick();
  });
  assert.deepEqual(calls, ["report", "baru", "impor", "buka:draft", "buka:done", "buka:interrupted", "buka:previous", "buka:running", "ulang:previous"]);
  for (const key of ["main", "analisa", "repertoar", "puzzle"]) {
    assert.equal(byTestId(renderer, `papan-tombol-${key}`).props.disabled, true);
  }
  renderer.unmount();
});

test("dashboard and board controls retain Indonesian and English labels", () => {
  for (const [dictionary, title, button, recent, fresh, flip, settings, promotion] of [
    [indonesia, "Report Analisa", "Buka laporan", "File Terbaru", "Mulai baru", "Balik papan", "Pengaturan", "Pilih bidak promosi"],
    [english, "Analysis Report", "View report", "Recent Files", "Start new", "Flip board", "Settings", "Choose promotion piece"],
  ]) {
    const renderer = renderPapan(dictionary, { onBaru: () => {} });
    assert.equal(byTestId(renderer, "papan-kartu-report").findByType("h2").children.join(""), title);
    assert.equal(byTestId(renderer, "papan-tombol-report").children.join(""), button);
    assert.equal(byTestId(renderer, "papan-tombol-baru").children.join(""), fresh);
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
