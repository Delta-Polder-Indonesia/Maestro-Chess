import assert from "node:assert/strict";
import test from "node:test";
import { Chess } from "chess.js";
import React from "react";
import TestRenderer from "react-test-renderer";
import * as fase from "../src/halaman/Analisa/mesin/fase.js";
import { agregatSkorPemain, hitungSkorKecurigaan } from "../src/halaman/Analisa/mesin/antiCheat.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const { act } = TestRenderer;
const {
  FASE_PEMBUKAAN,
  FASE_MENENGAH,
  FASE_AKHIR,
  DAFTAR_FASE,
  isEndOpening,
  isEndMiddlegame,
  faseBerikutnya,
  papanDariFen,
} = fase;

const FEN_AWAL = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const FEN_2_2 = "r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 2 3";
const FEN_3_1 = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/4P3/2N5/PPPP1PPP/RNBQKB1R w KQkq - 4 4";
const FEN_1_3 = "rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R b KQkq - 4 4";
const FEN_3_2 = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R b KQkq - 5 4";
const FEN_2_3 = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R b KQkq - 5 4";
const FEN_4_0 = "r2qk2r/pppp1ppp/1bn2n2/4p3/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 5";
const FEN_0_4 = "rnbqkbnr/pppppppp/8/8/4P3/1BN2N2/PPPP1PPP/R2QK2R b KQkq - 0 5";
// Put a White knight on rank 8 (`rNbqkb1r`): Black still has 3 own minor/queen pieces on rank 8 (2 dev),
// while White also has 2 dev (`R1BQKB1R`) -> false because opponent pieces on rank 8 are ignored.
const FEN_LAWAN_DI_BELAKANG_2_2 = "rNbqkb1r/pppp1ppp/2n5/4p3/4P3/2N5/PPPP1PPP/R1BQKB1R w KQkq - 0 4";
// Put an extra White knight on rank 1 (`RNNQKB1R`): 4 own minor/queen pieces on rank 1 -> 5 - 4 = 1 dev,
// so with 3 Black dev (`r1bqk2r`) -> false instead of true.
const FEN_EKSTRA_MILIK_SENDIRI_3_1 = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/4P3/5N2/PPPP1PPP/RNNQKB1R w KQkq - 0 5";

const FEN_TENGAH_3_3 = "r3k2r/8/2n5/3q4/3Q4/2N5/8/R3K2R w KQkq - 0 1";
const FEN_TENGAH_3_2 = "r3k2r/8/2n5/8/3Q4/2N5/8/R3K2R w KQkq - 0 1";
const FEN_TENGAH_2_3 = "r3k2r/8/2n5/3q4/8/2N5/8/R3K2R w KQkq - 0 1";
const FEN_AKHIR_2_2 = "4k2r/8/2n5/8/8/2N5/8/4K2R w KQk - 0 1";
const FEN_AKHIR_4_1 = "4k2r/8/8/8/3Q4/1BN5/8/4K2R w KQk - 0 1";
const FEN_AKHIR_1_4 = "r2qk2r/8/2n5/8/8/8/8/4K2R w KQk - 0 1";
const FEN_AKHIR_RAJA_PION = "4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1";

function entriLangkah(fen, { color, san = "e4", moveRating = "best", isForced = false, cpSebelum = "20", cpSesudah = "-20" } = {}) {
  return {
    fen,
    color,
    san,
    moveRating,
    isForced,
    bestMoveSan: san,
    previousStaticEvals: [["cp", cpSesudah], ["cp", cpSebelum]],
  };
}

test("fase module exposes exact eight named constants/functions and mutable phase list", () => {
  assert.deepEqual(Object.keys(fase).sort(), [
    "DAFTAR_FASE",
    "FASE_AKHIR",
    "FASE_MENENGAH",
    "FASE_PEMBUKAAN",
    "faseBerikutnya",
    "isEndMiddlegame",
    "isEndOpening",
    "papanDariFen",
  ]);
  assert.equal(Object.hasOwn(fase, "default"), false);
  assert.equal(FASE_PEMBUKAAN, "opening");
  assert.equal(FASE_MENENGAH, "middlegame");
  assert.equal(FASE_AKHIR, "endgame");
  assert.deepEqual(DAFTAR_FASE, ["opening", "middlegame", "endgame"]);
  assert.equal(Object.isFrozen(DAFTAR_FASE), false);

  const salinan = DAFTAR_FASE.slice();
  try {
    DAFTAR_FASE.push("ekstra");
    assert.equal(DAFTAR_FASE.length, 4);
  } finally {
    DAFTAR_FASE.splice(0, DAFTAR_FASE.length, ...salinan);
  }
  assert.deepEqual(DAFTAR_FASE, ["opening", "middlegame", "endgame"]);
});

