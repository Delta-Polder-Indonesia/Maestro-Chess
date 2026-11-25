import assert from "node:assert/strict";
import test from "node:test";
import { Chess } from "chess.js";
import * as peluang from "../src/halaman/Analisa/mesin/peluang.js";
import * as evaluasi from "../src/halaman/Analisa/mesin/evaluasi.js";
import * as penilaian from "../src/halaman/Analisa/mesin/penilaian.js";
import * as akurasi from "../src/halaman/Analisa/mesin/akurasi.js";
import * as antiCheat from "../src/halaman/Analisa/mesin/antiCheat.js";
import * as langkahKritis from "../src/halaman/Analisa/mesin/langkahKritis.js";

test("peluang module exposes exact four named exports and exact constants", () => {
  assert.deepEqual(Object.keys(peluang).sort(), [
    "CP_CEILING",
    "FAKTOR_PELUANG",
    "batasiCp",
    "peluangMenang",
  ]);
  assert.equal(Object.hasOwn(peluang, "default"), false);
  assert.equal(peluang.CP_CEILING, 1000);
  assert.equal(peluang.FAKTOR_PELUANG, -0.00368208);
});

test("batasiCp clamps values to [-1000, 1000] and retains raw Math.min/Math.max coercion behavior", () => {
  const { batasiCp } = peluang;
  assert.equal(batasiCp(0), 0);
  assert.equal(batasiCp(345), 345);
  assert.equal(batasiCp(-420), -420);
  assert.equal(batasiCp(1000), 1000);
  assert.equal(batasiCp(-1000), -1000);
  assert.equal(batasiCp(1500), 1000);
  assert.equal(batasiCp(-2500), -1000);
  assert.equal(batasiCp(Infinity), 1000);
  assert.equal(batasiCp(-Infinity), -1000);
  assert.equal(batasiCp(null), 0);
  assert.equal(batasiCp(""), 0);
  assert.equal(batasiCp(true), 1);
  assert.equal(Number.isNaN(batasiCp(NaN)), true);
  assert.equal(Number.isNaN(batasiCp(undefined)), true);
  assert.equal(Number.isNaN(batasiCp("abc")), true);
});

test("peluangMenang matches Lichess/en-croissant curve, clamping and symmetry", () => {
  const { peluangMenang } = peluang;
  assert.equal(peluangMenang(0), 50);
  const p100 = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * 100)) - 1);
  const m500 = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * -500)) - 1);
  assert.ok(Math.abs(peluangMenang(100) - p100) < 1e-12);
  assert.ok(Math.abs(peluangMenang(100) - 59.10) < 0.02);
  assert.ok(Math.abs(peluangMenang(-500) - m500) < 1e-12);
  assert.ok(Math.abs(peluangMenang(-500) - 13.69) < 0.02);
  assert.equal(peluangMenang(2500), peluangMenang(1000));
  assert.equal(peluangMenang(-2500), peluangMenang(-1000));
  for (const cp of [35, 100, 320, 500, 1000]) {
    assert.ok(Math.abs(peluangMenang(cp) + peluangMenang(-cp) - 100) < 1e-11, `symetri ${cp}`);
  }
});

test("peluangMenang preserves legacy Number(cp) || 0 coercion for non-numeric and infinite inputs", () => {
  const { peluangMenang } = peluang;
  for (const kosong of [NaN, undefined, null, "", "abc", -0, false]) {
    assert.equal(peluangMenang(kosong), 50, String(kosong));
  }
  assert.equal(peluangMenang("100"), peluangMenang(100));
  assert.equal(peluangMenang(Infinity), peluangMenang(1000));
  assert.equal(peluangMenang(-Infinity), peluangMenang(-1000));
});

test("downstream modules share exact identities and compute matching evaluation, rating, accuracy and critical-move results", () => {
  assert.strictEqual(akurasi.CP_CEILING, peluang.CP_CEILING);
  assert.strictEqual(akurasi.FAKTOR_PELUANG, peluang.FAKTOR_PELUANG);
  assert.strictEqual(akurasi.batasiCp, peluang.batasiCp);
  assert.strictEqual(akurasi.peluangMenang, peluang.peluangMenang);
  assert.strictEqual(antiCheat.CP_CEILING, peluang.CP_CEILING);
  assert.strictEqual(antiCheat.peluangMenang, peluang.peluangMenang);

  assert.equal(evaluasi.cpBaku(["cp", "2500"], false), 1000);
  assert.equal(evaluasi.cpBaku(["mate", "2"], true), -1000);

  assert.equal(akurasi.akurasiLangkah(0, 0), 100);
  assert.ok(Math.abs(akurasi.akurasiLangkah(0, -500) - 19.07) < 0.02);

  const chess = new Chess();
  chess.move("e4");
  const fenE4 = chess.fen();
  const blunder = penilaian.getMoveRating({
    staticEval: ["cp", "500"],
    previousStaticEvals: [["cp", "0"], ["cp", "0"]],
    bestMoveSan: "d4",
    moveSan: "e4",
    fen: fenE4,
    color: "b",
    sacrifice: false,
    previousSacrifice: false,
  });
  assert.equal(blunder.moveRating, "blunder");

  const posisi = new Chess();
  const langkah = posisi.move("e4");
  const kandidat = [
    { peringkat: 1, uci: "e2e4", cp: 500, mate: null },
    { peringkat: 2, uci: "d2d4", cp: 0, mate: null },
  ];
  assert.ok(Math.abs(langkahKritis.kerugianPeluangKandidat(kandidat) - (peluang.peluangMenang(500) - 50)) < 1e-12);
  assert.equal(langkahKritis.apakahLangkahKritis(langkah, {
    staticEval: ["cp", "-450"],
    previousKandidat: kandidat,
    previousBestMoveSan: "e4",
  }), true);
});
