/**
 * Pemilihan soal: saring rentang rating/tema, hindari pengulangan dalam satu
 * sesi, dan naikkan kesulitan secara progresif.
 *
 * Pola diadopsi dari layar puzzle En Croissant (GPL-3.0) sebagai PERILAKU, bukan
 * salinan kode: rentang rating 600–2800 dengan bawaan 1000–1500, mode progresif
 * menaikkan rentang ke [rating+50, rating+100] setelah soal benar, dan tema
 * opsional ("semua tema" bila null).
 *
 * Logika murni; pengacak disuntik agar hasil dapat diuji deterministik.
 */

export const RENTANG_RATING = Object.freeze({ min: 600, max: 2800, bawaan: Object.freeze([1000, 1500]) });
const LANGKAH_PROGRESIF = Object.freeze([50, 100]);

function jepit(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Rentang berikutnya untuk mode progresif. Rating tidak diketahui → rentang
 * bawaan (bukan naik dari nol).
 */
export function rentangProgresif(rating) {
  // Number(null) === 0, jadi null/undefined/kosong harus ditolak lebih dulu —
  // kalau tidak, soal tanpa rating (harian) menurunkan rentang ke dasar 600.
  const dasar = rating === null || rating === undefined || rating === "" ? Number.NaN : Number(rating);
  if (!Number.isFinite(dasar)) return [...RENTANG_RATING.bawaan];
  return [
    jepit(dasar + LANGKAH_PROGRESIF[0], RENTANG_RATING.min, RENTANG_RATING.max),
    jepit(dasar + LANGKAH_PROGRESIF[1], RENTANG_RATING.min, RENTANG_RATING.max),
  ];
}

/**
 * Sumber yang datanya TIDAK membawa rating maupun tema.
 *
 * Soal harian Chess.com hanya menyimpan `tanggal`, `fen`, dan `langkah`
 * (lihat public/data/README.md) — seluruh 7.097 soal harian punya rating null
 * dan tema kosong. Menerapkan filter rating/tema pada sumber ini membuang
 * SEMUA soalnya, termasuk pada rentang bawaan 1000–1500, sehingga layar harian
 * tampil kosong. Karena itu filter tersebut dilewati untuk sumber harian.
 *
 * Sumber lain (`skakmat`, `video`) memiliki rating dan tema lengkap sehingga
 * tetap disaring penuh. Jenis tak dikenal tetap disaring (perilaku lama).
 */
const SUMBER_TANPA_RATING_TEMA = Object.freeze(new Set(["harian"]));

function disaringRatingTema(soal) {
  return !SUMBER_TANPA_RATING_TEMA.has(soal?.jenis);
}

/**
 * Saring soal menurut rentang rating dan tema, dengan aturan per sumber:
 * sumber tanpa metadata rating/tema (harian) lolos apa adanya, sumber lain
 * disaring penuh. Soal berjenis reguler yang kehilangan rating tetap dibuang
 * saat pembatasan rating diminta — data rusak tidak diselundupkan.
 */
export function saringSoal(daftar, { ratingMin, ratingMax, tema } = {}) {
  const pakaiRating = Number.isFinite(ratingMin) || Number.isFinite(ratingMax);
  const bawah = Number.isFinite(ratingMin) ? ratingMin : RENTANG_RATING.min;
  const atas = Number.isFinite(ratingMax) ? ratingMax : RENTANG_RATING.max;
  return (daftar ?? []).filter((soal) => {
    if (!disaringRatingTema(soal)) return true;
    if (tema && !soal.tema?.includes(tema)) return false;
    if (!pakaiRating) return true;
    if (soal.rating === null || soal.rating === undefined) return false;
    return soal.rating >= bawah && soal.rating <= atas;
  });
}

/** Daftar tema unik terurut untuk pemilih tema di pengaturan. */
export function daftarTema(daftar) {
  const kumpulan = new Set();
  for (const soal of daftar ?? []) for (const tema of soal.tema ?? []) kumpulan.add(tema);
  return [...kumpulan].sort((a, b) => a.localeCompare(b));
}

/**
 * Pilih satu soal secara acak dari yang belum dikerjakan sesi ini. Bila semua
 * kandidat sudah terpakai, pakai lagi seluruh kandidat (sesi tidak boleh
 * mentok); bila tidak ada kandidat sama sekali, kembalikan null.
 *
 * @param {Array} daftar
 * @param {{terpakai?: Iterable<string>, ratingMin?: number, ratingMax?: number, tema?: string|null, acak?: () => number}} opsi
 */
export function pilihSoal(daftar, { terpakai = [], ratingMin, ratingMax, tema = null, acak = Math.random } = {}) {
  const kandidat = saringSoal(daftar, { ratingMin, ratingMax, tema });
  if (!kandidat.length) return null;
  const sudah = new Set(terpakai);
  const segar = kandidat.filter((soal) => !sudah.has(soal.id));
  const kolam = segar.length ? segar : kandidat;
  const indeks = Math.min(kolam.length - 1, Math.max(0, Math.floor(acak() * kolam.length)));
  return kolam[indeks];
}
