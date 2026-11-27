/**
 * Jejak langkah soal aktif: daftar posisi + notasi SAN dari awal sampai indeks
 * yang sudah dimainkan. Dipakai panel bawah untuk menampilkan daftar langkah
 * dan menelusurinya (<< < > >>) seperti papan puzzle En Croissant.
 *
 * Jalur yang ditampilkan adalah langkah yang BENAR-BENAR dimainkan bila sesi
 * memberikannya (`langkahNyata`); tanpa itu jejak memakai solusi soal. Pemain
 * boleh menang lewat skakmat alternatif, dan pada kasus itu jalur solusi awal
 * berbeda dari papan: menampilkan solusi akan menyebut langkah yang tidak
 * pernah dimainkan (mis. Re2 padahal pemain memainkan Rd8#) dan posisi tinjauan
 * tidak lagi cocok dengan papan. chess.js dipakai di sini (bukan di hook sesi).
 */
import { Chess } from "chess.js";

export default function buatJejak(soal, indeks, langkahNyata = null) {
  if (!soal) return [];
  const jalur = langkahNyata?.length ? langkahNyata : soal.langkah;
  const jejak = [{ fen: soal.fen, san: null, warna: null, nomor: null }];
  try {
    const papan = new Chess(soal.fen);
    const batas = Math.min(indeks, jalur.length);
    for (let i = 0; i < batas; i++) {
      const langkah = jalur[i];
      const nomor = papan.moveNumber();
      const hasil = papan.move({ from: langkah.from, to: langkah.to, promotion: langkah.promotion });
      jejak.push({ fen: papan.fen(), san: hasil.san, warna: hasil.color, nomor });
    }
  } catch {
    // Langkah tidak sah menghentikan jejak pada posisi terakhir yang sah.
  }
  return jejak;
}
