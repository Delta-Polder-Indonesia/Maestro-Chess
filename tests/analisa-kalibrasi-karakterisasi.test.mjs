import assert from "node:assert/strict";
import test from "node:test";
import * as kalibrasi from "../src/halaman/Analisa/mesin/antiCheat/kalibrasi.js";
import * as dasar from "../src/halaman/Analisa/mesin/antiCheat/dasar.js";
import * as skorMod from "../src/halaman/Analisa/mesin/antiCheat/skor.js";
import * as agregatMod from "../src/halaman/Analisa/mesin/antiCheat/agregat.js";
import * as antiCheat from "../src/halaman/Analisa/mesin/antiCheat.js";

const {
  KALIBRASI_RATING,
  komponenAcpl,
  komponenKecocokan,
  komponenPeringkat,
  komponenWaktu,
  pilihKalibrasi,
  ratingDariMetadata,
  tingkatDariSkor,
} = kalibrasi;

const { AMBANG, LEVEL_RENDAH, LEVEL_SEDANG, LEVEL_TINGGI, LEVEL_SEMENTARA } = dasar;

test("kalibrasi exposes exact 8 named exports, frozen KALIBRASI_RATING and shared antiCheat identities", () => {
  assert.deepEqual(Object.keys(kalibrasi).sort(), [
    "KALIBRASI_RATING",
    "komponenAcpl",
    "komponenKecocokan",
    "komponenPeringkat",
    "komponenWaktu",
    "pilihKalibrasi",
    "ratingDariMetadata",
    "tingkatDariSkor",
  ]);
  assert.equal(Object.hasOwn(kalibrasi, "default"), false);
  for (const nama of Object.keys(kalibrasi)) {
    assert.strictEqual(antiCheat[nama], kalibrasi[nama], nama);
  }

  assert.equal(Object.isFrozen(KALIBRASI_RATING), true);
  assert.deepEqual(
    KALIBRASI_RATING.map((k) => [k.batas, k.kecocokanDasar, k.acplAcuan]),
    [
      [800, 40, 70],
      [1200, 45, 55],
      [1600, 50, 45],
      [2000, 55, 38],
      [2400, 60, 32],
      [Number.POSITIVE_INFINITY, 65, 27],
    ],
  );
});

test("pilihKalibrasi and ratingDariMetadata preserve band boundaries, fallback copies and Elo coercions", () => {
  // Non-finite rating mengembalikan objek baru berisi ambang global.
  for (const tidakTerhingga of [null, undefined, NaN, Infinity, -Infinity, "1200", {}]) {
    const res = pilihKalibrasi(tidakTerhingga);
    assert.deepEqual(res, {
      kecocokanDasar: AMBANG.kecocokanDasar,
      acplAcuan: AMBANG.acplAcuan,
    });
  }
  assert.notStrictEqual(pilihKalibrasi(null), pilihKalibrasi(undefined));

  // Batas tiap band bersifat inklusif (`<=`) dan mengembalikan referensi entri `KALIBRASI_RATING`.
  assert.strictEqual(pilihKalibrasi(-50), KALIBRASI_RATING[0]);
  assert.strictEqual(pilihKalibrasi(800), KALIBRASI_RATING[0]);
  assert.strictEqual(pilihKalibrasi(801), KALIBRASI_RATING[1]);
  assert.strictEqual(pilihKalibrasi(1200), KALIBRASI_RATING[1]);
  assert.strictEqual(pilihKalibrasi(1201), KALIBRASI_RATING[2]);
  assert.strictEqual(pilihKalibrasi(1600), KALIBRASI_RATING[2]);
  assert.strictEqual(pilihKalibrasi(1601), KALIBRASI_RATING[3]);
  assert.strictEqual(pilihKalibrasi(2000), KALIBRASI_RATING[3]);
  assert.strictEqual(pilihKalibrasi(2001), KALIBRASI_RATING[4]);
  assert.strictEqual(pilihKalibrasi(2400), KALIBRASI_RATING[4]);
  assert.strictEqual(pilihKalibrasi(2401), KALIBRASI_RATING[5]);
  assert.strictEqual(pilihKalibrasi(3500), KALIBRASI_RATING[5]);

  // `ratingDariMetadata`
  for (const invalidMeta of [null, undefined, {}, { players: null }, { players: "bukan-array" }, { players: [] }]) {
    assert.deepEqual(ratingDariMetadata(invalidMeta), { w: null, b: null });
  }
  assert.deepEqual(
    ratingDariMetadata({ players: [{ elo: 1500 }, { elo: "NOELO" }] }),
    { w: 1500, b: null },
  );
  assert.deepEqual(
    ratingDariMetadata({ players: [{ elo: "2100" }, { elo: 0 }] }),
    { w: 2100, b: null },
  );
  assert.deepEqual(
    ratingDariMetadata({ players: [{ elo: -20 }, { elo: Number.POSITIVE_INFINITY }] }),
    { w: null, b: null },
  );
  // Perilaku koersi `Number(true) === 1 > 0` dan `Number("") === 0 <= 0` dipertahankan apa adanya.
  assert.deepEqual(
    ratingDariMetadata({ players: [{ elo: true }, { elo: "" }] }),
    { w: 1, b: null },
  );
});

