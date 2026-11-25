import assert from "node:assert/strict";
import test from "node:test";
import * as dasar from "../src/halaman/Analisa/mesin/antiCheat/dasar.js";
import * as antiCheat from "../src/halaman/Analisa/mesin/antiCheat.js";
import * as engine from "../src/halaman/Analisa/mesin/engine.js";
import * as skorMod from "../src/halaman/Analisa/mesin/antiCheat/skor.js";
import * as agregatMod from "../src/halaman/Analisa/mesin/antiCheat/agregat.js";
import { kunciCachePartai } from "../src/halaman/Analisa/akun/antiCheatRiwayat.js";

const {
  AMBANG,
  BATAS_KERUGIAN,
  BOBOT,
  CP_MATE,
  LEVEL_RENDAH,
  LEVEL_SEDANG,
  LEVEL_SEMENTARA,
  LEVEL_TINGGI,
  MIN_LANGKAH_AGGREGAT,
  MIN_PARTAI_AGGREGAT,
  SAMPEL_WAKTU_MINIMUM,
  batasi01,
  bulat1,
  cpKandidat,
  kehilanganMenangPermille,
  kerugianCentipawn,
  kerugianKandidatCp,
  ketajamanKandidat,
  korelasiSpearman,
  nilaiCentipawn,
  normalkanSan,
  pemainLangkah,
  peringkatLangkahDalam,
  rataRata,
  statistikWaktu,
  waktuBerpikir,
} = dasar;

const NAMA_EKSPOR_DASAR = [
  "AMBANG",
  "BATAS_KERUGIAN",
  "BOBOT",
  "CP_MATE",
  "LEVEL_RENDAH",
  "LEVEL_SEDANG",
  "LEVEL_SEMENTARA",
  "LEVEL_TINGGI",
  "MIN_LANGKAH_AGGREGAT",
  "MIN_PARTAI_AGGREGAT",
  "SAMPEL_WAKTU_MINIMUM",
  "batasi01",
  "bulat1",
  "cpKandidat",
  "kehilanganMenangPermille",
  "kerugianCentipawn",
  "kerugianKandidatCp",
  "ketajamanKandidat",
  "korelasiSpearman",
  "nilaiCentipawn",
  "normalkanSan",
  "pemainLangkah",
  "peringkatLangkahDalam",
  "rataRata",
  "statistikWaktu",
  "waktuBerpikir",
];

test("antiCheat dasar exposes exact 26 named exports, frozen constants and shared MULTI_PV identities", () => {
  assert.deepEqual(Object.keys(dasar).sort(), NAMA_EKSPOR_DASAR);
  assert.equal(Object.hasOwn(dasar, "default"), false);
  for (const nama of NAMA_EKSPOR_DASAR) {
    assert.strictEqual(antiCheat[nama], dasar[nama], nama);
  }

  assert.equal(engine.MULTI_PV, 5);
  assert.strictEqual(antiCheat.MULTI_PV, engine.MULTI_PV);

  assert.equal(CP_MATE, 10000);
  assert.equal(BATAS_KERUGIAN, 1000);
  assert.equal(SAMPEL_WAKTU_MINIMUM, 8);
  assert.equal(LEVEL_RENDAH, "rendah");
  assert.equal(LEVEL_SEDANG, "sedang");
  assert.equal(LEVEL_TINGGI, "tinggi");
  assert.equal(LEVEL_SEMENTARA, "sementara");
  assert.equal(MIN_PARTAI_AGGREGAT, 3);
  assert.equal(MIN_LANGKAH_AGGREGAT, 60);

  assert.equal(Object.isFrozen(AMBANG), true);
  assert.deepEqual(AMBANG, {
    kecocokanDasar: 45,
    acplAcuan: 45,
    variasiWaktuAcuan: 0.75,
    penyusutanLangkah: 12,
    peringkatJenuh: 6,
    kandidatSulit: 20,
    kandidatMudah: 100,
    korelasiSampelMinimum: 12,
    sedang: 35,
    tinggi: 70,
    tren: 1.5,
  });

  assert.equal(Object.isFrozen(BOBOT), true);
  assert.deepEqual(BOBOT, {
    kecocokan: 0.3,
    peringkat: 0.25,
    acpl: 0.25,
    waktu: 0.2,
  });
});

