import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { Chess } from "chess.js";
import React from "react";
import TestRenderer from "react-test-renderer";
import * as akurasi from "../src/halaman/Analisa/mesin/akurasi.js";
import * as peluang from "../src/modul/analisis/peluang.js";
import * as evaluasi from "../src/modul/analisis/evaluasi.js";
import * as antiCheat from "../src/halaman/Analisa/mesin/antiCheat.js";
import * as antiCheatDasar from "../src/halaman/Analisa/mesin/antiCheat/dasar.js";
import * as antiCheatSkor from "../src/halaman/Analisa/mesin/antiCheat/skor.js";
import * as antiCheatAgregat from "../src/halaman/Analisa/mesin/antiCheat/agregat.js";
import * as ringkasan from "../src/halaman/Analisa/mesin/ringkasanAnalisis.js";
import * as langkahKritis from "../src/halaman/Analisa/mesin/langkahKritis.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const { act } = TestRenderer;
const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const akurasiUrl = pathToFileURL(resolve(akar, "src/halaman/Analisa/mesin/akurasi.js")).href;

const EKSPOR_AKURASI = [
  "AMBANG_ANOTASI",
  "CP_AWAL",
  "CP_CEILING",
  "DAFTAR_ANOTASI",
  "FAKTOR_PELUANG",
  "KURVA_AKURASI",
  "akurasiLangkah",
  "akurasiMove",
  "anotasiLangkah",
  "anotasiMove",
  "batasiCp",
  "cpBaku",
  "harmonikDariJumlah",
  "inversAkurasi",
  "kerugianLangkah",
  "kerugianMove",
  "nilaiGrafikCp",
  "pasanganCpMove",
  "peluangMenang",
  "pemainDariEntri",
  "petaAnotasiKosong",
  "rataHarmonik",
  "rataRataAngka",
  "ringkasAkurasi",
];

test("akurasi exposes exact 24 named exports, frozen constants, shared identities and SSR safety", () => {
  assert.deepEqual(Object.keys(akurasi).sort(), EKSPOR_AKURASI);
  assert.equal(Object.hasOwn(akurasi, "default"), false);

  assert.equal(akurasi.CP_AWAL, 15);
  assert.equal(Object.isFrozen(akurasi.KURVA_AKURASI), true);
  assert.deepEqual(akurasi.KURVA_AKURASI, { a: 103.1668, k: -0.04354, b: -3.1669, bonus: 1 });
  assert.equal(Object.isFrozen(akurasi.DAFTAR_ANOTASI), true);
  assert.deepEqual(akurasi.DAFTAR_ANOTASI, ["??", "?", "?!", "!!", "!", "!?"]);
  assert.equal(Object.isFrozen(akurasi.AMBANG_ANOTASI), true);
  assert.deepEqual(akurasi.AMBANG_ANOTASI, { blunder: 20, mistake: 10, dubious: 5, great: 10, interesting: 5 });

  assert.strictEqual(akurasi.CP_CEILING, peluang.CP_CEILING);
  assert.strictEqual(akurasi.FAKTOR_PELUANG, peluang.FAKTOR_PELUANG);
  assert.strictEqual(akurasi.batasiCp, peluang.batasiCp);
  assert.strictEqual(akurasi.peluangMenang, peluang.peluangMenang);
  assert.strictEqual(akurasi.cpBaku, evaluasi.cpBaku);

  const script = `
    for (const key of ["window", "document", "navigator", "WebAssembly", "localStorage", "sessionStorage", "fetch"]) {
      Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error(key + " touched"); } });
    }
    globalThis.Worker = class { constructor() { throw new Error("worker created"); } };
    const api = await import(${JSON.stringify(akurasiUrl)});
    if (
      api.akurasiLangkah(0, 0) !== 100 ||
      api.nilaiGrafikCp(Infinity) !== 1 ||
      api.pemainDariEntri({ color: "w" }, 1) !== "b"
    ) {
      throw new Error("unexpected SSR check result");
    }
    console.log("ok");
  `;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: akar, encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), "ok");
});

