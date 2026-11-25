import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";
import ts from "typescript";

// Pemuat pengujian: transpile JSX/ESM dengan dependensi yang sudah terpasang,
// tetapi cache tiap modul agar identitas context/re-export tetap realistis.
const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

export function buatPemuatJsx(tiruan = {}, paket = {}) {
  const cache = new Map();
  const mocks = new Map(Object.entries(tiruan).map(([path, nilai]) => [resolve(akar, path), nilai]));

  function muat(path) {
    const nama = resolve(akar, path);
    if (mocks.has(nama)) return mocks.get(nama);
    if (cache.has(nama)) return cache.get(nama).exports;
    const kode = ts.transpileModule(readFileSync(nama, "utf8"), {
      fileName: nama,
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const modul = { exports: {} };
    cache.set(nama, modul);
    try {
      const jalankan = runInThisContext(`(function (require, module, exports) {\n${kode}\n})`, { filename: nama });
      jalankan((ref) => {
        if (ref === "react" || ref === "react/jsx-runtime") return require(ref);
        if (Object.hasOwn(paket, ref)) return paket[ref];
        if (ref.startsWith("@/")) return muat(resolve(akar, "src", ref.slice(2)));
        if (ref.startsWith(".")) return muat(resolve(dirname(nama), ref));
        throw new Error(`Dependensi pengujian tidak dikenal: ${nama} -> ${ref}`);
      }, modul, modul.exports);
    } catch (error) {
      cache.delete(nama);
      throw error;
    }
    return modul.exports;
  }

  return muat;
}
