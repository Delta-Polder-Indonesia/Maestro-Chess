import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { externalizeInlineScripts, isExecutableInlineScript } from "../scripts/externalize-inline-scripts.mjs";

function parseCsp(headerValue) {
  const directives = new Map();
  for (const part of headerValue.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [name, ...sources] = trimmed.split(/\s+/);
    assert.equal(directives.has(name.toLowerCase()), false, `Duplicate CSP directive: ${name}`);
    directives.set(name.toLowerCase(), sources);
  }
  return directives;
}

function walkFiles(dir, predicate) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(p, predicate));
    else if (entry.isFile() && predicate(p)) out.push(p);
  }
  return out.sort();
}

test("vercel.json enforces strict Observatory security headers without breaking Stockfish WASM or external avatars", () => {
  const vercelConfig = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.equal(vercelConfig.outputDirectory, null);
  assert.ok(Array.isArray(vercelConfig.headers) && vercelConfig.headers.length > 0);

  const globalRule = vercelConfig.headers.find((entry) => entry.source === "/(.*)");
  assert.ok(globalRule, "Missing global /(.*) header rule");

  const headerMap = new Map(globalRule.headers.map((item) => [item.key.toLowerCase(), item.value]));
  assert.equal(headerMap.get("x-content-type-options"), "nosniff");
  assert.equal(headerMap.get("x-frame-options"), "DENY");
  assert.equal(headerMap.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(headerMap.get("cross-origin-opener-policy"), "same-origin");
  assert.equal(headerMap.get("cross-origin-resource-policy"), "same-origin");
  assert.equal(headerMap.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");
  // COEP stays unset (deferred): require-corp is a candidate but needs browser
  // compatibility testing (Chrome/Firefox/Safari) before activation. See next.config.ts.
  assert.equal(headerMap.has("cross-origin-embedder-policy"), false);

  const cspRaw = headerMap.get("content-security-policy");
  assert.ok(cspRaw, "Missing Content-Security-Policy header");
  const csp = parseCsp(cspRaw);

  assert.deepEqual(csp.get("default-src"), ["'none'"]);
  assert.deepEqual(csp.get("base-uri"), ["'self'"]);
  assert.deepEqual(csp.get("form-action"), ["'self'"]);
  assert.deepEqual(csp.get("frame-ancestors"), ["'none'"]);
  assert.deepEqual(csp.get("frame-src"), ["'none'"]);
  assert.deepEqual(csp.get("object-src"), ["'none'"]);
  assert.deepEqual(csp.get("font-src"), ["'self'"]);
  assert.deepEqual(csp.get("media-src"), ["'self'"]);
  assert.deepEqual(csp.get("worker-src"), ["'self'"]);
  assert.deepEqual(csp.get("child-src"), ["'self'"]);
  // Style: atribut style inline diblokir penuh (style-src-attr 'none'). Elemen
  // <style> masih mengizinkan 'unsafe-inline' karena react-remove-scroll-bar
  // (modal Radix AlertDialog modal:true) menyuntik <style> scroll-lock dinamis
  // saat runtime yang tidak dapat di-hash/nonce secara aman pada static export.
  // Seluruh styling aplikasi lain berjalan via CSSOM runtime (tidak diatur CSP).
  assert.deepEqual(csp.get("style-src"), ["'self'"]);
  assert.deepEqual(csp.get("style-src-elem"), ["'self'", "'unsafe-inline'"]);
  assert.deepEqual(csp.get("style-src-attr"), ["'none'"]);
  for (const forbidden of ["'unsafe-inline'", "'unsafe-eval'", "*", "http:", "https:", "data:"]) {
    assert.equal(csp.get("style-src").includes(forbidden), false, `Forbidden style-src token: ${forbidden}`);
    assert.equal(csp.get("style-src-attr").includes(forbidden), false, `Forbidden style-src-attr token: ${forbidden}`);
  }
  assert.deepEqual(csp.get("img-src"), ["'self'", "https://images.chesscomfiles.com"]);
  for (const forbidden of ["data:", "https:", "http:", "*"]) {
    assert.equal(csp.get("img-src").includes(forbidden), false, `Forbidden img-src token: ${forbidden}`);
  }

  const scriptSrc = csp.get("script-src");
  assert.deepEqual(scriptSrc, ["'self'", "'wasm-unsafe-eval'"]);
  for (const forbidden of ["'unsafe-inline'", "'unsafe-eval'", "*", "http:", "https:", "data:", "blob:"]) {
    assert.equal(scriptSrc.includes(forbidden), false, `Forbidden script-src token: ${forbidden}`);
  }

  const connectSrc = csp.get("connect-src");
  assert.deepEqual(connectSrc, [
    "'self'",
    "https://api.chess.com",
    "https://www.chess.com",
    "https://lichess.org",
    "https://tablebase.lichess.org",
    "blob:",
  ]);

  // Every runtime fetch() origin in src/ must be covered by connect-src.
  const srcFiles = walkFiles(resolve("src"), (p) => /\.(js|jsx|ts|tsx)$/.test(p));
  const allowedOrigins = new Set(connectSrc.filter((s) => s.startsWith("https://")));
  for (const file of srcFiles) {
    const code = readFileSync(file, "utf8");
    for (const match of code.matchAll(/\bfetch\(\s*`?(https:\/\/[^/`"'?\s]+)/g)) {
      assert.ok(allowedOrigins.has(match[1]), `Unpermitted fetch origin ${match[1]} in ${file}`);
    }
  }
});

test("src avoids inline style forms blocked by style-src-attr 'none' (attribute, cssText, <style> element)", () => {
  // React style={{...}} diterapikan lewat CSSOM runtime dan TIDAK diblokir CSP,
  // jadi pola itu sengaja tidak dilarang. Yang dilarang: atribut style pada
  // markup/setAttribute, penugasan cssText, dan elemen <style> inline di src.
  const srcFiles = walkFiles(resolve("src"), (p) => /\.(js|jsx|ts|tsx)$/.test(p));
  const pola = [
    [/setAttribute\(\s*["']style["']/, "setAttribute('style', ...) diblokir style-src-attr 'none'"],
    [/\.cssText\s*=(?!=)/, "style.cssText = ... diblokir style-src-attr 'none'"],
    [/<style[\s>]/, "elemen <style> inline tidak boleh ditambahkan ke src"],
  ];
  for (const file of srcFiles) {
    const code = readFileSync(file, "utf8");
    for (const [re, pesan] of pola) {
      assert.equal(re.test(code), false, `${pesan}: ${file}`);
    }
  }
});

test("externalizeInlineScripts moves Next.js Flight inline scripts to same-origin static files identically for root and subpath builds", () => {
  assert.equal(isExecutableInlineScript("", "(self.__next_f=[]).push([0])"), true);
  assert.equal(isExecutableInlineScript('type="module"', "import './x.js'"), true);
  assert.equal(isExecutableInlineScript('src="/_next/static/a.js"', ""), false);
  assert.equal(isExecutableInlineScript('id="__NEXT_DATA__" type="application/json"', "{}"), false);

  for (const basePath of ["", "/Maestro-Chess"]) {
    const fixture = mkdtempSync(join(tmpdir(), "maestro-csp-"));
    try {
      const distDir = join(fixture, "dist");
      const nextAppDir = join(fixture, ".next/server/app");
      const nextPagesDir = join(fixture, ".next/server/pages");
      const nextStaticDir = join(fixture, ".next/static");

      mkdirSync(join(distDir, "_next/static/csp"), { recursive: true });
      mkdirSync(join(distDir, "attributions"), { recursive: true });
      mkdirSync(nextAppDir, { recursive: true });
      mkdirSync(nextPagesDir, { recursive: true });
      mkdirSync(nextStaticDir, { recursive: true });

      writeFileSync(join(fixture, ".next/routes-manifest.json"), JSON.stringify({ basePath }));
      writeFileSync(join(distDir, "_next/static/csp/stale.js"), "old();");

      const inline1 = "(self.__next_f=self.__next_f||[]).push([0])";
      const inline2 = 'self.__next_f.push([1,"hello"])';
      const inline3 = 'self.__next_f.push([1,"world"])';
      const indexHtml =
        `<!DOCTYPE html><html><head><script src="${basePath}/_next/static/chunks/main.js" async=""></script></head>` +
        `<body><script>${inline1}</script><script>${inline2}</script><script>${inline3}</script></body></html>`;
      const json500Html =
        '<!DOCTYPE html><html><body><script id="__NEXT_DATA__" type="application/json">{"err":500}</script></body></html>';

      writeFileSync(join(distDir, "index.html"), indexHtml);
      writeFileSync(join(distDir, "attributions/index.html"), indexHtml);
      writeFileSync(join(nextAppDir, "index.html"), indexHtml);
      writeFileSync(join(nextPagesDir, "500.html"), json500Html);

      const firstRun = externalizeInlineScripts(fixture);
      assert.equal(firstRun.basePath, basePath);
      assert.equal(firstRun.dist.transformedHtmlCount, 2);
      assert.equal(firstRun.dist.extractedScriptCount, 6);
      assert.equal(firstRun.dist.files.length, 1);
      assert.equal(firstRun.next.transformedHtmlCount, 1);
      assert.equal(firstRun.next.files.length, 1);
      assert.equal(existsSync(join(distDir, "_next/static/csp/stale.js")), false);

      const scriptAssetName = firstRun.dist.files[0];
      const expectedSrc = `${basePath}/_next/static/csp/${scriptAssetName}`;
      const rewrittenHtml = readFileSync(join(distDir, "index.html"), "utf8");
      assert.equal(rewrittenHtml.includes(`src="${expectedSrc}"`), true);
      assert.equal(rewrittenHtml.includes("__next_f.push"), false);
      assert.equal(readFileSync(join(nextPagesDir, "500.html"), "utf8"), json500Html);

      const extractedJs = readFileSync(join(distDir, "_next/static/csp", scriptAssetName), "utf8");
      const origCtx = { self: {} };
      origCtx.self = origCtx;
      for (const code of [inline1, inline2, inline3]) runInNewContext(code, origCtx);

      const extractedCtx = { self: {} };
      extractedCtx.self = extractedCtx;
      runInNewContext(extractedJs, extractedCtx);
      assert.equal(JSON.stringify(extractedCtx.__next_f), JSON.stringify(origCtx.__next_f));

      // Re-running must be idempotent and preserve the existing CSP script file.
      const secondRun = externalizeInlineScripts(fixture);
      assert.equal(secondRun.dist.transformedHtmlCount, 0);
      assert.equal(secondRun.dist.extractedScriptCount, 0);
      assert.deepEqual(secondRun.dist.files, [scriptAssetName]);
      assert.equal(existsSync(join(distDir, "_next/static/csp", scriptAssetName)), true);
      assert.equal(existsSync(join(nextStaticDir, "csp", scriptAssetName)), true);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }
});