test("batasi01, rataRata, bulat1 and normalkanSan preserve coercions and clamping", () => {
  assert.equal(batasi01(-0.5), 0);
  assert.equal(batasi01(0), 0);
  assert.equal(batasi01(0.42), 0.42);
  assert.equal(batasi01(1.5), 1);
  for (const tidakTerhingga of [NaN, Infinity, -Infinity, undefined, null, "0.5", true]) {
    assert.equal(batasi01(tidakTerhingga), 0);
  }

  assert.equal(Number.isNaN(rataRata([])), true);
  assert.equal(rataRata([10, 20, 30]), 20);

  assert.equal(bulat1(12.34), 12.3);
  assert.equal(bulat1(12.35), 12.4);
  assert.equal(Object.is(bulat1(-0.04), -0), true);
  assert.equal(bulat1(NaN), null);
  assert.equal(bulat1(Infinity), null);
  assert.equal(bulat1(null), null);

  assert.equal(normalkanSan(null), "");
  assert.equal(normalkanSan(undefined), "");
  assert.equal(normalkanSan("  Nf3+!?  "), "Nf3");
  assert.equal(normalkanSan("0-0"), "O-O");
  assert.equal(normalkanSan("0-0-0+"), "O-O-O");
  assert.equal(normalkanSan("0-0-0-0"), "0-0-0-0");
});

test("nilaiCentipawn, kerugianCentipawn and cpKandidat preserve mate scaling and legacy coercions", () => {
  assert.equal(nilaiCentipawn(null), null);
  assert.equal(nilaiCentipawn(["mate"]), null);
  assert.equal(nilaiCentipawn(["cp", null]), null);
  assert.equal(nilaiCentipawn(["cp", undefined]), null);
  assert.equal(nilaiCentipawn(["cp", ""]), null);
  assert.equal(nilaiCentipawn(["cp", "abc"]), null);
  assert.equal(nilaiCentipawn(["cp", "   "]), 0);
  assert.equal(nilaiCentipawn(["cp", false]), 0);
  assert.equal(nilaiCentipawn(["cp", true]), 1);
  assert.equal(nilaiCentipawn(["cp", "34"]), 34);
  assert.equal(nilaiCentipawn(["mate", "0"]), -10000);
  assert.equal(nilaiCentipawn(["mate", "   "]), -10000);
  assert.equal(nilaiCentipawn(["mate", 3]), 10000);
  assert.equal(nilaiCentipawn(["mate", -3]), -10000);

  // rugi = prev[1] + prev[0], dipotong ke [0, BATAS_KERUGIAN]
  assert.equal(kerugianCentipawn({ previousStaticEvals: [["cp", "-120"], ["cp", "50"]] }), 0);
  assert.equal(kerugianCentipawn({ previousStaticEvals: [["cp", "-10"], ["cp", "60"]] }), 50);
  assert.equal(kerugianCentipawn({ previousStaticEvals: [["cp", "2000"], ["cp", "500"]] }), 1000);
  assert.equal(kerugianCentipawn({ previousStaticEvals: [["cp", "10"]] }), null);

  assert.equal(cpKandidat(null), null);
  assert.equal(cpKandidat({ mate: 0, cp: 99 }), -10000);
  assert.equal(cpKandidat({ mate: 2, cp: -50 }), 10000);
  assert.equal(cpKandidat({ mate: "" }), null);
  assert.equal(cpKandidat({ cp: 75 }), 75);
  assert.equal(cpKandidat({ cp: "75" }), null);
});

