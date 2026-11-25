import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const JS_SCRIPT_TYPES = new Set([
  "",
  "text/javascript",
  "application/javascript",
  "application/ecmascript",
  "text/ecmascript",
  "module",
]);

function collectHtmlFiles(directory) {
  if (!existsSync(directory)) return [];
  const results = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

function parseScriptAttributes(attrs) {
  const hasSrc = /\bsrc\s*=/i.test(attrs);
  const typeMatch = attrs.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const type = (typeMatch?.[1] ?? typeMatch?.[2] ?? typeMatch?.[3] ?? "").trim().toLowerCase();
  const isModule = type === "module";
  const noModule = /\bnomodule\b/i.test(attrs);
  return { hasSrc, type, isModule, noModule };
}

export function isExecutableInlineScript(attrs, body) {
  const { hasSrc, type } = parseScriptAttributes(attrs);
  return !hasSrc && JS_SCRIPT_TYPES.has(type) && body.trim().length > 0;
}

function resolveBasePath(projectDir, explicitBasePath) {
  let basePath = explicitBasePath;
  if (basePath === undefined) {
    const routesManifestPath = join(projectDir, ".next", "routes-manifest.json");
    if (existsSync(routesManifestPath)) {
      const manifest = JSON.parse(readFileSync(routesManifestPath, "utf8"));
      if (typeof manifest.basePath === "string") {
        basePath = manifest.basePath;
      }
    }
  }
  if (basePath === undefined) {
    basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  }
  if (!basePath || basePath === "/") return "";
  return basePath.replace(/\/+$/, "");
}

function processHtmlTree({ htmlDirs, staticDir, basePath }) {
  const cspDir = join(staticDir, "csp");
  const referencedFiles = new Set();
  const existingCspSrcRe = /<script\b[^>]*\bsrc\s*=\s*["'][^"']*\/_next\/static\/csp\/([^"'?#]+\.js)["'][^>]*>/gi;
  const scriptTagRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

  let transformedHtmlCount = 0;
  let extractedScriptCount = 0;

  for (const htmlDir of htmlDirs) {
    for (const htmlPath of collectHtmlFiles(htmlDir)) {
      const originalHtml = readFileSync(htmlPath, "utf8");
      for (const existing of originalHtml.matchAll(existingCspSrcRe)) {
        referencedFiles.add(existing[1]);
      }

      const executableTokens = [];
      for (const match of originalHtml.matchAll(scriptTagRe)) {
        const attrs = match[1];
        const body = match[2];
        if (!isExecutableInlineScript(attrs, body)) continue;
        const { isModule, noModule } = parseScriptAttributes(attrs);
        executableTokens.push({
          start: match.index,
          end: match.index + match[0].length,
          body,
          isModule,
          noModule,
        });
      }

      if (executableTokens.length === 0) continue;

      const groups = [];
      for (const token of executableTokens) {
        const prevGroup = groups.at(-1);
        const prevToken = prevGroup?.at(-1);
        const between = prevToken ? originalHtml.slice(prevToken.end, token.start) : null;
        if (
          prevGroup &&
          between !== null &&
          /^\s*$/.test(between) &&
          prevToken.isModule === token.isModule &&
          prevToken.noModule === token.noModule
        ) {
          prevGroup.push(token);
        } else {
          groups.push([token]);
        }
      }

      let cursor = 0;
      let updatedHtml = "";
      for (const group of groups) {
        const first = group[0];
        const last = group[group.length - 1];
        const combinedJs = `${group.map((item) => item.body).join("\n;\n")}\n`;
        const hash = createHash("sha256").update(combinedJs, "utf8").digest("hex").slice(0, 16);
        const filename = `flight-${hash}.js`;

        mkdirSync(cspDir, { recursive: true });
        writeFileSync(join(cspDir, filename), combinedJs, "utf8");
        referencedFiles.add(filename);
        extractedScriptCount += group.length;

        const attrParts = [`src="${basePath}/_next/static/csp/${filename}"`];
        if (first.isModule) attrParts.push('type="module"');
        if (first.noModule) attrParts.push('noModule=""');

        updatedHtml += originalHtml.slice(cursor, first.start);
        updatedHtml += `<script ${attrParts.join(" ")}></script>`;
        cursor = last.end;
      }
      updatedHtml += originalHtml.slice(cursor);

      writeFileSync(htmlPath, updatedHtml, "utf8");
      transformedHtmlCount += 1;
    }
  }

  if (existsSync(cspDir)) {
    for (const entry of readdirSync(cspDir, { withFileTypes: true })) {
      if (entry.isFile() && !referencedFiles.has(entry.name)) {
        rmSync(join(cspDir, entry.name));
      }
    }
  }

  return { transformedHtmlCount, extractedScriptCount, files: [...referencedFiles].sort() };
}

export function externalizeInlineScripts(projectDirectory = ".", options = {}) {
  const projectDir = resolve(projectDirectory);
  const basePath = resolveBasePath(projectDir, options.basePath);

  let exportDir = join(projectDir, "dist");
  const exportDetailPath = join(projectDir, ".next", "export-detail.json");
  if (!existsSync(exportDir) && existsSync(exportDetailPath)) {
    const detail = JSON.parse(readFileSync(exportDetailPath, "utf8"));
    if (typeof detail.outDirectory === "string" && existsSync(detail.outDirectory)) {
      exportDir = detail.outDirectory;
    }
  }

  const distSummary = existsSync(exportDir)
    ? processHtmlTree({
        htmlDirs: [exportDir],
        staticDir: join(exportDir, "_next", "static"),
        basePath,
      })
    : { transformedHtmlCount: 0, extractedScriptCount: 0, files: [] };

  const nextServerDir = join(projectDir, ".next", "server");
  const nextStaticDir = join(projectDir, ".next", "static");
  const nextSummary =
    existsSync(nextServerDir) && existsSync(nextStaticDir)
      ? processHtmlTree({
          htmlDirs: [join(nextServerDir, "app"), join(nextServerDir, "pages")],
          staticDir: nextStaticDir,
          basePath,
        })
      : { transformedHtmlCount: 0, extractedScriptCount: 0, files: [] };

  return { basePath, dist: distSummary, next: nextSummary };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const summary = externalizeInlineScripts(process.argv[2] ?? ".");
  console.log(
    `Externalized ${summary.dist.extractedScriptCount} inline scripts across ${summary.dist.transformedHtmlCount} exported HTML files (${summary.dist.files.length} CSP script asset(s)).`,
  );
}
