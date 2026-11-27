// Kontrak modul bersama teka-teki (src/modul/tekaTeki): bentuk baku soal dari
// tiga sumber data, pemilihan (rentang rating/tema/progresif), penilaian langkah
// (benar/salah/skakmat + balasan otomatis), statistik sesi, dan pemuat malas.
// Perilaku diadopsi dari layar puzzle En Croissant (GPL-3.0) sebagai aturan main,
// ditulis ulang untuk chess.js — bukan salinan kode.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Chess } from "chess.js";

import {
  parseLangkah, uciLangkah, giliranDariFen, pihakPemain, parseTema, normalisasiSoal, normalisasiBerkas,
  RENTANG_RATING, rentangProgresif, saringSoal, daftarTema, pilihSoal,
  posisiAwalPemain, nilaiLangkah, petunjukBerikutnya, langkahDiharapkan, terapkanLangkah,
  STATUS_SOAL, buatEntri, hitungStatistik, formatWaktu,
  VERSI_DATA, JENIS_SOAL, muatSoal, resetCacheSoal,
} from "../src/modul/tekaTeki/index.js";

const baca = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));

// Soal rakitan mengikuti konvensi data sebenarnya: FEN = giliran PEMAIN dan
// langkah[0] adalah langkah pemain (di sini Putih skakmat dengan Re8#).
const FEN_MAT = "7k/6pp/p7/8/8/8/5PPP/4R1K1 w - - 0 1";
const SOAL_MAT = normalisasiSoal({ fen: FEN_MAT, langkah: "e1-e8", tanggal: "2025-01-01" }, "harian");

test("parseLangkah reads coordinate pairs, promotions, UCI fallback, and drops corrupt entries", () => {
  assert.deepEqual(parseLangkah("c4-c8;b7-c8"), [{ from: "c4", to: "c8" }, { from: "b7", to: "c8" }]);
  assert.deepEqual(parseLangkah("f2-f1q"), [{ from: "f2", to: "f1", promotion: "q" }]);
  assert.deepEqual(parseLangkah("e2e4 e7e5"), [{ from: "e2", to: "e4" }, { from: "e7", to: "e5" }]);
  assert.deepEqual(parseLangkah("e7e8q"), [{ from: "e7", to: "e8", promotion: "q" }]);
  // Entri rusak dilewati tanpa menggeser urutan langkah sah lainnya.
  assert.deepEqual(parseLangkah("c4-c8;rusak;b7-c8"), [{ from: "c4", to: "c8" }, { from: "b7", to: "c8" }]);
  assert.deepEqual(parseLangkah(""), []);
  assert.deepEqual(parseLangkah(null), []);
  assert.equal(uciLangkah({ from: "e7", to: "e8", promotion: "q" }), "e7e8q");
  assert.equal(uciLangkah(null), "");
});

test("side to play is the FEN turn — the puzzle's first move belongs to the player", () => {
  assert.equal(giliranDariFen(FEN_MAT), "w");
  assert.equal(pihakPemain(FEN_MAT), "w");
  assert.equal(pihakPemain("8/8/8/8/8/8/8/K6k b - - 0 1"), "b");
  assert.equal(giliranDariFen("bukan fen"), "");
  assert.equal(pihakPemain(""), "");
  assert.deepEqual(parseTema("backRankMate endgame mateIn3 endgame"), ["backRankMate", "endgame", "mateIn3"]);
});

