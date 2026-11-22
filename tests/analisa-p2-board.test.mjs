import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import { Chess } from "chess.js";
import ts from "typescript";
import * as configContext from "../src/halaman/Analisa/konteks/configKonteks.js";
import { boardThemes } from "../src/halaman/Analisa/komponen/pengaturan/boardThemes.js";
import { deformatSquare, formatSquare } from "../src/halaman/Analisa/mesin/engine.js";
import { analisa } from "../src/lib/terjemahan/id/analisa.js";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;
const noop = () => {};
const translate = (key, args = {}) => {
  let value = key.split(".").reduce((node, part) => node?.[part], { analisa }) ?? key;
  for (const [name, replacement] of Object.entries(args)) value = value.replaceAll(`{${name}}`, replacement);
  return value;
};
const source = readFileSync(new URL("../src/halaman/Analisa/komponen/game/board.jsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const dependencies = {
  "../../mesin/engine.js": { deformatSquare, formatSquare },
  "../suaraPapan.js": { buatSuara: () => ({ play: noop }) },
  "../../konteks/configKonteks.js": configContext,
  "../pengaturan/boardThemes.js": { boardThemes },
  "../svg/piece.jsx": { default: () => React.createElement("span", { "data-piece": true }) },
  "../svg/rating.jsx": { default: () => null },
  "../svg/result.jsx": { default: () => null },
  "../Gambar.jsx": { default: () => null },
  "../../../../lib/asets.js": { berkasPublik: (path) => path },
  "../../../TekaTeki/animasiBidak.js": { GESER_ISEPIC: { durasi: 300, kurva: "ease" } },
};
const compiledModule = { exports: {} };
runInThisContext(`(function (require, module, exports) {\n${compiled}\n})`)((id) => {
  if (id in dependencies) return dependencies[id];
  if (["react", "react/jsx-runtime", "chess.js"].includes(id)) return require(id);
  throw new Error(`Unexpected dependency: ${id}`);
}, compiledModule, compiledModule.exports);
const Board = compiledModule.exports.default;

function mount(t, { fen = new Chess().fen(), white = true } = {}) {
  const oldDocument = globalThis.document;
  const listeners = new Map();
  globalThis.document = {
    body: { style: {} },
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
  };
  t.after(() => { if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument; });
  const calls = [];
  const focused = [];
  const settings = {
    usedRatings: [configContext.defaultUsedRatings, noop], highlightByRating: [true, noop],
    showArrows: [true, noop], arrowAfterMove: [true, noop], showLegalMoves: [true, noop],
    animateMoves: [true, noop], boardSounds: [false, noop], boardTheme: [0, noop],
  };
  let state;
  function Harness() {
    const drag = React.useState({ is: false, id: "" });
    state = drag[0];
    return React.createElement(configContext.ConfigContext.Provider, { value: settings }, React.createElement(Board, {
      fen, white, t: translate, boardSize: 320, forward: true, animation: false, arrows: [],
      drag: drag[0], setDrag: drag[1], setMaterialAdvantage: noop, setPlaying: noop,
      setAnimation: noop, cleanArrows: noop, pushArrow: noop, analyzeMove: (...args) => calls.push(args),
    }));
  }
  const boardNode = {
    getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, right: 320, bottom: 320, width: 320, height: 320 }),
    querySelector: (selector) => ({ focus: () => focused.push(selector) }),
  };
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(Harness), { createNodeMock: (node) => {
    if (node.props.role === "group" && node.props["aria-describedby"]) return boardNode;
    if (node.props.role === "group") return { querySelector: () => ({ focus: noop }), contains: () => false };
    return null;
  } }); });
  const square = (id) => renderer.root.findByProps({ "data-square": id });
  const key = (id, name) => {
    const event = { key: name, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
    act(() => square(id).props.onKeyDown(event));
    return event;
  };
  const emit = (name, value) => act(() => { for (const fn of [...(listeners.get(name) || [])]) fn(value); });
  const pointer = (id, x, y, pointerId = 1) => {
    const piece = square(id).find((node) => typeof node.props.onPointerDown === "function");
    const element = { getBoundingClientRect: () => ({ x: x - 20, y: y - 20, width: 40, height: 40 }), setPointerCapture: noop, hasPointerCapture: () => true, releasePointerCapture: noop };
    const event = { pointerType: "touch", button: 0, isPrimary: true, pointerId, clientX: x, clientY: y, currentTarget: element, preventDefault: noop };
    act(() => piece.props.onPointerDown(event));
  };
  return { renderer, square, key, pointer, emit, calls, focused, get state() { return state; } };
}

