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
const TautanUji = React.forwardRef(function TautanUji(props, ref) {
  return React.createElement("a", { ...props, ref });
});

function compile(path, dependencies, exportName = "default") {
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
  return compiledModule.exports[exportName];
}

function renderPapan(dictionary, handlers = {}, work = { siap: true, tersedia: true, menyimpan: false, daftar: [], aktif: {} }) {
  const translate = (key) => key.split(".").reduce((value, part) => value?.[part], { analisa: dictionary }) ?? key;
  const i18n = { useI18n: () => ({ t: translate, bahasa: dictionary === english ? "en" : "id" }) };
  const Daftar = compile("../src/halaman/Analisa/komponen/nav/daftarPekerjaan.jsx", {
    "../../../../lib/i18n.jsx": i18n,
    "../../../../modul/pekerjaan/index.js": { daftarRiwayat, KUNCI_FITUR, usePekerjaan: () => work },
  });
  const Papan = compile("../src/halaman/Analisa/komponen/nav/layarPapan.jsx", {
    "./PanelLayar.jsx": { default: ({ children }) => React.createElement("section", null, children) },
    "./daftarPekerjaan.jsx": { default: Daftar },
    "../../../../lib/i18n.jsx": i18n,
  });
  return TestRenderer.create(React.createElement(Papan, handlers));
}