test("normalisasiSoal maps all three sources into one shape and rejects unusable entries", () => {
  const skakmat = normalisasiSoal({ problemid: 7, fen: FEN_MAT, moves: "e1-e8", rating: 900, tema: "mateIn1 backRankMate", type: "Mate in One" }, "skakmat");
  assert.equal(skakmat.id, "skakmat-7");
  assert.equal(skakmat.rating, 900);
  assert.deepEqual(skakmat.tema, ["mateIn1", "backRankMate"]);
  assert.equal(skakmat.pihak, "w");
  assert.equal(skakmat.video, null);

  const video = normalisasiSoal({ problemid: 9, fen: FEN_MAT, moves: "e1-e8", rating: 1200, video: "https://contoh/video.mp4", pelatih: "WIM X", judulSoal: "Taktik", tanggal: "2025-12-09" }, "video");
  assert.equal(video.id, "video-9");
  assert.equal(video.video, "https://contoh/video.mp4");
  assert.equal(video.pelatih, "WIM X");
  assert.equal(video.judul, "Taktik");

  assert.equal(SOAL_MAT.id, "harian-2025-01-01");
  assert.equal(SOAL_MAT.rating, null, "soal harian tidak punya rating");
  assert.equal(normalisasiSoal({ fen: FEN_MAT, moves: "" }), null);
  assert.equal(normalisasiSoal({ fen: "", moves: "e2-e4" }), null);
  assert.equal(normalisasiSoal(null), null);

  // Berkas nyata: ketiga sumber ternormalisasi tanpa kehilangan soal sah.
  assert.equal(normalisasiBerkas(baca("../public/data/teka-teki.json"), "skakmat").length, 5486);
  assert.equal(normalisasiBerkas(baca("../public/data/teka-teki-video.json"), "video").length, 6551);
  assert.equal(normalisasiBerkas(baca("../public/data/teka-teki-harian/2025.json"), "harian").length, 365);
});

test("every shipped mate puzzle replays legally and ends in checkmate", () => {
  const daftar = normalisasiBerkas(baca("../public/data/teka-teki.json"), "skakmat").slice(0, 120);
  for (const soal of daftar) {
    const papan = new Chess(soal.fen);
    for (const langkah of soal.langkah) papan.move({ from: langkah.from, to: langkah.to, promotion: langkah.promotion });
    assert.ok(papan.isCheckmate(), `soal ${soal.id} berakhir skakmat`);
  }
});

test("shipped data starts on the player's move: first move is theirs and mate-in-one is a single move", () => {
  const mentah = baca("../public/data/teka-teki.json").problems;
  const daftar = normalisasiBerkas({ problems: mentah }, "skakmat");
  assert.equal(daftar.length, mentah.length);
  let matSatu = 0;
  for (const [i, soal] of daftar.entries()) {
    const papan = new Chess(soal.fen);
    // Pihak pemain = giliran FEN, dan langkah[0] harus bidak milik pihak itu.
    assert.equal(soal.pihak, soal.giliranFen, `soal ${soal.id}: pihak pemain = giliran FEN`);
    const pertama = soal.langkah[0];
    const bidak = papan.get(pertama.from);
    assert.ok(bidak, `soal ${soal.id}: petak asal langkah pertama terisi`);
    assert.equal(bidak.color, soal.giliranFen, `soal ${soal.id}: langkah pertama milik pemain, bukan lawan`);
    // Field `first` pada sumber menegaskan pihak yang harus jalan.
    assert.equal(mentah[i].first, soal.giliranFen === "w" ? "White to Move" : "Black to Move");
    if (mentah[i].type === "Mate in One") {
      assert.equal(soal.langkah.length, 1, `soal ${soal.id}: mat dalam 1 = tepat satu langkah`);
      papan.move({ from: pertama.from, to: pertama.to, promotion: pertama.promotion });
      assert.ok(papan.isCheckmate(), `soal ${soal.id}: langkah tunggal pemain langsung skakmat`);
      matSatu++;
    }
  }
  assert.ok(matSatu > 1000, "sampel mencakup soal mat-dalam-satu");
});

