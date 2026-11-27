/**
 * Jejak langkah soal aktif: daftar posisi + notasi SAN dari awal sampai indeks
 * yang sudah dimainkan. Dipakai panel bawah untuk menampilkan daftar langkah
 * dan menelusurinya (<< < > >>) seperti papan puzzle En Croissant.
 *
 * Deterministik: dibangun dari solusi soal + indeks sesi, jadi tidak perlu
 * state tambahan di hook. chess.js dipakai di sini (bukan di hook sesi).
 */
import { Chess } from "chess.js";

export default function buatJejak(soal, indeks) {
  if (!soal) return [];
  const jejak = [{ fen: soal.fen, san: null, warna: null, nomor: null }];
  try {
    const papan = new Chess(soal.fen);
    const batas = Math.min(indeks, soal.langkah.length);
    for (let i = 0; i < batas; i++) {
      const langkah = soal.langkah[i];
      const nomor = papan.moveNumber();
      const hasil = papan.move({ from: langkah.from, to: langkah.to, promotion: langkah.promotion });
      jejak.push({ fen: papan.fen(), san: hasil.san, warna: hasil.color, nomor });
    }
  } catch {
    // Langkah tidak sah menghentikan jejak pada posisi terakhir yang sah.
  }
  return jejak;
}
