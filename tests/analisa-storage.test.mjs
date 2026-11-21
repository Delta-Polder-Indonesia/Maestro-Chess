import assert from "node:assert/strict";
import test from "node:test";
import { bacaAngka, bacaBoolean, bacaTeks, tulis, tulisBoolean } from "../src/halaman/Analisa/penyimpanan.js";

test("legacy settings are read without overwriting them; new preferences take precedence", (t) => {
  const previous = globalThis.localStorage;
  const values = new Map([
    ["depth", "6"],
    ["boardSounds", "0"],
    ["usedRatings", "10101010101"],
  ]);
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  t.after(() => {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  });
  assert.equal(bacaAngka("kedalaman", 13), 6);
  assert.equal(bacaBoolean("boardSounds", true), false);
  assert.equal(bacaTeks("usedRatings"), "101101010101");
  tulis("kedalaman", 8);
  tulisBoolean("boardSounds", true);
  assert.equal(bacaAngka("kedalaman", 13), 8);
  assert.equal(bacaBoolean("boardSounds", false), true);
  assert.equal(values.get("depth"), "6");
  assert.equal(values.get("boardSounds"), "0");
  assert.equal(values.get("maestro-analisa-kedalaman"), "8");
  values.set("maestro-analisa-kedalaman", "not-a-number");
  assert.equal(bacaAngka("kedalaman", 13), 13);
});

test("storage access failures fall back without crashing", (t) => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("full"); },
  };
  t.after(() => {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  });
  assert.equal(bacaTeks("kedalaman", "default"), "default");
  assert.equal(bacaAngka("kedalaman", 13), 13);
  assert.equal(bacaBoolean("boardSounds", true), true);
  assert.doesNotThrow(() => tulisBoolean("boardSounds", false));
});
