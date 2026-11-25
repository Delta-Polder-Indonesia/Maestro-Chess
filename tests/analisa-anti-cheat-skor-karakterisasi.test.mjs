import assert from "node:assert/strict";
import test from "node:test";
import * as skorMod from "../src/halaman/Analisa/mesin/antiCheat/skor.js";
import * as antiCheat from "../src/halaman/Analisa/mesin/antiCheat.js";
import * as dasar from "../src/halaman/Analisa/mesin/antiCheat/dasar.js";
import * as agregatMod from "../src/halaman/Analisa/mesin/antiCheat/agregat.js";
import { DAFTAR_FASE } from "../src/modul/analisis/fase.js";

const { hitungSkorKecurigaan, skorKecurigaan } = skorMod;
const { LEVEL_RENDAH, LEVEL_SEDANG, LEVEL_SEMENTARA, LEVEL_TINGGI } = dasar;

const FEN_AWAL = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const FEN_3_2 = "rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2";
const FEN_AKHIR_2_2 = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4";
const FEN_AKHIR_RAJA_PION = "4k3/4p3/8/8/8/8/4P3/4K3 w - - 0 40";

test("antiCheat/skor exposes exact 2 named exports without default and shares antiCheat identities", () => {
  assert.deepEqual(Object.keys(skorMod).sort(), ["hitungSkorKecurigaan", "skorKecurigaan"]);
  assert.equal(Object.hasOwn(skorMod, "default"), false);
  assert.strictEqual(antiCheat.skorKecurigaan, skorKecurigaan);
  assert.strictEqual(antiCheat.hitungSkorKecurigaan, hitungSkorKecurigaan);
});

