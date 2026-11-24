import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(akar, "src");
const ekstensiKode = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];

function berkasKode(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entri) => {
    const path = join(dir, entri.name);
    if (entri.isDirectory()) return berkasKode(path);
    return entri.isFile() && ekstensiKode.includes(extname(entri.name)) ? [path] : [];
  });
}

function referensiKode(teks, nama) {
  const ast = ts.createSourceFile(nama, teks, ts.ScriptTarget.Latest, true);
  const literal = [];
  const nonliteral = [];
  function kunjungi(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (ts.isStringLiteralLike(node.moduleSpecifier)) literal.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node)) {
      const impor = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const require = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (impor || require) {
        const argumen = node.arguments[0];
        if (argumen && ts.isStringLiteralLike(argumen)) literal.push(argumen.text);
        else nonliteral.push(ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1);
      }
    }
    ts.forEachChild(node, kunjungi);
  }
  kunjungi(ast);
  return { literal, nonliteral };
}

function cariSiklus(graf) {
  const status = new Map();
  const jalur = [];
  function kunjungi(simpul) {
    status.set(simpul, "aktif");
    jalur.push(simpul);
    for (const tujuan of graf.get(simpul) || []) {
      if (status.get(tujuan) === "aktif") return [...jalur.slice(jalur.indexOf(tujuan)), tujuan];
      if (!status.has(tujuan)) {
        const siklus = kunjungi(tujuan);
        if (siklus) return siklus;
      }
    }
    jalur.pop();
    status.set(simpul, "selesai");
    return null;
  }
  for (const simpul of graf.keys()) {
    if (status.has(simpul)) continue;
    const siklus = kunjungi(simpul);
    if (siklus) return siklus;
  }
  return null;
}

test("dependency parser covers imports, re-exports and dynamic calls", () => {
  const teks = [
    'import { x } from "./a.js";',
    'export * from "./b.js";',
    'const c = import("./c.js");',
    'const d = require("./d.js");',
    'const e = import(path);',
  ].join("\n");
  assert.deepEqual(referensiKode(teks, "contoh.js"), {
    literal: ["./a.js", "./b.js", "./c.js", "./d.js"],
    nonliteral: [5],
  });
});

test("cycle detector catches the former database shape and self-imports", () => {
  const dahulu = new Map([
    ["index", ["partai", "koleksi", "statistik", "akun"]],
    ["partai", ["index"]],
    ["koleksi", ["index", "partai"]],
    ["statistik", ["index", "partai", "koleksi"]],
    ["akun", ["index"]],
  ]);
  assert.deepEqual(cariSiklus(dahulu), ["index", "partai", "index"]);
  assert.deepEqual(cariSiklus(new Map([["sendiri", ["sendiri"]]])), ["sendiri", "sendiri"]);
  assert.equal(cariSiklus(new Map([["atas", ["bawah"]], ["bawah", []]])), null);
});

test("source imports and re-exports have no circular dependencies", () => {
  const semuaBerkas = berkasKode(src);
  const himpunan = new Set(semuaBerkas);
  const graf = new Map(semuaBerkas.map((path) => [path, new Set()]));
  const belumTerpecahkan = [];
  const nonliteral = [];

  for (const path of semuaBerkas) {
    const hasil = referensiKode(readFileSync(path, "utf8"), path);
    nonliteral.push(...hasil.nonliteral.map((baris) => `${relative(akar, path)}:${baris}`));
    for (const ref of hasil.literal) {
      const bersih = ref.split(/[?#]/, 1)[0];
      let dasar;
      if (bersih.startsWith("@/")) dasar = resolve(src, bersih.slice(2));
      else if (bersih.startsWith(".")) dasar = resolve(dirname(path), bersih);
      else continue; // Paket eksternal bukan simpul source aplikasi.

      const kandidat = [dasar, ...ekstensiKode.map((ext) => dasar + ext), ...ekstensiKode.map((ext) => join(dasar, "index" + ext))];
      const tujuan = kandidat.find((item) => himpunan.has(item));
      if (tujuan) graf.get(path).add(tujuan);
      else if (!existsSync(dasar) || extname(dasar) !== ".css") belumTerpecahkan.push(`${relative(akar, path)}: ${ref}`);
    }
  }

  assert.ok(semuaBerkas.length > 0);
  assert.deepEqual(belumTerpecahkan, [], "Semua referensi relatif/alias harus dapat diresolusi");
  assert.deepEqual(nonliteral, [], "Import/require nonliteral perlu ditinjau agar graf tidak diam-diam tidak lengkap");
  const database = join(src, "halaman", "Analisa", "database");
  const index = join(database, "index.js");
  const revisi = join(database, "revisiBasis.js");
  assert.ok(graf.get(index)?.has(revisi), "Barrel harus me-re-export bus revisi");
  for (const nama of ["partai.js", "koleksi.js", "statistik.js", "akun.js"]) {
    const dependensi = graf.get(join(database, nama));
    assert.ok(dependensi?.has(revisi), `${nama} harus menggunakan bus privat`);
    assert.equal(dependensi.has(index), false, `${nama} tidak boleh mengimpor barrel database`);
  }
  const siklus = cariSiklus(graf);
  assert.equal(siklus, null, siklus?.map((path) => relative(akar, path)).join(" -> "));
});
