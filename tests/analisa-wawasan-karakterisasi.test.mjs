import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import * as wawasan from "../src/halaman/Analisa/mesin/wawasan.js";
import * as analisisTersimpan from "../src/modul/analisis/analisisTersimpan.js";
import { hashPgn } from "../src/lib/pgnRingan.js";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const wrapper = ({ children }) => React.createElement(React.Fragment, null, children);
const kosong = () => null;
const t = (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key);

const {
  LABEL_PEMBUKAAN,
  agregasiWawasan,
  ekstraksHeaderPgn,
  extractFirstMovesFromPgn,
  filterPartaiWawasan,
  formatEcoUrlName,
  hitungHasil,
  hitungPembukaanTeratas,
  hitungStreak,
  hitungTaktikal,
  hitungTrenRating,
  parsePgnHeaders,
  warnaPemain,
} = wawasan;

function kompilasi(path, dependencies, namaExport = "default") {
  const filename = new URL(path, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename.pathname,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = { exports: {} };
  runInThisContext(`(function (require, module, exports) {\n${compiled}\n})`)((id) => {
    if (["react", "react/jsx-runtime", "lucide-react"].includes(id)) return require(id);
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, result, result.exports);
  return result.exports[namaExport];
}

test("wawasan exposes exact 13 named exports, frozen LABEL_PEMBUKAAN and parsePgnHeaders alias without default", () => {
  assert.deepEqual(Object.keys(wawasan).sort(), [
    "LABEL_PEMBUKAAN",
    "agregasiWawasan",
    "ekstraksHeaderPgn",
    "extractFirstMovesFromPgn",
    "filterPartaiWawasan",
    "formatEcoUrlName",
    "hitungHasil",
    "hitungPembukaanTeratas",
    "hitungStreak",
    "hitungTaktikal",
    "hitungTrenRating",
    "parsePgnHeaders",
    "warnaPemain",
  ]);
  assert.equal(Object.hasOwn(wawasan, "default"), false);
  assert.strictEqual(ekstraksHeaderPgn, parsePgnHeaders);
  assert.equal(Object.isFrozen(LABEL_PEMBUKAAN), true);
  assert.equal(LABEL_PEMBUKAAN.dariEco("C50"), "Opening C50");
  assert.equal(LABEL_PEMBUKAAN.tidakDiketahui, "Unknown Opening");
});

test("parsePgnHeaders, formatEcoUrlName and extractFirstMovesFromPgn preserve regex, fallback and 8-token rules", () => {
  for (const invalid of [null, undefined, "", 123, {}]) {
    assert.deepEqual(parsePgnHeaders(invalid), {});
  }

  const pgnRumit = [
    '[Event "Kejuaraan \\"Kota\\" \\\\ 2026"]',
    '[Event "Timpa Terakhir"]',
    '[Custom_Key1 "Nilai"]',
    '  [Indented "Diabaikan"]',
    '[Multiline "Baris 1',
    'Baris 2"]',
    "",
    '1. e4 {[%clk 0:03:00]} d5 {komentar} 2.   exd5\nQxd5 3. Nc3 Qa5 1/2-1/2',
  ].join("\n");

  assert.deepEqual(parsePgnHeaders(pgnRumit), {
    Event: "Timpa Terakhir",
    Custom_Key1: "Nilai",
    // Kelas karakter `[^"\\]` pada regex PGN mencakup newline sehingga tag multi-baris ikut terbaca.
    Multiline: "Baris 1\nBaris 2",
  });
  assert.deepEqual(
    parsePgnHeaders('[Event "Uji \\"Kutipan\\" \\\\ Garis"]'),
    { Event: 'Uji "Kutipan" \\ Garis' },
  );

  // `formatEcoUrlName`: URL sah, persen-encoded, trailing slash, tanpa segmen path, & fallback URL rusak.
  assert.equal(formatEcoUrlName(""), undefined);
  assert.equal(formatEcoUrlName(null), undefined);
  assert.equal(
    formatEcoUrlName("https://www.chess.com/openings/Sicilian-Defense-Najdorf_Variation/"),
    "Sicilian Defense Najdorf Variation",
  );
  assert.equal(
    formatEcoUrlName("https://lichess.org/opening/King%27s_Pawn_Game"),
    "King's Pawn Game",
  );
  assert.equal(formatEcoUrlName("https://www.chess.com/"), undefined);
  assert.equal(formatEcoUrlName("openings/French_Defense-Winawer"), "French Defense Winawer");
  assert.equal(formatEcoUrlName("openings/trailing/"), undefined);

  // `extractFirstMovesFromPgn`: menjaga nomor langkah, menghapus `{...}`, stop sebelum hasil, batas 8 token.
  assert.equal(extractFirstMovesFromPgn(""), "");
  assert.equal(extractFirstMovesFromPgn(null), "");
  assert.equal(
    extractFirstMovesFromPgn('[Event "Test"]\n\n1. e4 {[%clk 0:05:00]} d5 2. exd5 Qxd5 1-0'),
    "1. e4 d5 2. exd5 Qxd5",
  );
  assert.equal(
    extractFirstMovesFromPgn("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 *"),
    "1. e4 e5 2. Nf3 Nc6 3. Bb5",
  );
  assert.equal(extractFirstMovesFromPgn("1. c4 *"), "1. c4");
  assert.equal(extractFirstMovesFromPgn("1-0"), "");
});

test("warnaPemain, hitungHasil, hitungTrenRating and hitungStreak handle casing, unknown results and sorting", () => {
  assert.equal(warnaPemain({ whiteName: "Alice", blackName: "Bob" }, ""), null);
  assert.equal(warnaPemain({ whiteName: "Alice", blackName: "Bob" }, null), null);
  assert.equal(warnaPemain({ whiteName: "Alice", blackName: "Bob" }, "alice"), "white");
  assert.equal(warnaPemain({ whiteName: "Alice", blackName: "Bob" }, "BOB"), "black");
  assert.equal(warnaPemain({ whiteName: "Mirror", blackName: "Mirror" }, "mirror"), "white");
  assert.equal(warnaPemain({ whiteName: "Alice", blackName: "Bob" }, "Carol"), null);

  const partai = [
    { id: "g3", whiteName: "Alice", blackName: "Bob", whiteElo: 1550, blackElo: 1490, result: "white", timestamp: 3_000_000, timeClass: "blitz" },
    { id: "g5", whiteName: "Eve", blackName: "Alice", whiteElo: 1600, blackElo: 1580, result: "unknown", timestamp: 4_000_000 },
    { id: "g4", whiteName: "Dan", blackName: "Alice", whiteElo: 1510, blackElo: 1560, result: "black", timestamp: 3_500_000, timeClass: "rapid" },
    { id: "g2", whiteName: "Bob", blackName: "Alice", whiteElo: 1500, blackElo: 0, result: "draw", timestamp: 2_000_000, timeClass: "bullet" },
    { id: "g1", whiteName: "Alice", blackName: "Dan", whiteElo: "1520", blackElo: 1480, result: "black", timestamp: 1_000_000, timeClass: "rapid" },
    { id: "g0", whiteName: "Other1", blackName: "Other2", whiteElo: 1400, blackElo: 1400, result: "white", timestamp: 5_000_000 },
  ];

  // g3 (win), g4 (win), g2 (draw), g1 (loss); g5 (unknown) & g0 (bukan peserta) tidak dihitung.
  assert.deepEqual(hitungHasil(partai, "alice"), {
    wins: 2,
    losses: 1,
    draws: 1,
    total: 4,
    winRate: 50,
  });
  assert.deepEqual(hitungHasil([{ whiteName: "Alice", blackName: "Bob", result: "unknown" }], "Alice"), {
    wins: 0,
    losses: 0,
    draws: 0,
    total: 0,
    winRate: 0,
  });

  // `hitungTrenRating`: lewati elo <= 0 atau non-finite (`"1520"`), sertakan `result: null` untuk `"unknown"`, urut lama -> baru.
  assert.deepEqual(hitungTrenRating(partai, "Alice"), [
    { date: 3000, rating: 1550, gameId: "g3", result: "win", timeClass: "blitz" },
    { date: 3500, rating: 1560, gameId: "g4", result: "win", timeClass: "rapid" },
    { date: 4000, rating: 1580, gameId: "g5", result: null, timeClass: "" },
  ]);

  // `hitungStreak`: g5 (`unknown`) dilewati sehingga tidak memutus streak g4 + g3 (`win`, 2).
  assert.deepEqual(hitungStreak([], "Alice"), { type: "none", count: 0 });
  assert.deepEqual(hitungStreak([{ whiteName: "Alice", blackName: "Bob", result: "unknown", timestamp: 1000 }], "Alice"), {
    type: "none",
    count: 0,
  });
  assert.deepEqual(hitungStreak(partai, "Alice"), { type: "win", count: 2 });
  assert.deepEqual(
    hitungStreak(
      [
        { whiteName: "Bob", blackName: "Alice", result: "draw", timestamp: 5000 },
        { whiteName: "Alice", blackName: "Bob", result: "draw", timestamp: 4000 },
        { whiteName: "Alice", blackName: "Bob", result: "white", timestamp: 3000 },
      ],
      "Alice",
    ),
    { type: "draw", count: 2 },
  );
});

test("hitungPembukaanTeratas preserves fallback chain, ECO backfill, sorting and batas limits", () => {
  const partai = [
    // 1. `[Opening]` menang (1), lalu nama sama mengisi `eco` dari partai kedua (seri).
    { whiteName: "Alice", blackName: "B1", result: "white", pgn: '[Opening "Italian Game"]\n\n1. e4 e5 1-0' },
    { whiteName: "Alice", blackName: "B2", result: "draw", pgn: '[Opening "Italian Game"]\n[ECO "C50"]\n\n1. d4 d5 1/2-1/2' },
    // 2. `[ECOUrl]` tanpa `[Opening]`, 2 partai, kalah semua -> urutan kedua karena sama-sama 2 main namun winRate 0 < 75.
    { whiteName: "Alice", blackName: "B3", result: "black", pgn: '[ECO "B20"]\n[ECOUrl "https://www.chess.com/openings/Sicilian-Defense"]\n\n1. e4 c5 0-1' },
    { whiteName: "B4", blackName: "Alice", result: "white", pgn: '[ECOUrl "https://www.chess.com/openings/Sicilian-Defense"]\n\n1. e4 c5 1-0' },
    // 3. Hanya `[ECO]` -> pakai `label.dariEco`.
    { whiteName: "Alice", blackName: "B5", result: "white", pgn: '[ECO "D00"]\n\n1. d4 d5 1-0' },
    // 4. Tanpa header -> pakai `label.tidakDiketahui`; dan satu lagi dengan result "unknown" yang dilewati.
    { whiteName: "Alice", blackName: "B6", result: "black", pgn: "1. c4 e5 0-1" },
    { whiteName: "Alice", blackName: "B7", result: "unknown", pgn: '[Opening "Harus Dilewati"]\n\n1. e4 *' },
    // Ekstra pembukaan lain untuk menguji batas default = 5.
    { whiteName: "Alice", blackName: "B8", result: "white", pgn: '[Opening "King Pawn"]\n\n1. e4 e5 1-0' },
    { whiteName: "Alice", blackName: "B9", result: "black", pgn: '[Opening "Queen Pawn"]\n\n1. d4 d5 0-1' },
  ];

  const semua = hitungPembukaanTeratas(partai, "Alice", "all", Infinity);
  assert.equal(semua.length, 6);
  // `winRate` adalah persentase kemenangan murni (`wins / played`), seri tidak dihitung setengah poin;
  // saat `played` dan `winRate` sama, urutan mengikuti kemunculan pertama pada masukan.
  assert.deepEqual(
    semua.map((o) => ({ name: o.name, eco: o.eco, played: o.played, winRate: o.winRate, moves: o.moves })),
    [
      { name: "Italian Game", eco: "C50", played: 2, winRate: 50, moves: "1. e4 e5" },
      { name: "Sicilian Defense", eco: "B20", played: 2, winRate: 0, moves: "1. e4 c5" },
      { name: "Opening D00", eco: "D00", played: 1, winRate: 100, moves: "1. d4 d5" },
      { name: "King Pawn", eco: undefined, played: 1, winRate: 100, moves: "1. e4 e5" },
      { name: "Unknown Opening", eco: undefined, played: 1, winRate: 0, moves: "1. c4 e5" },
      { name: "Queen Pawn", eco: undefined, played: 1, winRate: 0, moves: "1. d4 d5" },
    ],
  );

  assert.equal(hitungPembukaanTeratas(partai, "Alice", "all").length, 5);
  assert.equal(hitungPembukaanTeratas(partai, "Alice", "all", null).length, 6);
  assert.equal(hitungPembukaanTeratas(partai, "Alice", "black").length, 1);

  const labelKustom = hitungPembukaanTeratas(partai, "Alice", "white", Infinity, {
    dariEco: (eco) => `Pembukaan ${eco}`,
    tidakDiketahui: "Tak dikenal",
  });
  assert.equal(labelKustom.some((o) => o.name === "Pembukaan D00"), true);
  assert.equal(labelKustom.some((o) => o.name === "Tak dikenal"), true);

  // `tidakDiketahui: ""` jatuh balik ke bawaan karena operator `||`.
  const fallbackKosong = hitungPembukaanTeratas(partai, "Alice", "white", Infinity, { tidakDiketahui: "" });
  assert.equal(fallbackKosong.some((o) => o.name === "Unknown Opening"), true);
  assert.deepEqual(hitungPembukaanTeratas(null, "Alice", "all"), []);
});

test("hitungTaktikal handles analysisMap summary shapes, platform accuracies fallback and zero guards", () => {
  assert.deepEqual(hitungTaktikal(null), {
    totalEvaluatedMoves: 0,
    avgAccuracy: null,
    blunders: 0,
    mistakes: 0,
    inaccuracies: 0,
    misses: 0,
    blundersPerGame: 0,
    analyzedGamesCount: 0,
    accuracyCount: 0,
  });

  const games = [
    // Pakai `analysisMap.summary.w` (termasuk accuracyEstimate valid).
    { id: "g1", userColor: "white", accuracies: { white: 55 } },
    // Pakai `analysisMap.summary.black` (diprioritaskan di atas `.b` via `??`) dengan accuracyEstimate: null.
    { id: "g2", userColor: "black" },
    // Tidak ada di analysisMap -> jatuh ke `accuracies.white`.
    { id: "g3", userColor: "white", accuracies: { white: 80.25 } },
    // Warna tidak valid -> dilewati total.
    { id: "g4", userColor: "unknown", accuracies: { white: 100 } },
    // Hanya punya summary lawan (`summary.w`), sisi pemain (`black`) kosong -> jatuh ke fallback platform.
    { id: "g5", userColor: "black", accuracies: { black: 70 } },
  ];

  const analysisMap = {
    g1: {
      summary: {
        w: {
          eligibleMoves: 20,
          accuracyEstimate: 90,
          breakdown: { blunder: 1, mistake: 2, inaccuracy: 3, miss: 1 },
        },
      },
    },
    g2: {
      summary: {
        black: {
          eligibleMoves: 10,
          accuracyEstimate: null,
          breakdown: { blunder: 0, mistake: 1, inaccuracy: 0, miss: 2 },
        },
        b: { eligibleMoves: 99, accuracyEstimate: 10 },
      },
    },
    g5: {
      summary: {
        w: { eligibleMoves: 40, accuracyEstimate: 99, breakdown: { blunder: 9 } },
      },
    },
  };

  const res = hitungTaktikal(games, analysisMap);
  assert.deepEqual(res, {
    totalEvaluatedMoves: 30,
    avgAccuracy: 80.1, // (90 + 80.25 + 70) / 3 = 80.0833 -> 80.1
    blunders: 1,
    mistakes: 3,
    inaccuracies: 3,
    misses: 3,
    blundersPerGame: 0.5, // 1 / 2 analyzedGamesCount
    analyzedGamesCount: 2,
    accuracyCount: 3,
  });
});

test("filterPartaiWawasan and agregasiWawasan enforce daily/correspondence mapping, date bounds and full insight bundle", () => {
  const now = 1_760_000_000_000;
  const hari = 86_400_000;
  const daftar = [
    null,
    "bukan-objek",
    { id: "a", timeClass: "daily", timestamp: now - 30 * hari },
    { id: "b", timeClass: "CORRESPONDENCE", timestamp: now },
    { id: "c", timeClass: "daily", timestamp: now - 31 * hari },
    { id: "d", timeClass: "daily", timestamp: now + 1 },
    { id: "e", timeClass: "daily", timestamp: undefined },
    { id: "f", timeClass: "blitz", timestamp: now - 5 * hari },
  ];

  assert.deepEqual(
    filterPartaiWawasan(daftar, { timeClass: "DAILY", dateRange: "30d" }, now).map((p) => p.id),
    ["a", "b"],
  );
  assert.deepEqual(
    filterPartaiWawasan(daftar, { timeClass: "blitz", dateRange: "90d" }, now).map((p) => p.id),
    ["f"],
  );
  assert.deepEqual(
    filterPartaiWawasan(daftar, { timeClass: "all", dateRange: "all" }, now).map((p) => p.id),
    ["a", "b", "c", "d", "e", "f"],
  );
  assert.deepEqual(filterPartaiWawasan(null), []);

  const sekarang = Date.now();
  const dataAgregat = [
    {
      id: "ag1",
      whiteName: "Alice",
      blackName: "Bob",
      whiteElo: 1500,
      blackElo: 1450,
      result: "white",
      timestamp: sekarang - 2 * hari,
      timeClass: "rapid",
      pgn: '[Opening "Ruy Lopez"]\n\n1. e4 e5 1-0',
      accuracies: { white: 88 },
    },
    {
      id: "ag2",
      whiteName: "Carol",
      blackName: "Alice",
      whiteElo: 1620,
      blackElo: 1610,
      result: "unknown",
      timestamp: sekarang - 1 * hari,
      timeClass: "rapid",
      pgn: '[ECO "C65"]\n\n1. e4 e5 *',
    },
    {
      id: "ag3",
      whiteName: "Dan",
      blackName: "Alice",
      whiteElo: 1590,
      blackElo: 1580,
      result: "white",
      timestamp: sekarang - 45 * hari,
      timeClass: "rapid",
      pgn: '[Opening "Sicilian"]\n\n1. e4 c5 1-0',
    },
  ];

  const agg = agregasiWawasan(
    dataAgregat,
    "Alice",
    { timeClass: "rapid", dateRange: "30d" },
    {
      ag1: {
        summary: {
          w: { eligibleMoves: 15, accuracyEstimate: 92.4, breakdown: { blunder: 0, mistake: 1, inaccuracy: 1, miss: 0 } },
        },
      },
    },
    { dariEco: (eco) => `Dari ${eco}`, tidakDiketahui: "Kosong" },
  );

  // `ag2` lolos filter tanggal/kecepatan sehingga `totalPartai === 2`, meski hasil `"unknown"` dikecualikan dari `hasilUmum`.
  assert.equal(agg.totalPartai, 2);
  assert.deepEqual(agg.hasilUmum, { wins: 1, losses: 0, draws: 0, total: 1, winRate: 100 });
  assert.deepEqual(agg.sebagaiPutih, { wins: 1, losses: 0, draws: 0, total: 1, winRate: 100 });
  assert.deepEqual(agg.sebagaiHitam, { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 });
  assert.equal(agg.peakRating, 1610);
  assert.deepEqual(agg.streak, { type: "win", count: 1 });
  assert.equal(agg.pembukaanSemua.length, 1);
  assert.equal(agg.pembukaanSemua[0].name, "Ruy Lopez");
  assert.equal(agg.taktikal.avgAccuracy, 92.4);
  assert.equal(agg.taktikal.analyzedGamesCount, 1);
});

test("LayarWawasan integrates real wawasan module and analisisTersimpan across filters and colors", async (tes) => {
  const { catatAnalisis, bersihkanAnalisis, ambilPetaAnalisis, langgananAnalisis } = analisisTersimpan;
  tes.after(() => bersihkanAnalisis());
  bersihkanAnalisis();

  const pgnPutih = '[Opening "French Defense"]\n\n1. e4 e6 1-0';
  catatAnalisis(hashPgn(pgnPutih), {
    status: "complete",
    summary: {
      w: { eligibleMoves: 12, accuracyEstimate: 94.2, breakdown: { blunder: 0, mistake: 0, inaccuracy: 1, miss: 0 } },
      b: { eligibleMoves: 12, accuracyEstimate: 70.0, breakdown: { blunder: 2, mistake: 1, inaccuracy: 0, miss: 0 } },
    },
  });

  const sekarang = Date.now();
  const daftarPartai = [
    {
      id: "w1",
      whiteName: "Alice",
      blackName: "Bob",
      whiteElo: 1540,
      blackElo: 1500,
      result: "white",
      timestamp: sekarang - 10_000,
      timeClass: "blitz",
      pgn: pgnPutih,
    },
    {
      id: "w2",
      whiteName: "Carol",
      blackName: "Alice",
      whiteElo: 1620,
      blackElo: 1610,
      result: "white",
      timestamp: sekarang - 20_000,
      timeClass: "blitz",
      pgn: '[ECO "B20"]\n\n1. e4 c5 1-0',
      accuracies: { black: 60.0 },
    },
  ];

  const AnalyzeContext = React.createContext(null);
  const LayarWawasan = kompilasi("../src/halaman/Analisa/komponen/nav/layarWawasan.jsx", {
    "../../../../lib/i18n.jsx": { useI18n: () => ({ t, bahasa: "id" }) },
    "../../../../lib/pgnRingan.js": { hashPgn },
    "../../../../modul/sesi/analisa.js": { AnalyzeContext },
    "../../basisData.js": {
      ambilDaftarPartai: async () => ({ partai: daftarPartai, total: daftarPartai.length }),
      langgananRevisi: () => () => {},
    },
    "../../akun/useAkunKoleksi.js": { useAkunKoleksi: () => ({ akunTersimpan: [], koleksi: [] }) },
    "../../akun/DashboardAkun.jsx": { default: kosong },
    "../../../../modul/analisis/wawasan.js": wawasan,
    "../../../../modul/analisis/analisisTersimpan.js": { ambilPetaAnalisis, langgananAnalisis },
    "./PanelLayar.jsx": { default: wrapper },
    "./SelectDaftar.jsx": { default: kosong },
    "./wawasan/kartuProfil.jsx": { default: kosong },
    "./wawasan/filterBar.jsx": { default: (props) => React.createElement("div", { "data-uji": "filter-bar", ...props }) },
    "./wawasan/kpiGrid.jsx": { default: ({ wawasan: w }) => React.createElement("div", { "data-uji": "kpi-grid", wawasan: w }) },
    "./wawasan/grafikTrenRating.jsx": { default: kosong },
    "./wawasan/distribusiHasil.jsx": { default: (props) => React.createElement("div", { "data-uji": "distribusi-hasil", ...props }) },
    "./wawasan/kartuPembukaan.jsx": { default: (props) => React.createElement("div", { "data-uji": "kartu-pembukaan", ...props }) },
    "./wawasan/kartuAkurasi.jsx": { default: kosong },
  });

  const context = { akun: [{ platform: "chessCom", username: "Alice" }, () => {}], game: [[]], players: [[]] };
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(
        AnalyzeContext.Provider,
        { value: context },
        React.createElement(LayarWawasan, { aktif: true }),
      ),
    );
    await flush();
  });
  tes.after(() => renderer.unmount());

  const kpi = () => renderer.root.findByProps({ "data-uji": "kpi-grid" }).props.wawasan;
  assert.equal(kpi().totalPartai, 2);
  assert.equal(kpi().hasilUmum.winRate, 50);
  assert.equal(kpi().peakRating, 1610);
  // 94.2 (dari analisisTersimpan untuk w1) + 60.0 (fallback platform untuk w2) -> rata-rata 77.1
  assert.equal(kpi().taktikal.avgAccuracy, 77.1);
  assert.equal(kpi().taktikal.analyzedGamesCount, 1);
  assert.equal(kpi().taktikal.accuracyCount, 2);

  const pembukaan = renderer.root.findByProps({ "data-uji": "kartu-pembukaan" }).props;
  assert.equal(pembukaan.putih[0].name, "French Defense");
  assert.equal(pembukaan.hitam[0].name, 'analisa.wawasan.pembukaan.dariEco:{"eco":"B20"}');

  // Filter warna hanya menyaring hasilUmum/sebagaiPutih/sebagaiHitam, bukan totalPartai maupun taktikal.
  act(() => {
    renderer.root.findByProps({ "data-uji": "filter-bar" }).props.onWarna("black");
  });
  assert.equal(kpi().totalPartai, 2);
  assert.equal(kpi().hasilUmum.winRate, 0);
  assert.equal(kpi().sebagaiPutih.total, 0);
  assert.equal(kpi().sebagaiHitam.losses, 1);
  assert.equal(kpi().taktikal.avgAccuracy, 77.1);
});