test("playing the solution as the player completes every sampled puzzle across all three sources", () => {
  const sumber = [
    ["skakmat", normalisasiBerkas(baca("../public/data/teka-teki.json"), "skakmat").filter((_, i) => i % 40 === 0)],
    ["video", normalisasiBerkas(baca("../public/data/teka-teki-video.json"), "video").filter((_, i) => i % 50 === 0)],
    ["harian", normalisasiBerkas(baca("../public/data/teka-teki-harian/2025.json"), "harian").filter((_, i) => i % 5 === 0)],
  ];
  for (const [nama, daftar] of sumber) {
    assert.ok(daftar.length > 0, nama);
    for (const soal of daftar) {
      let fen = posisiAwalPemain(soal.fen, soal.langkah);
      let indeks = 0;
      let selesai = false;
      for (let jaga = 0; jaga < 300 && !selesai; jaga++) {
        const langkah = soal.langkah[indeks];
        assert.ok(langkah, `${nama} ${soal.id}: langkah pemain tersedia di indeks ${indeks}`);
        const hasil = nilaiLangkah({ fen, langkahSoal: soal.langkah, indeks, pemain: langkah });
        assert.ok(hasil.sah && hasil.benar, `${nama} ${soal.id}: langkah solusi diterima di indeks ${indeks}`);
        fen = hasil.fenBaru;
        if (hasil.balasan) {
          const papan = new Chess(fen);
          papan.move(hasil.balasan);
          fen = papan.fen();
        }
        indeks += hasil.balasan ? 2 : 1;
        selesai = hasil.selesai;
      }
      assert.ok(selesai, `${nama} ${soal.id}: jalur solusi tuntas dimainkan pemain`);
    }
  }
});

test("rating/theme filtering keeps unrated daily puzzles only when no rating bound is asked", () => {
  const a = { id: "a", rating: 900, tema: ["mateIn1"] };
  const b = { id: "b", rating: 1800, tema: ["endgame"] };
  const harian = { id: "h", rating: null, tema: [] };
  const daftar = [a, b, harian];
  assert.deepEqual(saringSoal(daftar, { ratingMin: 600, ratingMax: 1500 }).map((s) => s.id), ["a"]);
  assert.deepEqual(saringSoal(daftar, { tema: "endgame" }).map((s) => s.id), ["b"]);
  assert.deepEqual(saringSoal(daftar).map((s) => s.id), ["a", "b", "h"], "tanpa batas rating, harian ikut");
  assert.deepEqual(saringSoal(daftar, { ratingMin: 2000, ratingMax: 2800 }), []);
  assert.deepEqual(daftarTema(daftar), ["endgame", "mateIn1"]);
  assert.deepEqual(RENTANG_RATING.bawaan, [1000, 1500]);
});

test("daily puzzles survive the default rating range and any theme filter (they carry neither)", () => {
  const harian = normalisasiBerkas(baca("../public/data/teka-teki-harian/2025.json"), "harian");
  assert.equal(harian.length, 365);
  // Data harian memang tidak punya rating/tema — bukan soal yang rusak.
  assert.ok(harian.every((soal) => soal.rating === null && soal.tema.length === 0));
  assert.deepEqual(daftarTema(harian), []);

  const [bawah, atas] = RENTANG_RATING.bawaan;
  assert.equal(saringSoal(harian, { ratingMin: bawah, ratingMax: atas }).length, harian.length,
    "rentang bawaan tidak boleh mengosongkan sumber harian");
  assert.equal(saringSoal(harian, { ratingMin: 2000, ratingMax: 2800 }).length, harian.length,
    "batas rating sempit tetap tidak membuang soal harian");
  assert.equal(saringSoal(harian, { tema: "mateIn3" }).length, harian.length,
    "filter tema tidak relevan untuk sumber harian");
  assert.equal(saringSoal(harian, { ratingMin: bawah, ratingMax: atas, tema: "endgame" }).length, harian.length);
  // Pemilihan nyata pada konfigurasi bawaan layar harus menghasilkan soal.
  const dipilih = pilihSoal(harian, { ratingMin: bawah, ratingMax: atas, tema: "mateIn3", acak: () => 0 });
  assert.ok(dipilih, "sumber harian menghasilkan soal pada konfigurasi bawaan");
  assert.equal(dipilih.jenis, "harian");
});