test("akurasiLangkah, kerugianLangkah, nilaiGrafikCp and move extractors preserve formulas and legacy edge behaviors", () => {
  const { akurasiLangkah, kerugianLangkah, nilaiGrafikCp, pasanganCpMove, akurasiMove, kerugianMove } = akurasi;

  for (const invalid of [null, undefined, NaN, Infinity, -Infinity, "0", {}]) {
    assert.equal(akurasiLangkah(invalid, 0), null, `akurasi sebelum ${String(invalid)}`);
    assert.equal(akurasiLangkah(0, invalid), null, `akurasi sesudah ${String(invalid)}`);
    assert.equal(kerugianLangkah(invalid, 0), null, `kerugian sebelum ${String(invalid)}`);
    assert.equal(kerugianLangkah(0, invalid), null, `kerugian sesudah ${String(invalid)}`);
  }

  assert.equal(akurasiLangkah(0, 0), 100);
  assert.equal(akurasiLangkah(-120, 80), 100);
  const ak500 = 103.1668 * Math.exp(-0.04354 * (akurasi.peluangMenang(0) - akurasi.peluangMenang(-500))) - 3.1669 + 1;
  assert.ok(Math.abs(akurasiLangkah(0, -500) - ak500) < 1e-12);
  assert.equal(akurasiLangkah(0, -500).toFixed(2), "19.07");
  assert.equal(akurasiLangkah(1000, -1000), 0);

  assert.equal(kerugianLangkah(50, 50), 0);
  assert.equal(kerugianLangkah(0, 150), 0);
  assert.equal(kerugianLangkah(500, -500), 1000);
  // Tanpa batas atas sendiri selain clamp ±1000 oleh cpBaku.
  assert.equal(kerugianLangkah(1000, -1000), 2000);

  for (const bukanAngka of ["0", null, undefined, NaN, {}]) {
    assert.equal(nilaiGrafikCp(bukanAngka), null, `grafik ${String(bukanAngka)}`);
  }
  assert.equal(nilaiGrafikCp(0), 0);
  assert.equal(nilaiGrafikCp(-0), 0);
  assert.equal(nilaiGrafikCp(Infinity), 1);
  assert.equal(nilaiGrafikCp(-Infinity), -1);
  assert.ok(Math.abs(nilaiGrafikCp(250) - (2 / (1 + Math.exp(-0.004 * 250)) - 1)) < 1e-15);
  assert.ok(Math.abs(nilaiGrafikCp(250) + nilaiGrafikCp(-250)) < 1e-15);

  for (const kosong of [
    null,
    undefined,
    {},
    { previousStaticEvals: [] },
    { previousStaticEvals: [["cp", "10"]] },
    { previousStaticEvals: [["cp", "abc"], ["cp", "10"]] },
    { previousStaticEvals: [["cp", "10"], ["mate"]] },
  ]) {
    assert.equal(pasanganCpMove(kosong), null);
    assert.equal(akurasiMove(kosong), null);
    assert.equal(kerugianMove(kosong), null);
  }

  const seimbang = { previousStaticEvals: [["cp", "-34"], ["cp", "34"]] };
  assert.deepEqual(pasanganCpMove(seimbang), { sebelum: 34, sesudah: 34 });
  assert.equal(akurasiMove(seimbang), 100);
  assert.equal(kerugianMove(seimbang), 0);

  const blunder = { previousStaticEvals: [["cp", "500"], ["cp", "0"]] };
  assert.deepEqual(pasanganCpMove(blunder), { sebelum: 0, sesudah: -500 });
  assert.equal(akurasiMove(blunder), akurasiLangkah(0, -500));
  assert.equal(kerugianMove(blunder), 500);

  const beriMate = { previousStaticEvals: [["mate", "0"], ["mate", "1"]] };
  assert.deepEqual(pasanganCpMove(beriMate), { sebelum: 1000, sesudah: 1000 });
  assert.equal(akurasiMove(beriMate), 100);
  assert.equal(kerugianMove(beriMate), 0);

  const nolKeNol = { previousStaticEvals: [["cp", "0"], ["cp", "0"]] };
  const pasangNol = pasanganCpMove(nolKeNol);
  assert.equal(pasangNol.sebelum, 0);
  assert.equal(Object.is(pasangNol.sesudah, -0), true);
  assert.equal(akurasiMove(nolKeNol), 100);
  assert.equal(kerugianMove(nolKeNol), 0);
});

