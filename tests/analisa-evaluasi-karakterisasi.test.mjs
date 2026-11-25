import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import TestRenderer from "react-test-renderer";
import { Chess } from "chess.js";
import * as evaluasi from "../src/halaman/Analisa/mesin/evaluasi.js";
import * as akurasi from "../src/halaman/Analisa/mesin/akurasi.js";
import * as penilaian from "../src/halaman/Analisa/mesin/penilaian.js";
import * as ringkasan from "../src/halaman/Analisa/mesin/ringkasanAnalisis.js";
import * as antiCheatDasar from "../src/halaman/Analisa/mesin/antiCheat/dasar.js";
import * as antiCheatSkor from "../src/halaman/Analisa/mesin/antiCheat/skor.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const { act } = TestRenderer;

test("evaluasi module exposes exact nine named exports, frozen STATUS_EVALUASI and MATE_DISAMPAIKAN", () => {
  assert.deepEqual(Object.keys(evaluasi).sort(), [
    "MATE_DISAMPAIKAN",
    "STATUS_EVALUASI",
    "apakahMateTerminal",
    "cpBaku",
    "evalSiap",
    "langkahTerpaksa",
    "normalisasiEval",
    "ratingTampilan",
    "tandaMate",
  ]);
  assert.equal(Object.hasOwn(evaluasi, "default"), false);
  assert.equal(Object.isFrozen(evaluasi.STATUS_EVALUASI), true);
  assert.deepEqual(evaluasi.STATUS_EVALUASI, {
    SIAP: "siap",
    GAGAL: "gagal",
    DIBATALKAN: "dibatalkan",
  });
  assert.equal(evaluasi.MATE_DISAMPAIKAN, 0);
});

test("normalisasiEval normalizes UCI scores, legacy bare mate and retains Number() edge coercions", () => {
  const { normalisasiEval } = evaluasi;
  assert.equal(normalisasiEval(null), null);
  assert.equal(normalisasiEval(undefined), null);
  assert.equal(normalisasiEval("cp"), null);
  assert.equal(normalisasiEval({}), null);
  assert.equal(normalisasiEval([]), null);
  assert.equal(normalisasiEval(["wdl", "10"]), null);

  assert.deepEqual(normalisasiEval(["mate"]), ["mate", "0"]);
  assert.deepEqual(normalisasiEval(["mate", undefined]), ["mate", "0"]);
  assert.deepEqual(normalisasiEval(["mate", null]), ["mate", "0"]);
  assert.deepEqual(normalisasiEval(["mate", ""]), ["mate", "0"]);

  assert.equal(normalisasiEval(["cp"]), null);
  assert.equal(normalisasiEval(["cp", undefined]), null);
  assert.equal(normalisasiEval(["cp", null]), null);
  assert.equal(normalisasiEval(["cp", ""]), null);
  assert.equal(normalisasiEval(["cp", "abc"]), null);
  assert.equal(normalisasiEval(["cp", Infinity]), null);
  assert.equal(normalisasiEval(["cp", -Infinity]), null);
  assert.equal(normalisasiEval(["mate", "abc"]), null);
  assert.equal(normalisasiEval(["mate", NaN]), null);

  assert.deepEqual(normalisasiEval(["cp", "34.9"]), ["cp", "34"]);
  assert.deepEqual(normalisasiEval(["cp", -34.9]), ["cp", "-34"]);
  assert.deepEqual(normalisasiEval(["mate", "-2.8"]), ["mate", "-2"]);
  assert.deepEqual(normalisasiEval(["cp", -0]), ["cp", "0"]);
  assert.deepEqual(normalisasiEval(["cp", "   "]), ["cp", "0"]);
  assert.deepEqual(normalisasiEval(["mate", "   "]), ["mate", "0"]);
  assert.deepEqual(normalisasiEval(["cp", true]), ["cp", "1"]);
  assert.deepEqual(normalisasiEval(["cp", false]), ["cp", "0"]);
});

