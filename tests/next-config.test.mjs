import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const { transpileConfig } = require("next/dist/build/next-config-ts/transpile-config");

const cases = [
  { name: "unset", value: undefined, expected: "" },
  { name: "empty", value: "", expected: "" },
  { name: "subpath", value: "/Maestro-Chess", expected: "/Maestro-Chess" },
  { name: "nested subpath", value: "/chess/analysis", expected: "/chess/analysis" },
];

test("static export and asset paths use a consistent base path without cross-origin isolation", async (t) => {
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

      assert.equal(config.output, "export");
      assert.equal(config.trailingSlash, true);
      assert.equal(config.headers, undefined);
    });
  }
});