test("MultiPV helpers validate candidate lists and calculate rank, loss, WDL drop and sharpness", () => {
  const limaKandidatAcak = [
    { uci: "d2d4", peringkat: 2, cp: 20, wdl: [320, 500, 180] },
    { uci: "e2e4", peringkat: 1, cp: 45, wdl: [380, 480, 140] },
    { uci: "c2c4", peringkat: 3, cp: 10, wdl: [300, 510, 190] },
    { uci: "g1f3", peringkat: 4, cp: 5, wdl: [290, 510, 200] },
    { uci: "b1c3", peringkat: 5, cp: -10, wdl: [270, 510, 220] },
  ];

  // Urutan array tidak diasumsikan: pencocokan memakai `entri.peringkat`.
  assert.equal(peringkatLangkahDalam("e2e4", limaKandidatAcak), 1);
  assert.equal(peringkatLangkahDalam("d2d4", limaKandidatAcak), 2);
  // Di luar top-5 lengkap => MULTI_PV + 1 = 6; daftar parsial di luar kandidat => null.
  assert.equal(peringkatLangkahDalam("a2a3", limaKandidatAcak), 6);
  assert.equal(peringkatLangkahDalam("a2a3", limaKandidatAcak.slice(0, 3)), null);
  assert.equal(peringkatLangkahDalam("", limaKandidatAcak), null);

  // Validasi kandidat menolak UCI tak sah, peringkat duplikat/bolong, atau > MULTI_PV.
  assert.equal(peringkatLangkahDalam("e2e4", [{ uci: "e2e4", peringkat: 2 }]), null);
  assert.equal(peringkatLangkahDalam("e2e4", [{ uci: "INVALID", peringkat: 1 }]), null);
  assert.equal(
    peringkatLangkahDalam("e2e4", [
      { uci: "e2e4", peringkat: 1 },
      { uci: "e2e4", peringkat: 2 },
    ]),
    null,
  );
  assert.equal(
    peringkatLangkahDalam("e2e4", [...limaKandidatAcak, { uci: "f2f4", peringkat: 6 }]),
    null,
  );

  // kerugianKandidatCp & kehilanganMenangPermille & ketajamanKandidat
  assert.equal(kerugianKandidatCp("d2d4", limaKandidatAcak), 25);
  assert.equal(kerugianKandidatCp("e2e4", [{ uci: "e2e4", peringkat: 1, cp: 45 }]), null);
  assert.equal(kerugianKandidatCp("b1c3", [
    { uci: "e2e4", peringkat: 1, mate: 1 },
    { uci: "b1c3", peringkat: 2, cp: 0 },
  ]), 1000);

  assert.equal(kehilanganMenangPermille("c2c4", limaKandidatAcak), 80);
  assert.equal(kehilanganMenangPermille("c2c4", [
    { uci: "e2e4", peringkat: 1, cp: 40, wdl: [300, 500, 200] },
    { uci: "c2c4", peringkat: 2, cp: 45, wdl: [350, 500, 150] },
  ]), 0);
  assert.equal(kehilanganMenangPermille("c2c4", [
    { uci: "e2e4", peringkat: 1, cp: 40, wdl: [300, 500] },
    { uci: "c2c4", peringkat: 2, cp: 20, wdl: [250, 500, 250] },
  ]), null);

  assert.equal(ketajamanKandidat(limaKandidatAcak), 35);
  assert.equal(ketajamanKandidat([
    { uci: "d2d4", peringkat: 2, cp: 50 },
    { uci: "e2e4", peringkat: 1, cp: 30 },
  ]), 0);
  assert.equal(ketajamanKandidat([{ uci: "e2e4", peringkat: 1, cp: 30 }]), null);
});

