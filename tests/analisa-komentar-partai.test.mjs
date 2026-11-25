import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";

// overallGameComment.jsx adalah modul fungsi murni (tanpa JSX/impor); transpile
// lalu jalankan untuk mengambil ekspor default getOverallGameComment.
function muat(path) {
  const filename = new URL(path, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename.pathname,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = { exports: {} };
  runInThisContext(`(function (require, module, exports) {\n${compiled}\n})`)(() => {
    throw new Error("Dependensi tak terduga");
  }, result, result.exports);
  return result.exports.default;
}

const getOverallGameComment = muat("../src/halaman/Analisa/komponen/menu/analysis/moves/overallGameComment.jsx");

// Tiruan i18n: substitusi placeholder {menang}/{kalah} seperti kamus asli.
const t = (kunci, vars) => `Pembuka {menang} penutup {kalah}`.replaceAll("{menang}", vars.menang).replaceAll("{kalah}", vars.kalah);

test("komentar partai memakai kelas warna, bukan atribut style inline (CSP style-src-attr 'none')", () => {
  for (const hasil of ["1-0", "0-1", "1/2-1/2", "tidak-diketahui"]) {
    const html = getOverallGameComment(["Putih Nama", "Hitam Nama"], hasil, t);
    assert.ok(html.includes('class="font-extrabold text-foregroundBlackDark"'), `kelas warna harus ada untuk hasil ${hasil}`);
    assert.equal(html.includes("style="), false, `tidak boleh ada atribut style untuk hasil ${hasil}`);
    assert.ok(html.includes("Putih Nama") && html.includes("Hitam Nama"), "nama pemain tetap tampil");
  }
});

test("nama pemain dengan karakter khusus tetap di-escape (sanitasi tidak dilemahkan)", () => {
  const berbahaya = '<script>alert(1)</script> & "kutip" \'tunggal\'';
  const html = getOverallGameComment([berbahaya, "Lawan"], "1-0", t);
  assert.equal(html.includes("<script>"), false, "markup berbahaya tidak boleh lolos");
  assert.ok(html.includes("&lt;script&gt;"), "kurung sudut di-escape");
  assert.ok(html.includes("&amp;"), "ampersand di-escape");
  assert.ok(html.includes("&quot;"), "kutip ganda di-escape");
  assert.ok(html.includes("&#39;"), "kutip tunggal di-escape");
  assert.equal(html.includes("style="), false);
});

test("nama kosong/null tidak menyebabkan crash dan tetap menghasilkan HTML aman", () => {
  for (const nama of [[null, undefined], ["", ""], [undefined, "Hitam"]]) {
    const html = getOverallGameComment(nama, "1-0", t);
    assert.equal(typeof html, "string");
    assert.equal(html.includes("style="), false);
    assert.ok(html.includes('class="font-extrabold text-foregroundBlackDark"'));
  }
});
