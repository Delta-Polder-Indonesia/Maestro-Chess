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
  };
  const Themes = kompilasi("../src/halaman/Analisa/komponen/pengaturan/themes.jsx", {
    ...umum, "../../../../components/ui/switch.jsx": { Switch: saklar("themes") },
  });
  const Ratings = kompilasi("../src/halaman/Analisa/komponen/pengaturan/ratings.jsx", {
    ...umum, "../menu/analyze/selectChessComData.js": { capitalizeFirst: (value) => value[0].toUpperCase() + value.slice(1) },
    "../../../../components/ui/switch.jsx": { Switch: saklar("ratings") },
  });
  const Moves = kompilasi("../src/halaman/Analisa/komponen/pengaturan/moves.jsx", {
    ...umum, "../svg/soundMax.jsx": { default: kosong }, "../svg/sound-mute.jsx": { default: kosong },
    "../../../../components/ui/switch.jsx": { Switch: saklar("moves") },
  });
  const BestMoves = kompilasi("../src/halaman/Analisa/komponen/pengaturan/bestMoves.jsx", {
    ...umum, "../game/board.jsx": { Arrow: kosong },
    "../../../../components/ui/switch.jsx": { Switch: saklar("best") },
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
