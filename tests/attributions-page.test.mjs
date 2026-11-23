import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
const filename = new URL("../src/app/attributions/page.tsx", import.meta.url);
const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
  fileName: filename.pathname,
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const factory = runInThisContext(`(function (require, module, exports, process) {\n${compiled}\n})`);
const Link = ({ children, ...props }) => React.createElement("a", props, children);

function renderPage(basePath = "") {
  const pageModule = { exports: {} };
  factory((id) => {
    if (id === "next/link") return { default: Link };
    if (id === "react/jsx-runtime" || id === "lucide-react") return nodeRequire(id);
    throw new Error(`Unexpected attribution dependency: ${id}`);
  }, pageModule, pageModule.exports, { env: { NEXT_PUBLIC_BASE_PATH: basePath } });
  return {
    renderer: TestRenderer.create(React.createElement(pageModule.exports.default)),
    metadata: pageModule.exports.metadata,
  };
}

function text(node) {
  if (typeof node === "string") return node;
  if (node.props?.["aria-hidden"] === "true" || node.props?.className?.split(/\s+/).includes("sr-only")) return "";
  return node.children.map(text).join("");
}

const localPaths = [
  "licenses/chessclub-MIT.txt",
  "licenses/brilliant-chess-MIT.txt",
  "licenses/chess-game-reviewer-MIT.txt",
  "engine/source/COPYING.txt",
  "engine/source/AUTHORS.txt",
  "engine/source/stockfish.js-efc5758a1cf72ec7644fa771a1f17fcbfdae410e-no-networks.tar.gz",
  "engine/source/stockfish.js-215df8c6a72847e306644d399733de18fb8e0d6c-source-only.tar.gz",
  "engine/source/stockfish.js-602fd7e1a571a2be71f242942db90483731f2a1f-source-only.tar.gz",
  "engine/source/stockfish.js-082eeba46b0c5f8f8065e5386750aa0ecfa2062c.tar.gz",
  "engine/source/stockfish.js-93c994592dcf3b4b21052ab925e9b534df9c0918.tar.gz",
  "engine/source/stockfish.js-0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6.tar.gz",
  "engine/nn-5af11540bbfe.nnue",
  "engine/source/nn-9067e33176e8.nnue",
  "engine/source/nn-61e7af4bb97d.nnue",
  "licenses/lichess-AGPL-3.0.txt",
  "licenses/chess-openings-CC0.txt",
  "licenses/flag-icons-MIT.txt",
  "licenses/geist-OFL-1.1.txt",
];
const externalUrls = [
  "https://github.com/Delta-Polder-Indonesia/ChessClub",
  "https://github.com/wdeloo/Brilliant-Chess",
  "https://github.com/SheyBoiCarti/ChessGameReviewer",
  "https://github.com/nmrugg/stockfish.js",
  "https://en.wikipedia.org/wiki/User:Cburnett",
  "https://creativecommons.org/licenses/by-sa/3.0/",
  "https://github.com/lichess-org/lila/tree/master/public/sound/standard",
  "https://github.com/lichess-org/chess-openings",
  "https://github.com/lipis/flag-icons",
  "https://github.com/vercel/geist-font",
];

test("attributions are an article with a clear heading hierarchy and six labelled cards", () => {
  const { renderer, metadata } = renderPage();
  assert.equal(metadata.title, "Atribusi & lisensi — Maestro Chess");
  assert.equal(text(renderer.root.findByType("h1")), "Atribusi & lisensi");
  assert.deepEqual(renderer.root.findAllByType("h2").map(text), ["Komponen & aset", "Catatan merek"]);
  const cards = renderer.root.findAllByType("article").filter((node) => node.props["aria-labelledby"]);
  const titles = ["Antarmuka & analisis", "Engine Stockfish", "Bidak catur", "Suara papan", "Buku pembukaan", "Bendera & huruf"];
  assert.equal(cards.length, titles.length);
  cards.forEach((card, index) => {
    const heading = card.findByType("h3");
    assert.equal(text(heading), titles[index]);
    assert.equal(card.props["aria-labelledby"], heading.props.id);
    assert.ok(card.findAllByType("a").length > 0, `${titles[index]} has attribution links`);
  });
  const section = renderer.root.findByProps({ id: "daftar-atribusi" });
  assert.equal(section.props["aria-labelledby"], "judul-daftar");
  const links = renderer.root.findAllByType("a");
  assert.ok(links.some((link) => link.props.href === "#konten-atribusi"));
  assert.ok(links.some((link) => link.props.href === "#daftar-atribusi"));
  assert.ok(links.some((link) => link.props.href === "/"));
  assert.equal(renderer.root.findByType("nav").props["aria-label"], "Jejak navigasi");
  renderer.unmount();
});

test("all attribution, license, source and NNUE links survive both static-export base paths", () => {
  for (const basePath of ["", "/Maestro-Chess"]) {
    const { renderer } = renderPage(basePath);
    const links = renderer.root.findAllByType("a");
    const local = links.filter((link) => link.props.href?.startsWith(`${basePath}/licenses/`) || link.props.href?.startsWith(`${basePath}/engine/`));
    assert.deepEqual(local.map((link) => link.props.href).sort(), localPaths.map((path) => `${basePath}/${path}`).sort());
    for (const link of local) {
      assert.equal(link.props.target, undefined, link.props.href);
      if (link.props.href.endsWith(".tar.gz")) assert.match(link.props["aria-label"], /^Kode sumber Stockfish /);
      if (link.props.href.endsWith(".nnue")) assert.match(link.props["aria-label"], /^Jaringan NNUE /);
    }
    const external = links.filter((link) => link.props.href?.startsWith("https://"));
    assert.deepEqual(external.map((link) => link.props.href).sort(), [...externalUrls].sort());
    for (const link of external) {
      assert.equal(link.props.target, "_blank");
      assert.match(link.props.rel, /\bnoopener\b/);
      assert.match(link.props.rel, /\bnoreferrer\b/);
      assert.ok(link.findAll((node) => node.props.className === "sr-only" && text(node.children[0]).includes("terbuka di tab baru")).length, link.props.href);
    }
    renderer.unmount();
  }
});

test("copyright, license, engine and trademark notices remain visible", () => {
  const { renderer } = renderPage();
  const content = text(renderer.root).replace(/\s+/g, " ");
  for (const notice of [
    "© 2025–2026 Delta-Polder-Indonesia",
    "© 2025 Delo",
    "© 2026 Chess Game Reviewer contributors",
    "dilisensikan GPL-3.0",
    "memakai satu utas dan berjalan lokal di peramban",
    "Stockfish 18 Lite (JS 18.0.8) memakai WASM yang sama dengan Stockfish 18 Lite bawaan, dengan pemuat JavaScript berbeda",
    "Salin jaringan yang sesuai ke direktori src/ sumber jika membangun ulang engine",
    "Desain bidak oleh Cburnett",
    "CC BY-SA 3.0",
    "Beberapa nama berkas menggunakan suara yang sama",
    "CC0 1.0",
    "© 2013 Panayiotis Lipiridis",
    "SIL OFL 1.1",
    "Nama dan logo Chess.com serta Lichess merupakan merek pemiliknya masing-masing",
  ]) assert.ok(content.includes(notice), notice);
  renderer.unmount();
});
