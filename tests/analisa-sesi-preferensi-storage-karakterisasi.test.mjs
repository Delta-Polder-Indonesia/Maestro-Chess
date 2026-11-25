import assert from "node:assert/strict";
import test from "node:test";
import * as penyimpanan from "../src/halaman/Analisa/penyimpanan.js";
import { tangkapGalatDiuji } from "./bantuGalat.mjs";

function pasangStorage(tes, awal = []) {
  const lama = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const data = new Map(awal);
  const baca = [];
  const tulis = [];
  const storage = {
    data, baca, tulis,
    getItem(key) { baca.push(key); return data.get(key) ?? null; },
    setItem(key, nilai) { tulis.push([key, nilai]); data.set(key, String(nilai)); },
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: storage });
  tes.after(() => {
    if (lama) Object.defineProperty(globalThis, "localStorage", lama);
    else delete globalThis.localStorage;
  });
  return storage;
}

function hapusStorage(tes) {
  const lama = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  delete globalThis.localStorage;
  tes.after(() => { if (lama) Object.defineProperty(globalThis, "localStorage", lama); });
}

test("original storage helper exposes its six names and handles missing localStorage", (tes) => {
  hapusStorage(tes);
  assert.deepEqual(Object.keys(penyimpanan).sort(), ["bacaAngka", "bacaBoolean", "bacaTeks", "cobaBacaTeks", "tulis", "tulisBoolean"]);
  assert.equal(penyimpanan.bacaTeks("boardTheme"), null);
  assert.equal(penyimpanan.bacaTeks("boardTheme", "default"), "default");
  assert.equal(penyimpanan.bacaAngka("boardTheme", 4), 4);
  assert.equal(penyimpanan.bacaBoolean("boardSounds", true), true);
  assert.deepEqual(penyimpanan.cobaBacaTeks("daftar-akun"), { berhasil: false, nilai: null });
  assert.equal(penyimpanan.tulis("boardTheme", 2), false);
  assert.equal(penyimpanan.tulisBoolean("boardSounds", true), undefined);
});

test("legacy keys are read without migration writes and the current key takes precedence even when empty", (tes) => {
  const kunci = {
    kedalaman: "depth", boardTheme: "boardTheme", usedRatings: "usedRatings", highlightByRating: "highlightByRating",
    showArrows: "showArrows", arrowAfterMove: "arrowAfterMove", showLegalMoves: "showLegalMoves",
    animateMoves: "animateMoves", boardSounds: "boardSounds", chesscom: "chesscom", lichessorg: "lichessorg",
  };
  const storage = pasangStorage(tes, Object.values(kunci).map((nama) => [nama, `lama:${nama}`]));
  for (const [baru, lama] of Object.entries(kunci)) assert.equal(penyimpanan.bacaTeks(baru, "default"), `lama:${lama}`);
  assert.equal(penyimpanan.bacaTeks("engine", "default"), "default");
  assert.deepEqual(storage.tulis, []);
  storage.baca.length = 0;
  storage.data.set("maestro-analisa-boardTheme", "");
  assert.equal(penyimpanan.bacaTeks("boardTheme", "default"), "");
  assert.deepEqual(storage.baca, ["maestro-analisa-boardTheme"]);
  assert.equal(storage.data.get("boardTheme"), "lama:boardTheme");
});

test("only an eleven-bit legacy ratings string gets the duplicated third bit", (tes) => {
  const storage = pasangStorage(tes, [["usedRatings", "10101010101"]]);
  assert.equal(penyimpanan.bacaTeks("usedRatings"), "101101010101");
  assert.equal(storage.data.get("usedRatings"), "10101010101");
  assert.deepEqual(storage.tulis, []);
  storage.data.set("usedRatings", "00111111111");
  assert.equal(penyimpanan.bacaTeks("usedRatings"), "001111111111");
  storage.data.set("usedRatings", "1010101010x");
  assert.equal(penyimpanan.bacaTeks("usedRatings"), "1010101010x");
  storage.data.set("usedRatings", "101010101010");
  assert.equal(penyimpanan.bacaTeks("usedRatings"), "101010101010");
  storage.data.set("maestro-analisa-usedRatings", "10101010101");
  assert.equal(penyimpanan.bacaTeks("usedRatings"), "10101010101", "current-format values are not expanded");
});

