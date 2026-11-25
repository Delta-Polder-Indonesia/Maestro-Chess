import assert from "node:assert/strict";
import React, { useRef, useState } from "react";
import TestRenderer from "react-test-renderer";
import test from "node:test";
import * as ringkasan from "../src/halaman/Analisa/mesin/ringkasanAnalisis.js";
import * as akurasi from "../src/modul/analisis/akurasi.js";
import * as analisisTersimpan from "../src/modul/analisis/analisisTersimpan.js";
import * as wawasan from "../src/halaman/Analisa/mesin/wawasan.js";
import { hashPgn } from "../src/lib/pgnRingan.js";
import { useMuatPartai } from "../src/halaman/Analisa/komponen/game/useMuatPartai.js";

const {
  KUALITAS_LANGKAH,
  PETA_KUALITAS,
  breakdownKosong,
  ringkasAnalisis,
  ringkasWarna,
} = ringkasan;
const { act } = TestRenderer;
const noop = () => {};
const flush = () => new Promise((resolve) => setImmediate(resolve));

function buatEntriPutih(moveRating, { sebelum = "50", sesudah = "-50", extra = {} } = {}) {
  return {
    color: "b",
    san: "e4",
    moveRating,
    previousStaticEvals: [["cp", sesudah], ["cp", sebelum]],
    ...extra,
  };
}

function buatEntriHitam(moveRating, { sebelum = "-50", sesudah = "50", extra = {} } = {}) {
  return {
    color: "w",
    san: "e5",
    moveRating,
    previousStaticEvals: [["cp", sesudah], ["cp", sebelum]],
    ...extra,
  };
}

test("ringkasanAnalisis exposes exact five named exports and frozen constants without default", () => {
  assert.deepEqual(Object.keys(ringkasan).sort(), [
    "KUALITAS_LANGKAH",
    "PETA_KUALITAS",
    "breakdownKosong",
    "ringkasAnalisis",
    "ringkasWarna",
  ]);
  assert.equal(Object.hasOwn(ringkasan, "default"), false);

  assert.equal(Object.isFrozen(KUALITAS_LANGKAH), true);
  assert.deepEqual(KUALITAS_LANGKAH, [
    "brilliant",
    "great",
    "best",
    "excellent",
    "good",
    "inaccuracy",
    "mistake",
    "blunder",
    "miss",
    "forced",
    "book",
  ]);

  assert.equal(Object.isFrozen(PETA_KUALITAS), true);
  assert.deepEqual(PETA_KUALITAS, {
    brilliant: "brilliant",
    great: "great",
    best: "best",
    critical: "best",
    excellent: "excellent",
    good: "good",
    book: "book",
    inaccuracy: "inaccuracy",
    mistake: "mistake",
    miss: "miss",
    blunder: "blunder",
    forced: "forced",
  });

  const a = breakdownKosong();
  const b = breakdownKosong();
  assert.notStrictEqual(a, b);
  assert.deepEqual(Object.keys(a), KUALITAS_LANGKAH);
  for (const k of KUALITAS_LANGKAH) assert.equal(a[k], 0);
  a.best = 7;
  assert.equal(b.best, 0);
});

