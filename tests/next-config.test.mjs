import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
// Exercise Next.js's own route normalization, including its automatic basePath prefix.
const { transpileConfig } = require("next/dist/build/next-config-ts/transpile-config");
const { defaultConfig } = require("next/dist/server/config-shared");
const loadCustomRoutes = require("next/dist/lib/load-custom-routes").default;

const cases = [
  { name: "unset", value: undefined, expected: "" },
  { name: "empty", value: "", expected: "" },
  { name: "subpath", value: "/Maestro-Chess", expected: "/Maestro-Chess" },
  { name: "nested subpath", value: "/chess/analysis", expected: "/chess/analysis" },
];

test("header routes and asset paths use a consistent base path", async (t) => {
  const original = process.env.NEXT_PUBLIC_BASE_PATH;
  t.after(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
    } else {
      process.env.NEXT_PUBLIC_BASE_PATH = original;
    }
  });

  for (const { name, value, expected } of cases) {
    await t.test(name, async () => {
      if (value === undefined) {
        delete process.env.NEXT_PUBLIC_BASE_PATH;
      } else {
        process.env.NEXT_PUBLIC_BASE_PATH = value;
      }

      const { default: config } = await transpileConfig({
        nextConfigPath: resolve("next.config.ts"),
        configFileName: "next.config.ts",
        cwd: process.cwd(),
      });
      assert.equal(config.basePath, expected);
      assert.equal(config.assetPrefix, `${expected}/`);
      assert.equal(config.env.NEXT_PUBLIC_BASE_PATH, expected);

      const rawHeaders = await config.headers();
      assert.deepEqual(rawHeaders.map(({ source }) => source), ["/(.*)", "/engine/(.*)"]);

      const { headers } = await loadCustomRoutes({ ...defaultConfig, ...config });
      assert.deepEqual(headers.map(({ source }) => source), [
        `${expected}/(.*)`,
        `${expected}/engine/(.*)`,
      ]);
      assert.deepEqual(headers[0].headers, [
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
      ]);
      assert.deepEqual(headers[1].headers, [
        { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
      ]);
    });
  }
});