test("papanDariFen returns an 8x8 board for valid FEN and null for empty or invalid input", () => {
  for (const kosong of [undefined, null, "", 0, false, "bukan-fen", "8/8/8/8/8/8/8/8 w - - 0 1"]) {
    assert.equal(papanDariFen(kosong), null, String(kosong));
  }
  const papan = papanDariFen(FEN_AWAL);
  assert.ok(Array.isArray(papan));
  assert.equal(papan.length, 8);
  assert.ok(papan.every((baris) => Array.isArray(baris) && baris.length === 8));
  assert.deepEqual(papan[0][0], { square: "a8", type: "r", color: "b" });
  assert.deepEqual(papan[7][4], { square: "e1", type: "k", color: "w" });
});

test("isEndOpening characterizes asymmetric development thresholds and back-rank piece rules", () => {
  assert.equal(isEndOpening(papanDariFen(FEN_AWAL)), false);
  assert.equal(isEndOpening(papanDariFen(FEN_2_2)), false);
  assert.equal(isEndOpening(papanDariFen(FEN_3_1)), false);
  assert.equal(isEndOpening(papanDariFen(FEN_1_3)), false);

  assert.equal(isEndOpening(papanDariFen(FEN_3_2)), true);
  assert.equal(isEndOpening(papanDariFen(FEN_2_3)), true);
  assert.equal(isEndOpening(papanDariFen(FEN_4_0)), true);
  assert.equal(isEndOpening(papanDariFen(FEN_0_4)), true);

  assert.equal(isEndOpening(papanDariFen(FEN_LAWAN_DI_BELAKANG_2_2)), false);
  assert.equal(isEndOpening(papanDariFen(FEN_EKSTRA_MILIK_SENDIRI_3_1)), false);
});

test("isEndMiddlegame characterizes heavy/minor piece counts and ignores kings and pawns", () => {
  assert.equal(isEndMiddlegame(papanDariFen(FEN_TENGAH_3_3)), false);
  assert.equal(isEndMiddlegame(papanDariFen(FEN_TENGAH_3_2)), false);
  assert.equal(isEndMiddlegame(papanDariFen(FEN_TENGAH_2_3)), false);

  assert.equal(isEndMiddlegame(papanDariFen(FEN_AKHIR_2_2)), true);
  assert.equal(isEndMiddlegame(papanDariFen(FEN_AKHIR_4_1)), true);
  assert.equal(isEndMiddlegame(papanDariFen(FEN_AKHIR_1_4)), true);
  assert.equal(isEndMiddlegame(papanDariFen(FEN_AKHIR_RAJA_PION)), true);
});

test("faseBerikutnya advances strictly one step forward and handles missing boards or unknown phases", () => {
  const awal = papanDariFen(FEN_AWAL);
  const tengah = papanDariFen(FEN_3_2);
  const akhir = papanDariFen(FEN_AKHIR_2_2);

  assert.equal(faseBerikutnya(FASE_PEMBUKAAN, null), FASE_PEMBUKAAN);
  assert.equal(faseBerikutnya(FASE_MENENGAH, undefined), FASE_MENENGAH);
  assert.equal(faseBerikutnya(FASE_PEMBUKAAN, awal), FASE_PEMBUKAAN);
  assert.equal(faseBerikutnya(FASE_PEMBUKAAN, tengah), FASE_MENENGAH);
  // Even an endgame board during opening only advances one step to middlegame.
  assert.equal(faseBerikutnya(FASE_PEMBUKAAN, akhir), FASE_MENENGAH);
  assert.equal(faseBerikutnya(FASE_MENENGAH, awal), FASE_MENENGAH);
  assert.equal(faseBerikutnya(FASE_MENENGAH, akhir), FASE_AKHIR);
  assert.equal(faseBerikutnya(FASE_AKHIR, awal), FASE_AKHIR);
  assert.equal(faseBerikutnya("tidak-dikenal", akhir), "tidak-dikenal");
});

test("antiCheat per-game and aggregate summaries advance phase after recording each step", () => {
  const moves = [
    { fen: FEN_AWAL, color: "w", bestMoveSan: "e4" },
    entriLangkah(FEN_AWAL, { color: "b", san: "e4" }), // opening (w) -> stays opening
    entriLangkah(FEN_3_2, { color: "w", san: "Nf6" }), // opening (b) -> transitions to middlegame AFTER move
    entriLangkah(FEN_TENGAH_3_3, { color: "b", san: "Bc4" }), // middlegame (w) -> stays middlegame
    entriLangkah(FEN_AKHIR_2_2, { color: "w", san: "Rxd8" }), // middlegame (b) -> transitions to endgame AFTER move
    entriLangkah(FEN_AKHIR_RAJA_PION, { color: "b", san: "Ke2" }), // endgame (w)
  ];

  const skor = hitungSkorKecurigaan(moves);
  assert.equal(skor.w.perFase.opening.langkahDinilai, 1);
  assert.equal(skor.w.perFase.middlegame.langkahDinilai, 1);
  assert.equal(skor.w.perFase.endgame.langkahDinilai, 1);
  assert.equal(skor.b.perFase.opening.langkahDinilai, 1);
  assert.equal(skor.b.perFase.middlegame.langkahDinilai, 1);
  assert.equal(skor.b.perFase.endgame.langkahDinilai, 0);

  const agregat = agregatSkorPemain([
    { id: "p1", timestamp: 1, warna: "w", hasil: skor },
  ], "Alice");
  assert.deepEqual(Object.keys(agregat.perFase), DAFTAR_FASE);
  assert.equal(agregat.perFase.opening.langkahDinilai, 1);
  assert.equal(agregat.perFase.middlegame.langkahDinilai, 1);
  assert.equal(agregat.perFase.endgame.langkahDinilai, 1);
});

