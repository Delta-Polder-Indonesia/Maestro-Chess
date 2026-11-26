// Pengunci pengayaan buku pembukaan (scripts/generasi-buku-analisa.mjs) dan
// kontrak data teka-teki yang disimpan di public/data untuk pemakaian nanti.
//
// Buku: skrip asli ChessClub hanya mencatat posisi AKHIR tiap garis (11.957
// posisi). Versi diperkaya mencatat posisi SEPANJANG garis (27.826 posisi),
// aturan nama tetap "varian paling sering dimainkan", dan label lama
// dipertahankan apa adanya. Tes fixture mengunci algoritmanya; tes reproduksi
// penuh membuktikan buku yang dikirim = hasil skrip dari sumber yang sama.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Chess } from "chess.js";

import { bangunBuku } from "../scripts/generasi-buku-analisa.mjs";
import { kunciFen } from "../src/halaman/Analisa/mesin/kunciFen.js";

const baca = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));

// Catatan: chess.js hanya menulis target en passant bila ada tangkapan ep
// legal, sehingga kunci posisi setelah 1.e4 / 1...e5 / 1.d4 berakhiran "-".
const KUNCI_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -";
const KUNCI_E4E5 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -";
const KUNCI_D4 = "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq -";

test("bangunBuku records every position along a line, not just the terminal one", () => {
  const { peta, statistik } = bangunBuku([
    { moves: "e2e4 e7e5", opening: "King's Pawn Game", eco: "C20", games: 10 },
  ]);
  assert.deepEqual(Object.keys(peta).sort(), [KUNCI_E4, KUNCI_E4E5].sort());
  assert.equal(peta[KUNCI_E4], "King's Pawn Game (C20)");
  assert.equal(peta[KUNCI_E4E5], "King's Pawn Game (C20)");
  assert.equal(statistik.garis, 1);
  assert.equal(statistik.gagal, 0);
  assert.equal(statistik.posisiDilalui, 2);
  assert.equal(statistik.posisiUnik, 2);
  assert.equal(statistik.baru, 2);
  assert.equal(statistik.total, 2);
});

test("bangunBuku picks the most-played variant per position and keeps the first on ties", () => {
  const { peta } = bangunBuku([
    { moves: "e2e4 e7e5 g1f3", opening: "King's Knight", eco: "C40", games: 500 },
    { moves: "e2e4 e7e5", opening: "Open Game", eco: "C20", games: 9000 },
  ]);
  // Posisi setelah 1...e5 dilalui kedua garis → games terbesar menang.
  assert.equal(peta[KUNCI_E4E5], "Open Game (C20)");
  assert.equal(peta[KUNCI_E4], "Open Game (C20)");
  // Posisi setelah 2.Nf3 hanya dilalui garis pertama.
  const kunciNf3 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -";
  assert.equal(peta[kunciNf3], "King's Knight (C40)");

  // Tie (games sama): entri pertama dalam urutan sumber menang (strict >).
  const tie = bangunBuku([
    { moves: "e2e4", opening: "Pertama", eco: "B00", games: 7 },
    { moves: "e2e4", opening: "Kedua", eco: "C20", games: 7 },
  ]);
  assert.equal(tie.peta[KUNCI_E4], "Pertama (B00)");
});

test("bangunBuku preserves baseline labels verbatim and only adds new positions", () => {
  const baseline = { [KUNCI_E4]: "Label Lama (A00)" };
  const { peta, statistik } = bangunBuku([
    { moves: "e2e4 e7e5", opening: "King's Pawn Game", eco: "C20", games: 99999 },
  ], baseline);
  assert.equal(peta[KUNCI_E4], "Label Lama (A00)");
  assert.equal(peta[KUNCI_E4E5], "King's Pawn Game (C20)");
  assert.equal(statistik.baru, 1);
  assert.equal(statistik.total, 2);
  // Baseline tidak dimutasi.
  assert.deepEqual(baseline, { [KUNCI_E4]: "Label Lama (A00)" });
});