test("komponenKecocokan, komponenPeringkat, komponenAcpl, komponenWaktu and tingkatDariSkor preserve formulas and clamping", () => {
  // Non-finite masukan mengembalikan null pada semua komponen & tingkat.
  for (const invalid of [null, undefined, NaN, Infinity, -Infinity, "50"]) {
    assert.equal(komponenKecocokan(invalid), null);
    assert.equal(komponenPeringkat(invalid), null);
    assert.equal(komponenAcpl(invalid), null);
    assert.equal(komponenWaktu(invalid), null);
    assert.equal(tingkatDariSkor(invalid), null);
  }

  // `komponenKecocokan`: fallback `dasar` non-finite -> AMBANG.kecocokanDasar (45), jepit 0..100.
  assert.equal(komponenKecocokan(30), 0);
  assert.equal(komponenKecocokan(45), 0);
  assert.equal(komponenKecocokan(50), 9); // Math.round((5 / 55) * 100)
  assert.equal(komponenKecocokan(72.5), 50);
  assert.equal(komponenKecocokan(100), 100);
  assert.equal(komponenKecocokan(110), 100);
  assert.equal(komponenKecocokan(70, 40), 50);
  assert.equal(komponenKecocokan(72.5, NaN), 50);
  assert.equal(komponenKecocokan(100, 100), 0); // 0 / 0 = NaN -> batasi01 -> 0
  assert.equal(komponenKecocokan(90, 100), 0); // -Infinity -> batasi01 -> 0

  // `komponenPeringkat`: linear 1 -> 100 sampai AMBANG.peringkatJenuh (6) -> 0.
  assert.equal(AMBANG.peringkatJenuh, 6);
  assert.equal(komponenPeringkat(0.5), 100);
  assert.equal(komponenPeringkat(1), 100);
  assert.equal(komponenPeringkat(2), 80);
  assert.equal(komponenPeringkat(3.5), 50);
  assert.equal(komponenPeringkat(5), 20);
  assert.equal(komponenPeringkat(6), 0);
  assert.equal(komponenPeringkat(8), 0);

  // `komponenAcpl`: fallback `acuan` <= 0 atau non-finite -> AMBANG.acplAcuan (45).
  assert.equal(komponenAcpl(-10), 100);
  assert.equal(komponenAcpl(0), 100);
  assert.equal(komponenAcpl(22.5), 50);
  assert.equal(komponenAcpl(45), 0);
  assert.equal(komponenAcpl(100), 0);
  assert.equal(komponenAcpl(15, 60), 75);
  assert.equal(komponenAcpl(22.5, 0), 50);
  assert.equal(komponenAcpl(22.5, -5), 50);
  assert.equal(komponenAcpl(22.5, NaN), 50);

  // `komponenWaktu`: `Math.round(batasi01(v) * 100)`.
  assert.equal(komponenWaktu(-0.2), 0);
  assert.equal(komponenWaktu(0), 0);
  assert.equal(komponenWaktu(0.456), 46);
  assert.equal(komponenWaktu(1), 100);
  assert.equal(komponenWaktu(1.8), 100);

  // `tingkatDariSkor`: < 35 rendah, 35..69.999 sedang, >= 70 tinggi.
  assert.equal(tingkatDariSkor(-5), LEVEL_RENDAH);
  assert.equal(tingkatDariSkor(0), LEVEL_RENDAH);
  assert.equal(tingkatDariSkor(34.9), LEVEL_RENDAH);
  assert.equal(tingkatDariSkor(35), LEVEL_SEDANG);
  assert.equal(tingkatDariSkor(69.9), LEVEL_SEDANG);
  assert.equal(tingkatDariSkor(70), LEVEL_TINGGI);
  assert.equal(tingkatDariSkor(100), LEVEL_TINGGI);
});

