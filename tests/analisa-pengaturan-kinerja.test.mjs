import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import * as configContext from "../src/halaman/Analisa/konteks/configKonteks.js";
import { boardThemes } from "../src/halaman/Analisa/komponen/pengaturan/boardThemes.js";
import { analisa as indonesia } from "../src/lib/terjemahan/id/analisa.js";
import { analisa as english } from "../src/lib/terjemahan/en/analisa.js";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;
const noop = () => {};
function kompilasi(path, dependencies) {
  const filename = new URL(path, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename.pathname,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const factory = runInThisContext(`(function (require, module, exports) {\n${compiled}\n})`);
  const result = { exports: {} };
  factory((id) => {
    if (id === "react" || id === "react/jsx-runtime" || id === "chess.js") return require(id);
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, result, result.exports);
  return result.exports.default;
}

test("a setting updates only the relevant panels while theme changes reach every preview", async () => {
  const renders = { themes: 0, ratings: 0, moves: 0, best: 0 };
  const kosong = () => null;
  const saklar = (bagian) => function SwitchMock({ checked, onCheckedChange, "aria-label": label }) {
    renders[bagian]++;
    return React.createElement("button", { "aria-label": label, "aria-checked": checked, onClick: () => onCheckedChange(!checked) });
  };
  const umum = {
    "../../konteks/configKonteks.js": configContext,
    "./boardThemes.js": { boardThemes },
    "../../../../lib/i18n.jsx": { useI18n: () => ({ t: (key) => key }) },
    "../../penyimpanan.js": { bacaTeks: () => null, tulis: noop },
    "../svg/piece.jsx": { default: kosong },
    "../svg/rating.jsx": { default: kosong },
    "./barisPengaturan.jsx": { default: function BarisPengaturanUji({ children }) { return React.createElement("div", null, children); } },
  };
  const Themes = kompilasi("../src/halaman/Analisa/komponen/pengaturan/themes.jsx", {
    ...umum, "./sakelarPengaturan.jsx": { default: saklar("themes") },
  });
  const Ratings = kompilasi("../src/halaman/Analisa/komponen/pengaturan/ratings.jsx", {
    ...umum, "../menu/analyze/selectChessComData.js": { capitalizeFirst: (value) => value[0].toUpperCase() + value.slice(1) },
    "./sakelarPengaturan.jsx": { default: saklar("ratings") },
  });
  const Moves = kompilasi("../src/halaman/Analisa/komponen/pengaturan/moves.jsx", {
    ...umum, "../svg/soundMax.jsx": { default: kosong }, "../svg/sound-mute.jsx": { default: kosong },
    "./sakelarPengaturan.jsx": { default: saklar("moves") },
  });
  const BestMoves = kompilasi("../src/halaman/Analisa/komponen/pengaturan/bestMoves.jsx", {
    ...umum, "../game/board.jsx": { Arrow: kosong },
    "./sakelarPengaturan.jsx": { default: saklar("best") },
  });
  function Harness() {
    const boardTheme = React.useState(0);
    const usedRatings = React.useState(configContext.defaultUsedRatings);
    const highlightByRating = React.useState(true);
    const showArrows = React.useState(true);
    const arrowAfterMove = React.useState(true);
    const showLegalMoves = React.useState(true);
    const animateMoves = React.useState(true);
    const boardSounds = React.useState(true);
    const value = { boardTheme, usedRatings, highlightByRating, showArrows, arrowAfterMove, showLegalMoves, animateMoves, boardSounds };
    return React.createElement(configContext.ConfigContext.Provider, { value },
      React.createElement(Themes), React.createElement(Ratings), React.createElement(Moves, { aktif: false }), React.createElement(BestMoves));
  }
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness)); });
  const tombol = (label) => renderer.root.findAllByType("button").find((node) => node.props["aria-label"] === label);
  const awal = { ...renders };
  await act(async () => { tombol("analisa.pengaturan.suara").props.onClick(); });
  assert.equal(tombol("analisa.pengaturan.suara").props["aria-checked"], false);
  assert.equal(renders.themes, awal.themes);
  assert.equal(renders.ratings, awal.ratings);
  assert.equal(renders.best, awal.best);
  assert.ok(renders.moves > awal.moves);

  const setelahSuara = { ...renders };
  await act(async () => { tombol("Best").props.onClick(); });
  assert.equal(tombol("Best").props["aria-checked"], false);
  assert.ok(renders.ratings > setelahSuara.ratings);
  assert.equal(renders.moves, setelahSuara.moves);
  assert.equal(renders.themes, setelahSuara.themes);
  assert.equal(renders.best, setelahSuara.best);

  const setelahRating = { ...renders };
  await act(async () => { tombol("analisa.tema.biru").props.onClick(); });
  assert.equal(tombol("analisa.tema.biru").props["aria-checked"], true);
  for (const bagian of Object.keys(renders)) assert.ok(renders[bagian] > setelahRating[bagian], bagian);
  await act(async () => { renderer.unmount(); });
});