test("apakahMateTerminal detects mate 0, legacy bare mate and zero-coerced values", () => {
  const { apakahMateTerminal } = evaluasi;
  assert.equal(apakahMateTerminal(null), false);
  assert.equal(apakahMateTerminal("mate"), false);
  assert.equal(apakahMateTerminal(["cp", "0"]), false);
  assert.equal(apakahMateTerminal(["cp"]), false);

  assert.equal(apakahMateTerminal(["mate"]), true);
  assert.equal(apakahMateTerminal(["mate", undefined]), true);
  assert.equal(apakahMateTerminal(["mate", null]), true);
  assert.equal(apakahMateTerminal(["mate", ""]), true);
  assert.equal(apakahMateTerminal(["mate", 0]), true);
  assert.equal(apakahMateTerminal(["mate", "0"]), true);
  assert.equal(apakahMateTerminal(["mate", "-0"]), true);
  assert.equal(apakahMateTerminal(["mate", "   "]), true);
  assert.equal(apakahMateTerminal(["mate", false]), true);

  assert.equal(apakahMateTerminal(["mate", "2"]), false);
  assert.equal(apakahMateTerminal(["mate", -1]), false);
  assert.equal(apakahMateTerminal(["mate", "abc"]), false);
  assert.equal(apakahMateTerminal(["mate", NaN]), false);
});

test("tandaMate maps delivered mate 0 to -1, absent/invalid to null and signed mate to ±1", () => {
  const { tandaMate } = evaluasi;
  assert.equal(tandaMate(null), null);
  assert.equal(tandaMate(undefined), null);
  assert.equal(tandaMate(""), null);
  assert.equal(tandaMate(NaN), null);
  assert.equal(tandaMate(Infinity), null);
  assert.equal(tandaMate(-Infinity), null);
  assert.equal(tandaMate("abc"), null);

  assert.equal(tandaMate(0), -1);
  assert.equal(tandaMate("0"), -1);
  assert.equal(tandaMate("-0"), -1);
  assert.equal(tandaMate(-0), -1);
  assert.equal(tandaMate("   "), -1);
  assert.equal(tandaMate(false), -1);

  assert.equal(tandaMate(1), 1);
  assert.equal(tandaMate("3"), 1);
  assert.equal(tandaMate(0.2), 1);
  assert.equal(tandaMate(true), 1);
  assert.equal(tandaMate(-1), -1);
  assert.equal(tandaMate("-4"), -1);
});

test("cpBaku preserves clamping, mate sign inversion, length<2 guard and legacy coercions", () => {
  const { cpBaku } = evaluasi;
  assert.equal(cpBaku(null), null);
  assert.equal(cpBaku(["mate"]), null);
  assert.equal(cpBaku(["cp"]), null);
  assert.equal(cpBaku(["cp", null]), null);
  assert.equal(cpBaku(["cp", undefined]), null);
  assert.equal(cpBaku(["cp", ""]), null);
  assert.equal(cpBaku(["mate", null]), null);
  assert.equal(cpBaku(["mate", undefined]), null);
  assert.equal(cpBaku(["mate", ""]), null);
  assert.equal(cpBaku(["cp", "abc"]), null);
  assert.equal(cpBaku(["cp", Infinity]), null);
  assert.equal(cpBaku(["mate", "abc"]), null);
  assert.equal(cpBaku(["mate", Infinity]), null);

  assert.equal(cpBaku(["cp", "2500"], false), 1000);
  assert.equal(cpBaku(["cp", "2500"], true), -1000);
  assert.equal(cpBaku(["cp", "42.7"], false), 42.7);
  assert.equal(cpBaku(["other", "50"], false), 50);
  assert.equal(cpBaku(["cp", false], false), 0);
  assert.equal(cpBaku(["cp", true], false), 1);
  assert.equal(Object.is(cpBaku(["cp", "0"], true), -0), true);

  assert.equal(cpBaku(["mate", "2"], false), 1000);
  assert.equal(cpBaku(["mate", "2"], true), -1000);
  assert.equal(cpBaku(["mate", "-2"], true), 1000);
  assert.equal(cpBaku(["mate", "0"], false), -1000);
  assert.equal(cpBaku(["mate", "0"], true), 1000);
});