test("cobaBacaTeks distinguishes absent data from inaccessible storage and never consults legacy keys", (tes) => {
  const storage = pasangStorage(tes, [["depth", "12"]]);
  assert.deepEqual(penyimpanan.cobaBacaTeks("kedalaman"), { berhasil: true, nilai: null });
  assert.deepEqual(storage.baca, ["maestro-analisa-kedalaman"]);
  storage.data.set("maestro-analisa-kedalaman", "");
  assert.deepEqual(penyimpanan.cobaBacaTeks("kedalaman"), { berhasil: true, nilai: "" });
  storage.data.set("maestro-analisa-kedalaman", "7");
  assert.deepEqual(penyimpanan.cobaBacaTeks("kedalaman"), { berhasil: true, nilai: "7" });
});

test("numeric and boolean reads preserve Number coercion, finite checks and defaults", (tes) => {
  const storage = pasangStorage(tes);
  for (const [mentah, hasil] of [
    ["", 99], ["0", 0], ["  ", 0], ["-2.5", -2.5], ["0x10", 16], ["1e2", 100],
    ["Infinity", 99], ["NaN", 99], ["bukan angka", 99],
  ]) {
    storage.data.set("maestro-analisa-n", mentah);
    assert.equal(penyimpanan.bacaAngka("n", 99), hasil, mentah);
  }
  for (const [mentah, bawaan, hasil] of [
    ["0", true, false], ["1", false, true], ["2", false, true], ["-1", false, true],
    ["  ", true, false], ["", true, true], ["false", true, true], ["Infinity", false, false],
  ]) {
    storage.data.set("maestro-analisa-b", mentah);
    assert.equal(penyimpanan.bacaBoolean("b", bawaan), hasil, mentah);
  }
});

test("writes stringify values under the Maestro prefix and boolean writes return undefined", (tes) => {
  const storage = pasangStorage(tes, [["boardTheme", "legacy"]]);
  assert.equal(penyimpanan.tulis("boardTheme", 2), true);
  assert.equal(penyimpanan.tulis("lain", null), true);
  assert.equal(penyimpanan.tulis("undefined", undefined), true);
  assert.equal(penyimpanan.tulisBoolean("boardSounds", false), undefined);
  assert.equal(penyimpanan.tulisBoolean("showArrows", "0"), undefined);
  assert.deepEqual(storage.tulis, [
    ["maestro-analisa-boardTheme", "2"], ["maestro-analisa-lain", "null"],
    ["maestro-analisa-undefined", "undefined"], ["maestro-analisa-boardSounds", "0"],
    ["maestro-analisa-showArrows", "1"],
  ]);
  assert.equal(storage.data.get("boardTheme"), "legacy");
});

test("blocked global storage access returns defaults and reports the access failure", (tes) => {
  const galat = tangkapGalatDiuji(tes, "Gagal mengakses penyimpanan pengaturan Analisa:");
  const lama = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("access blocked"); } });
  tes.after(() => {
    if (lama) Object.defineProperty(globalThis, "localStorage", lama);
    else delete globalThis.localStorage;
  });
  assert.equal(penyimpanan.bacaTeks("boardTheme", "default"), "default");
  assert.deepEqual(penyimpanan.cobaBacaTeks("daftar-akun"), { berhasil: false, nilai: null });
  assert.equal(penyimpanan.tulis("boardTheme", 1), false);
  assert.equal(galat.length, 3);
  assert.ok(galat.every(([, error]) => /access blocked/.test(String(error))));
});

test("read, write and string-conversion errors keep their fallback and logging behavior", (tes) => {
  const galat = tangkapGalatDiuji(tes, ["Gagal membaca pengaturan Analisa:", "Gagal menyimpan pengaturan Analisa:"]);
  const storage = pasangStorage(tes);
  storage.getItem = () => { throw new Error("read blocked"); };
  storage.setItem = () => { throw new Error("quota full"); };
  assert.equal(penyimpanan.bacaTeks("x", "fallback"), "fallback");
  assert.deepEqual(penyimpanan.cobaBacaTeks("x"), { berhasil: false, nilai: null });
  assert.equal(penyimpanan.tulis("x", 1), false);
  assert.equal(penyimpanan.tulisBoolean("x", true), undefined);
  const buruk = { toString() { throw new Error("string gagal"); } };
  assert.equal(penyimpanan.tulis("x", buruk), false);
  assert.deepEqual(galat.map(([pesan]) => pesan), [
    "Gagal membaca pengaturan Analisa:", "Gagal membaca pengaturan Analisa:",
    "Gagal menyimpan pengaturan Analisa:", "Gagal menyimpan pengaturan Analisa:", "Gagal menyimpan pengaturan Analisa:",
  ]);
  assert.match(String(galat.at(-1)[1]), /string gagal/);
});