test("anotasiLangkah, anotasiMove and petaAnotasiKosong preserve strict thresholds, MultiPV guards and mate coercions", () => {
  const { anotasiLangkah, anotasiMove, petaAnotasiKosong, DAFTAR_ANOTASI } = akurasi;

  const p1 = petaAnotasiKosong();
  const p2 = petaAnotasiKosong();
  assert.notStrictEqual(p1, p2);
  assert.deepEqual(Object.keys(p1), DAFTAR_ANOTASI);
  assert.deepEqual(p1, { "??": 0, "?": 0, "?!": 0, "!!": 0, "!": 0, "!?": 0 });
  p1["??"] = 9;
  assert.equal(p2["??"], 0);

  assert.equal(anotasiLangkah(), "");
  assert.equal(anotasiLangkah({ sebelumCp: NaN, sesudahCp: 0 }), "");
  assert.equal(anotasiLangkah({ sebelumCp: 0, sesudahCp: Infinity }), "");

  // Ambang selisih win-chance memakai > ketat: exact 20 masih "?" dan > 20 menjadi "??".
  assert.equal(anotasiLangkah({ sebelumCp: 230.1139194116379, sesudahCp: 0 }), "?");
  assert.equal(anotasiLangkah({ sebelumCp: 230.2, sesudahCp: 0 }), "??");
  assert.equal(anotasiLangkah({ sebelumCp: 110.0, sesudahCp: 0 }), "?!");
  assert.equal(anotasiLangkah({ sebelumCp: 110.2, sesudahCp: 0 }), "?");
  assert.equal(anotasiLangkah({ sebelumCp: 54.4, sesudahCp: 0 }), "");
  assert.equal(anotasiLangkah({ sebelumCp: 54.6, sesudahCp: 0 }), "?!");
  // Pengorbanan tidak menggantikan label negatif bila kerugian melebihi ambang.
  assert.equal(anotasiLangkah({ sebelumCp: 60, sesudahCp: 0, sacrifice: true }), "?!");

  // kandidat.length <= 1 atau bukan array tidak pernah menghasilkan "!!", "!", atau "!?".
  assert.equal(
    anotasiLangkah({
      sebelumCp: 50,
      sesudahCp: 50,
      sacrifice: true,
      kandidat: [{ uci: "e2e4", cp: 200 }],
      uci: "e2e4",
    }),
    "",
  );
  assert.equal(
    anotasiLangkah({ sebelumCp: 50, sesudahCp: 50, sacrifice: true, kandidat: null, uci: "e2e4" }),
    "",
  );

  // Cabang "!!": kandidat #1 > #2 lebih dari 10 poin peluang, langkah === uci terbaik, sacrifice === true.
  const kandKritis = [
    { uci: "e2e4", cp: 250, mate: null },
    { uci: "d2d4", cp: 0, mate: null },
  ];
  assert.equal(
    anotasiLangkah({
      sebelumCp: 250,
      sesudahCp: 250,
      kandidat: kandKritis,
      uci: "e2e4",
      sacrifice: true,
    }),
    "!!",
  );

  // Cabang "!": bukan sacrifice, duaLangkahLaluCp tersedia & kenaikan > 5 poin peluang.
  assert.equal(
    anotasiLangkah({
      sebelumCp: 250,
      sesudahCp: 250,
      duaLangkahLaluCp: 150,
      kandidat: kandKritis,
      uci: "e2e4",
      sacrifice: false,
    }),
    "!",
  );
  // Jika duaLangkahLaluCp null (atau selisih <= 5) saat sudah masuk cabang kandidat terbaik,
  // hasil harus "" dan TIDAK jatuh ke else-if "!?".
  assert.equal(
    anotasiLangkah({
      sebelumCp: 250,
      sesudahCp: 250,
      duaLangkahLaluCp: null,
      kandidat: kandKritis,
      uci: "e2e4",
      sacrifice: false,
    }),
    "",
  );

  // Cabang "!?": sacrifice dengan sesudahCp > -200 (ketat!) bila bukan langkah terbaik unik
  // dan selisih win-chance tidak melebihi ambang dubious (5).
  assert.equal(
    anotasiLangkah({
      sebelumCp: -190,
      sesudahCp: -199,
      kandidat: [
        { uci: "e2e4", cp: 10, mate: null },
        { uci: "d2d4", cp: 5, mate: null },
      ],
      uci: "e2e4",
      sacrifice: true,
    }),
    "!?",
  );
  assert.equal(
    anotasiLangkah({
      sebelumCp: -190,
      sesudahCp: -200,
      kandidat: [
        { uci: "e2e4", cp: 10, mate: null },
        { uci: "d2d4", cp: 5, mate: null },
      ],
      uci: "e2e4",
      sacrifice: true,
    }),
    "",
  );

  // cpBakuDariKandidat memakai tandaMate: mate 0 atau false -> -1000, mate "" -> null, mate >0 -> +1000.
  assert.equal(
    anotasiLangkah({
      sebelumCp: 0,
      sesudahCp: 0,
      duaLangkahLaluCp: 0,
      kandidat: [
        { uci: "e2e4", cp: null, mate: 2 },
        { uci: "d2d4", cp: null, mate: 0 },
      ],
      uci: "e2e4",
      sacrifice: false,
    }),
    "!",
  );
  assert.equal(
    anotasiLangkah({
      sebelumCp: 0,
      sesudahCp: 0,
      duaLangkahLaluCp: 0,
      kandidat: [
        { uci: "e2e4", cp: null, mate: 2 },
        { uci: "d2d4", cp: null, mate: false },
      ],
      uci: "e2e4",
      sacrifice: false,
    }),
    "!",
  );
  assert.equal(
    anotasiLangkah({
      sebelumCp: 0,
      sesudahCp: 0,
      duaLangkahLaluCp: 0,
      kandidat: [
        { uci: "e2e4", cp: null, mate: 2 },
        { uci: "d2d4", cp: null, mate: "" },
      ],
      uci: "e2e4",
      sacrifice: false,
    }),
    "",
  );

  // anotasiMove
  assert.equal(anotasiMove({}, kandKritis, 0), "");
  assert.equal(
    anotasiMove(
      { previousStaticEvals: [["cp", "-250"], ["cp", "250"]], uci: "e2e4", sacrifice: true },
      kandKritis,
    ),
    "!!",
  );
});

