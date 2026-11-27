/**
 * Penilai langkah pemain terhadap solusi soal.
 *
 * Perilaku diadopsi dari PuzzleBoard En Croissant (GPL-3.0) sebagai aturan main,
 * ditulis ulang untuk chess.js:
 *  - langkah benar bila sama dengan solusi PADA INDEKS itu, atau menghasilkan
 *    skakmat (solusi alternatif yang tetap menang tetap diterima);
 *  - setelah langkah benar, balasan lawan dimainkan otomatis;
 *  - soal selesai bila langkah terakhir solusi tercapai atau posisi skakmat;
 *  - langkah salah tidak memajukan posisi (UI menampilkannya lalu membatalkan).
 *
 * Hanya bergantung chess.js dan bentuk baku soal; tanpa DOM/React.
 */
import { Chess } from "chess.js";
import { uciLangkah } from "./soal.js";

/**
 * Posisi awal yang dilihat pemain = FEN soal apa adanya.
 *
 * Data soal memakai konvensi "pemain jalan lebih dulu" (lihat pihakPemain dan
 * public/data/README.md): `langkah[0]` adalah langkah PEMAIN, bukan pembuka
 * lawan. Memainkan langkah[0] di sini akan merampas langkah pertama pemain dan
 * membalik pihak yang dimainkan — pada "Mate in One" papan langsung skakmat
 * sehingga tidak ada bidak yang bisa bergerak.
 *
 * Fungsi dipertahankan sebagai satu pintu posisi awal (dipakai sesi saat buka
 * soal dan saat memutar solusi) agar konvensi ini hanya tertulis sekali.
 */
export function posisiAwalPemain(fen) {
  return fen;
}

/**
 * Nilai satu langkah pemain.
 *
 * @param {{fen: string, langkahSoal: Array, indeks: number, pemain: {from:string,to:string,promotion?:string}}} masukan
 * @returns {{sah: boolean, benar: boolean, selesai: boolean, balasan: object|null, uci: string, fenBaru: string|null}}
 */
export function nilaiLangkah({ fen, langkahSoal, indeks, pemain }) {
  const uci = uciLangkah(pemain);
  const kosong = { sah: false, benar: false, selesai: false, balasan: null, uci, fenBaru: null };
  if (!pemain || !Array.isArray(langkahSoal) || !langkahSoal.length) return kosong;
  let papan;
  try {
    papan = new Chess(fen);
    papan.move({ from: pemain.from, to: pemain.to, promotion: pemain.promotion });
  } catch {
    return kosong; // langkah tidak sah: papan tidak berubah, bukan "salah"
  }
  const diharapkan = uciLangkah(langkahSoal[indeks]);
  const mat = papan.isCheckmate();
  const benar = uci === diharapkan || mat;
  if (!benar) return { sah: true, benar: false, selesai: false, balasan: null, uci, fenBaru: papan.fen() };
  const terakhir = indeks >= langkahSoal.length - 1;
  const balasan = terakhir ? null : (langkahSoal[indeks + 1] ?? null);
  // Jalur habis bila tidak ada langkah pemain lagi sesudah balasan lawan.
  // Solusi panjang genap (sebagian soal harian) berakhir pada balasan lawan,
  // jadi balasan terakhir tetap diterapkan lalu soal ditandai selesai.
  const habis = indeks + (balasan ? 2 : 1) >= langkahSoal.length;
  const selesai = mat || habis;
  return {
    sah: true,
    benar: true,
    selesai,
    balasan,
    uci,
    fenBaru: papan.fen(),
  };
}

/**
 * Petunjuk bertingkat (pola En Croissant): klik pertama menandai petak asal,
 * klik kedua menjadi panah asal→tujuan, klik ketiga menghapus petunjuk.
 *
 * @param {"kosong"|"petak"|"panah"} tingkat
 * @param {{from: string, to: string}} langkah
 */
export function petunjukBerikutnya(tingkat, langkah) {
  if (!langkah) return { tingkat: "kosong", petak: null, panah: null };
  if (tingkat === "kosong") return { tingkat: "petak", petak: langkah.from, panah: null };
  if (tingkat === "petak") return { tingkat: "panah", petak: null, panah: { from: langkah.from, to: langkah.to } };
  return { tingkat: "kosong", petak: null, panah: null };
}

/** Langkah solusi yang sedang diharapkan pada indeks tertentu. */
export function langkahDiharapkan(langkahSoal, indeks) {
  return langkahSoal?.[indeks] ?? null;
}

/**
 * FEN setelah satu langkah diterapkan (dipakai untuk balasan lawan otomatis).
 * Langkah tidak sah mengembalikan FEN asal, bukan melempar.
 */
export function terapkanLangkah(fen, langkah) {
  if (!langkah) return fen;
  try {
    const papan = new Chess(fen);
    papan.move({ from: langkah.from, to: langkah.to, promotion: langkah.promotion });
    return papan.fen();
  } catch {
    return fen;
  }
}
