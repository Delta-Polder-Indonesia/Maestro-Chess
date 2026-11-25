import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { Chess } from "chess.js";
import * as penilaian from "../src/halaman/Analisa/mesin/penilaian.js";
import * as akurasi from "../src/halaman/Analisa/mesin/akurasi.js";
import * as dasar from "../src/halaman/Analisa/mesin/antiCheat/dasar.js";
import * as engine from "../src/halaman/Analisa/mesin/engine.js";
import * as evaluasi from "../src/modul/analisis/evaluasi.js";
import { analisa as kamusEn } from "../src/lib/terjemahan/en/analisa.js";
import { analisa as kamusId } from "../src/lib/terjemahan/id/analisa.js";

const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const penilaianUrl = pathToFileURL(resolve(akar, "src/halaman/Analisa/mesin/penilaian.js")).href;

const NAMA_EKSPOR = [
  "AMBANG_KERUGIAN_PELUANG",
  "JUMLAH_VARIAN",
  "KUNCI_KOMENTAR",
  "getMoveRating",
  "invertColor",
  "isForced",
  "isSacrifice",
];

function nilai({
  staticEval,
  previousStaticEvals,
  bestMoveSan = "Nf3",
  moveSan = "e4",
  fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -",
  color = "w",
  sacrifice = false,
  previousSacrifice = false,
  openings = {},
  kritis = false,
}) {
  return penilaian.getMoveRating({
    staticEval,
    previousStaticEvals,
    bestMoveSan,
    moveSan,
    fen,
    color,
    sacrifice,
    previousSacrifice,
    openings,
    kritis,
  });
}

test("penilaian exposes exact seven named exports, frozen thresholds, matching EN/ID comment keys and SSR safety", () => {
  assert.deepEqual(Object.keys(penilaian).sort(), NAMA_EKSPOR);
  assert.equal(Object.hasOwn(penilaian, "default"), false);
  assert.equal(Object.isFrozen(penilaian.AMBANG_KERUGIAN_PELUANG), true);
  assert.deepEqual(penilaian.AMBANG_KERUGIAN_PELUANG, {
    good: 5,
    inaccuracy: 10,
    mistake: 20,
    blunder: 30,
  });
  assert.equal(penilaian.JUMLAH_VARIAN, 3);
  assert.equal(Array.isArray(penilaian.KUNCI_KOMENTAR), true);
  assert.equal(penilaian.KUNCI_KOMENTAR.length, 19);
  for (const kunci of penilaian.KUNCI_KOMENTAR) {
    assert.equal(Array.isArray(kamusEn.komentar[kunci]), true, `en ${kunci}`);
    assert.equal(kamusEn.komentar[kunci].length, penilaian.JUMLAH_VARIAN, `en len ${kunci}`);
    assert.equal(Array.isArray(kamusId.komentar[kunci]), true, `id ${kunci}`);
    assert.equal(kamusId.komentar[kunci].length, penilaian.JUMLAH_VARIAN, `id len ${kunci}`);
  }
  assert.deepEqual(
    Object.keys(kamusEn.komentar).filter((k) => !penilaian.KUNCI_KOMENTAR.includes(k)),
    [],
  );
  assert.deepEqual(
    Object.keys(kamusId.komentar).filter((k) => !penilaian.KUNCI_KOMENTAR.includes(k)),
    [],
  );

  const script = `
    for (const key of ["window", "document", "navigator", "WebAssembly", "localStorage", "sessionStorage", "fetch"]) {
      Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error(key + " touched"); } });
    }
    globalThis.Worker = class { constructor() { throw new Error("worker created"); } };
    const api = await import(${JSON.stringify(penilaianUrl)});
    if (api.invertColor("w") !== "b" || api.isForced({ before: "7k/6p1/4BKN1/8/8/8/8/8 b - - 0 1" }) !== true) {
      throw new Error("unexpected SSR check result");
    }
    console.log("ok");
  `;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: akar, encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), "ok");
});