test("harmonic and arithmetic accuracy aggregations preserve clamping, null guards and cross-game sum equivalence", () => {
  const { rataHarmonik, rataRataAngka, ringkasAkurasi, harmonikDariJumlah, inversAkurasi } = akurasi;

  for (const kosong of [null, undefined, 123, [], [null, undefined, NaN, Infinity]]) {
    assert.equal(rataHarmonik(kosong), null);
    assert.equal(rataRataAngka(kosong), null);
    assert.deepEqual(ringkasAkurasi(kosong), { akurasi: null, akurasiAritmetik: null });
  }

  // Clamp Math.max(1, a) mencegah nilai 0 atau negatif menarik seluruh harmonic mean ke nol.
  const hNol = 2 / (1 + 1 / 100);
  assert.ok(Math.abs(rataHarmonik([0, 100]) - hNol) < 1e-12);
  assert.equal(rataHarmonik([-50, 100]), rataHarmonik([0, 100]));
  assert.ok(Math.abs(rataHarmonik([100, 100, 0]) - 3 / (0.01 + 0.01 + 1)) < 1e-12);
  assert.equal(rataRataAngka([0, 100, NaN, null]), 50);

  const ringkas = ringkasAkurasi([90, 60, null, NaN]);
  assert.equal(ringkas.akurasiAritmetik, 75);
  assert.ok(Math.abs(ringkas.akurasi - 2 / (1 / 90 + 1 / 60)) < 1e-12);

  for (const invalid of [null, undefined, NaN, Infinity, -Infinity, "50"]) {
    assert.equal(inversAkurasi(invalid), null);
  }
  assert.equal(inversAkurasi(0), 1);
  assert.equal(inversAkurasi(-10), 1);
  assert.equal(inversAkurasi(0.5), 1);
  assert.equal(inversAkurasi(50), 0.02);

  for (const [inv, n] of [
    [NaN, 5],
    [5, NaN],
    [1, 0],
    [1, -2],
    [0, 5],
    [-1, 5],
  ]) {
    assert.equal(harmonikDariJumlah(inv, n), null);
  }

  // Akumulasi mentah lintas dua partai harus sama persis dengan rataHarmonik gabungan.
  const partai1 = [100, 80, 0];
  const partai2 = [95, 70];
  const gabungan = [...partai1, ...partai2];
  const jumlahInvers = gabungan.reduce((acc, a) => acc + inversAkurasi(a), 0);
  assert.ok(Math.abs(harmonikDariJumlah(jumlahInvers, gabungan.length) - rataHarmonik(gabungan)) < 1e-12);
});