test("ringkasWarna characterizes arithmetic mean, all 11 breakdown keys, forced override and excludedMoves", () => {
  const movesSemuaKategori = [
    { fen: "start" },
    buatEntriPutih("brilliant"),
    buatEntriHitam("great"),
    buatEntriPutih("best"),
    buatEntriHitam("critical"),
    buatEntriPutih("excellent"),
    buatEntriHitam("good"),
    buatEntriPutih("inaccuracy"),
    buatEntriHitam("mistake"),
    buatEntriPutih("blunder"),
    buatEntriHitam("miss"),
    buatEntriPutih("book"),
    buatEntriHitam("forced"),
    // `isForced: true` mengesampingkan `moveRating` sambil tetap masuk `eligibleMoves`.
    buatEntriPutih("critical", { extra: { isForced: true } }),
    // `moveRating` tak dikenal yang evalnya terhingga tetap masuk `eligibleMoves` tanpa breakdown.
    buatEntriHitam("tidak-dikenal"),
    // Eval hilang / tak terbaca (`staticEval: []` saat gagal) -> masuk `excludedMoves`, tidak masuk `estimates` maupun `breakdown`.
    { color: "b", san: "Nf3", moveRating: "blunder", previousStaticEvals: [] },
    { color: "w", san: "Nc6", moveRating: "mistake", statusEvaluasi: "gagal", previousStaticEvals: [[], ["cp", "0"]] },
  ];

  const w = ringkasWarna(movesSemuaKategori, "w");
  assert.equal(w.eligibleMoves, 7);
  assert.equal(w.excludedMoves, 1);
  assert.equal(w.accuracyEstimate, 100);
  assert.deepEqual(w.breakdown, {
    brilliant: 1,
    great: 0,
    best: 1,
    excellent: 1,
    good: 0,
    inaccuracy: 1,
    mistake: 0,
    blunder: 1,
    miss: 0,
    forced: 1,
    book: 1,
  });

  const b = ringkasWarna(movesSemuaKategori, "b");
  assert.equal(b.eligibleMoves, 7);
  assert.equal(b.excludedMoves, 1);
  assert.equal(b.accuracyEstimate, 100);
  assert.deepEqual(b.breakdown, {
    brilliant: 0,
    great: 1,
    best: 1,
    excellent: 0,
    good: 1,
    inaccuracy: 0,
    mistake: 1,
    blunder: 0,
    miss: 1,
    forced: 1,
    book: 0,
  });

  // `ringkasWarna` menyaring berdasarkan keterhinggaan `akurasiMove(move)`, bukan `statusEvaluasi`.
  const denganStatusGagalTapiEvalAda = ringkasWarna(
    [{}, { color: "b", san: "e4", moveRating: "best", statusEvaluasi: "gagal", previousStaticEvals: [["cp", "0"], ["cp", "0"]] }],
    "w",
  );
  assert.equal(denganStatusGagalTapiEvalAda.eligibleMoves, 1);
  assert.equal(denganStatusGagalTapiEvalAda.excludedMoves, 0);

  // Verifikasi rata-rata aritmetik (bukan harmonik) ketika akurasi antarlangkah berbeda jauh.
  const m1 = buatEntriPutih("best", { sebelum: "50", sesudah: "-50" }); // ~100
  const m2 = buatEntriPutih("blunder", { sebelum: "300", sesudah: "300" }); // turun tajam: +300 -> -300
  const ak1 = akurasi.akurasiMove(m1);
  const ak2 = akurasi.akurasiMove(m2);
  const diharapkanAritmetik = (ak1 + ak2) / 2;
  const nilaiHarmonik = akurasi.rataHarmonik([ak1, ak2]);
  assert.notEqual(diharapkanAritmetik, nilaiHarmonik);
  const variasi = ringkasWarna([{}, m1, m2], "w");
  assert.equal(variasi.eligibleMoves, 2);
  assert.equal(variasi.accuracyEstimate, diharapkanAritmetik);

  // Masukan non-array, kosong, atau warna invalid.
  for (const tidakValid of [null, undefined, {}, []]) {
    const res = ringkasWarna(tidakValid, "w");
    assert.equal(res.accuracyEstimate, null);
    assert.equal(res.eligibleMoves, 0);
    assert.equal(res.excludedMoves, 0);
    assert.deepEqual(res.breakdown, breakdownKosong());
  }
  const warnaAsing = ringkasWarna([{}, m1], "z");
  assert.equal(warnaAsing.accuracyEstimate, null);
  assert.equal(warnaAsing.eligibleMoves, 0);
  assert.equal(warnaAsing.excludedMoves, 0);
});