test("PlayersAccuracy and antiCheat preserve their respective forced-move phase scanning behaviors", () => {
  const muat = buatPemuatJsx({
    "src/halaman/Analisa/komponen/svg/profile.jsx": { default: () => null },
    "src/lib/i18n.jsx": { useI18n: () => ({ t: (k) => k }) },
    "src/modul/profil/index.js": { useKartuPemain: () => null },
    "src/halaman/Analisa/komponen/menu/analysis/summary/ratingBox.jsx": { default: ({ children }) => children },
    "src/components/ui/tooltip.jsx": { TooltipLabel: ({ children }) => children },
  }, { "chess.js": { Chess } });

  const PlayersAccuracy = muat("src/halaman/Analisa/komponen/menu/analysis/summary/playersAccuracy.jsx").default;
  const moves = [
    { fen: FEN_AWAL, color: "w", bestMoveSan: "e4" },
    entriLangkah(FEN_AWAL, { color: "b", san: "e4" }), // opening (w)
    entriLangkah(FEN_3_2, { color: "w", san: "Nf6", isForced: true }), // forced boundary move
    entriLangkah(FEN_AKHIR_2_2, { color: "b", san: "Qd2" }), // middlegame in skor.js, still opening in PlayersAccuracy!
    entriLangkah(FEN_AKHIR_RAJA_PION, { color: "w", san: "Kxd2" }), // endgame in skor.js, middlegame in PlayersAccuracy
  ];

  // antiCheat advances phase on valid FEN even when move is forced.
  const skor = hitungSkorKecurigaan(moves);
  assert.deepEqual(
    DAFTAR_FASE.map((kunci) => skor.w.perFase[kunci].langkahDinilai + skor.b.perFase[kunci].langkahDinilai),
    [1, 1, 1]
  );

  // PlayersAccuracy skips forced moves before recording or advancing phase.
  let akurasi = null;
  let perFase = null;
  let renderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(PlayersAccuracy, {
      players: [{ name: "Putih" }, { name: "Hitam" }],
      accuracy: [{ w: null, b: null }, (v) => { akurasi = v; }],
      setAccuracyPhases: (v) => { perFase = v; },
      moves,
    }));
  });
  act(() => { renderer.unmount(); });

  assert.ok(Number.isFinite(akurasi.w) && Number.isFinite(akurasi.b));
  assert.deepEqual(
    DAFTAR_FASE.map((kunci) => perFase[kunci].w.length + perFase[kunci].b.length),
    [2, 1, 0]
  );
});

test("RingkasanAntiCheat renders phase rows in DAFTAR_FASE order", () => {
  const muat = buatPemuatJsx({
    "src/lib/i18n.jsx": { useI18n: () => ({ t: (k) => k }) },
    "src/modul/analisis/multiPv.js": { MULTI_PV: 5 },
  }, { "chess.js": { Chess } });
  const RingkasanAntiCheat = muat("src/halaman/Analisa/komponen/nav/ringkasanAntiCheat.jsx").default;
  const agregat = agregatSkorPemain([
    {
      id: "p1",
      timestamp: 1,
      warna: "w",
      moves: [
        { fen: FEN_AWAL, color: "w", bestMoveSan: "e4" },
        entriLangkah(FEN_AWAL, { color: "b", san: "e4" }),
        entriLangkah(FEN_3_2, { color: "w", san: "Nf6" }),
        entriLangkah(FEN_AKHIR_2_2, { color: "b", san: "Bc4" }),
        entriLangkah(FEN_AKHIR_RAJA_PION, { color: "w", san: "Ke2" }),
      ],
    },
  ], "Putih");

  let renderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(RingkasanAntiCheat, { agregat }));
  });
  const teks = JSON.stringify(renderer.toJSON());
  act(() => { renderer.unmount(); });

  const indeks = DAFTAR_FASE.map((f) => teks.indexOf(`analisa.antiCheat.fase.${f}`));
  assert.ok(indeks.every((i) => i >= 0));
  assert.ok(indeks[0] < indeks[1] && indeks[1] < indeks[2]);
});
