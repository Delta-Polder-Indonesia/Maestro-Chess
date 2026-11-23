import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import * as formatDatabase from "../src/halaman/Analisa/komponen/nav/database/formatDatabase.js";
import { tekanPanahTab } from "../src/halaman/Analisa/komponen/navigasiTab.js";
import { tekanPanahOpsi } from "../src/halaman/Analisa/komponen/nav/useDropdown.js";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;
const kosong = () => null;
const t = (key) => key;
const flush = () => new Promise((resolve) => setImmediate(resolve));

function kompilasi(path, dependencies) {
  const filename = new URL(path, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename.pathname,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = { exports: {} };
  runInThisContext(`(function (require, module, exports) {\n${compiled}\n})`)((id) => {
    if (id in dependencies) return dependencies[id];
    if (["react", "react/jsx-runtime", "@tanstack/react-table", "@tanstack/react-table/legacy"].includes(id)) return require(id);
    throw new Error(`Unexpected dependency: ${id}`);
  }, result, result.exports);
  return result.exports;
}

test("summary table keeps its row semantics and exposes a native analysis button", async () => {
  const game = { id: "game-1", whiteName: "Alice", blackName: "Bob", timestamp: 1, plyCount: 2 };
  const calls = [];
  const TabelRingkasan = kompilasi("../src/halaman/Analisa/komponen/nav/database/tabelRingkasan.jsx", {
    "../../../basisData.js": { ambilDaftarPartai: async () => ({ partai: [game], total: 1 }) },
    "./formatDatabase.js": formatDatabase,
    "../../svg/square-fill-plus.jsx": { default: kosong },
    "../../svg/square-fill-minus.jsx": { default: kosong },
    "../../svg/square-fill-equal.jsx": { default: kosong },
    "./ikonDatabase.jsx": { IkonSearch: kosong },
    "./tabelPartai.jsx": { MenuKolom: kosong, HeaderKolom: kosong },
    "../../loading/DualRingSpinner.jsx": { default: kosong },
    "../../svg/database.jsx": { default: kosong },
  }).TabelRingkasan;
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(TabelRingkasan, {
      koleksiId: "impor:impor", t, locale: "id", username: "", totalKoleksi: 1,
      tanganiAnalisa: (value) => calls.push(value),
    }));
    await flush();
  });
  const row = renderer.root.findByType("tbody").findByType("tr");
  assert.equal(row.props.tabIndex, undefined, "a row must not masquerade as an interactive control");
  const button = row.findByType("button");
  assert.equal(button.props.type, "button");
  assert.equal(button.props["aria-label"], "1: analisa.basisData.analisaSekarang: Alice – Bob");
  let stopped = false;
  act(() => button.props.onClick({ stopPropagation() { stopped = true; } }));
  assert.equal(stopped, true);
  assert.deepEqual(calls, [game]);
  act(() => row.props.onClick());
  assert.deepEqual(calls, [game, game], "clicking elsewhere in the row still opens the game");
  act(() => renderer.unmount());
});

test("summary row numbers and analysis labels remain correct after pagination and sorting", async () => {
  const games = Array.from({ length: 425 }, (_, i) => ({
    id: `game-${i}`, whiteName: `Player${String(i).padStart(3, "0")}`,
    blackName: "Bob", timestamp: i + 1, plyCount: 2,
  }));
  const queries = [];
  const TabelRingkasan = kompilasi("../src/halaman/Analisa/komponen/nav/database/tabelRingkasan.jsx", {
    "../../../basisData.js": { ambilDaftarPartai: async (opts) => {
      queries.push(opts);
      const sorted = [...games].sort((a, b) => {
        const comparison = opts.urut === "putih" ? a.whiteName.localeCompare(b.whiteName) : a.timestamp - b.timestamp;
        return comparison * (opts.arah === "asc" ? 1 : -1);
      });
      return { partai: sorted.slice(opts.offset, opts.offset + opts.limit), total: sorted.length };
    } },
    "./formatDatabase.js": formatDatabase,
    "../../svg/square-fill-plus.jsx": { default: kosong },
    "../../svg/square-fill-minus.jsx": { default: kosong },
    "../../svg/square-fill-equal.jsx": { default: kosong },
    "./ikonDatabase.jsx": { IkonSearch: kosong },
    "./tabelPartai.jsx": { MenuKolom: kosong, HeaderKolom: ({ kolom }) => React.createElement("button", {
      "data-sort": kolom.id, onClick: kolom.column.getToggleSortingHandler(),
    }, kolom.id) },
    "../../loading/DualRingSpinner.jsx": { default: kosong },
    "../../svg/database.jsx": { default: kosong },
  }).TabelRingkasan;
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(TabelRingkasan, {
      koleksiId: "chessCom:alice", t, locale: "id", username: "Alice", totalKoleksi: games.length,
      tanganiAnalisa: kosong,
    }));
    await flush();
  });
  const labelBarisPertama = () => renderer.root.findByType("tbody").findAllByType("tr")[0].findByType("button").props["aria-label"];
  const next = async () => act(async () => {
    renderer.root.findAllByType("button").find((button) => button.children.includes("analisa.basisData.berikutnya")).props.onClick();
    await flush();
  });
  assert.match(labelBarisPertama(), /^1: .*Player424/);
  await next();
  assert.match(labelBarisPertama(), /^11: .*Player414/);
  await act(async () => {
    renderer.root.findByProps({ "data-sort": "whiteName" }).props.onClick({ persist() {}, shiftKey: false });
    await flush();
  });
  assert.equal(queries.at(-1).urut, "putih");
  assert.equal(queries.at(-1).arah, "asc");
  assert.equal(queries.at(-1).offset, 0);
  assert.match(labelBarisPertama(), /^1: .*Player000/);
  await next();
  assert.equal(queries.at(-1).offset, 10);
  assert.match(labelBarisPertama(), /^11: .*Player010/);
  act(() => renderer.unmount());
});

