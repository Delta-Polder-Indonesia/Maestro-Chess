/**
 * Karakterisasi sinyal anomali kekuatan (kinerja vs Elo).
 *
 * Memastikan: data kurang -> tidakAda; Elo rendah dengan kinerja band GM ->
 * jauhDiAtas; menyimpang dari band sendiri -> diAtasWajar; sesuai harapan ->
 * wajar; pemain kuat mencapai GM tetap wajar; dan fungsi TIDAK mengubah
 * kebijakan skor inti (hanya sinyal tinjauan).
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  nilaiAnomaliKekuatan,
  AMBANG_ANOMALI,
} from "../src/halaman/Analisa/mesin/antiCheat/anomaliKekuatan.js";

test("data kurang -> tidakAda (tidak menebak)", () => {
  assert.equal(nilaiAnomaliKekuatan({}).level, "tidakAda");
  assert.equal(nilaiAnomaliKekuatan({ rating: 1500 }).level, "tidakAda");
  assert.equal(nilaiAnomaliKekuatan({ rating: 1500, engineMatchRate: 60 }).level, "tidakAda");
  assert.equal(nilaiAnomaliKekuatan(null).level, "tidakAda");
  assert.equal(nilaiAnomaliKekuatan({ rating: NaN, engineMatchRate: 60, acpl: 20 }).level, "tidakAda");
});

test("Elo 1500 dengan kinerja band GM -> jauhDiAtas (kasus inti user)", () => {
  // GM floors: kecocokan >= 65, ACPL <= 27.
  const hasil = nilaiAnomaliKekuatan({ rating: 1500, engineMatchRate: 68, acpl: 20 });
  assert.equal(hasil.level, "jauhDiAtas");
  assert.equal(hasil.capaiGM, true);
  assert.equal(hasil.rating, 1500);
  assert.equal(hasil.harapanKecocokan, 50); // band 1600 untuk Elo 1500
  assert.equal(hasil.harapanAcpl, 45);
});

test("Elo 1500 sesuai harapan -> wajar", () => {
  const hasil = nilaiAnomaliKekuatan({ rating: 1500, engineMatchRate: 50, acpl: 45 });
  assert.equal(hasil.level, "wajar");
  assert.equal(hasil.capaiGM, false);
});

test("Elo 1500 menyimpang dari band sendiri tapi belum GM -> diAtasWajar", () => {
  // >= 50 + 10 = 60 kecocokan, <= 45 - 12 = 33 ACPL; belum capai GM (kecocokan < 65).
  const hasil = nilaiAnomaliKekuatan({ rating: 1500, engineMatchRate: 61, acpl: 30 });
  assert.equal(hasil.level, "diAtasWajar");
  assert.equal(hasil.capaiGM, false);
});

test("hanya satu metrik menyimpang -> tidak diAtasWajar (harus DUA metrik)", () => {
  // kecocokan tinggi tapi ACPL masih sesuai band -> wajar.
  const hasil = nilaiAnomaliKekuatan({ rating: 1500, engineMatchRate: 63, acpl: 44 });
  assert.equal(hasil.level, "wajar");
});

test("pemain kuat (Elo 2500) mencapai band GM -> wajar (bukan anomali)", () => {
  const hasil = nilaiAnomaliKekuatan({ rating: 2500, engineMatchRate: 68, acpl: 20 });
  assert.equal(hasil.level, "wajar");
  assert.equal(hasil.capaiGM, true);
});

test("pemain kuat menyimpang jauh di atas band tinggi miliknya -> diAtasWajar", () => {
  // band GM: harapan kecocokan 65, ACPL 27 -> butuh >= 75 dan <= 15.
  const hasil = nilaiAnomaliKekuatan({ rating: 2500, engineMatchRate: 78, acpl: 12 });
  assert.equal(hasil.level, "diAtasWajar");
});

test("ambang bersifat konservatif dan terdokumentasi", () => {
  assert.equal(AMBANG_ANOMALI.selisihKecocokan, 10);
  assert.equal(AMBANG_ANOMALI.selisihAcpl, 12);
  assert.equal(AMBANG_ANOMALI.batasEloRentan, 2400);
});