test("pemainDariEntri matches antiCheat/dasar.pemainLangkah across index and color edge cases", () => {
  const { pemainDariEntri } = akurasi;
  const kasus = [
    [null, 1, null],
    [undefined, 1, null],
    [{ color: "w" }, 0, null],
    [{ color: "b" }, -1, null],
    [{ color: "w" }, 1, "b"],
    [{ color: "b" }, 2, "w"],
    [{ color: "W" }, 1, "w"],
    [{ color: "" }, 2, "b"],
    [{}, 3, "w"],
    [{}, 4, "b"],
  ];
  for (const [move, idx, diharapkan] of kasus) {
    assert.equal(pemainDariEntri(move, idx), diharapkan);
    assert.equal(pemainDariEntri(move, idx), antiCheatDasar.pemainLangkah(move, idx));
  }
});

test("downstream callers antiCheat, ringkasanAnalisis and langkahKritis integrate accurately with akurasi", () => {
  for (const nama of [
    "akurasiMove",
    "anotasiMove",
    "CP_AWAL",
    "CP_CEILING",
    "DAFTAR_ANOTASI",
    "harmonikDariJumlah",
    "kerugianMove",
    "peluangMenang",
    "petaAnotasiKosong",
    "rataHarmonik",
  ]) {
    assert.strictEqual(antiCheat[nama], akurasi[nama], `antiCheat.${nama}`);
  }

  const movesRingkas = [
    { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" },
    { color: "b", san: "e4", moveRating: "critical", previousStaticEvals: [["cp", "-20"], ["cp", "20"]] },
    { color: "w", san: "e5", isForced: true, moveRating: "best", previousStaticEvals: [["cp", "40"], ["cp", "20"]] },
    { color: "b", san: "Nf3", moveRating: "good", previousStaticEvals: [] },
  ];
  const hasilRingkas = ringkasan.ringkasAnalisis(movesRingkas);
  assert.equal(hasilRingkas.totalPlies, 3);
  assert.equal(hasilRingkas.summary.w.eligibleMoves, 1);
  assert.equal(hasilRingkas.summary.w.excludedMoves, 1);
  assert.equal(hasilRingkas.summary.w.breakdown.best, 1);
  assert.equal(hasilRingkas.summary.b.eligibleMoves, 1);
  assert.equal(hasilRingkas.summary.b.breakdown.forced, 1);
  assert.equal(hasilRingkas.summary.b.accuracyEstimate, akurasi.akurasiMove(movesRingkas[2]));

  const papan = new Chess();
  const e4 = papan.move("e4");
  const kandidat = [
    { peringkat: 1, uci: "e2e4", cp: 260, mate: null },
    { peringkat: 2, uci: "d2d4", cp: 0, mate: null },
  ];
  assert.equal(
    langkahKritis.apakahLangkahKritis(e4, {
      staticEval: ["cp", "-250"],
      previousKandidat: kandidat,
      previousBestMoveSan: "e4",
    }),
    true,
  );
  assert.equal(langkahKritis.cpKandidat({ mate: 0 }), -1000);
  assert.equal(langkahKritis.cpKandidat({ mate: "" }), null);

  // Integrasi antiCheat/skor.js dan antiCheat/agregat.js (cross-game harmonic mean + anotasi).
  const movesSkor = [
    {
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      kandidat: [
        { peringkat: 1, uci: "e2e4", cp: 260, mate: null },
        { peringkat: 2, uci: "d2d4", cp: 0, mate: null },
      ],
      bestMoveSan: "e4",
    },
    {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      color: "b",
      san: "e4",
      uci: "e7e5",
      sacrifice: true,
      moveRating: "brilliant",
      previousStaticEvals: [["cp", "-260"], ["cp", "260"], ["cp", "0"]],
    },
    {
      fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
      color: "w",
      san: "e5",
      uci: "e2e4",
      moveRating: "best",
      previousStaticEvals: [["cp", "0"], ["cp", "0"]],
    },
  ];
  movesSkor[1].uci = "e2e4";
  const skor = antiCheatSkor.hitungSkorKecurigaan(movesSkor);
  assert.equal(skor.w.anotasi["!!"], 1);
  assert.equal(skor.w.akurasiSampel, 1);

  const agregat = antiCheatAgregat.agregatSkorPemain([
    { id: "g1", timestamp: 1, warna: "w", moves: movesSkor },
    {
      id: "g2",
      timestamp: 2,
      warna: "w",
      moves: [
        { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" },
        {
          fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
          color: "b",
          san: "e4",
          uci: "e2e4",
          moveRating: "blunder",
          previousStaticEvals: [["cp", "500"], ["cp", "0"]],
        },
      ],
    },
  ], "Putih");
  assert.equal(agregat.akurasiSampel, 2);
  assert.equal(agregat.anotasi["!!"], 1);
  assert.equal(agregat.anotasi["??"], 1);
  const akurasiManual = Math.round(akurasi.rataHarmonik([100, akurasi.akurasiLangkah(0, -500)]) * 10) / 10;
  assert.equal(agregat.akurasi, akurasiManual);
});

test("UI components PlayersAccuracy and KartuAkurasiPartai integrate with akurasi helpers", async () => {
  const muat = buatPemuatJsx(
    {
      "src/halaman/Analisa/komponen/svg/profile.jsx": { default: () => null },
      "src/lib/i18n.jsx": { useI18n: () => ({ t: (k) => k }) },
      "src/modul/profil/index.js": { useKartuPemain: () => null },
      "src/halaman/Analisa/komponen/menu/analysis/summary/ratingBox.jsx": {
        default: ({ children, white }) => React.createElement("span", { "data-side": white ? "w" : "b" }, children),
      },
      "src/components/ui/tooltip.jsx": { TooltipLabel: ({ children }) => children },
    },
    { "chess.js": { Chess } },
  );

  const PlayersAccuracy = muat("src/halaman/Analisa/komponen/menu/analysis/summary/playersAccuracy.jsx").default;
  const KartuAkurasiPartai = muat("src/halaman/Analisa/komponen/nav/wawasan/kartuAkurasi.jsx").default;

  const moves = [
    { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", color: "w" },
    {
      fen: "bukan-fen",
      color: "b",
      san: "e4",
      previousStaticEvals: [["cp", "0"], ["cp", "0"]],
      kandidat: [{ peringkat: 1, wdl: [500, 400, 100] }],
    },
    {
      fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
      color: "w",
      san: "e5",
      isForced: true,
      previousStaticEvals: [["cp", "500"], ["cp", "0"]],
      kandidat: [{ peringkat: 1, wdl: [100, 200, 700] }],
    },
    {
      fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
      color: "b",
      san: "Nf3",
      previousStaticEvals: [["mate", "-2"], ["cp", "100"]],
    },
  ];

  let akurasiSummary = null;
  let faseSummary = null;
  let rendSummary;
  await act(async () => {
    rendSummary = TestRenderer.create(
      React.createElement(PlayersAccuracy, {
        players: [{ name: "Putih" }, { name: "Hitam" }],
        accuracy: [{ w: null, b: null }, (v) => { akurasiSummary = v; }],
        setAccuracyPhases: (v) => { faseSummary = v; },
        moves,
      }),
    );
  });
  await act(async () => { rendSummary.unmount(); });

  assert.equal(akurasiSummary.w, 100);
  assert.ok(Math.abs(akurasiSummary.b - akurasi.akurasiLangkah(0, -500)) < 1e-12);
  assert.deepEqual(faseSummary.opening, { w: [100], b: [] });

  let rendKartu;
  await act(async () => {
    rendKartu = TestRenderer.create(
      React.createElement(KartuAkurasiPartai, {
        players: [{ name: "Putih" }, { name: "Hitam" }],
        moves,
      }),
    );
  });
  const teksDiv = rendKartu.root
    .findAllByType("div")
    .map((node) => node.children.filter((c) => typeof c === "string").join(""));
  assert.ok(teksDiv.includes("100.0%"));
  assert.ok(teksDiv.includes("19.1%"));
  assert.ok(teksDiv.includes("0.0 ACPL"));
  assert.ok(teksDiv.includes("500.0 ACPL"));

  // Grafik SVG memetakan eval awal = 0 (y=95.00), eval sesudah Hitam +500 cp (Putih unggul -> y<95),
  // dan mate terukur langsung ke tepi atas (y=8.00).
  const pathSvg = rendKartu.root
    .findAllByType("path")
    .map((node) => node.props.d)
    .find((d) => !d.endsWith("Z"));
  assert.match(pathSvg, /^M 8\.00 95\.00 L 360\.00 \d+\.\d{2} L 712\.00 8\.00$/);

  const tombolWdl = rendKartu.root.findAllByType("button").find((btn) => btn.children.includes("WDL"));
  assert.equal(tombolWdl.props.disabled, false);
  await act(async () => { tombolWdl.props.onClick(); });
  assert.equal(tombolWdl.props["aria-pressed"], true);
  await act(async () => { rendKartu.unmount(); });
});