test("theme switch names match the visible colour labels while state and persistence stay correct", async () => {
  const Sakelar = kompilasi("../src/halaman/Analisa/komponen/pengaturan/sakelarPengaturan.jsx", {});
  const Baris = kompilasi("../src/halaman/Analisa/komponen/pengaturan/barisPengaturan.jsx", {});
  for (const dictionary of [indonesia, english]) {
    const saved = [];
    const Themes = kompilasi("../src/halaman/Analisa/komponen/pengaturan/themes.jsx", {
      "../../konteks/configKonteks.js": configContext,
      "../../../../lib/i18n.jsx": { useI18n: () => ({ t: (key) => key.split(".").reduce((value, part) => value?.[part], { analisa: dictionary }) }) },
      "../../penyimpanan.js": { bacaTeks: () => "0", tulis: (key, value) => saved.push([key, value]) },
      "./sakelarPengaturan.jsx": { default: Sakelar },
      "./boardThemes.js": { boardThemes },
      "./barisPengaturan.jsx": { default: Baris },
    });
    function Harness() {
      const boardTheme = React.useState(0);
      return React.createElement(configContext.ConfigContext.Provider, { value: { boardTheme } }, React.createElement(Themes));
    }
    let renderer;
    await act(async () => { renderer = TestRenderer.create(React.createElement(Harness)); });
    const switches = () => renderer.root.findAllByType("button").filter((node) => node.props.role === "switch");
    const previews = () => renderer.root.findAllByType("button").filter((node) => !node.props.role);
    const labels = boardThemes.map((theme) => dictionary.tema[theme.kunci]);
    assert.equal(switches().length, labels.length);
    assert.equal(previews().length, labels.length);
    for (const [index, label] of labels.entries()) {
      const preview = previews()[index];
      assert.equal(preview.findByType("span").children.join(""), label);
      assert.equal(preview.findByType("div").props["aria-hidden"], "true");
    }
    for (let selected = 0; selected < labels.length; selected++) {
      await act(async () => { switches()[selected].props.onClick(); });
      assert.deepEqual(saved.at(-1), ["boardTheme", String(selected)]);
      switches().forEach((button, index) => {
        const status = index === selected ? "ON" : "OFF";
        assert.equal(button.props["aria-checked"], index === selected);
        assert.equal(button.findAllByType("span")[0].children.join(""), status);
        assert.equal(button.findAllByType("span")[0].props["aria-hidden"], "true");
        assert.equal(button.props["aria-label"], labels[index]);
        assert.equal(button.findAllByType("span")[1].props["aria-hidden"], "true");
      });
    }
    await act(async () => { previews()[1].props.onClick(); });
    assert.equal(switches()[1].props["aria-checked"], true);
    assert.deepEqual(saved.at(-1), ["boardTheme", "1"]);
    await act(async () => { renderer.unmount(); });
  }
});

test("settings switch preserves its boolean toggle behaviour", () => {
  const Sakelar = kompilasi("../src/halaman/Analisa/komponen/pengaturan/sakelarPengaturan.jsx", {});
  for (const checked of [true, false]) {
    const changes = [];
    const renderer = TestRenderer.create(React.createElement(Sakelar, {
      checked, onCheckedChange: (value) => changes.push(value), "aria-label": "Tampilkan panah",
    }));
    const button = renderer.root.findByType("button");
    assert.equal(button.props["aria-label"], "Tampilkan panah");
    assert.equal(button.props["aria-checked"], checked);
    assert.equal(button.findAllByType("span")[0].props["aria-hidden"], "true");
    act(() => button.props.onClick());
    assert.deepEqual(changes, [!checked]);
    renderer.unmount();
  }
});