function renderNav(dictionary, penyimpanan = { bacaBoolean: (_key, fallback) => fallback, tulisBoolean: () => {} }, onTampilan = () => {}, onBukaPapan = () => {}, tampilan = "papan") {
  const translate = (key) => key.split(".").reduce((value, part) => value?.[part], { analisa: dictionary }) ?? key;
  const svg = { default: () => React.createElement("svg") };
  const Nav = compile("../src/halaman/Analisa/komponen/nav/nav.jsx", {
    "next/link": { default: TautanUji },
    "../../../../lib/repo.js": { URL_REPO: "https://github.com/Delta-Polder-Indonesia/Maestro-Chess" },
    "../svg/github.jsx": svg,
    "../svg/license.jsx": svg,
    "../svg/profile.jsx": svg,
    "../../konteks/analyzeKonteks.js": { TAMPILAN_ANALISA: { PAPAN: "papan", BERMAIN: "bermain", AKUN: "akun", BASIS_DATA: "database", ENGINE: "engine", IMPOR: "impor", DETEKSI_ENGINE: "deteksi-engine", WAWASAN: "wawasan", PENGATURAN: "pengaturan" } },
    "../../konteks/boardKonteks.js": { useTampilan: () => [tampilan, onTampilan] },
    "@/modul/sesi/index.js": { useTabKerja: () => ({ bukaImpor() {}, bukaPapan: onBukaPapan, perluPulih: false }) },
    "../../../../lib/i18n.jsx": { useI18n: () => ({ t: translate }) },
    "../../../../components/ui/tooltip.jsx": { TooltipLabel: ({ children }) => children },
    "../../konstanta.js": { navTop: 516 },
    "../../../../modul/sesi/preferensi.js": penyimpanan,
  });
  return TestRenderer.create(React.createElement(Nav));
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

function description(row, button) {
  const id = button.props["aria-describedby"];
  assert.ok(id, "the detailed information must describe its button");
  const matches = row.findAll((node) => node.props.id === id);
  assert.equal(matches.length, 1);
  return matches[0];
}

test("navigation wordmark keeps the visible brand in its accessible name in both languages", () => {
  for (const [dictionary, name] of [[indonesia, "Maestro Chess — Beranda"], [english, "Maestro Chess — Home"]]) {
    const renderer = renderNav(dictionary);
    const link = renderer.root.findAllByType("a").find((node) => node.props.href === "/");
    assert.ok(link);
    assert.equal(link.props["aria-label"], name);
    assert.match(text(link), /Maestro\s+Chess/);
    assert.match(link.findByType("span").props.className, /hidden navTop:block/);
    TestRenderer.act(() => byTestId(renderer, "nav-tutup").props.onClick());
    assert.equal(link.props["aria-label"], name);
    renderer.unmount();
  }
});

test("navigation saves the user's choice and exposes clear toggle labels in both languages", () => {
  for (const [dictionary, tutup, buka] of [
    [indonesia, "Perkecil bilah navigasi", "Perluas bilah navigasi"],
    [english, "Collapse navigation", "Expand navigation"],
  ]) {
    let tersimpan;
    const storage = {
      bacaBoolean: (_key, fallback) => tersimpan ?? fallback,
      tulisBoolean: (key, value) => { assert.equal(key, "navTerbuka"); tersimpan = value; },
    };
    let renderer;
    TestRenderer.act(() => { renderer = renderNav(dictionary, storage); });
    const toggle = () => byTestId(renderer, "nav-tutup");
    assert.equal(toggle().props["aria-label"], tutup);
    assert.equal(toggle().props["aria-expanded"], true);
    TestRenderer.act(() => { toggle().props.onClick(); });
    assert.equal(toggle().props["aria-label"], buka);
    assert.equal(toggle().props["aria-expanded"], false);
    assert.equal(tersimpan, false);
    assert.match(byTestId(renderer, "nav-akun").props.className, /navTop:gap-0/);
    assert.match(byTestId(renderer, "nav-akun").props.className, /navTop:px-\[7px\]/);
    TestRenderer.act(() => { renderer.unmount(); renderer = renderNav(dictionary, storage); });
    assert.equal(toggle().props["aria-expanded"], false, "the collapsed choice survives remount");
    TestRenderer.act(() => { toggle().props.onClick(); toggle().props.onClick(); toggle().props.onClick(); });
    assert.equal(toggle().props["aria-expanded"], true, "batched clicks use the latest state");
    assert.equal(tersimpan, true);
    TestRenderer.act(() => renderer.unmount());
  }
});

test("navigation places Engine between database and settings with the requested chip icon", () => {
  const lintas = [];
  const renderer = renderNav(english, undefined, (tampilan) => lintas.push(tampilan));
  const tombol = renderer.root.findAll((node) => typeof node.props["data-uji"] === "string" && node.props["data-uji"].startsWith("nav-") && node.props["data-uji"] !== "nav-tutup");
  assert.deepEqual(
    tombol.map((node) => node.props["data-uji"]),
    ["nav-papan", "nav-akun", "nav-database", "nav-engine", "nav-pengaturan"],
  );
  const engine = byTestId(renderer, "nav-engine");
  assert.equal(engine.props["aria-label"], "Engine");
  const ikon = engine.findByType("svg");
  assert.equal(ikon.props.width, 18);
  assert.equal(ikon.props.height, 18);
  assert.equal(
    ikon.findByType("path").props.d,
    "M9,15V9h6v6H9Zm2-2h2V11H11v2ZM9,21V19H7q-0.82,0-1.41-0.59T5,17V15H3V13H5V11H3V9H5V7Q5,6.18 5.59,5.59T7,5H9V3h2V5h2V3h2V5h2q0.82,0 1.41,0.59Q19,6.18 19,7V9h2v2H19v2h2v2H19v2q0,0.82-0.59,1.41T17,19H15v2H13V19H11v2H9Zm8-4V7H7V17H17Zm-5-5Z",
  );
  TestRenderer.act(() => engine.props.onClick());
  assert.deepEqual(lintas, ["engine"]);
  renderer.unmount();
});

test("board navigation returns to the saved workspace instead of resetting it", () => {
  const tujuan = [];
  const renderer = renderNav(english, undefined, (layar) => tujuan.push(layar), () => tujuan.push("buka-papan"));
  TestRenderer.act(() => byTestId(renderer, "nav-papan").props.onClick());
  assert.deepEqual(tujuan, ["buka-papan"]);
  TestRenderer.act(() => byTestId(renderer, "nav-pengaturan").props.onClick());
  assert.deepEqual(tujuan, ["buka-papan", "pengaturan"]);
  renderer.unmount();
  const laporan = renderNav(english, undefined, undefined, undefined, "bermain");
  assert.equal(byTestId(laporan, "nav-papan").props["aria-current"], "true");
  assert.equal(byTestId(laporan, "nav-pengaturan").props["aria-current"], undefined);
  laporan.unmount();
});

test("navigation keeps only the home link; source and attributions live in settings", () => {
  const renderer = renderNav(english);
  const href = renderer.root.findAllByType("a").map((node) => node.props.href);
  assert.deepEqual(href, ["/"]);
  renderer.unmount();
});

test("a stable tooltip keeps its trigger mounted and only describes a visible label", () => {
  const pembungkus = ({ children }) => children;
  const Root = ({ children }) => children;
  const Trigger = ({ children }) => children;
  const TooltipLabel = compile("../src/components/ui/tooltip.jsx", {
    "@radix-ui/react-tooltip": {
      Provider: pembungkus, Root, Trigger,
      Portal: pembungkus, Content: pembungkus, Arrow: () => null,
    },
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
  }, "TooltipLabel");
  let mounts = 0;
  let unmounts = 0;
  function Tombol() {
    React.useEffect(() => { mounts++; return () => { unmounts++; }; }, []);
    return React.createElement("button", { "data-uji": "tooltip-trigger-test" });
  }
  const buat = (label) => React.createElement(TooltipLabel, { label, stabil: true }, React.createElement(Tombol));
  let renderer;
  TestRenderer.act(() => { renderer = TestRenderer.create(buat(undefined)); });
  const tombol = byTestId(renderer, "tooltip-trigger-test");
  const root = () => renderer.root.findByType(Root);
  assert.equal(root().props.open, false);
  TestRenderer.act(() => renderer.root.findByType(Trigger).props.onFocus());
  TestRenderer.act(() => renderer.update(buat("Akun")));
  assert.equal(byTestId(renderer, "tooltip-trigger-test"), tombol);
  assert.equal(root().props.open, true, "a newly visible label describes the still-focused control");
  TestRenderer.act(() => root().props.onOpenChange(false));
  assert.equal(root().props.open, false, "Escape may close the tooltip without moving focus");
  TestRenderer.act(() => renderer.update(buat(undefined)));
  assert.equal(root().props.open, false);
  assert.equal(byTestId(renderer, "tooltip-trigger-test"), tombol);
  assert.equal(mounts, 1);
  assert.equal(unmounts, 0);
  TestRenderer.act(() => renderer.unmount());
  assert.equal(unmounts, 1);
});

test("tooltips remain usable without ResizeObserver by omitting the measured arrow", (t) => {
  const sebelumnya = globalThis.ResizeObserver;
  t.after(() => { if (sebelumnya === undefined) delete globalThis.ResizeObserver; else globalThis.ResizeObserver = sebelumnya; });
  const pembungkus = ({ children }) => children;
  const Arrow = () => null;
  const TooltipContent = compile("../src/components/ui/tooltip.jsx", {
    "@radix-ui/react-tooltip": { Portal: pembungkus, Content: pembungkus, Arrow },
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
  }, "TooltipContent");
  globalThis.ResizeObserver = undefined;
  let renderer;
  TestRenderer.act(() => { renderer = TestRenderer.create(React.createElement(TooltipContent, null, "Akun")); });
  assert.equal(renderer.root.findAllByType(Arrow).length, 0);
  globalThis.ResizeObserver = class {};
  TestRenderer.act(() => renderer.update(React.createElement(TooltipContent, null, "Akun")));
  assert.equal(renderer.root.findAllByType(Arrow).length, 1);
  TestRenderer.act(() => renderer.unmount());
});

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
    onDeteksiEngine: () => calls.push("deteksi-engine"),
    onWawasan: () => calls.push("wawasan"),
    onBukaPekerjaan: (record) => calls.push(`buka:${record.id}`),
  }, work);
  const cards = renderer.root.findAll((node) => node.props["data-uji"]?.startsWith("papan-kartu-"));
  assert.equal(cards.length, 8);
  const grid = renderer.root.findAll((node) => typeof node.props.className === "string" && /grid grid-cols-1.*xl:grid-cols-5/.test(node.props.className));
  assert.equal(grid.length, 1);
  const report = byTestId(renderer, "papan-kartu-report");
  assert.equal(report.findByType("h2").children.join(""), "Report Analisa");
  assert.equal(report.findAllByType("button").length, 1);
  assert.match(text(byTestId(renderer, "pekerjaan-daftar")), /File Terbaru/);
  assert.match(text(item(renderer, "fitur:akun")), /Akun/);
  assert.match(text(item(renderer, "interrupted")), /Terputus/);
  assert.match(text(item(renderer, "previous")), /Terputus/);
  const previousRow = item(renderer, "previous");
  const previousOpen = previousRow.find((node) => node.props["data-uji"] === "pekerjaan-buka");
  assert.match(text(description(previousRow, previousOpen)), /hasil sebelumnya tersedia/);
  assert.match(text(item(renderer, "running")), /Proses/);
  assert.equal(item(renderer, "previous").findAllByType("button").length, 1);

  TestRenderer.act(() => {
    byTestId(renderer, "papan-tombol-report").props.onClick();
    byTestId(renderer, "papan-tombol-impor").props.onClick();
    byTestId(renderer, "papan-tombol-deteksi-engine").props.onClick();
    byTestId(renderer, "papan-tombol-wawasan").props.onClick();
    for (const id of ["draft", "done", "interrupted", "previous", "running", "fitur:akun"]) {
      item(renderer, id).find((node) => node.props["data-uji"] === "pekerjaan-buka").props.onClick();
    }
  });
  assert.deepEqual(calls, ["report", "impor", "deteksi-engine", "wawasan", "buka:draft", "buka:done", "buka:interrupted", "buka:previous", "buka:running", "buka:fitur:akun"]);
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
  assert.match(panel.props.className, /rounded-\[6px\] border-2 border-border bg-backgroundBoxBox p-4/);
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

