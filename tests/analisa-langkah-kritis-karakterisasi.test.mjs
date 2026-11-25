import assert from "node:assert/strict";
import test from "node:test";
import { Chess } from "chess.js";
import * as langkahKritis from "../src/halaman/Analisa/mesin/langkahKritis.js";
import * as engine from "../src/halaman/Analisa/mesin/engine.js";
import * as akurasi from "../src/modul/analisis/akurasi.js";
import * as antiCheatDasar from "../src/halaman/Analisa/mesin/antiCheat/dasar.js";

const {
  AMBANG_KERUGIAN_KRITIS,
  AMBANG_UNGGUL_MUTLAK_CP,
  apakahLangkahKritis,
  cpKandidat,
  kerugianPeluangKandidat,
} = langkahKritis;

function buatLangkah(fen, san) {
  const papan = new Chess(fen);
  const move = papan.move(san);
  assert.ok(move, `Langkah uji harus sah: ${san} pada ${fen}`);
  return move;
}

const FEN_AWAL = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const LANGKAH_E4 = buatLangkah(FEN_AWAL, "e4");
const KANDIDAT_KRITIS = [{ cp: 500 }, { cp: 100 }];

test("langkahKritis exposes exact five named exports and threshold constants without default", () => {
  assert.deepEqual(Object.keys(langkahKritis).sort(), [
    "AMBANG_KERUGIAN_KRITIS",
    "AMBANG_UNGGUL_MUTLAK_CP",
    "apakahLangkahKritis",
    "cpKandidat",
    "kerugianPeluangKandidat",
  ]);
  assert.equal(Object.hasOwn(langkahKritis, "default"), false);
  assert.equal(AMBANG_KERUGIAN_KRITIS, 10);
  assert.equal(AMBANG_UNGGUL_MUTLAK_CP, 700);
});

test("cpKandidat characterizes centipawn clamping, mate priority and legacy coercion quirks", () => {
  for (const tidakValid of [null, undefined, "e2e4", 42, true, {}]) {
    assert.equal(cpKandidat(tidakValid), null);
  }

  assert.equal(cpKandidat({ cp: 150, mate: null }), 150);
  assert.equal(cpKandidat({ cp: -234.5, mate: undefined }), -234.5);
  assert.equal(cpKandidat({ cp: 1500 }), 1000);
  assert.equal(cpKandidat({ cp: -1800 }), -1000);
  assert.equal(cpKandidat({ cp: "250" }), 250);
  assert.equal(cpKandidat({ cp: " -40 " }), -40);
  assert.equal(cpKandidat({ cp: "   " }), 0);

  for (const cpRusak of [NaN, Infinity, -Infinity, "", false, true, null, undefined]) {
    assert.equal(cpKandidat({ cp: cpRusak }), null, String(cpRusak));
  }

  // `mate` mendahului `cp` ketika terdeteksi numerik oleh Number.isFinite(Number(...)).
  assert.equal(cpKandidat({ cp: 50, mate: 2 }), 1000);
  assert.equal(cpKandidat({ cp: 50, mate: -3 }), -1000);
  assert.equal(cpKandidat({ cp: 50, mate: "2" }), 1000);
  assert.equal(cpKandidat({ cp: 50, mate: 0 }), -1000);
  assert.equal(cpKandidat({ cp: 50, mate: "0" }), -1000);
  assert.equal(cpKandidat({ cp: 50, mate: "   " }), -1000);

  // Perilaku lama: "" dan boolean pada `mate` lolos Number.isFinite(Number(mate)) sehingga
  // memanggil cpBaku(["mate", String(mate)]) -> null tanpa fallback ke `cp`.
  assert.equal(cpKandidat({ cp: 50, mate: "" }), null);
  assert.equal(cpKandidat({ cp: 50, mate: false }), null);
  assert.equal(cpKandidat({ cp: 50, mate: true }), null);

  // Non-finite `mate` baru jatuh ke cabang `cp`.
  assert.equal(cpKandidat({ cp: 75, mate: NaN }), 75);
  assert.equal(cpKandidat({ cp: 75, mate: Infinity }), 75);
  assert.equal(cpKandidat({ cp: 75, mate: "bukan-angka" }), 75);

  // Kontras disengaja dengan `antiCheat/dasar.cpKandidat` yang memakai skala ±10000.
  assert.equal(antiCheatDasar.cpKandidat({ mate: 0 }), -10000);
  assert.equal(antiCheatDasar.cpKandidat({ mate: 2 }), 10000);
  assert.notEqual(cpKandidat({ mate: 2 }), antiCheatDasar.cpKandidat({ mate: 2 }));
});