test("bangunBuku skips corrupt lines entirely, empty moves, and handles promotion/no-eco", () => {
  const { peta, statistik } = bangunBuku([
    { moves: "e2e4 e7e5 e2e4", opening: "Rusak", eco: "C20", games: 1 },
    { moves: "   ", opening: "Kosong", eco: "A00", games: 1 },
    { moves: "d2d4", opening: "Queen's Pawn", games: 5 },
    { moves: "a2a4 b7b5 a4b5 a7a6 b5a6 b8c6 a6a7 c6b8 a7b8q", opening: "Promosi", eco: "A00", games: 3 },
  ]);
  assert.equal(statistik.gagal, 1);
  assert.equal(peta[KUNCI_E4], undefined, "garis korup tidak menyumbang posisi apa pun");
  assert.equal(peta[KUNCI_E4E5], undefined);
  assert.equal(peta[KUNCI_D4], "Queen's Pawn", "tanpa eco → nama polos");
  // Promosi benar-benar diterapkan: ratu putih di b8 menggantikan kuda hitam
  // (rank 8 FEN diawali "rQ": benteng a8 hitam + ratu b8 putih).
  const kunciPromosi = Object.keys(peta).find((k) => k.startsWith("rQ"));
  assert.ok(kunciPromosi, "posisi promosi tercatat");
  assert.equal(peta[kunciPromosi], "Promosi (A00)");
  // 1 posisi dari 1.d4 + 9 posisi sepanjang garis promosi (pengayaan mencatat
  // posisi antara, bukan hanya akhirnya).
  assert.equal(statistik.total, 10);
});

test("bangunBuku output is localeCompare-sorted and idempotent against its own result", () => {
  const daftar = [
    { moves: "d2d4 d7d5", opening: "Queen's Gambit", eco: "D06", games: 40 },
    { moves: "e2e4 c7c5", opening: "Sicilian Defense", eco: "B20", games: 80 },
    { moves: "g1f3", opening: "Zukertort Opening", eco: "A04", games: 20 },
  ];
  const r1 = bangunBuku(daftar);
  const kunci = Object.keys(r1.peta);
  assert.deepEqual(kunci, [...kunci].sort((a, b) => a.localeCompare(b)));
  const r2 = bangunBuku(daftar, r1.peta);
  assert.deepEqual(r2.peta, r1.peta);
  assert.equal(r2.statistik.baru, 0);
});

// ---------------------------------------------------------------------------
// Data terkirim: buku yang dikirim harus sama persis dengan hasil skrip.
// Baseline lama direkonstruksi dengan algoritma terminal-only ChessClub
// (posisi akhir tiap garis, games terbesar menang) — hasilnya terbukti sama
// persis dengan buku 11.957 posisi sebelum pengayaan.
// ---------------------------------------------------------------------------

function bukuTerminal(daftar) {
  const permainan = new Chess();
  const terbaik = new Map();
  for (const entri of daftar) {
    const langkah = String(entri.moves ?? "").trim().split(/\s+/).filter(Boolean);
    if (!langkah.length) continue;
    permainan.reset();
    let rusak = false;
    for (const uci of langkah) {
      try {
        permainan.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined });
      } catch {
        rusak = true;
        break;
      }
    }
    if (rusak) continue;
    const kunci = kunciFen(permainan.fen());
    const jumlah = Number(entri.games ?? 0);
    const lama = terbaik.get(kunci);
    if (!lama || jumlah > lama.games) terbaik.set(kunci, { nama: entri.opening, eco: entri.eco, games: jumlah });
  }
  return Object.fromEntries(
    [...terbaik.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, n]) => [k, n.eco ? `${n.nama} (${n.eco})` : n.nama]),
  );
}

