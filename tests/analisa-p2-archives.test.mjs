import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import { indexedDB, IDBDatabase, IDBKeyRange } from "fake-indexeddb";
import { storageMemori } from "./bantuStorage.mjs";
import { pesanPenyimpananPartai } from "../src/halaman/Analisa/database/statusSimpan.js";
import { analisa as indonesia } from "../src/lib/terjemahan/id/analisa.js";
import { analisa as english } from "../src/lib/terjemahan/en/analisa.js";

globalThis.localStorage = storageMemori();
globalThis.window = { indexedDB };
globalThis.IDBKeyRange = IDBKeyRange;
const { muatPartaiChessCom } = await import("../src/halaman/Analisa/akun/muatPartaiAkun.js");
const { ambilDaftarPartai } = await import("../src/halaman/Analisa/basisData.js");
const root = "https://api.chess.com/pub/player/archiveuser/games";
const urls = ["01", "02", "03", "04"].map((m) => `${root}/2025/${m}`);
const game = { pgn: '[White "ArchiveUser"]\n[Black "Bob"]\n\n1. e4 e5 *', url: "https://www.chess.com/game/live/123", end_time: 1735689600, white: { username: "ArchiveUser" }, black: { username: "Bob" } };

function mockFetch(t, handler) {
  const previous = globalThis.fetch;
  globalThis.fetch = handler;
  t.after(() => { globalThis.fetch = previous; });
}
const ok = (json) => ({ ok: true, json: async () => json });

test("failed, malformed and unreachable archives are returned in archive order while successful games are saved", async (t) => {
  mockFetch(t, async (url) => {
    if (url.endsWith("/archives")) return ok({ archives: urls });
    if (url.endsWith("/04")) return { ok: false, status: 503 };
    if (url.endsWith("/03")) return ok({ invalid: [] });
    if (url.endsWith("/02")) throw new TypeError("network error");
    return ok({ games: [game] });
  });
  const result = await muatPartaiChessCom("ArchiveUser", { paksa: true });
  assert.equal(result.totalArsip, 4);
  assert.deepEqual(result.arsipGagal, [
    { tahun: "2025", bulan: "04", status: 503 },
    { tahun: "2025", bulan: "03", status: 0 },
    { tahun: "2025", bulan: "02", status: 0 },
  ]);
  assert.equal(result.partai.length, 1);
  assert.equal(result.penyimpanan.tersimpan, 1);
  assert.equal((await ambilDaftarPartai({ koleksiId: "chessCom:archiveuser" })).total, 1);
});

test("partial download and independent storage failure are both observable", async (t) => {
  mockFetch(t, async (url) => {
    if (url.endsWith("/archives")) return ok({ archives: urls.slice(0, 2) });
    return url.endsWith("/02") ? { ok: false, status: 500 } : ok({ games: [game] });
  });
  const previous = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (stores, mode, ...rest) {
    if (mode === "readwrite") throw new DOMException("quota", "QuotaExceededError");
    return previous.call(this, stores, mode, ...rest);
  };
  t.after(() => { IDBDatabase.prototype.transaction = previous; });
  const result = await muatPartaiChessCom("ArchiveUser", { paksa: true });
  assert.equal(result.partai.length, 1);
  assert.equal(result.arsipGagal.length, 1);
  assert.equal(result.penyimpanan.media, "gagal");
  assert.equal(result.penyimpanan.tersimpan, 0);
});