test("kerugianPeluangKandidat reads array indices 0 and 1, clamps negative drops and validates entries", () => {
  assert.equal(kerugianPeluangKandidat(null), null);
  assert.equal(kerugianPeluangKandidat(undefined), null);
  assert.equal(kerugianPeluangKandidat({}), null);
  assert.equal(kerugianPeluangKandidat([]), null);
  assert.equal(kerugianPeluangKandidat([{ cp: 200 }]), null);
  assert.equal(kerugianPeluangKandidat([{ cp: "" }, { cp: 0 }]), null);
  assert.equal(kerugianPeluangKandidat([{ cp: 200 }, { mate: "" }]), null);

  // Memakai indeks array [0] dan [1] langsung, bukan mengurutkan berdasarkan `peringkat`.
  const takTerurut = [
    { peringkat: 2, cp: 300 },
    { peringkat: 1, cp: 50 },
  ];
  assert.equal(
    kerugianPeluangKandidat(takTerurut),
    akurasi.peluangMenang(300) - akurasi.peluangMenang(50),
  );

  // Selisih negatif saat kandidat #1 lebih buruk dari #2 dijepit ke 0.
  assert.equal(kerugianPeluangKandidat([{ cp: 50 }, { cp: 300 }]), 0);

  // Kombinasi mate vs cp dihitung terhadap kurva peluangMenang.
  assert.equal(
    kerugianPeluangKandidat([{ mate: 1 }, { cp: 0 }]),
    akurasi.peluangMenang(1000) - 50,
  );
});