test("evalSiap, langkahTerpaksa and ratingTampilan preserve legacy status and forced flags", () => {
  const { STATUS_EVALUASI, evalSiap, langkahTerpaksa, ratingTampilan } = evaluasi;

  assert.equal(evalSiap(null), false);
  assert.equal(evalSiap(undefined), false);
  assert.equal(evalSiap("siap"), false);
  assert.equal(evalSiap(0), false);
  assert.equal(evalSiap({}), true);
  assert.equal(evalSiap([]), true);
  assert.equal(evalSiap({ statusEvaluasi: null }), true);
  assert.equal(evalSiap({ statusEvaluasi: STATUS_EVALUASI.SIAP }), true);
  assert.equal(evalSiap({ statusEvaluasi: "custom-status" }), true);
  assert.equal(evalSiap({ statusEvaluasi: STATUS_EVALUASI.GAGAL }), false);
  assert.equal(evalSiap({ statusEvaluasi: STATUS_EVALUASI.DIBATALKAN }), false);

  assert.equal(langkahTerpaksa(null), false);
  assert.equal(langkahTerpaksa(undefined), false);
  assert.equal(langkahTerpaksa("forced"), false);
  assert.equal(langkahTerpaksa({ isForced: 1 }), false);
  assert.equal(langkahTerpaksa({ isForced: "true" }), false);
  assert.equal(langkahTerpaksa({ isForced: true }), true);
  assert.equal(langkahTerpaksa({ moveRating: "forced" }), true);
  assert.equal(langkahTerpaksa({ isForced: true, moveRating: "best" }), true);

  assert.equal(ratingTampilan(null), undefined);
  assert.equal(ratingTampilan({}), undefined);
  assert.equal(ratingTampilan({ isForced: false, moveRating: "best" }), "best");
  assert.equal(ratingTampilan({ isForced: true, moveRating: "best" }), "forced");
  assert.equal(ratingTampilan({ moveRating: "forced" }), "forced");
});

test("downstream analysis modules preserve shared cpBaku identity and evaluation outcomes", () => {
  assert.strictEqual(akurasi.cpBaku, evaluasi.cpBaku);

  const chess = new Chess();
  chess.move("e4");
  const gagal = penilaian.getMoveRating({
    staticEval: ["cp", "abc"],
    previousStaticEvals: [["cp", "0"], ["cp", "0"]],
    bestMoveSan: "e4",
    moveSan: "e4",
    fen: chess.fen(),
  });
  assert.equal(gagal.statusEvaluasi, "gagal");
  assert.equal(gagal.moveRating, null);

  assert.equal(antiCheatDasar.nilaiCentipawn(["mate", 0]), -10000);
  assert.equal(antiCheatDasar.nilaiCentipawn(["mate", 2]), 10000);
  assert.equal(antiCheatDasar.cpKandidat({ mate: 0 }), -10000);

  const hasilRingkas = ringkasan.ringkasAnalisis([
    {},
    {
      color: "b",
      san: "e4",
      isForced: true,
      moveRating: "best",
      previousStaticEvals: [["cp", "20"], ["cp", "20"]],
    },
    {
      color: "w",
      san: "e5",
      moveRating: "good",
      previousStaticEvals: [["cp", "15"], ["cp", "20"]],
    },
  ]);
  assert.equal(hasilRingkas.summary.w.breakdown.forced, 1);
  assert.equal(hasilRingkas.summary.w.breakdown.best, 0);
  assert.equal(hasilRingkas.summary.b.breakdown.good, 1);

  const skor = antiCheatSkor.hitungSkorKecurigaan([
    {},
    { color: "b", san: "e4", isForced: true, moveRating: "best", previousStaticEvals: [["cp", "0"], ["cp", "0"]], kandidat: [] },
  ]);
  assert.equal(skor.jumlahLangkah, 0);
});

test("UI components Evaluation, Comments/FormatEval and RatingCount render expected outputs using evaluasi helpers", async () => {
  const muat = buatPemuatJsx({
    "src/lib/i18n.jsx": { useI18n: () => ({ t: (k) => k }) },
    "src/halaman/Analisa/komponen/svg/rating.jsx": { default: ({ rating }) => React.createElement("span", { "data-rating": rating }) },
  });
  const Evaluation = muat("src/halaman/Analisa/komponen/game/evaluation.jsx").default;
  const { FormatEval } = muat("src/halaman/Analisa/komponen/menu/analysis/moves/comments.jsx");
  const RatingCount = muat("src/halaman/Analisa/komponen/menu/analysis/summary/ratingCount.jsx").default;

  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(React.Fragment, null,
      React.createElement(Evaluation, { size: 300, white: true, advantage: ["mate"], whiteMoving: true, navTop: true }),
      React.createElement(FormatEval, { evaluation: ["mate", "0"], white: false, smaller: false, best: false }),
      React.createElement(RatingCount, {
        moves: [
          { moveRating: "best", isForced: true },
          { moveRating: "critical" },
        ],
      })));
  });

  const teksDiv = renderer.root.findAllByType("div").map((n) => n.children.join("")).join(" ");
  assert.match(teksDiv, /0-1/);
  assert.match(teksDiv, /1-0/);
  const barisSkor = renderer.root.findAllByType("span").map((n) => n.children.join("")).filter(Boolean);
  assert.ok(barisSkor.includes("analisa.penilaian.forced"));
  await act(async () => { renderer.unmount(); });
});
