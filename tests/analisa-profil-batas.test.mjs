import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";
import * as profil from "../src/modul/profil/index.js";
import * as pemainLama from "../src/lib/pemainCatur.js";
import * as benderaLama from "../src/lib/bendera.js";

const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(akar, "src");
const modul = resolve(src, "modul/profil");
const api = resolve(modul, "index.js");
const asets = resolve(src, "lib/asets.js");
const pathLama = new Set([resolve(src, "lib/pemainCatur.js"), resolve(src, "lib/bendera.js")]);
const ekstensi = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];

function berkasKode(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entri) => {
    const path = resolve(dir, entri.name);
    if (entri.isDirectory()) return berkasKode(path);
    return entri.isFile() && ekstensi.includes(extname(path)) ? [path] : [];
  });
}

function referensi(path) {
  const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  const hasil = [];
  function kunjungi(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (ts.isStringLiteralLike(node.moduleSpecifier)) hasil.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node)) {
      const impor = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const require = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (impor || require) {
        const argumen = node.arguments[0];
        assert.ok(argumen && ts.isStringLiteralLike(argumen), `Import nonliteral: ${relative(akar, path)}`);
        hasil.push(argumen.text);
      }
    }
    ts.forEachChild(node, kunjungi);
  }
  kunjungi(ast);
  return hasil;
}

function tujuan(source, ref) {
  const bersih = ref.split(/[?#]/, 1)[0];
  let dasar;
  if (bersih.startsWith("@/")) dasar = resolve(src, bersih.slice(2));
  else if (bersih.startsWith(".")) dasar = resolve(dirname(source), bersih);
  else return null;
  const kandidat = [dasar, ...ekstensi.map((ext) => dasar + ext), ...ekstensi.map((ext) => resolve(dasar, `index${ext}`))];
  const ditemukan = kandidat.find((path) => existsSync(path) && statSync(path).isFile());
  assert.ok(ditemukan, `Import tidak terpecahkan: ${relative(akar, source)} -> ${ref}`);
  return ditemukan;
}

function diDalam(path, folder) {
  return path === folder || path.startsWith(folder + sep);
}

test("Profil exposes the four existing named exports and the legacy paths preserve their identities", () => {
  assert.deepEqual(Object.keys(profil).sort(), ["ambilKartuPemain", "segarkanKartuPemain", "urlBendera", "useKartuPemain"].sort());
  assert.deepEqual(Object.keys(pemainLama).sort(), ["ambilKartuPemain", "segarkanKartuPemain", "useKartuPemain"].sort());
  assert.deepEqual(Object.keys(benderaLama), ["urlBendera"]);
  for (const nama of Object.keys(pemainLama)) assert.strictEqual(pemainLama[nama], profil[nama]);
  assert.strictEqual(benderaLama.urlBendera, profil.urlBendera);
});

test("new and legacy imports share one profile cache, including refresh", async (tes) => {
  const fetchLama = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  const storageLama = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const data = new Map();
  let calls = 0;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  } });
  Object.defineProperty(globalThis, "fetch", { configurable: true, writable: true, value: async () => {
    const nomor = ++calls;
    return { ok: true, json: async () => ({ id: `same-${nomor}`, profile: { firstName: "Shared", lastName: String(nomor) }, perfs: {}, count: {} }) };
  } });
  tes.after(() => {
    if (fetchLama) Object.defineProperty(globalThis, "fetch", fetchLama); else delete globalThis.fetch;
    if (storageLama) Object.defineProperty(globalThis, "localStorage", storageLama); else delete globalThis.localStorage;
  });
  const first = await pemainLama.ambilKartuPemain("shared-module-cache", "lichessOrg");
  assert.equal(first.name, "Shared 1");
  assert.strictEqual(await profil.ambilKartuPemain("SHARED-MODULE-CACHE", "lichessOrg"), first);
  const refreshed = await profil.segarkanKartuPemain("shared-module-cache", "lichessOrg");
  assert.equal(refreshed.name, "Shared 2");
  assert.strictEqual(await pemainLama.ambilKartuPemain("shared-module-cache", "lichessOrg"), refreshed);
  assert.equal(calls, 2);
  assert.equal(JSON.parse(data.get("maestro-analisa-pemain-v2-lichessOrg:shared-module-cache")).name, "Shared 2");
});

test("Profil and its allowed shared helper do not depend on other features", () => {
  const antrean = berkasKode(modul);
  const diperiksa = new Set();
  while (antrean.length) {
    const source = antrean.shift();
    if (diperiksa.has(source)) continue;
    diperiksa.add(source);
    for (const ref of referensi(source)) {
      const target = tujuan(source, ref);
      if (target === null) {
        assert.equal(ref, "react", `Dependensi eksternal Profil tidak diizinkan: ${relative(akar, source)} -> ${ref}`);
      } else {
        assert.ok(diDalam(target, modul) || target === asets,
          `Profil tidak boleh bergantung ke fitur lain: ${relative(akar, source)} -> ${relative(akar, target)}`);
        antrean.push(target);
      }
    }
  }
  assert.ok(diperiksa.has(api));
  assert.ok(diperiksa.has(asets));
});

test("application consumers use the Profil facade, not private files or legacy paths", () => {
  const konsumen = new Set();
  for (const source of berkasKode(src)) {
    if (diDalam(source, modul)) continue;
    for (const ref of referensi(source)) {
      const target = tujuan(source, ref);
      if (!target) continue;
      assert.equal(pathLama.has(target), false, `Import path Profil lama di source: ${relative(akar, source)} -> ${ref}`);
      if (diDalam(target, modul)) {
        assert.equal(target, api, `Import internal Profil dari luar modul: ${relative(akar, source)} -> ${ref}`);
        if (!pathLama.has(source)) konsumen.add(relative(akar, source));
      }
    }
  }
  for (const expected of [
    "src/halaman/Analisa/akun/KartuAkun.jsx",
    "src/halaman/Analisa/komponen/game/game.jsx",
    "src/halaman/Analisa/komponen/game/name.jsx",
    "src/halaman/Analisa/komponen/menu/analysis/summary/playersAccuracy.jsx",
    "src/halaman/Analisa/komponen/nav/wawasan/kartuProfil.jsx",
  ]) assert.ok(konsumen.has(expected), `Pemanggil belum memakai API Profil: ${expected}`);
});