test("apakahLangkahKritis enforces all seven gates and inclusive boundary thresholds", () => {
  const opsiDasar = {
    staticEval: ["cp", "-450"],
    previousKandidat: KANDIDAT_KRITIS,
    previousBestMoveSan: "e4",
  };
  assert.equal(apakahLangkahKritis(LANGKAH_E4, opsiDasar), true);

  // Gerbang 1: langkah, previousBestMoveSan wajib ada dan sama persis dengan move.san.
  assert.equal(apakahLangkahKritis(null, opsiDasar), false);
  assert.equal(apakahLangkahKritis(LANGKAH_E4), false);
  assert.equal(apakahLangkahKritis(LANGKAH_E4, { ...opsiDasar, previousBestMoveSan: "" }), false);
  assert.equal(apakahLangkahKritis(LANGKAH_E4, { ...opsiDasar, previousBestMoveSan: "d4" }), false);
  assert.equal(apakahLangkahKritis(LANGKAH_E4, { ...opsiDasar, previousBestMoveSan: "e4+" }), false);

  // Gerbang 2 & 3: MultiPV minimal 2 kandidat dengan skor terbaca.
  assert.equal(apakahLangkahKritis(LANGKAH_E4, { ...opsiDasar, previousKandidat: null }), false);
  assert.equal(apakahLangkahKritis(LANGKAH_E4, { ...opsiDasar, previousKandidat: [{ cp: 500 }] }), false);
  assert.equal(
    apakahLangkahKritis(LANGKAH_E4, { ...opsiDasar, previousKandidat: [{ cp: 500 }, { mate: "" }] }),
    false,
  );

  // Gerbang 4: kedua >= 700 (AMBANG_UNGGUL_MUTLAK_CP) langsung ditolak.
  assert.equal(
    apakahLangkahKritis(LANGKAH_E4, {
      ...opsiDasar,
      previousKandidat: [{ mate: 1 }, { cp: AMBANG_UNGGUL_MUTLAK_CP }],
    }),
    false,
  );

  // Gerbang 5: staticEval sudut lawan -> sesudahPemain < 0 atau null ditolak; 0 tepat diterima.
  assert.equal(apakahLangkahKritis(LANGKAH_E4, { ...opsiDasar, staticEval: [] }), false);
  assert.equal(apakahLangkahKritis(LANGKAH_E4, { ...opsiDasar, staticEval: null }), false);
  assert.equal(apakahLangkahKritis(LANGKAH_E4, { ...opsiDasar, staticEval: ["cp", "1"] }), false);
  assert.equal(apakahLangkahKritis(LANGKAH_E4, { ...opsiDasar, staticEval: ["mate", "1"] }), false);
  assert.equal(apakahLangkahKritis(LANGKAH_E4, { ...opsiDasar, staticEval: ["cp", "0"] }), true);
  assert.equal(apakahLangkahKritis(LANGKAH_E4, { ...opsiDasar, staticEval: ["mate", "0"] }), true);

  // Gerbang 6: promosi ratu ditolak, sedangkan underpromotion tetap diizinkan.
  const fenPromosi = "4k3/P7/8/8/8/8/8/4K3 w - - 0 1";
  const promosiRatu = buatLangkah(fenPromosi, "a8=Q");
  const underpromoKuda = buatLangkah(fenPromosi, "a8=N");
  assert.equal(
    apakahLangkahKritis(promosiRatu, { ...opsiDasar, previousBestMoveSan: promosiRatu.san }),
    false,
  );
  assert.equal(
    apakahLangkahKritis(underpromoKuda, { ...opsiDasar, previousBestMoveSan: underpromoKuda.san }),
    true,
  );

  // Gerbang 7: move.before kosong, FEN rusak, atau posisi sebelum langkah sedang sekak ditolak.
  assert.equal(
    apakahLangkahKritis({ san: "e4", before: "" }, opsiDasar),
    false,
  );
  assert.equal(
    apakahLangkahKritis({ san: "e4", before: "fen-tidak-valid" }, opsiDasar),
    false,
  );
  const balasanSekak = buatLangkah("4k3/8/8/8/8/8/4r3/4K3 w - - 0 1", "Kxe2");
  assert.equal(
    apakahLangkahKritis(balasanSekak, { ...opsiDasar, previousBestMoveSan: balasanSekak.san }),
    false,
  );

  // Ambang kerugian peluang >= 10 poin persen (inklusif) dan kandidat terbalik.
  const batasTepat10Cp = Math.log(1.5) / akurasi.FAKTOR_PELUANG;
  assert.equal(
    apakahLangkahKritis(LANGKAH_E4, {
      staticEval: ["cp", "0"],
      previousKandidat: [{ cp: 0 }, { cp: batasTepat10Cp }],
      previousBestMoveSan: "e4",
    }),
    true,
  );
  assert.equal(
    apakahLangkahKritis(LANGKAH_E4, {
      staticEval: ["cp", "0"],
      previousKandidat: [{ cp: 0 }, { cp: batasTepat10Cp + 1e-9 }],
      previousBestMoveSan: "e4",
    }),
    false,
  );
  assert.equal(
    apakahLangkahKritis(LANGKAH_E4, {
      staticEval: ["cp", "0"],
      previousKandidat: [{ cp: 100 }, { cp: -10 }],
      previousBestMoveSan: "e4",
    }),
    true,
  );
  assert.equal(
    apakahLangkahKritis(LANGKAH_E4, {
      staticEval: ["cp", "0"],
      previousKandidat: [{ cp: 100 }, { cp: -9 }],
      previousBestMoveSan: "e4",
    }),
    false,
  );
  assert.equal(
    apakahLangkahKritis(LANGKAH_E4, {
      staticEval: ["cp", "0"],
      previousKandidat: [{ cp: -100 }, { cp: 200 }],
      previousBestMoveSan: "e4",
    }),
    false,
  );
});