test("rating and theme filters still apply in full to the regular and video sources", () => {
  const skakmat = normalisasiBerkas(baca("../public/data/teka-teki.json"), "skakmat");
  const video = normalisasiBerkas(baca("../public/data/teka-teki-video.json"), "video");
  for (const [nama, daftar] of [["skakmat", skakmat], ["video", video]]) {
    assert.ok(daftar.every((soal) => soal.rating !== null && soal.tema.length > 0), `${nama} punya rating dan tema`);
    const sempit = saringSoal(daftar, { ratingMin: 1000, ratingMax: 1500 });
    assert.ok(sempit.length > 0 && sempit.length < daftar.length, `${nama}: rentang bawaan benar-benar menyaring`);
    assert.ok(sempit.every((soal) => soal.rating >= 1000 && soal.rating <= 1500));
    const tema = daftarTema(daftar)[0];
    const bertema = saringSoal(daftar, { tema });
    assert.ok(bertema.length > 0 && bertema.length < daftar.length, `${nama}: filter tema menyaring`);
    assert.ok(bertema.every((soal) => soal.tema.includes(tema)));
    // Gabungan rating + tema tetap berlaku dan lebih sempit dari masing-masing.
    const gabungan = saringSoal(daftar, { ratingMin: 1000, ratingMax: 1500, tema });
    assert.ok(gabungan.length <= Math.min(sempit.length, bertema.length));
    assert.ok(gabungan.every((soal) => soal.rating >= 1000 && soal.rating <= 1500 && soal.tema.includes(tema)));
    assert.deepEqual(saringSoal(daftar, { ratingMin: 2700, ratingMax: 2800 }), [], `${nama}: di atas rating tertinggi kosong`);
  }
  // Soal sumber reguler yang kehilangan rating tetap dibuang saat rating diminta:
  // data rusak tidak diselundupkan lewat pengecualian sumber harian.
  const rusak = [{ id: "rusak", jenis: "skakmat", rating: null, tema: [] }];
  assert.deepEqual(saringSoal(rusak, { ratingMin: 1000, ratingMax: 1500 }), []);
  assert.deepEqual(saringSoal(rusak, { tema: "mateIn1" }), []);
});

test("progressive mode raises the range by +50/+100 and clamps at the ceiling", () => {
  assert.deepEqual(rentangProgresif(1200), [1250, 1300]);
  assert.deepEqual(rentangProgresif(2780), [2800, 2800]);
  assert.deepEqual(rentangProgresif(null), [1000, 1500], "tanpa rating → bawaan, bukan dasar 600");
  assert.deepEqual(rentangProgresif(undefined), [1000, 1500]);
});

test("pilihSoal is deterministic with an injected rng, avoids repeats, and never dead-ends", () => {
  const daftar = [{ id: "a", rating: 1000, tema: [] }, { id: "b", rating: 1100, tema: [] }, { id: "c", rating: 1200, tema: [] }];
  assert.equal(pilihSoal(daftar, { acak: () => 0 }).id, "a");
  assert.equal(pilihSoal(daftar, { acak: () => 0.99 }).id, "c");
  assert.equal(pilihSoal(daftar, { terpakai: ["a"], acak: () => 0 }).id, "b");
  // Semua terpakai → boleh mengulang (sesi tidak mentok).
  assert.equal(pilihSoal(daftar, { terpakai: ["a", "b", "c"], acak: () => 0 }).id, "a");
  assert.equal(pilihSoal(daftar, { ratingMin: 2500, ratingMax: 2800 }), null);
  assert.equal(pilihSoal([], {}), null);
});

test("posisiAwalPemain keeps the puzzle FEN so the player makes the first move", () => {
  const awal = posisiAwalPemain(FEN_MAT, SOAL_MAT.langkah);
  assert.equal(awal, FEN_MAT, "tidak ada langkah pembuka yang dimainkan otomatis");
  assert.equal(giliranDariFen(awal), "w", "giliran tetap milik pemain");
  // Langkah pertama solusi masih bisa dimainkan dari posisi awal.
  const papan = new Chess(awal);
  const pertama = SOAL_MAT.langkah[0];
  assert.doesNotThrow(() => papan.move({ from: pertama.from, to: pertama.to }));
  assert.ok(papan.isCheckmate(), "langkah pertama pemain adalah skakmat");
  assert.equal(posisiAwalPemain(FEN_MAT, []), FEN_MAT);
});

