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

// Node's test runner cannot import JSX directly. Compile this component using
// the existing TypeScript dependency and replace only its UI/i18n boundaries.
const filename = new URL("../src/halaman/Analisa/komponen/nav/layarPapan.jsx", import.meta.url);
const source = readFileSync(filename, "utf8");
const compiled = ts.transpileModule(source, {
  fileName: filename.pathname,
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const factory = runInThisContext(`(function (require, module, exports) {\n${compiled}\n})`);
const nodeRequire = createRequire(import.meta.url);

function renderPapan(dictionary, onReport, onImpor) {
  const compiledModule = { exports: {} };
  const translate = (key) => key.split(".").reduce((value, part) => value?.[part], { analisa: dictionary }) ?? key;
  const requireForComponent = (id) => {
    if (id === "react/jsx-runtime") return nodeRequire(id);
    if (id === "./PanelLayar.jsx") return { default: ({ children }) => React.createElement("section", null, children) };
    if (id === "../../../../lib/i18n.jsx") return { useI18n: () => ({ t: translate }) };
    throw new Error(`Unexpected dashboard dependency: ${id}`);
  };
  factory(requireForComponent, compiledModule, compiledModule.exports);
  return TestRenderer.create(React.createElement(compiledModule.exports.default, { onReport, onImpor }));
}

function byTestId(renderer, id) {
  return renderer.root.find((node) => node.props["data-uji"] === id);
}

test("dashboard shows six cards, with working report and import actions but no recent files", () => {
  let reports = 0;
  let imports = 0;
  const renderer = renderPapan(indonesia, () => { reports++; }, () => { imports++; });
  const cards = renderer.root.findAll((node) => node.props["data-uji"]?.startsWith("papan-kartu-"));
  assert.equal(cards.length, 6);
  assert.equal(byTestId(renderer, "papan-kartu-report").findByType("h2").children.join(""), "Report Analisa");
  assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /File Terbaru|Recent Files/);

  const report = byTestId(renderer, "papan-tombol-report");
  const impor = byTestId(renderer, "papan-tombol-impor");
  assert.equal(Boolean(report.props.disabled), false);
  assert.equal(Boolean(impor.props.disabled), false);
  TestRenderer.act(() => { report.props.onClick(); impor.props.onClick(); });
  assert.equal(reports, 1);
  assert.equal(imports, 1);
  for (const key of ["main", "analisa", "repertoar", "puzzle"]) {
    assert.equal(byTestId(renderer, `papan-tombol-${key}`).props.disabled, true);
  }
  renderer.unmount();
});

test("report card and board controls retain Indonesian and English labels", () => {
  for (const [dictionary, title, button, flip, settings, promotion] of [
    [indonesia, "Report Analisa", "Buka laporan", "Balik papan", "Pengaturan", "Pilih bidak promosi"],
    [english, "Analysis Report", "View report", "Flip board", "Settings", "Choose promotion piece"],
  ]) {
    const renderer = renderPapan(dictionary, () => {}, () => {});
    assert.equal(byTestId(renderer, "papan-kartu-report").findByType("h2").children.join(""), title);
    assert.equal(byTestId(renderer, "papan-tombol-report").children.join(""), button);
    assert.equal(dictionary.papan.balik, flip);
    assert.equal(dictionary.papan.pengaturan, settings);
    assert.equal(dictionary.papan.promosi, promotion);
    renderer.unmount();
  }
});