test("skorKecurigaan and agregatSkorPemain integrate with kalibrasi thresholds and metadata ratings", () => {
  // Cakupan memadai (>= 12 sampel pada 2+ domain): `skorKecurigaan` memakai `tingkatDariSkor`
  // dan mengabaikan parameter `ratingPemain` karena kebijakan pukul rata memakai `AMBANG`.
  const rendahElo = skorMod.skorKecurigaan({
    engineMatchRate: 85,
    acpl: 10,
    konsistensiWaktu: 0.9,
    rataPeringkat: 1.5,
    jumlahLangkah: 40,
    sampel: { kecocokan: 20, peringkat: 20, acpl: 40, waktu: 30 },
    ratingPemain: 600,
  });
  const tinggiElo = skorMod.skorKecurigaan({
    engineMatchRate: 85,
    acpl: 10,
    konsistensiWaktu: 0.9,
    rataPeringkat: 1.5,
    jumlahLangkah: 40,
    sampel: { kecocokan: 20, peringkat: 20, acpl: 40, waktu: 30 },
    ratingPemain: 2600,
  });
  assert.deepEqual(rendahElo, tinggiElo);
  assert.equal(rendahElo.komponen.kecocokan, komponenKecocokan(85));
  assert.equal(rendahElo.komponen.peringkat, komponenPeringkat(1.5));
  assert.equal(rendahElo.komponen.acpl, komponenAcpl(10));
  assert.equal(rendahElo.komponen.waktu, komponenWaktu(0.9));
  assert.equal(rendahElo.level, tingkatDariSkor(rendahElo.skor));

  // Cakupan terbatas (hanya 1 domain bukti memadai): tetap mengembalikan komponen dari kalibrasi,
  // tetapi `level` diganti `LEVEL_SEMENTARA`.
  const terbatas = skorMod.skorKecurigaan({
    engineMatchRate: 100,
    acpl: null,
    konsistensiWaktu: null,
    rataPeringkat: null,
    jumlahLangkah: 20,
    sampel: { kecocokan: 20, peringkat: 0, acpl: 0, waktu: 0 },
  });
  assert.equal(terbatas.cakupanTerbatas, true);
  assert.equal(terbatas.level, LEVEL_SEMENTARA);
  assert.equal(terbatas.komponen.kecocokan, 100);

  // `agregatSkorPemain` memakai `ratingDariMetadata` saat `item.rating` kosong/0/non-finite.
  const ringkasPartai = {
    langkahDinilai: 20,
    langkahCocok: 14,
    engineMatchRate: 70,
    langkahAcpl: 20,
    totalKerugian: 300,
    acpl: 15,
  };
  const agregat = agregatMod.agregatSkorPemain([
    { id: "g1", timestamp: 1000, metadata: { players: [{ name: "Alice", elo: "1800" }, { name: "Bob", elo: "1700" }] }, hasil: { w: ringkasPartai, b: ringkasPartai } },
    { id: "g2", timestamp: 2000, warna: "w", rating: "", metadata: { players: [{ name: "Alice", elo: "NOELO" }, { name: "Carol", elo: 1900 }] }, hasil: { w: ringkasPartai, b: ringkasPartai } },
    { id: "g3", timestamp: 3000, warna: "b", rating: 2000, metadata: { players: [{ name: "Dan", elo: 1500 }, { name: "Alice", elo: 1400 }] }, hasil: { w: ringkasPartai, b: ringkasPartai } },
  ], "Alice");

  // Rating dari g1 (1800 dari metadata) dan g3 (2000 eksplisit); g2 ("NOELO") -> null. Median = (1800+2000)/2 = 1900.
  assert.equal(agregat.rating, 1900);
  assert.equal(agregat.partai[0].rating, 1800);
  assert.equal(agregat.partai[1].rating, null);
  assert.equal(agregat.partai[2].rating, 2000);
});