test("shipped enriched book reproduces exactly from the ChessClub source (27826 = 11957 old + 15869 new)", () => {
  const sumber = baca("../public/data/buku-pembukaan.json");
  const dikirim = baca("../public/data/buku-analisa.json");
  assert.equal(sumber.length, 18713);

  const baseline = bukuTerminal(sumber);
  assert.equal(Object.keys(baseline).length, 11957, "buku lama = posisi terminal saja");
  // Sentinel label lama (dari buku sebelum pengayaan).
  assert.equal(
    baseline["1nbqkb1r/1ppp1ppp/4pn2/1P6/8/8/1BPPPPPP/rN1QKBNR w Kk -"],
    "Polish Opening: Rooks Swap Line (A00)",
  );
  assert.equal(
    baseline["1r1q1rk1/pp1bppbp/2np1np1/8/2BNP3/2N1BP2/PPPQ2PP/2KR3R w - -"],
    "Sicilian Defense: Dragon Variation, Yugoslav Attack, Chinese Dragon (B78)",
  );

  const { peta, statistik } = bangunBuku(sumber, baseline);
  assert.deepEqual(peta, dikirim, "buku terkirim = hasil skrip generasi dari sumber yang sama");
  assert.equal(statistik.garis, 18713);
  assert.equal(statistik.gagal, 0);
  assert.equal(statistik.posisiDilalui, 185955);
  assert.equal(statistik.posisiUnik, 27826);
  assert.equal(statistik.baru, 15869);
  assert.equal(statistik.total, 27826);

  // Semua kunci = 4 bidang pertama FEN; semua nilai string tak kosong.
  for (const [kunci, nama] of Object.entries(dikirim)) {
    assert.equal(kunci.split(/\s+/).length, 4, kunci);
    assert.equal(typeof nama, "string");
    assert.ok(nama.length > 0);
  }
  // Sentinel posisi BARU (posisi antara yang dulu tidak tercatat).
  assert.equal(
    dikirim["1rb2rk1/pp2nppp/2n2q2/3N4/4P3/2P1Q3/PP3PPP/RN2KB1R b KQ -"],
    "Scotch Game: Gottschall Variation (C45)",
  );
});

// ---------------------------------------------------------------------------
// Data teka-teki: disimpan apa adanya untuk pemakaian nanti (belum ada UI).
// Kontrak ini menjaga bentuknya tetap utuh sampai fitur teka-teki dibangun.
// ---------------------------------------------------------------------------

test("teka-teki.json keeps the ChessClub mate-puzzle schema (5486 problems, sequential ids)", () => {
  const data = baca("../public/data/teka-teki.json");
  const soal = data.problems;
  assert.equal(soal.length, 5486);
  soal.forEach((p, i) => {
    assert.equal(p.problemid, i + 1, "problemid = posisi array + 1 (dipakai parameter URL ?id=)");
    assert.ok(p.fen && p.moves, `soal ${i + 1} punya fen+moves`);
    assert.ok(["Mate in One", "Mate in Two", "Mate in Three"].includes(p.type));
    assert.ok(["White to Move", "Black to Move"].includes(p.first));
  });
});

test("teka-teki-video.json keeps version 2 with 6551 problems and 1681 video entries", () => {
  const data = baca("../public/data/teka-teki-video.json");
  assert.equal(data.versi, 2);
  assert.equal(data.problems.length, 6551);
  assert.equal(data.jumlahTotal, 6551);
  assert.equal(data.jumlahVideo, 1681);
  assert.equal(data.problems.filter((p) => p.video).length, 1681);
  for (const p of data.problems) {
    assert.ok(p.fen && p.moves, `soal ${p.problemid} punya fen+moves`);
  }
});

test("daily puzzle snapshot covers 2007-2026 with 7097 fact-only problems and consistent index", () => {
  const indeks = baca("../public/data/teka-teki-harian/indeks.json");
  assert.equal(indeks.versi, 1);
  assert.equal(indeks.jumlah, 7097);
  assert.equal(indeks.terlama, "2007-05-08");
  assert.equal(indeks.terbaru, "2026-10-20");
  assert.deepEqual(indeks.tahun.map((t) => t.tahun), Array.from({ length: 20 }, (_, i) => 2007 + i));

  let total = 0;
  for (const tahun of rangeTahun()) {
    const data = baca(`../public/data/teka-teki-harian/${tahun}.json`);
    assert.equal(data.tahun, tahun);
    assert.equal(data.jumlah, data.soal.length, `jumlah ${tahun} = panjang soal`);
    for (const soal of data.soal) {
      // Hanya fakta soal: tanggal, FEN, langkah solusi — tanpa judul/penulis/media.
      assert.deepEqual(Object.keys(soal).sort(), ["fen", "langkah", "tanggal"]);
      assert.ok(soal.tanggal.startsWith(`${tahun}-`));
      assert.ok(soal.fen.split(/\s+/).length >= 4);
      assert.ok(soal.langkah.includes("-"));
    }
    total += data.soal.length;
  }
  assert.equal(total, 7097);
  assert.equal(total, indeks.jumlah);

  const terbaru = baca("../public/data/teka-teki-harian/terbaru.json");
  assert.equal(terbaru.soal.length, 7);
  assert.ok(terbaru.dibuat);
});

function rangeTahun() {
  return Array.from({ length: 20 }, (_, i) => 2007 + i);
}
