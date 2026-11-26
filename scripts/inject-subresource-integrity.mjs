import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Injeksi Subresource Integrity (SRI) pasca-build.
 *
 * Dijalankan SETELAH externalize-inline-scripts.mjs supaya seluruh skrip Flight
 * sudah berupa berkas eksternal dan HTML sudah final. Hash SHA-384 dihitung dari
 * byte akhir berkas yang dirujuk, lalu atribut integrity + crossorigin ditambahkan
 * pada <script src>, <link rel="stylesheet">, dan <link rel="preload" as="script|style">
 * yang berasal dari origin sendiri (/_next/static/...). Berlaku untuk dua pohon:
 * dist/ (hosting statis) dan .next/server/ (yang dilayani Vercel).
 *
 * Cakupan: skrip/stylesheet awal yang direferensikan HTML. Chunk dinamis yang
 * dimuat runtime oleh webpack (createElement("script")) TIDAK dicakup di sini;
 * lihat laporan audit Tahap 5. Proses ini idempoten.
 */

function collectHtmlFiles(directory) {
  if (!existsSync(directory)) return [];
  const results = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) results.push(...collectHtmlFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith(".html")) results.push(fullPath);
  }
  return results.sort();
}

function resolveBasePath(projectDir, explicitBasePath) {
  let basePath = explicitBasePath;
  if (basePath === undefined) {
    const routesManifestPath = join(projectDir, ".next", "routes-manifest.json");
    if (existsSync(routesManifestPath)) {
      const manifest = JSON.parse(readFileSync(routesManifestPath, "utf8"));
      if (typeof manifest.basePath === "string") basePath = manifest.basePath;
    }
  }
  if (basePath === undefined) basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  if (!basePath || basePath === "/") return "";
  return basePath.replace(/\/+$/, "");
}

function ambilAtribut(tag, nama) {
  const match = tag.match(new RegExp(`\\b${nama}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

/** Path berkas aset dari URL same-origin /_next/static/... (basePath dilepas). */
function resolveAset(url, staticDir, basePath) {
  if (!url) return null;
  let path = url;
  if (basePath && path.startsWith(basePath + "/")) path = path.slice(basePath.length);
  const match = path.match(/^\/_next\/static\/(.+)$/);
  if (!match) return null;
  const file = join(staticDir, match[1]);
  return existsSync(file) ? file : null;
}

function hashFile(file, cache) {
  if (!cache.has(file)) {
    cache.set(file, createHash("sha384").update(readFileSync(file)).digest("base64"));
  }
  return cache.get(file);
}

function tambahIntegrity(tag, hash) {
  // Buang integrity/crossorigin lama agar idempoten dan tidak duplikat.
  let bersih = tag
    .replace(/\s+integrity\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+crossorigin\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  const attrs = ` integrity="sha384-${hash}" crossorigin="anonymous"`;
  if (bersih.endsWith("/>")) return bersih.slice(0, -2) + attrs + "/>";
  return bersih.slice(0, -1) + attrs + ">";
}

function processHtml(html, staticDir, basePath, cache) {
  let diubah = false;
  const hasil = html
    .replace(/<script\b[^>]*>/gi, (tag) => {
      const file = resolveAset(ambilAtribut(tag, "src"), staticDir, basePath);
      if (!file) return tag;
      diubah = true;
      return tambahIntegrity(tag, hashFile(file, cache));
    })
    .replace(/<link\b[^>]*>/gi, (tag) => {
      const rel = (ambilAtribut(tag, "rel") ?? "").toLowerCase();
      const as = (ambilAtribut(tag, "as") ?? "").toLowerCase();
      const layak = rel === "stylesheet" || (rel === "preload" && (as === "script" || as === "style"));
      if (!layak) return tag;
      const file = resolveAset(ambilAtribut(tag, "href"), staticDir, basePath);
      if (!file) return tag;
      diubah = true;
      return tambahIntegrity(tag, hashFile(file, cache));
    });
  return { html: hasil, diubah };
}

function processHtmlTree({ htmlDirs, staticDir, basePath }) {
  const cache = new Map();
  let transformedHtmlCount = 0;
  let taggedSubresourceCount = 0;
  for (const htmlDir of htmlDirs) {
    for (const htmlPath of collectHtmlFiles(htmlDir)) {
      const originalHtml = readFileSync(htmlPath, "utf8");
      const { html, diubah } = processHtml(originalHtml, staticDir, basePath, cache);
      if (!diubah) continue;
      const jumlah = (html.match(/\bintegrity="sha384-/g) ?? []).length;
      taggedSubresourceCount += jumlah;
      if (html !== originalHtml) {
        writeFileSync(htmlPath, html, "utf8");
        transformedHtmlCount += 1;
      }
    }
  }
  return { transformedHtmlCount, taggedSubresourceCount };
}

export function injectSubresourceIntegrity(projectDirectory = ".", options = {}) {
  const projectDir = resolve(projectDirectory);
  const basePath = resolveBasePath(projectDir, options.basePath);

  let exportDir = join(projectDir, "dist");
  const exportDetailPath = join(projectDir, ".next", "export-detail.json");
  if (!existsSync(exportDir) && existsSync(exportDetailPath)) {
    const detail = JSON.parse(readFileSync(exportDetailPath, "utf8"));
    if (typeof detail.outDirectory === "string" && existsSync(detail.outDirectory)) exportDir = detail.outDirectory;
  }

  const distSummary = existsSync(exportDir)
    ? processHtmlTree({ htmlDirs: [exportDir], staticDir: join(exportDir, "_next", "static"), basePath })
    : { transformedHtmlCount: 0, taggedSubresourceCount: 0 };

  const nextServerDir = join(projectDir, ".next", "server");
  const nextStaticDir = join(projectDir, ".next", "static");
  const nextSummary = existsSync(nextServerDir) && existsSync(nextStaticDir)
    ? processHtmlTree({ htmlDirs: [join(nextServerDir, "app"), join(nextServerDir, "pages")], staticDir: nextStaticDir, basePath })
    : { transformedHtmlCount: 0, taggedSubresourceCount: 0 };

  return { basePath, dist: distSummary, next: nextSummary };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const summary = injectSubresourceIntegrity(process.argv[2] ?? ".");
  console.log(
    `SRI tagged ${summary.dist.taggedSubresourceCount} subresources across ${summary.dist.transformedHtmlCount} dist HTML files; ${summary.next.taggedSubresourceCount} across ${summary.next.transformedHtmlCount} Next server HTML files.`,
  );
}
