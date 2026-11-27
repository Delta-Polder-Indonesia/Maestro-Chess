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
 * Saring soal. Soal tanpa rating (mis. teka-teki harian) hanya lolos bila
 * pembatasan rating tidak diminta — kalau tidak, penyaring rating membuang seluruh
 * sumber harian tanpa penjelasan.
 */
export function saringSoal(daftar, { ratingMin, ratingMax, tema } = {}) {
  const pakaiRating = Number.isFinite(ratingMin) || Number.isFinite(ratingMax);
  const bawah = Number.isFinite(ratingMin) ? ratingMin : RENTANG_RATING.min;
  const atas = Number.isFinite(ratingMax) ? ratingMax : RENTANG_RATING.max;
  return (daftar ?? []).filter((soal) => {
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