test("korelasiSpearman, pemainLangkah, waktuBerpikir and statistikWaktu preserve rules and edge cases", () => {
  // Kurang dari 12 sampel -> null
  assert.equal(korelasiSpearman(Array.from({ length: 11 }, (_, i) => ({ detik: i + 1, peringkat: i + 1 }))), null);
  // Korelasi negatif sempurna (-1)
  const negatif = Array.from({ length: 12 }, (_, i) => ({ detik: i + 1, peringkat: 12 - i }));
  assert.ok(Math.abs(korelasiSpearman(negatif) - (-1)) < 1e-12);
  // Varians nol -> null
  const seragam = Array.from({ length: 12 }, (_, i) => ({ detik: 5, peringkat: i + 1 }));
  assert.equal(korelasiSpearman(seragam), null);

  // pemainLangkah
  assert.equal(pemainLangkah(null, 1), null);
  assert.equal(pemainLangkah({ color: "w" }, 0), null);
  assert.equal(pemainLangkah({ color: "w" }, 1), "b");
  assert.equal(pemainLangkah({ color: "b" }, 2), "w");
  assert.equal(pemainLangkah({ color: "x" }, 1), "w");
  assert.equal(pemainLangkah({}, 2), "b");

  // waktuBerpikir: increment diketahui vs tidak diketahui vs negatif
  assert.equal(waktuBerpikir([
    { clock: { white: 300, black: 300 } },
    { clock: { white: 292, black: 300, incrementSeconds: 2 } },
  ], 1, "w"), 10);
  assert.equal(waktuBerpikir([
    { clock: { white: 300, black: 300 } },
    { clock: { white: 295, black: 300, incrementSeconds: null } },
  ], 1, "w"), null);
  assert.equal(waktuBerpikir([
    { clock: { white: 300, black: 300 } },
    { clock: { white: 295, black: 300, incrementSeconds: -1 } },
  ], 1, "w"), null);
  assert.equal(waktuBerpikir([
    { clock: { white: 290, black: 300 } },
    { clock: { white: 300, black: 300 } },
  ], 1, "w"), null);

  // statistikWaktu: < 8 sampel -> null; semua nol -> null; konstan positif -> konsistensi = 1
  assert.equal(statistikWaktu([5, 5, 5, 5, 5, 5, 5]), null);
  assert.equal(statistikWaktu([0, 0, 0, 0, 0, 0, 0, 0]), null);
  const konstan = statistikWaktu([4, 4, 4, 4, 4, 4, 4, 4]);
  assert.deepEqual(konstan, {
    jumlahSampel: 8,
    rataRata: 4,
    deviasiBaku: 0,
    koefisienVariasi: 0,
    konsistensi: 1,
  });
});

test("antiCheat/skor, antiCheat/agregat and antiCheatRiwayat integrate with dasar and MULTI_PV", () => {
  const kunci = kunciCachePartai("g1", 8, "1. e4 e5 *", "stockfish-18-lite");
  assert.equal(JSON.parse(kunci)[3], 5);

  const moves = [
    {
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      color: "w",
      bestMoveSan: "e4",
      kandidat: [
        { uci: "e2e4", peringkat: 1, cp: 25, wdl: [350, 500, 150] },
        { uci: "d2d4", peringkat: 2, cp: 20, wdl: [340, 500, 160] },
      ],
    },
    {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      color: "b",
      san: "e4",
      previousBestMoveSan: "e4",
      uci: "e2e4",
      previousStaticEvals: [["cp", "-20"], ["cp", "20"]],
    },
  ];
  const perPartai = skorMod.hitungSkorKecurigaan(moves);
  assert.equal(perPartai.jumlahLangkah, 1);
  assert.equal(perPartai.w.langkahDinilai, 1);
  assert.equal(perPartai.w.engineMatchRate, 100);
  assert.equal(perPartai.w.rataPeringkat, 1);
  assert.equal(perPartai.w.level, LEVEL_SEMENTARA);

  const agregat = agregatMod.agregatSkorPemain([
    { id: "p1", timestamp: 1, moves, metadata: { players: [{ name: "Alice" }, { name: "Bob" }] } },
  ], "Alice");
  assert.equal(agregat.jumlahPartai, 1);
  assert.equal(agregat.jumlahLangkah, 1);
  assert.equal(agregat.rataPeringkat, 1);
});
