import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { injectSubresourceIntegrity } from "../scripts/inject-subresource-integrity.mjs";

const sha384 = (isi) => "sha384-" + createHash("sha384").update(isi, "utf8").digest("base64");

test("injectSubresourceIntegrity adds matching SHA-384 to local scripts/stylesheets/preloads in both trees and basePaths, idempotently", () => {
  for (const basePath of ["", "/Maestro-Chess"]) {
    const fixture = mkdtempSync(join(tmpdir(), "maestro-sri-"));
    try {
      const distStatic = join(fixture, "dist/_next/static");
      const nextStatic = join(fixture, ".next/static");
      for (const root of [distStatic, nextStatic]) {
        mkdirSync(join(root, "chunks"), { recursive: true });
        mkdirSync(join(root, "css"), { recursive: true });
        mkdirSync(join(root, "csp"), { recursive: true });
      }
      mkdirSync(join(fixture, "dist/attributions"), { recursive: true });
      mkdirSync(join(fixture, ".next/server/app"), { recursive: true });
      mkdirSync(join(fixture, ".next/server/pages"), { recursive: true });

      const jsIsi = "console.log('chunk');\n";
      const cssIsi = "body{color:red}\n";
      const flightIsi = "self.__next_f=[];\n";
      for (const root of [distStatic, nextStatic]) {
        writeFileSync(join(root, "chunks/a.js"), jsIsi);
        writeFileSync(join(root, "css/b.css"), cssIsi);
        writeFileSync(join(root, "csp/flight.js"), flightIsi);
      }
      writeFileSync(join(fixture, ".next/routes-manifest.json"), JSON.stringify({ basePath }));

      const p = (u) => `${basePath}${u}`;
      const html =
        "<!DOCTYPE html><html><head>" +
        `<link rel="stylesheet" href="${p("/_next/static/css/b.css")}" data-precedence="next"/>` +
        `<link rel="preload" as="script" fetchPriority="low" href="${p("/_next/static/chunks/a.js")}"/>` +
        `<script src="${p("/_next/static/chunks/a.js")}" async=""></script>` +
        '<link rel="author" href="https://github.com/example"/>' +
        `<link rel="icon" href="${p("/favicon.ico")}"/>` +
        '<script src="https://cdn.example.net/extern.js"></script>' +
        "</head><body>" +
        `<script src="${p("/_next/static/csp/flight.js")}"></script>` +
        "</body></html>";
      writeFileSync(join(fixture, "dist/index.html"), html);
      writeFileSync(join(fixture, "dist/attributions/index.html"), html);
      writeFileSync(join(fixture, ".next/server/app/index.html"), html);
      writeFileSync(join(fixture, ".next/server/pages/404.html"), html);

      const first = injectSubresourceIntegrity(fixture);
      assert.equal(first.basePath, basePath);
      assert.ok(first.dist.transformedHtmlCount > 0, "dist HTML harus diproses");
      assert.ok(first.next.transformedHtmlCount > 0, "Next server HTML harus diproses");

      const rewritten = readFileSync(join(fixture, "dist/index.html"), "utf8");
      assert.ok(rewritten.includes(`integrity="${sha384(jsIsi)}"`), "hash chunk cocok");
      assert.ok(rewritten.includes(`integrity="${sha384(cssIsi)}"`), "hash stylesheet cocok");
      assert.ok(rewritten.includes(`integrity="${sha384(flightIsi)}"`), "hash flight cocok");
      assert.ok(rewritten.includes('crossorigin="anonymous"'));
      const jumlahHashJs = rewritten.split(`integrity="${sha384(jsIsi)}"`).length - 1;
      assert.equal(jumlahHashJs, 2, "preload dan script untuk berkas sama memakai hash identik");
      assert.ok(rewritten.includes('<script src="https://cdn.example.net/extern.js"></script>'), "skrip eksternal tidak disentuh");
      assert.ok(rewritten.includes('<link rel="author" href="https://github.com/example"/>'), "link author tidak disentuh");
      assert.ok(rewritten.includes(`<link rel="icon" href="${p("/favicon.ico")}"/>`), "favicon tidak disentuh");

      const nextHtml = readFileSync(join(fixture, ".next/server/app/index.html"), "utf8");
      assert.ok(nextHtml.includes(`integrity="${sha384(jsIsi)}"`), "pohon .next ikut diberi SRI");

      const second = injectSubresourceIntegrity(fixture);
      assert.equal(second.dist.transformedHtmlCount, 0, "idempoten: dist tidak ditulis ulang");
      assert.equal(second.next.transformedHtmlCount, 0, "idempoten: Next tidak ditulis ulang");
      assert.equal(readFileSync(join(fixture, "dist/index.html"), "utf8"), rewritten);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }
});