test("invertColor, isForced, history slice non-mutation and Math.random commentIndex match legacy contract", () => {
  assert.equal(penilaian.invertColor("w"), "b");
  assert.equal(penilaian.invertColor("b"), "w");
  for (const lain of ["", null, undefined, "W", 0]) {
    assert.equal(penilaian.invertColor(lain), "w", String(lain));
  }

  assert.equal(penilaian.isForced({ before: "7k/6p1/4BKN1/8/8/8/8/8 b - - 0 1" }), true);
  assert.equal(
    penilaian.isForced({ before: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" }),
    false,
  );
  assert.throws(() => penilaian.isForced({ before: "bukan-fen" }));

  const riwayat = [["cp", "15"]];
  const asliRandom = Math.random;
  try {
    Math.random = () => 0.7;
    const hasil = nilai({
      staticEval: ["cp", "-15"],
      previousStaticEvals: riwayat,
      bestMoveSan: "e4",
      moveSan: "e4",
    });
    assert.equal(hasil.moveRating, "best");
    assert.equal(hasil.commentKey, "best");
    assert.equal(hasil.commentIndex, 2);
    assert.equal(riwayat.length, 1);

    Math.random = () => 0;
    assert.equal(
      nilai({ staticEval: ["cp", "-15"], previousStaticEvals: riwayat, bestMoveSan: "e4", moveSan: "e4" }).commentIndex,
      0,
    );
  } finally {
    Math.random = asliRandom;
  }
});

test("getMoveRating preserves validation gate, openings precedence and all five standard bands for White and Black", () => {
  const targetFen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -";

  // Gerbang validasi menang di atas openings, bestMoveSan, dan kritis.
  for (const [staticEval, prev0] of [
    [[], ["cp", "20"]],
    [["cp"], ["cp", "20"]],
    [["cp", "20"], []],
    [["cp", "20"], undefined],
    [["unknown", "20"], ["cp", "20"]],
  ]) {
    const gagal = nilai({
      staticEval,
      previousStaticEvals: [prev0],
      bestMoveSan: "e4",
      moveSan: "e4",
      fen: targetFen,
      openings: { [targetFen]: "King's Pawn" },
      kritis: true,
    });
    assert.deepEqual(gagal, {
      moveRating: null,
      commentKey: null,
      commentIndex: 0,
      statusEvaluasi: evaluasi.STATUS_EVALUASI.GAGAL,
    });
  }

  // openings sebagai fungsi maupun objek mengalahkan best, critical dan sacrifice.
  const bookFn = nilai({
    staticEval: ["cp", "-30"],
    previousStaticEvals: [["cp", "20"]],
    bestMoveSan: "e4",
    moveSan: "e4",
    fen: targetFen,
    sacrifice: true,
    kritis: true,
    openings: (f) => (f === targetFen ? "King's Pawn" : undefined),
  });
  assert.deepEqual(bookFn, { moveRating: "book", comment: "King's Pawn" });
  assert.equal(Object.hasOwn(bookFn, "commentKey"), false);

  const bookMap = nilai({
    staticEval: ["cp", "-30"],
    previousStaticEvals: [["cp", "20"]],
    fen: targetFen,
    openings: { [targetFen]: "King's Pawn Map" },
  });
  assert.deepEqual(bookMap, { moveRating: "book", comment: "King's Pawn Map" });

  // Kelima band standar tanpa melintasi garis ±2.00 untuk Putih dan Hitam.
  const kasusBand = [
    [["cp", "0"], ["cp", "0"], "excellent"],
    [["cp", "0"], ["cp", "55"], "good"],
    [["cp", "0"], ["cp", "115"], "inaccuracy"],
    [["cp", "-201"], ["cp", "950"], "mistake"],
    [["cp", "199"], ["cp", "199"], "blunder"],
  ];
  for (const color of ["w", "b"]) {
    for (const [prev, cur, expected] of kasusBand) {
      const hasil = nilai({
        staticEval: cur,
        previousStaticEvals: [prev],
        bestMoveSan: "Nf3",
        moveSan: "e4",
        color,
      });
      assert.equal(hasil.moveRating, expected, `${color} ${prev[1]}->${cur[1]}`);
      assert.equal(hasil.commentKey, expected, `${color} key ${expected}`);
      assert.ok(hasil.commentIndex >= 0 && hasil.commentIndex < 3);
    }
  }
});

test("getMoveRating characterizes brilliant, great, best, critical and all mate verdicts for both colors", () => {
  // 1. brilliant via sacrifice + pemulihan kesalahan lawan, dan guard !previousBrilliant.
  const brillSac = nilai({
    staticEval: ["cp", "-200"],
    previousStaticEvals: [["cp", "200"], ["cp", "-200"], ["cp", "200"], ["cp", "0"]],
    color: "w",
    sacrifice: true,
    previousSacrifice: false,
  });
  assert.equal(brillSac.moveRating, "brilliant");
  assert.equal(brillSac.commentKey, "brilliant");

  const terhalangPrevBrill = nilai({
    staticEval: ["cp", "-200"],
    previousStaticEvals: [["cp", "200"], ["cp", "-200"], ["cp", "200"], ["cp", "0"]],
    color: "w",
    sacrifice: true,
    previousSacrifice: true,
  });
  assert.equal(terhalangPrevBrill.moveRating, "excellent");

  // 2. brilliant memulai skakmat & mempercepat skakmat.
  assert.equal(
    nilai({
      staticEval: ["mate", "-3"],
      previousStaticEvals: [["cp", "150"]],
      color: "b",
      sacrifice: true,
    }).moveRating,
    "brilliant",
  );
  assert.equal(
    nilai({
      staticEval: ["mate", "-2"],
      previousStaticEvals: [["mate", "3"]],
      color: "w",
      sacrifice: true,
    }).moveRating,
    "brilliant",
  );

  // 3. great menghukum blunder lawan & terblokir bila previousMiss.
  const greatRes = nilai({
    staticEval: ["cp", "-400"],
    previousStaticEvals: [["cp", "400"], ["cp", "400"]],
    color: "w",
  });
  assert.equal(greatRes.moveRating, "great");
  assert.equal(greatRes.commentKey, "great");

  // 4. best terminal mate, legacy ["mate"], critical vs non-best kritis, dan best biasa.
  const bestMate = nilai({
    staticEval: ["mate", "0"],
    previousStaticEvals: [["mate", "1"]],
    bestMoveSan: "Qh7#",
    moveSan: "Qh7#",
    kritis: true,
  });
  assert.equal(bestMate.moveRating, "best");
  assert.equal(bestMate.commentKey, "mate");

  const bestLegacyMate = nilai({
    staticEval: ["mate"],
    previousStaticEvals: [["mate", "1"]],
    bestMoveSan: "Qh7#",
    moveSan: "Qh7#",
  });
  assert.equal(bestLegacyMate.moveRating, "best");
  assert.equal(bestLegacyMate.commentKey, "mate");

  const criticalRes = nilai({
    staticEval: ["cp", "-150"],
    previousStaticEvals: [["cp", "150"]],
    bestMoveSan: "Nf3",
    moveSan: "Nf3",
    kritis: true,
  });
  assert.equal(criticalRes.moveRating, "critical");
  assert.equal(criticalRes.commentKey, "critical");

  const nonBestKritis = nilai({
    staticEval: ["cp", "-140"],
    previousStaticEvals: [["cp", "150"]],
    bestMoveSan: "Nf3",
    moveSan: "Nc3",
    kritis: true,
  });
  assert.equal(nonBestKritis.moveRating, "excellent");

  // 5. excellent mate (non-best terminal, mateIn baru, mateIn lanjutan) dan good (delayMate, advanceMate).
  const excMateTerm = nilai({
    staticEval: ["mate", "0"],
    previousStaticEvals: [["mate", "1"]],
    bestMoveSan: "Qg7#",
    moveSan: "Qh7#",
  });
  assert.equal(excMateTerm.moveRating, "excellent");
  assert.equal(excMateTerm.commentKey, "mate");

  assert.equal(
    nilai({ staticEval: ["mate", "-3"], previousStaticEvals: [["cp", "100"]], color: "w" }).commentKey,
    "mateIn",
  );
  assert.equal(
    nilai({ staticEval: ["mate", "-2"], previousStaticEvals: [["mate", "3"]], color: "b" }).commentKey,
    "mateIn",
  );

  for (const color of ["w", "b"]) {
    const delay = nilai({
      staticEval: ["mate", "-4"],
      previousStaticEvals: [["mate", "2"]],
      color,
    });
    assert.equal(delay.moveRating, "good", `delayMate ${color}`);
    assert.equal(delay.commentKey, "delayMate", `delayMate key ${color}`);

    const adv = nilai({
      staticEval: ["mate", "2"],
      previousStaticEvals: [["mate", "-4"]],
      color,
    });
    assert.equal(adv.moveRating, "good", `advanceMate ${color}`);
    assert.equal(adv.commentKey, "advanceMate", `advanceMate key ${color}`);
  }
});

test("getMoveRating characterizes miss, loseAdvantage, giveAdvantage and gettingMated for White and Black", () => {
  // missMate: kehilangan jalur skakmat menang.
  const missMate = nilai({
    staticEval: ["cp", "50"],
    previousStaticEvals: [["mate", "2"]],
    color: "w",
  });
  assert.equal(missMate.moveRating, "miss");
  assert.equal(missMate.commentKey, "missMate");

  // missAdvantage: lawan baru blunder besar dan pemain membalas blunder.
  const missAdv = nilai({
    staticEval: ["cp", "0"],
    previousStaticEvals: [["cp", "400"], ["cp", "400"]],
    color: "w",
  });
  assert.equal(missAdv.moveRating, "miss");
  assert.equal(missAdv.commentKey, "missAdvantage");

  for (const color of ["w", "b"]) {
    // loseAdvantage -> mistake bila kerugian peluang < 30, blunder bila >= 30.
    const loseMistake = nilai({
      staticEval: ["cp", "-120"],
      previousStaticEvals: [["cp", "250"]],
      color,
    });
    assert.equal(loseMistake.moveRating, "mistake", `loseMistake ${color}`);
    assert.equal(loseMistake.commentKey, "loseAdvantage", `loseMistake key ${color}`);

    const loseBlunder = nilai({
      staticEval: ["cp", "100"],
      previousStaticEvals: [["cp", "500"]],
      color,
    });
    assert.equal(loseBlunder.moveRating, "blunder", `loseBlunder ${color}`);
    assert.equal(loseBlunder.commentKey, "loseAdvantage", `loseBlunder key ${color}`);

    // giveAdvantage -> mistake (< 30) dan blunder (>= 30).
    const giveMistake = nilai({
      staticEval: ["cp", "400"],
      previousStaticEvals: [["cp", "-150"]],
      color,
    });
    assert.equal(giveMistake.moveRating, "mistake", `giveMistake ${color}`);
    assert.equal(giveMistake.commentKey, "giveAdvantage", `giveMistake key ${color}`);

    const giveBlunder = nilai({
      staticEval: ["cp", "600"],
      previousStaticEvals: [["cp", "0"]],
      color,
    });
    assert.equal(giveBlunder.moveRating, "blunder", `giveBlunder ${color}`);
    assert.equal(giveBlunder.commentKey, "giveAdvantage", `giveBlunder key ${color}`);

    // gettingMated: posisi sudah kalah berat (<= -2 untuk w, >= 2 untuk b) -> mistake; posisi seimbang/menang -> blunder.
    const gmMistake = nilai({
      staticEval: ["mate", "3"],
      previousStaticEvals: [["cp", "-250"]],
      color,
    });
    assert.equal(gmMistake.moveRating, "mistake", `gmMistake ${color}`);
    assert.equal(gmMistake.commentKey, "gettingMated", `gmMistake key ${color}`);

    const gmBlunder = nilai({
      staticEval: ["mate", "3"],
      previousStaticEvals: [["cp", "100"]],
      color,
    });
    assert.equal(gmBlunder.moveRating, "blunder", `gmBlunder ${color}`);
    assert.equal(gmBlunder.commentKey, "gettingMated", `gmBlunder key ${color}`);
  }
});

test("isSacrifice characterizes undefended captures, minor-vs-pawn, rook/queen battery exceptions, pinned pieces and couldBeSaved", () => {
  const langkah = (fen, mv) => new Chess(fen).move(mv);

  // 1. Penyerang terpin ke raja musuh diabaikan; pembela terpin ke raja sendiri tetap dianggap tak terjaga.
  assert.equal(
    penilaian.isSacrifice(langkah("4k3/8/8/8/4rB2/8/7P/3QRK2 w - - 0 1", "h3")),
    false,
  );
  assert.equal(
    penilaian.isSacrifice(langkah("k5r1/8/8/3q4/4N1R1/8/7P/6K1 w - - 0 1", "h3")),
    true,
  );

  // 2. Bidak minor diserang pion: non-capture bernilai true, capture pion saat dibela bernilai false.
  assert.equal(
    penilaian.isSacrifice(langkah("4k3/8/8/8/3p4/1R6/4N3/4K3 w - - 0 1", "Nc3")),
    true,
  );
  assert.equal(
    penilaian.isSacrifice(langkah("4k3/8/8/8/3p4/1Rp5/4N3/4K3 w - - 0 1", "Nxc3")),
    false,
  );

  // 3. Pengecualian Benteng & Ratu serta baterai tersembunyi.
  assert.equal(
    penilaian.isSacrifice(langkah("4k3/3r4/4n3/8/2B5/8/4R3/4K3 w - - 0 1", "Rxe6")),
    false,
  );
  assert.equal(
    penilaian.isSacrifice(langkah("4k3/8/1r1r4/8/8/8/3Q4/3RK3 w - - 0 1", "Qxd6")),
    false,
  );
  assert.equal(
    penilaian.isSacrifice(langkah("3rk3/3r4/3r4/8/8/8/3Q4/3RK3 w - - 0 1", "Qxd6")),
    true,
  );

  // 4. Bidak yang sejak sebelum langkah tidak punya langkah penyelamat sah bukan pengorbanan.
  assert.equal(
    penilaian.isSacrifice(langkah("N6k/r1P5/1P6/8/8/8/7P/7K w - - 0 1", "h3")),
    false,
  );

  // 5. Tidak memutasi objek move masukan dan melempar pada FEN tidak valid.
  const mv = langkah("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "e4");
  const snapshot = structuredClone(mv);
  assert.equal(penilaian.isSacrifice(mv), false);
  assert.deepEqual({ ...mv }, snapshot);
  assert.throws(() => penilaian.isSacrifice({ before: "invalid", after: mv.after, color: "w", from: "e2" }));
});

test("penilaian callers akurasi, antiCheat/dasar and engine preserve invertColor and parsePGN integration", async () => {
  assert.strictEqual(engine.invertColor, penilaian.invertColor);
  assert.equal(akurasi.pemainDariEntri({ color: "w" }, 1), "b");
  assert.equal(akurasi.pemainDariEntri({ color: "b" }, 0), null);
  assert.equal(akurasi.pemainDariEntri({}, 1), "w");
  assert.equal(dasar.pemainLangkah({ color: "w" }, 1), "b");
  assert.equal(dasar.pemainLangkah({}, 0), null);
  assert.equal(dasar.pemainLangkah({}, 1), "w");
  assert.equal(dasar.pemainLangkah({}, 2), "b");

  const fakeMesin = {
    gameBaru() {},
    setop() {},
    async cari() {
      return {
        staticEval: ["cp", "20"],
        bestMove: undefined,
        bestMoveCoronation: undefined,
        daftarKandidat: [],
      };
    },
  };
  const progres = [];
  const { moves } = await engine.parsePGN(
    fakeMesin,
    '[White "A"]\n[Black "B"]\n\n1. e4 e5 *',
    6,
    {},
    (nilaiProgres) => progres.push(nilaiProgres),
  );
  assert.deepEqual(progres, [50, 100, 0]);
  assert.equal(moves.length, 3);
  assert.equal(moves[1].san, "e4");
  assert.equal(moves[1].color, "b");
  assert.equal(moves[1].moveRating, "excellent");
  assert.equal(moves[1].commentKey, "excellent");
  assert.equal(moves[1].isForced, false);
  assert.equal(moves[1].statusEvaluasi, evaluasi.STATUS_EVALUASI.SIAP);
  assert.equal(moves[2].san, "e5");
  assert.equal(moves[2].color, "w");
});
