/**
 * Anti-cheat — sinyal ANOMALI KEKUATAN (kinerja vs Elo).
 *
 * Membandingkan kinerja agregat seorang pemain (kecocokan langkah engine dan
 * ACPL) dengan harapan untuk rentang Elo-nya, memakai tabel kalibrasi yang
 * sudah ada (`KALIBRASI_RATING`). Ide: pemain ber-Elo rendah yang konsisten
 * bermain pada tingkat jauh lebih tinggi (mis. band Grandmaster) patut
 * ditinjau — inilah pola "Elo 1500 tapi langkah setara GM".
 *
 * PENTING: ini SINYAL TINJAUAN, bukan vonis dan bukan masukan skor kecurigaan
 * inti. Kebijakan deteksi tetap memakai ambang global pukul rata; fungsi ini
 * hanya menambah konteks "seberapa jauh kinerja di atas harapan Elo" untuk
 * peninjau manusia. Pemain kuat, jalur buku, dan akhirpartai sederhana dapat
 * tampak anomali secara alami, jadi wajib disertai sanggahan dan tinjauan
 * partai asli.
 *
 * Fungsi ini MURNI: tidak ada React/DOM/engine. Hanya membaca field agregat
 * yang sudah dihasilkan lapisan agregat dan tabel kalibrasi.
 */
import { KALIBRASI_RATING, pilihKalibrasi } from "../../../../modul/analisis/antiCheatKalibrasi.js";

/**
 * Ambang heuristik anomali (konservatif: menuntut DUA metrik menyimpang).
 * - selisihKecocokan: berapa % kecocokan engine di atas harapan band sendiri.
 * - selisihAcpl: berapa cp ACPL lebih baik (lebih rendah) dari harapan band.
 * - batasEloRentan: di bawah Elo ini, mencapai band GM dianggap anomali kuat.
 */
export const AMBANG_ANOMALI = Object.freeze({
  selisihKecocokan: 10,
  selisihAcpl: 12,
  batasEloRentan: 2400,
});

/**
 * @param {{rating?: number, engineMatchRate?: number, acpl?: number}} agregat
 *   Field agregat: `rating` (Elo acuan), `engineMatchRate` (persen 0–100),
 *   `acpl` (kerugian rata-rata cp, lebih rendah = lebih baik; skala yang sama
 *   dengan `acplAcuan` kalibrasi).
 * @returns {{level: string, rating: number|null, harapanKecocokan: number|null,
 *   harapanAcpl: number|null, kecocokan: number|null, acpl: number|null, capaiGM: boolean}}
 *   `level`: "tidakAda" (data kurang), "wajar", "diAtasWajar", "jauhDiAtas".
 */
export function nilaiAnomaliKekuatan(agregat) {
  const rating = agregat?.rating;
  const kecocokan = agregat?.engineMatchRate;
  const acpl = agregat?.acpl;
  const kosong = {
    level: "tidakAda",
    rating: null,
    harapanKecocokan: null,
    harapanAcpl: null,
    kecocokan: null,
    acpl: null,
    capaiGM: false,
  };
  if (!Number.isFinite(rating) || !Number.isFinite(kecocokan) || !Number.isFinite(acpl)) {
    return kosong;
  }

  const harapan = pilihKalibrasi(rating);
  const gm = KALIBRASI_RATING[KALIBRASI_RATING.length - 1];
  // Mencapai band tertinggi (GM): kecocokan >= floors GM DAN ACPL <= acuan GM.
  const capaiGM = kecocokan >= gm.kecocokanDasar && acpl <= gm.acplAcuan;
  // Menyimpang di atas band sendiri: KEDUA metrik harus lebih baik dari harapan.
  const diAtasBand =
    kecocokan >= harapan.kecocokanDasar + AMBANG_ANOMALI.selisihKecocokan &&
    acpl <= harapan.acplAcuan - AMBANG_ANOMALI.selisihAcpl;

  let level;
  if (rating < AMBANG_ANOMALI.batasEloRentan) {
    if (capaiGM) level = "jauhDiAtas";
    else if (diAtasBand) level = "diAtasWajar";
    else level = "wajar";
  } else {
    // Pemain kuat (>= batasEloRentan): mencapai band GM adalah wajar;
    // hanya tandai bila kinerjanya bahkan di atas band tinggi miliknya.
    level = diAtasBand ? "diAtasWajar" : "wajar";
  }

  return {
    level,
    rating,
    harapanKecocokan: harapan.kecocokanDasar,
    harapanAcpl: harapan.acplAcuan,
    kecocokan,
    acpl,
    capaiGM,
  };
}