test("recent-file names come from their visible content and details use unique descriptions", () => {
  const waktu = Date.now() - 9 * 60 * 1000;
  const work = {
    siap: true, tersedia: true, menyimpan: false, aktif: {},
    daftar: [
      { id: "fitur:pengaturan", jenis: "fitur", fitur: "pengaturan", waktu },
      { id: "fitur:wawasan", jenis: "fitur", fitur: "wawasan", waktu },
      { id: "fitur:akun", jenis: "fitur", fitur: "akun", waktu: 0 },
      { id: "laporan:tanpa-waktu", jenis: "laporan", status: "baru", waktu: 0 },
    ],
  };
  for (const [dictionary, prefix, judul] of [
    [indonesia, "Buka: ", ["Pengaturan", "Wawasan"]],
    [english, "Open: ", ["Settings", "Insights"]],
  ]) {
    const renderer = renderPapan(dictionary, {}, work);
    const ids = [];
    for (const [index, key] of ["fitur:pengaturan", "fitur:wawasan"].entries()) {
      const row = item(renderer, key);
      const open = row.findByProps({ "data-uji": "pekerjaan-buka" });
      assert.equal(open.props["aria-label"], undefined);
      assert.equal(open.findByProps({ className: "sr-only" }).children.join(""), prefix);
      assert.match(text(open), new RegExp(judul[index]));
      const detail = description(row, open);
      assert.equal(detail.props.className, "sr-only");
      assert.equal(detail.findByProps({ className: "sm:hidden" }).children.join(""), dictionary === indonesia ? "9 menit yang lalu" : "9 minutes ago");
      ids.push(detail.props.id);
    }
    assert.equal(new Set(ids).size, ids.length);
    const noTime = item(renderer, "fitur:akun").findByProps({ "data-uji": "pekerjaan-buka" });
    assert.equal(noTime.props["aria-describedby"], undefined);
    const statusOnlyRow = item(renderer, "laporan:tanpa-waktu");
    const statusOnly = statusOnlyRow.findByProps({ "data-uji": "pekerjaan-buka" });
    assert.equal(text(description(statusOnlyRow, statusOnly)), dictionary.pekerjaan.statusBaru);
    renderer.unmount();
  }
});