test("skorKecurigaan preserves sample shrinkage, zero-sample guards, weight renormalization and domain evidence counting", () => {
  // Tanpa metrik aktif -> skor/level null, cakupanTerbatas true
  const kosong = skorKecurigaan({
    engineMatchRate: null,
    acpl: null,
    konsistensiWaktu: null,
    rataPeringkat: null,
    jumlahLangkah: 0,
  });
  assert.equal(kosong.skor, null);
  assert.equal(kosong.level, null);
  assert.deepEqual(kosong.metrikAktif, []);
  assert.equal(kosong.jumlahMetrikAktif, 0);
  assert.deepEqual(kosong.domainBukti, []);
  assert.equal(kosong.jumlahDomainBukti, 0);
  assert.equal(kosong.cakupanTerbatas, true);
  assert.deepEqual(kosong.komponen, { kecocokan: null, peringkat: null, acpl: null, waktu: null });
  assert.deepEqual(kosong.sampelMetrik, { kecocokan: 0, peringkat: 0, acpl: 0, waktu: 0 });

  // Metrik bernilai angka dengan n <= 0 dikeluarkan dari skor aktif sambil mempertahankan nilai komponen mentah
  const nolSampel = skorKecurigaan({
    engineMatchRate: 100,
    acpl: 0,
    konsistensiWaktu: 1,
    rataPeringkat: 1,
    jumlahLangkah: 0,
    sampel: { kecocokan: 0, peringkat: 0, acpl: 0, waktu: 0 },
  });
  assert.equal(nolSampel.skor, null);
  assert.equal(nolSampel.level, null);
  assert.deepEqual(nolSampel.metrikAktif, []);
  assert.deepEqual(nolSampel.komponen, { kecocokan: 100, peringkat: 100, acpl: 100, waktu: 100 });

  // Kecocokan top-1 + peringkat MultiPV berada dalam SATU domain ("pemilihan"), jadi meski keduanya >= 12 tetap cakupanTerbatas: true
  const satuDomain = skorKecurigaan({
    engineMatchRate: 100,
    acpl: null,
    konsistensiWaktu: null,
    rataPeringkat: 1,
    jumlahLangkah: 24,
    sampel: { kecocokan: 12, peringkat: 12, acpl: 0, waktu: 0 },
  });
  assert.deepEqual(satuDomain.metrikAktif, ["kecocokan", "peringkat"]);
  assert.deepEqual(satuDomain.domainBukti, ["pemilihan"]);
  assert.equal(satuDomain.jumlahDomainBukti, 1);
  assert.equal(satuDomain.cakupanTerbatas, true);
  assert.equal(satuDomain.skor, 50); // 100 * 12/(12+12) = 50
  assert.equal(satuDomain.level, LEVEL_SEMENTARA);

  // Jumlah partisi sampel pemilihan: 6 kecocokan + 6 peringkat = 12 (memadai untuk domain pemilihan), ditambah acpl 12 -> 2 domain
  const duaDomainPartisi = skorKecurigaan({
    engineMatchRate: 100,
    acpl: 0,
    konsistensiWaktu: null,
    rataPeringkat: 1,
    jumlahLangkah: 18,
    sampel: { kecocokan: 6, peringkat: 6, acpl: 12, waktu: 0 },
  });
  assert.deepEqual(duaDomainPartisi.domainBukti, ["pemilihan", "kualitas"]);
  assert.equal(duaDomainPartisi.jumlahDomainBukti, 2);
  assert.equal(duaDomainPartisi.cakupanTerbatas, false);
  // bobot: 0.3*(100*6/18) + 0.25*(100*6/18) + 0.25*(100*12/24) = (10 + 8.3333 + 12.5) / 0.8 = 38.54 -> 39
  assert.equal(duaDomainPartisi.skor, 39);
  assert.equal(duaDomainPartisi.level, LEVEL_SEDANG);

  // Fallback jumlahLangkah saat `sampel` tidak diberikan + tingkat rendah / tinggi + ratingPemain tidak mengubah skor
  const tinggi = skorKecurigaan({
    engineMatchRate: 100,
    acpl: 0,
    konsistensiWaktu: 1,
    rataPeringkat: 1,
    jumlahLangkah: 60,
    ratingPemain: 600,
  });
  const tinggiEloBesar = skorKecurigaan({
    engineMatchRate: 100,
    acpl: 0,
    konsistensiWaktu: 1,
    rataPeringkat: 1,
    jumlahLangkah: 60,
    ratingPemain: 2700,
  });
  assert.deepEqual(tinggi, tinggiEloBesar);
  assert.equal(tinggi.skor, 83); // 100 * 60 / (60 + 12) = 83.33 -> 83
  assert.equal(tinggi.level, LEVEL_TINGGI);

  const rendah = skorKecurigaan({
    engineMatchRate: 50,
    acpl: 40,
    konsistensiWaktu: 0,
    rataPeringkat: 5,
    jumlahLangkah: 60,
  });
  assert.equal(rendah.level, LEVEL_RENDAH);
  assert.ok(rendah.skor < 35);
});