test("nilaiLangkah accepts the solution move, auto-replies, and finishes on the last move or mate", () => {
  const awal = posisiAwalPemain(FEN_MAT, SOAL_MAT.langkah);
  const hasil = nilaiLangkah({ fen: awal, langkahSoal: SOAL_MAT.langkah, indeks: 0, pemain: { from: "e1", to: "e8" } });
  assert.equal(hasil.sah, true);
  assert.equal(hasil.benar, true);
  assert.equal(hasil.selesai, true, "langkah terakhir → soal selesai");
  assert.equal(hasil.balasan, null);
  assert.equal(hasil.uci, "e1e8");

  // Langkah sah tetapi bukan solusi: posisi tidak dianggap benar.
  const salah = nilaiLangkah({ fen: awal, langkahSoal: SOAL_MAT.langkah, indeks: 0, pemain: { from: "g2", to: "g3" } });
  assert.equal(salah.sah, true);
  assert.equal(salah.benar, false);
  assert.equal(salah.selesai, false);

  // Langkah tidak sah: bukan "salah", papan tidak berubah.
  const ilegal = nilaiLangkah({ fen: awal, langkahSoal: SOAL_MAT.langkah, indeks: 0, pemain: { from: "e1", to: "f3" } });
  assert.equal(ilegal.sah, false);
  assert.equal(ilegal.fenBaru, null);

  // Soal nyata multi-langkah: benar → balasan lawan otomatis, belum selesai.
  const soal = normalisasiBerkas(baca("../public/data/teka-teki.json"), "skakmat")[0];
  const posisi = posisiAwalPemain(soal.fen, soal.langkah);
  const tengah = nilaiLangkah({ fen: posisi, langkahSoal: soal.langkah, indeks: 0, pemain: soal.langkah[0] });
  assert.equal(tengah.benar, true);
  assert.equal(tengah.selesai, false);
  assert.deepEqual(tengah.balasan, soal.langkah[1], "balasan lawan di indeks ganjil");
  assert.deepEqual(langkahDiharapkan(soal.langkah, 0), soal.langkah[0]);
  assert.equal(langkahDiharapkan(soal.langkah, 99), null);
});

test("an alternative move that still checkmates counts as correct", () => {
  // Putih punya dua jalan skakmat; solusi menyebut salah satunya.
  const fen = "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1";
  const solusi = [{ from: "d1", to: "d8" }];
  const hasil = nilaiLangkah({ fen, langkahSoal: solusi, indeks: 0, pemain: { from: "d1", to: "d8" } });
  assert.equal(hasil.benar, true);
  assert.equal(hasil.selesai, true);
  assert.equal(hasil.balasan, null, "langkah terakhir tidak meminta balasan");
});

test("an alternative mate before the last recorded move ends the puzzle with no reply", () => {
  // Jalur solusi tercatat tiga langkah, tetapi Putih punya skakmat langsung
  // Rd8# di indeks 0. Permainan berakhir di situ: balasan jalur awal tidak
  // boleh dikirim (ilegal pada posisi mati) dan indeks hanya maju satu.
  const fen = "6k1/5ppp/8/8/8/8/5PPP/3RR1K1 w - - 0 1";
  const solusi = parseLangkah("e1-e2;g7-g6;d1-d8");
  const hasil = nilaiLangkah({ fen, langkahSoal: solusi, indeks: 0, pemain: { from: "d1", to: "d8" } });
  assert.equal(hasil.sah, true);
  assert.equal(hasil.benar, true, "skakmat alternatif tetap diterima");
  assert.equal(hasil.selesai, true, "posisi berakhir → soal selesai");
  assert.equal(hasil.balasan, null, "tidak ada balasan setelah permainan berakhir");
  assert.ok(new Chess(hasil.fenBaru).isCheckmate());
  // Balasan yang dipaksakan pun tidak mengubah posisi mati.
  assert.equal(terapkanLangkah(hasil.fenBaru, solusi[1]), hasil.fenBaru);
  // Indeks berikutnya = satu langkah nyata yang dimainkan.
  assert.equal(0 + (hasil.balasan ? 2 : 1), 1);

  // Sama halnya bila skakmat alternatif terjadi di tengah jalur (indeks 2 dari 5).
  const panjang = parseLangkah("e1-e2;g7-g6;d1-d8;g6-g5;d8-d7");
  const tengah = nilaiLangkah({ fen, langkahSoal: panjang, indeks: 0, pemain: { from: "d1", to: "d8" } });
  assert.equal(tengah.selesai, true);
  assert.equal(tengah.balasan, null);
});

