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
import * as setBidak from "../src/halaman/Analisa/komponen/pengaturan/setBidak.js";
import { analisa as english } from "../src/lib/terjemahan/en/analisa.js";

const nodeRequire = createRequire(import.meta.url);
const { act } = TestRenderer;
const kosong = () => null;
const TautanUji = React.forwardRef(function TautanUji(props, ref) {
  return React.createElement("a", { ...props, ref });
});

function compile(path, dependencies) {
  const filename = new URL(path, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename.pathname,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const factory = runInThisContext(`(function (require, module, exports) {\n${compiled}\n})`);
  const hasil = { exports: {} };
  factory((id) => {
    if (id === "react" || id === "react/jsx-runtime" || id === "chess.js") return nodeRequire(id);
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, hasil, hasil.exports);
  return hasil.exports;
}

function teks(node) {
  return node.children.map((child) => typeof child === "string" ? child : teks(child)).join(" ").trim().replace(/\s+/g, " ");
}

function renderLayar() {
  const translate = (key, options) => {
    const value = key.split(".").reduce((acc, part) => acc?.[part], { analisa: english }) ?? key;
    if (typeof value !== "string" || !options) return value;
    return value.replace(/\{(\w+)\}/g, (_, name) => String(options[name] ?? ""));
  };
  const keadaan = { bahasa: [] };
  function SwitchUji({ "aria-label": label, checked }) {
    return React.createElement("button", { "aria-label": label, "aria-checked": checked });
  }
  const umum = {
    "../../../../modul/sesi/preferensi.js": { ...configContext, boardThemes, bacaTeks: () => null, tulis: () => {} },
    "../../../../lib/i18n.jsx": { useI18n: () => ({ t: translate, bahasa: "en", setBahasa: (value) => keadaan.bahasa.push(value) }) },
    "../svg/piece.jsx": { default: kosong },
    "../svg/rating.jsx": { default: kosong },
    "../svg/soundMax.jsx": { default: kosong },
    "../svg/sound-mute.jsx": { default: kosong },
    "../game/board.jsx": { Arrow: kosong },
    "../menu/analyze/selectChessComData.js": { capitalizeFirst: (value) => value[0].toUpperCase() + value.slice(1) },
    "./sakelarPengaturan.jsx": { default: SwitchUji },
    "../../../../lib/repo.js": { URL_REPO: "https://github.com/Delta-Polder-Indonesia/Maestro-Chess" },
    "next/link": { default: TautanUji },
  };
  const Baris = compile("../src/halaman/Analisa/komponen/pengaturan/barisPengaturan.jsx", {}).default;
  const PilihRingkas = compile("../src/halaman/Analisa/komponen/pengaturan/pilihRingkas.jsx", {}).default;
  const denganBaris = { ...umum, "./barisPengaturan.jsx": { default: Baris }, "./pilihRingkas.jsx": { default: PilihRingkas }, "./setBidak.js": setBidak };
  const modulRatings = compile("../src/halaman/Analisa/komponen/pengaturan/ratings.jsx", denganBaris);
  const modulLayar = compile("../src/halaman/Analisa/komponen/nav/layarPengaturan.jsx", {
    "../../../../lib/i18n.jsx": umum["../../../../lib/i18n.jsx"],
    "./PanelLayar.jsx": { default: ({ judul, children }) => React.createElement("section", null, React.createElement("h1", null, judul), children) },
    "../pengaturan/themes.jsx": { default: compile("../src/halaman/Analisa/komponen/pengaturan/themes.jsx", denganBaris).default },
    "../pengaturan/ratings.jsx": modulRatings,
    "../pengaturan/moves.jsx": { default: compile("../src/halaman/Analisa/komponen/pengaturan/moves.jsx", denganBaris).default },
    "../pengaturan/bestMoves.jsx": { default: compile("../src/halaman/Analisa/komponen/pengaturan/bestMoves.jsx", denganBaris).default },
    "../pengaturan/barisPengaturan.jsx": { default: Baris },
    "../../../../modul/sesi/preferensi.js": { boardThemes },
    "../../../../lib/repo.js": umum["../../../../lib/repo.js"],
    "next/link": umum["next/link"],
    "../svg/github.jsx": { default: kosong },
    "../svg/license.jsx": { default: kosong },
  });
  const Layar = modulLayar.default;

  function Harness() {
    const nilai = {
      boardTheme: React.useState(0),
      pieceSet: React.useState("cburnett"),
      usedRatings: React.useState(configContext.defaultUsedRatings),
      highlightByRating: React.useState(true),
      showArrows: React.useState(true),
      arrowAfterMove: React.useState(true),
      showLegalMoves: React.useState(true),
      animateMoves: React.useState(true),
      boardSounds: React.useState(true),
    };
    return React.createElement(configContext.ConfigContext.Provider, { value: nilai }, React.createElement(Layar, { aktif: false }));
  }
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(Harness)); });
  return { renderer, keadaan };
}