test("recent-file status badges and their full descriptions remain available in both languages", () => {
  const waktu = Date.now() - 5 * 60 * 1000;
  const work = {
    siap: true, tersedia: true, menyimpan: false, aktif: { id: "running", berjalan: true },
    daftar: [
      { id: "draft", jenis: "draf", status: "draf", waktu },
      { id: "done", jenis: "laporan", status: "selesai", waktu },
      { id: "interrupted", jenis: "laporan", status: "terputus", adaHasil: false, waktu },
      { id: "previous", jenis: "laporan", status: "terputus", adaHasil: true, waktu },
      { id: "running", jenis: "laporan", status: "berjalan", waktu },
      { id: "new", jenis: "laporan", status: "baru", waktu },
    ],
  };
  const cases = [
    ["draft", "statusDraf", "singkatDraf"], ["done", "statusSelesai", "singkatSelesai"],
    ["interrupted", "statusTerputus", "singkatTerputus"], ["previous", "statusHasilLama", "singkatTerputus"],
    ["running", "statusBerjalan", "singkatBerjalan"], ["new", "statusBaru", "singkatBaru"],
  ];
  for (const dictionary of [indonesia, english]) {
    const renderer = renderPapan(dictionary, {}, work);
    for (const [id, full, short] of cases) {
      const row = item(renderer, id);
      const open = row.findByProps({ "data-uji": "pekerjaan-buka" });
      assert.equal(open.findByProps({ title: dictionary.pekerjaan[full] }).children.join(""), dictionary.pekerjaan[short]);
      assert.ok(text(description(row, open)).includes(dictionary.pekerjaan[full]));
    }
    renderer.unmount();
  }
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
    const detail = description(row, open);
    assert.equal(detail.props.className, "sr-only");
    assert.match(text(detail), new RegExp(status));
    const fullMobileTime = detail.find((node) => node.props.className === "sm:hidden");
    assert.equal(fullMobileTime.children.join(""), `. ${lengkap}`);
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
