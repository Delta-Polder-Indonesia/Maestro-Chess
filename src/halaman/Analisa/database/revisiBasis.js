/** Bus revisi privat untuk database Analisa. */

/*
 * Revisi basis data: naik setiap ada tulis (simpan/hapus/gabung/bersihkan).
 * Komponen yang men-cache ringkasan yang mahal (mis. statistik panel
 * Database) memakai ini untuk tahu kapan cache-nya basi, tanpa harus
 * memindai ulang seluruh basis untuk memeriksa.
 */
let revisiBasis = 0;

/** Baca revisi tulis saat ini — pembanding validitas cache sesi. */
export function bacaRevisiBasis() {
  return revisiBasis;
}

/*
 * Pendengar perubahan basis data. Setiap tulis (simpan/hapus/gabung/
 * bersihkan/pastikan koleksi) menaikkan revisi SEKALIGUS memberitahu
 * pendengar — layar Database berlangganan di sini supaya koleksi yang baru
 * ditambahkan dari layar Akun langsung muncul tanpa harus keluar-masuk
 * layar. Tanpa ini ada balapan: Database yang dibuka sepersekian detik
 * setelah "Tambah akun" membaca revisi lama, mengira cache-nya masih segar,
 * dan akun barunya tidak terlihat sampai layar dibuka ulang.
 */
const pendengarRevisi = new Set();

/**
 * Daftarkan panggilan-balik yang dijalankan setiap revisi naik.
 * @returns {Function} fungsi berhenti berlangganan.
 */
export function langgananRevisi(cb) {
  if (typeof cb !== "function") return () => {};
  pendengarRevisi.add(cb);
  return () => {
    pendengarRevisi.delete(cb);
  };
}

function naikkanRevisi() {
  revisiBasis++;
  for (const cb of Array.from(pendengarRevisi)) {
    try {
      cb(revisiBasis);
    } catch {
      /* pendengar tidak boleh merusak tulis */
    }
  }
}

/*
 * `revisiBasis` diekspor sebagai binding hidup (live binding ESM): pembaca
 * selalu melihat angka terbaru tanpa harus memanggil fungsi.
 * `naikkanRevisi` sengaja tidak masuk fasad `../basisData.js` — ia hanya
 * dipakai modul database lain.
 */
export { revisiBasis, naikkanRevisi };