test("hitungSkorKecurigaan preserves empty input guards, forced/book filtering, and phase advancement", () => {
  const kosong = hitungSkorKecurigaan(null);
  assert.equal(kosong.jumlahLangkah, 0);
  assert.equal(kosong.w.warna, "w");
  assert.equal(kosong.b.warna, "b");
  assert.equal(kosong.w.skor, null);
  assert.equal(kosong.w.level, null);
  assert.deepEqual(Object.keys(kosong.w.perFase), DAFTAR_FASE);
  assert.equal(Object.hasOwn(kosong.w.perFase.opening, "skor"), false);

  // Langkah buku dan langkah paksa dilewati dari metrik, tetapi tetap memajukan fase jika FEN sah
  const moves = [
    null,
    { fen: FEN_AWAL, color: "w", bestMoveSan: "e4" },
    // move[2] (Putih): book -> tidak masuk jumlahLangkah, tetapi tetap memajukan fase dari opening -> opening
    { fen: FEN_3_2, color: "b", san: "e4", moveRating: "book", previousStaticEvals: [["cp", "0"], ["cp", "0"]] },
    // move[3] (Hitam): forced -> tidak masuk jumlahLangkah, tetapi FEN_AKHIR_RAJA_PION langsung memajukan fase jika sudah endgame? (opening->middlegame pada FEN_AKHIR_2_2)
    { fen: FEN_AKHIR_2_2, color: "w", san: "e5", isForced: true, moveRating: "best", previousStaticEvals: [["cp", "0"], ["cp", "0"]] },
    // move[4] (Putih): langkah dinilai -> tercatat di middlegame (bukan opening)
    {
      fen: FEN_AKHIR_2_2,
      color: "b",
      san: "Nf3",
      bestMoveSan: "Nf3",
      previousBestMoveSan: "e4",
      previousStaticEvals: [["cp", "-20"], ["cp", "20"]],
    },
  ];
  // Karena moves[1] punya bestMoveSan "e4", moves[2] adalah "book" (lewati), moves[3] forced (lewati, maju fase ke middlegame),
  // moves[4] pakai saran dari moves[3] (tidak punya bestMoveSan) dan dicatat di middlegame
  const hasil = hitungSkorKecurigaan(moves);
  assert.equal(hasil.jumlahLangkah, 1);
  assert.equal(hasil.w.langkahDinilai, 0); // moves[3] tidak punya bestMoveSan jadi cocok === null!
  assert.equal(hasil.w.langkahAcpl, 1);
  assert.equal(hasil.w.perFase.opening.langkahAcpl, 0);
  assert.equal(hasil.w.perFase.middlegame.langkahAcpl, 1);
});

