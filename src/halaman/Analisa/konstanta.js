/**
 * Ukuran tata letak halaman Analisa. `navTop` juga dipakai di
 * tailwind.config.ts; panel kanan memakai lebar area kerja, bukan viewport.
 */

/** Di bawah lebar ini navigasi pindah ke atas dan papan menjadi kolom. */
export const navTop = 516;

/** Lebar minimum area kerja agar panel kanan dapat sejajar dengan papan. */
export const maxVertical = 1100;

/** Batas sisi papan; layar pendek tetap bisa menggulir papan minimum. */
export const minSisiPapan = 160;
export const maxSisiPapan = 1000;

/** Di bawah lebar ini ringkasan ditampilkan dalam versi ramping. */
export const reduceSummary = 1669;

/**
 * Kedalaman analisis (ply).
 *
 * upstream menawarkan 15/18/21 dengan Stockfish multi-utas; engine milik
 * situs ini build "single" (satu utas) sehingga 18 ply bisa berarti menit per
 * partai panjang. Tangganya diturunkan dan tetap bisa dipilih pengguna dari
 * panel Pengaturan.
 */
export const KEDALAMAN = [
  { kunci: "cepat", ikon: "quick", ply: 10 },
  { kunci: "sedang", ikon: "standard", ply: 13 },
  { kunci: "dalam", ikon: "deep", ply: 16 },
  { kunci: "maksimal", ikon: null, ply: 20 },
];