test("engine parseMove and parsePGN preserve tri-state kritis (null, true, false) with langkahKritis", async () => {
  const mesinE4 = {
    async cari() {
      return {
        staticEval: ["cp", "-300"],
        bestMove: [{ col: 4, row: 6 }, { col: 4, row: 4 }],
        bestMoveCoronation: undefined,
        daftarKandidat: [{ cp: 50, mate: null }],
      };
    },
  };

  // 1. MultiPV kurang dari 2 / skor rusak menghasilkan `kritis: null` (tak diketahui) dan rating `best`.
  const tanpaMultiPv = await engine.parseMove(
    mesinE4,
    8,
    buatLangkah(FEN_AWAL, "e4"),
    new Chess(),
    [["cp", "20"]],
    "e4",
    false,
    {},
    () => {},
    undefined,
    5,
    [{ cp: 300 }],
  );
  assert.equal(tanpaMultiPv.kritis, null);
  assert.equal(tanpaMultiPv.moveRating, "best");

  const kandidatRusak = await engine.parseMove(
    mesinE4,
    8,
    buatLangkah(FEN_AWAL, "e4"),
    new Chess(),
    [["cp", "20"]],
    "e4",
    false,
    {},
    () => {},
    undefined,
    5,
    [{ cp: 300 }, { mate: "" }],
  );
  assert.equal(kandidatRusak.kritis, null);
  assert.equal(kandidatRusak.moveRating, "best");

  // 2. MultiPV lengkap + semua gerbang lolos menghasilkan `kritis: true` dan `moveRating: "critical"`.
  const langkahKritisHasil = await engine.parseMove(
    mesinE4,
    8,
    buatLangkah(FEN_AWAL, "e4"),
    new Chess(),
    [["cp", "300"]],
    "e4",
    false,
    {},
    () => {},
    undefined,
    5,
    KANDIDAT_KRITIS,
  );
  assert.equal(langkahKritisHasil.kritis, true);
  assert.equal(langkahKritisHasil.moveRating, "critical");

  // 3. MultiPV lengkap tetapi tidak memenuhi gerbang menghasilkan `kritis: false` (bukan `null`).
  const bukanKritisHasil = await engine.parseMove(
    mesinE4,
    8,
    buatLangkah(FEN_AWAL, "e4"),
    new Chess(),
    [["cp", "20"]],
    "d4",
    false,
    {},
    () => {},
    undefined,
    5,
    KANDIDAT_KRITIS,
  );
  assert.equal(bukanKritisHasil.kritis, false);
  assert.notEqual(bukanKritisHasil.moveRating, "critical");

  // 4. Alur penuh `parsePGN` merambatkan `kandidat` antarlangkah menjadi `kritis` tri-state.
  const responPerPosisi = [
    // Posisi awal (`parsePosition`): hanya e4 mempertahankan keunggulan (+500 vs +50).
    {
      staticEval: ["cp", "20"],
      bestMove: [{ col: 4, row: 1 }, { col: 4, row: 3 }],
      daftarKandidat: [{ cp: 500 }, { cp: 50 }],
    },
    // Setelah 1. e4 (`moves[1]`): `staticEval` -300 (Putih +300 -> `kritis: true`); kandidat untuk Hitam seimbang (-300 vs -310).
    {
      staticEval: ["cp", "-300"],
      bestMove: [{ col: 4, row: 6 }, { col: 4, row: 4 }],
      daftarKandidat: [{ cp: -300 }, { cp: -310 }],
    },
    // Setelah 1... e5 (`moves[2]`): `kritis: false`; kandidat untuk Putih hanya 1 item (MultiPV mati).
    {
      staticEval: ["cp", "300"],
      bestMove: [{ col: 6, row: 0 }, { col: 5, row: 2 }],
      daftarKandidat: [{ cp: 300 }],
    },
    // Setelah 2. Nf3 (`moves[3]`): `previousKandidat` cuma 1 item -> `kritis: null`.
    {
      staticEval: ["cp", "-250"],
      bestMove: [{ col: 1, row: 7 }, { col: 2, row: 5 }],
      daftarKandidat: [{ cp: -250 }, { mate: "" }],
    },
    // Setelah 2... Nc6 (`moves[4]`): `previousKandidat[1]` korup -> `kritis: null`.
    {
      staticEval: ["cp", "250"],
      bestMove: undefined,
      daftarKandidat: [],
    },
  ];
  let idx = 0;
  const mesinPgn = {
    gameBaru() {},
    setop() {},
    async cari() {
      const hasil = responPerPosisi[idx];
      idx += 1;
      return hasil;
    },
  };
  const { moves } = await engine.parsePGN(
    mesinPgn,
    "1. e4 e5 2. Nf3 Nc6 *",
    8,
    {},
    () => {},
  );
  assert.equal(idx, 5);
  assert.equal(moves.length, 5);
  assert.equal(moves[1].kritis, true);
  assert.equal(moves[1].moveRating, "critical");
  assert.equal(moves[2].kritis, false);
  assert.equal(moves[3].kritis, null);
  assert.equal(moves[4].kritis, null);
});