function judulGrup(renderer) {
  return renderer.root.findAllByType("h2").map(teks);
}
function saklar(renderer) {
  return renderer.root.findAllByType("button")
    .filter((node) => node.props["aria-label"])
    .map((node) => node.props["aria-label"]);
}

test("settings screen uses a search row, a vertical category nav, and only real tabs", () => {
  const { renderer } = renderLayar();
  assert.equal(teks(renderer.root.findByType("h1")), "Settings");
  assert.equal(renderer.root.findByType("input").props.placeholder, "Search settings");
  const tab = renderer.root.findByType("nav").findAllByType("button");
  assert.deepEqual(tab.map(teks), ["Board", "Ratings", "Moves", "Language", "Documentation"]);
  assert.equal(tab[0].props["aria-current"], "page");
  assert.deepEqual(judulGrup(renderer), ["Board theme", "Board behaviour"]);
  renderer.unmount();
});

test("the selected sidebar category turns its name green without a green background", () => {
  const { renderer } = renderLayar();
  const tab = () => renderer.root.findByType("nav").findAllByType("button");
  assert.match(tab()[0].props.className, /text-backgroundBoxBoxHighlighted/);
  assert.doesNotMatch(tab()[0].props.className, /bg-backgroundBoxBoxHighlighted/);
  act(() => tab()[3].props.onClick());
  assert.match(tab()[3].props.className, /text-backgroundBoxBoxHighlighted/);
  assert.doesNotMatch(tab()[0].props.className, /text-backgroundBoxBoxHighlighted/);
  renderer.unmount();
});

test("each tab opens only its own settings groups", () => {
  const { renderer, keadaan } = renderLayar();
  const tab = () => renderer.root.findByType("nav").findAllByType("button");
  act(() => tab()[3].props.onClick());
  assert.deepEqual(judulGrup(renderer), ["Language"]);
  assert.deepEqual(saklar(renderer), []);
  const pilihBahasa = renderer.root.findByType("select");
  assert.equal(pilihBahasa.props["aria-label"], "Language");
  act(() => pilihBahasa.props.onChange({ target: { value: "id" } }));
  assert.deepEqual(keadaan.bahasa, ["id"]);

  act(() => tab()[2].props.onClick());
  assert.deepEqual(judulGrup(renderer), ["Best moves"]);
  assert.deepEqual(saklar(renderer), ["Show arrows", "Arrow after opponent's move", "Erase arrows on click"]);
  renderer.unmount();
});

test("search filters rows across tabs and clears when another tab is chosen", () => {
  const { renderer } = renderLayar();
  const cari = renderer.root.findByType("input");
  act(() => cari.props.onChange({ target: { value: "sound" } }));
  assert.deepEqual(judulGrup(renderer), ["Board behaviour"]);
  assert.deepEqual(saklar(renderer), ["Board sounds"]);

  act(() => cari.props.onChange({ target: { value: "brilliant" } }));
  assert.deepEqual(judulGrup(renderer), ["Ratings"]);
  assert.deepEqual(saklar(renderer), ["Brilliant"]);

  act(() => cari.props.onChange({ target: { value: "tidak ada" } }));
  assert.equal(judulGrup(renderer).length, 0);
  assert.match(teks(renderer.root), /No settings found for "tidak ada"/);

  act(() => cari.props.onChange({ target: { value: "animasi" } }));
  assert.deepEqual(saklar(renderer), ["Animate moves"]);
  act(() => renderer.root.findByType("nav").findAllByType("button")[0].props.onClick());
  assert.equal(renderer.root.findByType("input").props.value, "");
  assert.deepEqual(judulGrup(renderer), ["Board theme", "Board behaviour"]);
  renderer.unmount();
});

test("documentation tab holds the source and attribution links removed from the navigation", () => {
  const { renderer } = renderLayar();
  act(() => renderer.root.findByType("nav").findAllByType("button")[4].props.onClick());
  assert.deepEqual(judulGrup(renderer), ["Documentation"]);
  const tautan = renderer.root.findAllByType("a").filter((node) => node.props["aria-label"]);
  assert.deepEqual(tautan.map((node) => node.props["aria-label"]), ["Source Code", "Attributions"]);
  assert.equal(tautan[0].props.href, "https://github.com/Delta-Polder-Indonesia/Maestro-Chess");
  assert.equal(tautan[0].props.target, "_blank");
  assert.equal(tautan[1].props.href, "/attributions");
  renderer.unmount();
});