test("collection selection and export/delete are separate native controls", () => {
  const calls = [];
  const KolomKoleksi = kompilasi("../src/halaman/Analisa/komponen/nav/database/kolomKoleksi.jsx", {
    "../../../../../lib/i18n.jsx": { useI18n: () => ({ t }) },
    "../../svg/database.jsx": { default: kosong },
    "../../svg/trash.jsx": { default: kosong },
    "../../svg/download.jsx": { default: kosong },
    "./formatDatabase.js": formatDatabase,
    "./ikonDatabase.jsx": { IkonSearch: kosong },
  }).default;
  const collection = { id: "chessCom:alice", label: "Alice Chess.com", jumlahPartai: 5 };
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(KolomKoleksi, {
    mode: "data", koleksiList: [collection], daftarKoleksi: [collection], statMap: {},
    koleksiTerpilih: collection.id, setKoleksiTerpilih: (id) => calls.push(["select", id]),
    setMode: (mode) => calls.push(["mode", mode]), cariKoleksi: "", setCariKoleksi: () => {},
    tanganiEksporPgn: (id) => calls.push(["export", id]),
    tanganiHapusKoleksi: (id) => calls.push(["delete", id]),
  })); });
  const select = renderer.root.findByProps({ "aria-label": "Alice Chess.com" });
  assert.equal(select.type, "button");
  assert.equal(select.props["aria-pressed"], true);
  assert.equal(select.findAllByType("button").length, 1, "other actions must not be nested in the selection button");
  act(() => select.props.onClick());
  assert.deepEqual(calls, [["select", collection.id], ["mode", "data"]]);
  const buttons = renderer.root.findAllByType("button");
  const exportButton = buttons.find((node) => node.findAllByType("span").some((child) => child.children.includes("analisa.basisData.eksporPgn")));
  const deleteButton = buttons.find((node) => node.findAllByType("span").some((child) => child.children.includes("analisa.basisData.hapusKoleksi")));
  const event = { stopPropagation() {} };
  act(() => { exportButton.props.onClick(event); deleteButton.props.onClick(event); });
  assert.deepEqual(calls.slice(2), [["export", collection.id], ["delete", collection.id]]);
  act(() => renderer.unmount());
});

test("tablists and listboxes support wrapping arrows and Home/End", (testContext) => {
  const previousDocument = globalThis.document;
  const result = [];
  const items = [0, 1, 2].map((index) => ({
    focus() { result.push(["focus", index]); globalThis.document.activeElement = this; },
    click() { result.push(["click", index]); },
  }));
  globalThis.document = { activeElement: items[0] };
  testContext.after(() => { if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; });
  const tab = (key, target = items[0]) => {
    let prevented = false;
    tekanPanahTab({ key, target, currentTarget: { querySelectorAll: () => items }, preventDefault() { prevented = true; } });
    return prevented;
  };
  assert.equal(tab("ArrowLeft"), true);
  assert.deepEqual(result.splice(0), [["focus", 2], ["click", 2]]);
  assert.equal(tab("Home", items[2]), true);
  assert.deepEqual(result.splice(0), [["focus", 0], ["click", 0]]);
  assert.equal(tab("End"), true);
  assert.deepEqual(result.splice(0), [["focus", 2], ["click", 2]]);
  assert.equal(tab("Tab"), false);
  const option = (key) => {
    let prevented = false;
    tekanPanahOpsi({ key, currentTarget: { querySelectorAll: () => items }, preventDefault() { prevented = true; } });
    return prevented;
  };
  assert.equal(option("ArrowDown"), true);
  assert.deepEqual(result.splice(0), [["focus", 0]]);
  assert.equal(option("End"), true);
  assert.deepEqual(result.splice(0), [["focus", 2]]);
  assert.equal(option("Home"), true);
  assert.deepEqual(result.splice(0), [["focus", 0]]);
  assert.equal(option("ArrowUp"), true);
  assert.deepEqual(result.splice(0), [["focus", 2]]);
  assert.equal(option("Tab"), false);
});