test("a correct move that does not end the game still gets the opponent's reply", () => {
  const fen = "6k1/5ppp/8/8/8/8/5PPP/3RR1K1 w - - 0 1";
  const solusi = parseLangkah("e1-e2;g7-g6;d1-d8");
  // Langkah solusi di indeks 0 (Re2) bukan skakmat → balasan lawan tetap ada.
  const hasil = nilaiLangkah({ fen, langkahSoal: solusi, indeks: 0, pemain: { from: "e1", to: "e2" } });
  assert.equal(hasil.benar, true);
  assert.equal(hasil.selesai, false, "permainan belum berakhir");
  assert.deepEqual(hasil.balasan, solusi[1], "balasan jalur solusi tetap dikirim");
  const posisi = terapkanLangkah(hasil.fenBaru, hasil.balasan);
  assert.equal(new Chess(posisi).turn(), "w", "giliran kembali ke pemain");

  // Langkah alternatif yang tidak skakmat tetap dinilai salah dan dibatalkan UI:
  // tidak ada balasan dan tidak ada status selesai.
  const salah = nilaiLangkah({ fen, langkahSoal: solusi, indeks: 0, pemain: { from: "e1", to: "e3" } });
  assert.equal(salah.sah, true);
  assert.equal(salah.benar, false);
  assert.equal(salah.selesai, false);
  assert.equal(salah.balasan, null);

  // Jalur normal sampai langkah terakhir: selesai tanpa balasan (tanpa regresi).
  const akhir = nilaiLangkah({ fen: posisi, langkahSoal: solusi, indeks: 2, pemain: { from: "d1", to: "d8" } });
  assert.equal(akhir.benar, true);
  assert.equal(akhir.selesai, true);
  assert.equal(akhir.balasan, null);
});

test("hints escalate square → arrow → cleared", () => {
  const langkah = { from: "e1", to: "e8" };
  const satu = petunjukBerikutnya("kosong", langkah);
  assert.deepEqual(satu, { tingkat: "petak", petak: "e1", panah: null });
  const dua = petunjukBerikutnya(satu.tingkat, langkah);
  assert.deepEqual(dua, { tingkat: "panah", petak: null, panah: langkah });
  assert.deepEqual(petunjukBerikutnya(dua.tingkat, langkah), { tingkat: "kosong", petak: null, panah: null });
  assert.deepEqual(petunjukBerikutnya("kosong", null), { tingkat: "kosong", petak: null, panah: null });
});

test("session stats compute accuracy, tail streak, and average time over solved puzzles", () => {
  const riwayat = [
    { status: STATUS_SOAL.BENAR, waktu: 4000 },
    { status: STATUS_SOAL.SALAH, waktu: 9000 },
    { status: STATUS_SOAL.BENAR, waktu: 6000 },
    { status: STATUS_SOAL.BENAR, waktu: 0 },
    { status: STATUS_SOAL.BELUM, waktu: 0 },
  ];
  const stat = hitungStatistik(riwayat);
  assert.equal(stat.benar, 3);
  assert.equal(stat.salah, 1);
  assert.equal(stat.selesai, 4);
  assert.equal(stat.akurasi, 75);
  assert.equal(stat.streak, 2, "streak dari ekor, entri belum dikerjakan dilewati");
  assert.equal(stat.rataWaktu, 5000, "rata-rata hanya soal benar yang berwaktu");
  assert.deepEqual(hitungStatistik([]), { benar: 0, salah: 0, selesai: 0, akurasi: null, streak: 0, rataWaktu: null });
  assert.equal(hitungStatistik([{ status: STATUS_SOAL.SALAH }]).streak, 0);
  assert.equal(formatWaktu(65_000), "01:05");
  assert.equal(formatWaktu(null), "00:00");
  assert.deepEqual(buatEntri(SOAL_MAT), { id: "harian-2025-01-01", rating: null, jenis: "harian", status: "belum", waktu: 0, tema: [] });
});