test("board squares expose one keyboard stop, navigate with orientation, and permit legal moves", (t) => {
  const app = mount(t);
  assert.equal(app.renderer.root.findAll((n) => n.props["data-square"] && n.props.tabIndex === 0).length, 1);
  assert.match(app.square("e2").props["aria-label"], /e2, putih pion/);
  assert.equal(app.key("e2", "Enter").prevented, true);
  assert.equal(app.state.id, "e2");
  assert.match(app.square("e4").props["aria-label"], /langkah sah/);
  assert.equal(app.key("e2", "ArrowUp").stopped, true);
  assert.match(app.focused.at(-1), /e3/);
  app.key("e5", "Enter");
  assert.equal(app.calls.length, 0, "illegal destinations never execute a move");
  app.key("e2", " ");
  app.key("e4", "Enter");
  assert.deepEqual(app.calls[0][1], { from: "e2", to: "e4" });
  act(() => app.renderer.unmount());

  const reversed = mount(t, { white: false });
  reversed.key("e2", "ArrowDown");
  assert.match(reversed.focused.at(-1), /e3/);
  reversed.key("e2", "ArrowUp");
  assert.match(reversed.focused.at(-1), /e1/);
  act(() => reversed.renderer.unmount());
});

test("assistive-technology clicks activate squares without duplicating normal pointer gestures", (t) => {
  const app = mount(t);
  const click = (id, detail) => {
    const element = {};
    act(() => app.square(id).props.onClick({ detail, target: element, currentTarget: element }));
  };
  click("e2", 1);
  assert.equal(app.state.id, "", "ordinary mouse clicks are handled by the pointer path");
  click("e2", 0);
  assert.equal(app.state.id, "e2");
  click("e4", 0);
  assert.deepEqual(app.calls[0][1], { from: "e2", to: "e4" });
  assert.equal(app.calls.length, 1);
  act(() => app.renderer.unmount());
});

test("touch drag, illegal release, pointer cancellation, and unmount clean up listeners", (t) => {
  const app = mount(t);
  const up = (x, y) => app.emit("pointerup", { pointerId: 1, clientX: x, clientY: y });
  app.pointer("e2", 180, 260);
  app.emit("pointermove", { pointerId: 1, clientX: 180, clientY: 140 }); // e5 is illegal
  up(180, 140);
  assert.equal(app.calls.length, 0);
  app.pointer("e2", 180, 260);
  app.emit("pointercancel", { pointerId: 1 });
  assert.equal(app.state.id, "");
  app.pointer("e2", 180, 260);
  app.emit("pointermove", { pointerId: 1, clientX: 180, clientY: 180 });
  up(180, 180);
  assert.deepEqual(app.calls[0][1], { from: "e2", to: "e4" });
  app.pointer("e2", 180, 260);
  act(() => app.renderer.unmount());
  app.emit("pointerup", { pointerId: 1, clientX: 180, clientY: 180 });
  assert.equal(app.calls.length, 1, "listeners are removed when a dragged piece unmounts");
});

test("keyboard promotion offers named buttons and Escape returns focus", async (t) => {
  const app = mount(t, { fen: "7k/P7/8/8/8/8/8/7K w - - 0 1" });
  app.key("a7", "Enter");
  app.key("a8", "Enter");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  const group = app.renderer.root.findByProps({ "aria-label": "Pilih promosi pion" });
  assert.ok(group.findByProps({ "aria-label": "Promosikan menjadi menteri" }));
  const escape = { key: "Escape", preventDefault: noop, stopPropagation: noop };
  act(() => group.props.onKeyDown(escape));
  assert.match(app.focused.at(-1), /a8/);
  assert.equal(app.calls.length, 0);
  // After cancel, reselect the pawn and choose a queen with a native button.
  app.key("a7", "Enter");
  app.key("a8", "Enter");
  act(() => app.renderer.root.findByProps({ "aria-label": "Promosikan menjadi menteri" }).props.onClick());
  assert.deepEqual(app.calls[0][1], { from: "a7", to: "a8", promotion: "q" });
  act(() => app.renderer.unmount());
});