test("ringkasAnalisis preserves totalPlies and analyzedPlies legacy edge behavior", () => {
  for (const kosong of [null, undefined, {}, []]) {
    const res = ringkasAnalisis(kosong);
    assert.equal(res.status, "complete");
    assert.equal(res.totalPlies, 0);
    assert.equal(res.analyzedPlies, 0);
    assert.equal(res.summary.w.accuracyEstimate, null);
    assert.equal(res.summary.b.accuracyEstimate, null);
  }

  // Perilaku lama: array 1 elemen selalu menghasilkan totalPlies 0 dan melewati indeks 0.
  const satuPosisi = ringkasAnalisis([{ fen: "start" }]);
  assert.equal(satuPosisi.totalPlies, 0);
  assert.equal(satuPosisi.analyzedPlies, 0);

  const satuTanpaAwal = ringkasAnalisis([buatEntriPutih("best")]);
  assert.equal(satuTanpaAwal.totalPlies, 0);
  assert.equal(satuTanpaAwal.analyzedPlies, 0);
  assert.equal(satuTanpaAwal.summary.w.eligibleMoves, 0);
  assert.equal(satuTanpaAwal.summary.w.excludedMoves, 0);

  // Perilaku lama: `analyzedPlies` selalu sama dengan `totalPlies` sekalipun ada ply tereksklusi.
  const parsial = ringkasAnalisis([
    { fen: "start" },
    buatEntriPutih("best"),
    { color: "w", san: "e5", moveRating: "blunder", previousStaticEvals: [] },
    { color: "b", san: "Nf3", moveRating: "mistake", previousStaticEvals: [] },
  ]);
  assert.equal(parsial.totalPlies, 3);
  assert.equal(parsial.analyzedPlies, 3);
  assert.equal(parsial.summary.w.eligibleMoves, 1);
  assert.equal(parsial.summary.w.excludedMoves, 1);
  assert.equal(parsial.summary.b.eligibleMoves, 0);
  assert.equal(parsial.summary.b.excludedMoves, 1);
  assert.equal(parsial.summary.b.accuracyEstimate, null);
});

test("useMuatPartai recovery path and wawasan.hitungTaktikal integrate cleanly with ringkasAnalisis", async (t) => {
  const { ambilPetaAnalisis, bersihkanAnalisis, jumlahAnalisis } = analisisTersimpan;
  t.after(() => bersihkanAnalisis());
  bersihkanAnalisis();

  const pgnText = '[White "Alice"]\n[Black "Bob"]\n\n1. e4 e5 *';
  const expectedKey = hashPgn(pgnText);
  const game = [
    { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", previousStaticEvals: [["cp", "20"]] },
    {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      color: "b",
      san: "e4",
      moveRating: "critical",
      previousStaticEvals: [["cp", "-20"], ["cp", "20"]],
    },
    {
      fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
      color: "w",
      san: "e5",
      moveRating: "blunder",
      previousStaticEvals: [["cp", "350"], ["cp", "-20"]],
    },
  ];
  const snapshot = {
    versi: 1,
    game,
    customLine: { moveNumber: -1, moves: [], arrows: {} },
    moveNumber: 2,
    white: true,
    tab: "summary",
    pageState: "analyze",
    arrows: {},
    players: [{ name: "Alice", elo: 1500 }, { name: "Bob", elo: 1450 }],
  };

  function Harness({ data }) {
    const [controller, setController] = useState(() => new AbortController());
    const boardSoundsRef = useRef(false);
    useMuatPartai({
      data, depth: 8, boardSoundsRef, t: (k) => k, siapkan: async () => ({}),
      analyzeController: controller, setAnalyzeController: setController,
      setPageState: noop, setPlayers: noop, setGame: noop, setErrors: noop,
      setTab: noop, setProgress: noop, setLangkahSementara: noop, setTime: noop,
      setResult: noop, setAnimation: noop, setArrows: noop, setCustomLine: noop,
      setAnalyzingMove: noop, setMoveNumber: noop, setWhite: noop, setPlaying: noop,
    });
    return null;
  }

  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(Harness, {
        data: { format: "pgn", string: pgnText, pemulihan: { status: "selesai", snapshot } },
      }),
    );
    await flush();
  });
  t.after(() => renderer.unmount());

  assert.equal(jumlahAnalisis(), 1);
  const hasil = ambilPetaAnalisis()[expectedKey];
  assert.deepEqual(hasil, ringkasAnalisis(game));
  assert.equal(hasil.summary.w.breakdown.best, 1);
  assert.equal(hasil.summary.b.breakdown.blunder, 1);

  const taktikalHitam = wawasan.hitungTaktikal(
    [
      { id: expectedKey, userColor: "black" },
      { id: "tanpa-warna", userColor: "unknown" },
    ],
    ambilPetaAnalisis(),
  );
  assert.equal(taktikalHitam.analyzedGamesCount, 1);
  assert.equal(taktikalHitam.accuracyCount, 1);
  assert.equal(taktikalHitam.totalEvaluatedMoves, 1);
  assert.equal(taktikalHitam.blunders, 1);
  assert.equal(
    taktikalHitam.avgAccuracy,
    Math.round(hasil.summary.b.accuracyEstimate * 10) / 10,
  );
});