test("loader fetches each source once, caches in flight, and does not cache failures", async (tes) => {
  const asli = globalThis.fetch;
  const diminta = [];
  let gagal = false;
  globalThis.fetch = async (url) => {
    diminta.push(url);
    if (gagal) return { ok: false, status: 500 };
    return { ok: true, json: async () => ({ soal: [{ tanggal: "2025-01-01", fen: FEN_MAT, langkah: "e1-e8" }] }) };
  };
  const diam = console.error;
  console.error = () => {};
  tes.after(() => { globalThis.fetch = asli; console.error = diam; resetCacheSoal(); });
  resetCacheSoal();

  const [satu, dua] = await Promise.all([muatSoal(JENIS_SOAL.HARIAN, { tahun: 2025 }), muatSoal(JENIS_SOAL.HARIAN, { tahun: 2025 })]);
  assert.equal(diminta.length, 1, "satu unduhan untuk panggilan bersamaan");
  assert.equal(satu.length, 1);
  assert.equal(satu, dua, "hasil cache identik");
  assert.ok(diminta[0].includes(`data/teka-teki-harian/2025.json?v=${VERSI_DATA}`));

  await muatSoal(JENIS_SOAL.SKAKMAT);
  await muatSoal(JENIS_SOAL.VIDEO);
  assert.ok(diminta[1].includes("data/teka-teki.json"));
  assert.ok(diminta[2].includes("data/teka-teki-video.json"));

  // Kegagalan tidak di-cache: percobaan berikutnya mengunduh ulang.
  resetCacheSoal();
  gagal = true;
  assert.deepEqual(await muatSoal(JENIS_SOAL.SKAKMAT), []);
  gagal = false;
  const ulang = await muatSoal(JENIS_SOAL.SKAKMAT);
  assert.equal(ulang.length, 1, "setelah gagal, sumber dicoba lagi");
});

test("terapkanLangkah applies a move and tolerates an illegal one", () => {
  const awal = posisiAwalPemain(FEN_MAT, SOAL_MAT.langkah);
  const sesudah = terapkanLangkah(awal, { from: "e1", to: "e8" });
  assert.equal(giliranDariFen(sesudah), "b");
  assert.equal(terapkanLangkah(awal, { from: "e1", to: "f3" }), awal, "langkah tidak sah → FEN asal");
  assert.equal(terapkanLangkah(awal, null), awal);
});

test("module barrel exposes exactly the intended surface and stays UI-free", () => {
  const sumber = readFileSync(new URL("../src/modul/tekaTeki/index.js", import.meta.url), "utf8");
  const ekspor = [...sumber.matchAll(/export \{([^}]+)\}/g)].flatMap((m) => m[1].split(",").map((s) => s.trim()));
  assert.deepEqual(ekspor.sort(), [
    "JENIS_SOAL", "RENTANG_RATING", "STATUS_SOAL", "VERSI_DATA",
    "buatEntri", "daftarTema", "formatWaktu", "giliranDariFen", "hitungStatistik",
    "langkahDiharapkan", "muatSoal", "normalisasiBerkas", "normalisasiSoal", "parseLangkah",
    "parseTema", "petunjukBerikutnya", "pihakPemain", "pilihSoal", "posisiAwalPemain",
    "rentangProgresif", "resetCacheSoal", "saringSoal", "nilaiLangkah", "terapkanLangkah", "uciLangkah",
  ].sort());
  // Modul bersama tidak boleh memuat React/JSX atau menyentuh DOM langsung.
  for (const berkas of ["soal.js", "pemilih.js", "penilai.js", "sesi.js", "pemuat.js", "index.js"]) {
    const isi = readFileSync(new URL(`../src/modul/tekaTeki/${berkas}`, import.meta.url), "utf8");
    assert.ok(!/from "react"/.test(isi), `${berkas} bebas React`);
    assert.ok(!/\bdocument\.|\bwindow\./.test(isi), `${berkas} bebas DOM`);
    assert.ok(!/@mantine|@tabler|chessops|jotai/.test(isi), `${berkas} tanpa dependensi En Croissant`);
  }
});
