import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import * as profil from "../src/modul/profil/index.js";
import { KELAS_RATING } from "../src/halaman/Analisa/komponen/nav/wawasan/opsiWawasan.js";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const kosong = () => null;
const pembungkus = ({ children }) => React.createElement(React.Fragment, null, children);

function kompilasi(path, dependencies) {
  const filename = new URL(path, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename.pathname,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = { exports: {} };
  runInThisContext(`(function (require, module, exports) {\n${compiled}\n})`)((id) => {
    if (id === "react" || id === "react/jsx-runtime") return require(id);
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, result, result.exports);
  return result.exports.default;
}

function gantiGlobal(tes, nama, nilai) {
  const lama = Object.getOwnPropertyDescriptor(globalThis, nama);
  Object.defineProperty(globalThis, nama, { configurable: true, writable: true, value: nilai });
  tes.after(() => {
    if (lama) Object.defineProperty(globalThis, nama, lama);
    else delete globalThis[nama];
  });
}

test("account, insights, and board consumers use the real shared profile module and subpath flags", async (tes) => {
  const originalBase = process.env.NEXT_PUBLIC_BASE_PATH;
  process.env.NEXT_PUBLIC_BASE_PATH = "/Maestro-Chess";
  tes.after(() => {
    if (originalBase === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = originalBase;
  });
  const storage = new Map();
  gantiGlobal(tes, "localStorage", {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  });
  let profilCalls = 0;
  const urls = [];
  gantiGlobal(tes, "fetch", async (url) => {
    urls.push(url);
    if (url.endsWith("/stats")) {
      const rating = profilCalls === 1 ? 1500 : 1600;
      return { ok: true, json: async () => ({ chess_rapid: { last: { rating }, record: { win: 3, loss: 1, draw: 1 } } }) };
    }
    const nomor = ++profilCalls;
    return { ok: true, json: async () => ({
      name: `Profile ${nomor}`, avatar: `https://example.test/avatar-${nomor}.png`,
      country: "https://api.chess.com/pub/country/ID",
    }) };
  });
  const dialog = Object.fromEntries([
    "AlertDialog", "AlertDialogAction", "AlertDialogCancel", "AlertDialogContent",
    "AlertDialogDescription", "AlertDialogFooter", "AlertDialogHeader", "AlertDialogTitle",
  ].map((nama) => [nama, pembungkus]));
  const Akun = kompilasi("../src/halaman/Analisa/akun/KartuAkun.jsx", {
    "../../../lib/i18n.jsx": { useI18n: () => ({ t: (key) => key, bahasa: "en" }) },
    "../../../components/ui/tooltip.jsx": { TooltipLabel: pembungkus },
    "../../../components/ui/alert-dialog.jsx": dialog,
    "@/modul/profil/index.js": profil,
    "../basisData.js": { bacaRevisiBasis: () => 0, ambilDaftarPartai: async () => ({ partai: [], total: 2 }) },
    "../komponen/svg/profile.jsx": { default: kosong },
    "../komponen/svg/trash.jsx": { default: kosong },
  });
  const Wawasan = kompilasi("../src/halaman/Analisa/komponen/nav/wawasan/kartuProfil.jsx", {
    "@/modul/profil/index.js": profil,
    "../../LencanaGelar.jsx": { default: kosong },
    "../../svg/refresh.jsx": { default: kosong },
    "./opsiWawasan.js": { KELAS_RATING },
    "../../../../../components/ui/tooltip.jsx": { TooltipLabel: pembungkus },
  });
  const NamaPapan = kompilasi("../src/halaman/Analisa/komponen/game/name.jsx", {
    "@/modul/profil/index.js": profil,
    "../svg/profile.jsx": { default: kosong },
    "./capturedPieces.jsx": { default: kosong },
    "../LencanaGelar.jsx": { default: kosong },
  });
  let akun;
  let wawasan;
  let papan;
  tes.after(() => act(() => { akun?.unmount(); wawasan?.unmount(); papan?.unmount(); }));
  const username = "integration-profile";
  await act(async () => {
    akun = TestRenderer.create(React.createElement(Akun, { username, platform: "chessCom" }));
    await flush();
  });
  assert.equal(profilCalls, 1);
  assert.ok(akun.root.findAllByType("img").some((node) => node.props.src === "https://example.test/avatar-1.png"));
  await act(async () => {
    wawasan = TestRenderer.create(React.createElement(Wawasan, { username, platform: "chessCom", t: (key) => key, locale: "en" }));
    papan = TestRenderer.create(React.createElement(NamaPapan, { flag: "🇮🇩", white: true }, username));
    await flush();
  });
  assert.equal(profilCalls, 1, "Wawasan reads the same cached card used by Akun");
  assert.ok(JSON.stringify(wawasan.toJSON()).includes("Profile 1"));
  assert.ok(wawasan.root.findAllByType("img").some((node) => node.props.src === "/Maestro-Chess/flags/id.svg"));
  assert.ok(papan.root.findAllByType("img").some((node) => node.props.src === "/Maestro-Chess/flags/id.svg"));
  await act(async () => { await wawasan.root.findByProps({ "data-uji": "wawasan-profil-refresh" }).props.onClick(); await flush(); });
  assert.equal(profilCalls, 2);
  assert.ok(JSON.stringify(wawasan.toJSON()).includes("Profile 2"));
  assert.ok(akun.root.findAllByType("img").some((node) => node.props.src === "https://example.test/avatar-1.png"),
    "the already mounted account hook does not subscribe to refreshes");
  assert.equal((await profil.ambilKartuPemain(username, "chessCom")).name, "Profile 2");
  assert.equal(JSON.parse(storage.get("maestro-analisa-pemain-v2-chessCom:integration-profile")).name, "Profile 2");
  assert.deepEqual(urls, [
    "https://api.chess.com/pub/player/integration-profile",
    "https://api.chess.com/pub/player/integration-profile/stats",
    "https://api.chess.com/pub/player/integration-profile",
    "https://api.chess.com/pub/player/integration-profile/stats",
  ]);
});