test("hitungSkorKecurigaan preserves MultiPV partition, conditional buckets, clock correlation and WDL aggregation", () => {
  const mkKandidat = (uci1, cp1, uci2, cp2, cp3 = cp2 - 20, wdl1 = [400, 480, 120], wdl2 = [340, 500, 160]) => [
    { uci: uci1, peringkat: 1, cp: cp1, wdl: wdl1 },
    { uci: uci2, peringkat: 2, cp: cp2, wdl: wdl2 },
    { uci: "a2a3", peringkat: 3, cp: cp3, wdl: [300, 500, 200] },
    { uci: "h2h3", peringkat: 4, cp: cp3 - 10, wdl: [290, 500, 210] },
    { uci: "b2b3", peringkat: 5, cp: cp3 - 20, wdl: [280, 500, 220] },
  ];

  // Rangkaian posisi Putih:
  // - 14 langkah ber-MultiPV (sebagian sulit, sebagian mudah, sebagian netral, dengan streak terputus di langkah ke-4),
  // - + 2 langkah tanpa kandidat (menunjukkan partisi langkahDinilaiTanpaPeringkat = 2 vs kandidatSampel = 14)
  const moves = [
    {
      fen: FEN_AWAL,
      color: "w",
      bestMoveSan: "e4",
      kandidat: mkKandidat("e2e4", 50, "d2d4", 40, 35), // ketajaman 15 <= 20 -> sulit
      clock: { white: 600, black: 600 },
    },
  ];

  for (let ply = 0; ply < 16; ply++) {
    const adalahHitamSetelahPutih = ply < 14;
    // Tambahkan langkah Putih pada indeks ganjil (1, 3, 5, ...)
    const pakaiRank2 = ply === 3;
    const adaKandidat = ply < 14;
    const isSulit = ply % 3 === 0;
    const isMudah = ply % 3 === 1;
    const jamPutihSebelum = 600 - ply * 10;
    const waktuPikirPutih = ply + 1; // naik terus sementara rank konstan / variasi -> korelasi terhitung
    const jamPutihSesudah = jamPutihSebelum - waktuPikirPutih;

    const prevMove = moves[moves.length - 1];
    // Pastikan posisi sebelumnya punya bestMoveSan dan kandidat (untuk ply < 14)
    if (ply > 0) {
      prevMove.bestMoveSan = "e4";
      prevMove.kandidat = adaKandidat
        ? mkKandidat(
            "e2e4",
            150,
            "d2d4",
            120,
            isSulit ? 135 : isMudah ? 20 : 100, // tajam: 15 (sulit) / 130 (mudah) / 50 (netral)
          )
        : undefined;
    }

    moves.push({
      fen: FEN_3_2,
      color: "b",
      san: pakaiRank2 ? "d4" : "e4",
      uci: pakaiRank2 ? "d2d4" : "e2e4",
      previousBestMoveSan: "e4",
      previousStaticEvals: [["cp", pakaiRank2 ? "-20" : "-30"], ["cp", "30"]],
      clock: { white: jamPutihSesudah, black: 600, incrementSeconds: 0 },
    });

    // Tambah dummy langkah Hitam pada indeks genap sebelum langkah Putih berikutnya
    if (ply < 15) {
      moves.push({
        fen: FEN_AKHIR_RAJA_PION,
        color: "w",
        san: "e5",
        uci: "e7e5",
        moveRating: "book",
        previousStaticEvals: [["cp", "0"], ["cp", "0"]],
        clock: { white: jamPutihSesudah, black: 595, incrementSeconds: 0 },
        ...(adalahHitamSetelahPutih ? {} : {}),
      });
    }
  }

  const perPartai = hitungSkorKecurigaan(moves, { rating: { w: 2200, b: 2200 } });
  const w = perPartai.w;

  assert.equal(perPartai.jumlahLangkah, 16);
  assert.equal(w.langkahDinilai, 16);
  assert.equal(w.langkahCocok, 15);
  assert.equal(w.kandidatSampel, 14);
  assert.equal(w.langkahDinilaiTanpaPeringkat, 2);
  assert.equal(w.langkahCocokTanpaPeringkat, 2);
  assert.equal(w.sampelMetrik.kecocokan, 2);
  assert.equal(w.sampelMetrik.peringkat, 14);
  assert.equal(w.sampelMetrik.acpl, 16);
  assert.equal(w.sampelMetrik.waktu, 16);

  // Streak terpanjang: ply 0,1,2 cocok top-1 (3), ply 3 rank 2 (reset), lalu ply 4..13 cocok top-1 (10)
  assert.equal(w.streakTerpanjang, 10);
  // Bucket sulit (ply 0,3,6,9,12 -> 5 langkah, 1 gagal di ply 3 -> 4/5 = 80%)
  assert.equal(w.sulitDinilai, 5);
  assert.equal(w.sulitCocok, 4);
  assert.equal(w.kecocokanSulit, 80);
  // Bucket mudah (ply 1,4,7,10,13 -> 5 langkah, semua cocok -> 100%)
  assert.equal(w.mudahDinilai, 5);
  assert.equal(w.mudahCocok, 5);
  assert.equal(w.kecocokanMudah, 100);
  // 3 domain aktif (pemilihan, kualitas, waktu)
  assert.equal(w.cakupanTerbatas, false);
  assert.equal(w.jumlahDomainBukti, 3);
  assert.equal(w.sampelKorelasi, 14);
  assert.ok(Number.isFinite(w.korelasiWaktuKualitas));
  assert.ok(Number.isFinite(w.akurasi));
  assert.ok(w.akurasiAritmetik >= w.akurasi);

  // Rating opsi tidak mengubah skor (kebijakan pukul rata)
  const tanpaRating = hitungSkorKecurigaan(moves);
  assert.equal(w.skor, tanpaRating.w.skor);
  assert.equal(w.level, tanpaRating.w.level);

  // Integrasi ke agregatSkorPemain mempertahankan angka konsisten
  const agregat = agregatMod.agregatSkorPemain([
    { id: "g-skor", timestamp: 100, warna: "w", hasil: perPartai },
  ], "Putih");
  assert.equal(agregat.skor, w.skor);
  assert.equal(agregat.streakTerpanjang, w.streakTerpanjang);
  assert.equal(agregat.kecocokanSulit, w.kecocokanSulit);
});