test("all failures include details, empty archives succeed, and cancellation is not treated as a partial success", async (t) => {
  mockFetch(t, async (url) => {
    if (url.endsWith("/archives")) return ok({ archives: urls.slice(0, 2) });
    throw new Error("offline");
  });
  await assert.rejects(muatPartaiChessCom("ArchiveUser", { paksa: true }), (error) => {
    assert.equal(error.totalArsip, 2);
    assert.deepEqual(error.arsipGagal.map((a) => a.bulan), ["02", "01"]);
    return true;
  });
  globalThis.fetch = async () => ok({ invalid: [] });
  await assert.rejects(muatPartaiChessCom("ArchiveUser", { paksa: true }), /respons daftar arsip tidak valid/);
  globalThis.fetch = async () => ok({ archives: [] });
  const empty = await muatPartaiChessCom("ArchiveUser", { paksa: true });
  assert.deepEqual(empty, { partai: [], penyimpanan: { tersimpan: 0, total: 0, sementara: 0, media: "tidak-ada" }, arsipGagal: [], totalArsip: 0 });

  const controller = new AbortController();
  globalThis.fetch = async (url) => {
    if (url.endsWith("/archives")) return ok({ archives: [urls[0]] });
    controller.abort();
    throw new DOMException("canceled", "AbortError");
  };
  await assert.rejects(muatPartaiChessCom("ArchiveUser", { paksa: true, signal: controller.signal }), (error) => error.name === "AbortError");
});

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(new URL("../src/halaman/Analisa/akun/PanelTarikPartai.jsx", import.meta.url), "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const wrapper = ({ children }) => React.createElement(React.Fragment, null, children);
const kosong = () => null;
const flush = () => new Promise((resolve) => setImmediate(resolve));

for (const [language, dictionary] of [["id", indonesia], ["en", english]]) {
  test(`the ${language} panel reports archive and storage warnings together`, async () => {
    const translate = (key, args = {}) => {
      let text = key.split(".").reduce((value, part) => value?.[part], { analisa: dictionary }) ?? key;
      for (const [name, value] of Object.entries(args)) text = text.replaceAll(`{${name}}`, String(value));
      return text;
    };
    let download = { partai: [{}], penyimpanan: { tersimpan: 1, sementara: 0, media: "indexedDB" }, arsipGagal: [{ tahun: "2025", bulan: "02" }], totalArsip: 2 };
    const dependencies = {
      "../../../components/ui/tabs.jsx": { Tabs: wrapper, TabsContent: wrapper, TabsList: wrapper, TabsTrigger: wrapper },
      "../../../lib/i18n.jsx": { useI18n: () => ({ t: translate }) },
      "../penyimpanan.js": { bacaTeks: () => "", tulis: () => true },
      "./muatPartaiAkun.js": { muatPartaiChessCom: async () => { if (download instanceof Error) throw download; return download; }, muatPartaiLichess: kosong },
      "../database/statusSimpan.js": { pesanPenyimpananPartai },
      "./PemilihRentang.jsx": { default: kosong },
      "./rentangTanggal.js": { PRESET_RENTANG: ["30hari"], rentangPreset: () => ({ dari: "2025-01-01", sampai: "2025-03-01" }) },
    };
    const compiledModule = { exports: {} };
    runInThisContext(`(function (require, module, exports) {\n${compiled}\n})`)((id) => {
      if (id in dependencies) return dependencies[id];
      if (id === "react" || id === "react/jsx-runtime") return require(id);
      throw new Error(`Unexpected dependency: ${id}`);
    }, compiledModule, compiledModule.exports);
    let renderer;
    await TestRenderer.act(async () => { renderer = TestRenderer.create(React.createElement(compiledModule.exports.default, { akun: { platform: "chessCom", username: "ArchiveUser" }, abortRef: { current: null } })); });
    const click = async () => TestRenderer.act(async () => {
      renderer.root.findAllByType("button").find((node) => node.children.includes(translate("analisa.akun.tarik.muat"))).props.onClick();
      await flush();
    });
    const message = () => renderer.root.findByProps({ role: "alert" }).children.join("");
    await click();
    assert.match(message(), /2025-02/);
    assert.match(message(), language === "id" ? /1 dari 2 arsip gagal/ : /1 of 2 archives failed/);
    assert.match(message(), language === "id" ? /1 tersimpan permanen/ : /1 saved permanently/);
    download = { ...download, penyimpanan: { tersimpan: 0, sementara: 0, media: "gagal" } };
    await click();
    assert.match(message(), /2025-02/);
    assert.match(message(), language === "id" ? /Penyimpanan gagal/ : /Saving failed/);
    download = Object.assign(new Error("all failed"), { arsipGagal: [{ tahun: "2025", bulan: "01" }], totalArsip: 1 });
    await click();
    assert.match(message(), /2025-01/);
    TestRenderer.act(() => renderer.unmount());
  });
}
