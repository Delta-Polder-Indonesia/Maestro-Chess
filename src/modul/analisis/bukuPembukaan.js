/**
 * Tabel "langkah buku" (nama pembukaan) dan kunci FEN untuk halaman Analisa.
 *
 * Berkas datanya dibuat dari buku pembukaan milik situs ini sendiri:
 *   node scripts/generasi-buku-analisa.mjs → public/data/buku-analisa.json
 *
 * Dipuat sekali per kunjungan halaman dan di-cache di modul ini (bukan di
 * komponen) agar berpindah tab di panel kanan tidak memicu fetch ulang.
 * Bila berkasnya gagal diunduh, analisis tetap jalan tanpa label "book";
 * penyebab kegagalan tetap dilaporkan di console.
 */

import { berkasPublik } from "../../lib/asets.js";

/**
 * FEN lengkap → kunci tabel buku: papan, giliran, rokade, dan en passant.
 * Penghitung setengah-langkah/penuh dibuang supaya posisi yang sama dari
 * partai mana pun tetap dikenali sebagai langkah buku.
 */
export function kunciFen(fen) {
  return String(fen ?? "").trim().split(/\s+/).slice(0, 4).join(" ");
}

let janji = null;

/*
 * Cache-buster pada URL: berkas buku dipakai berbulan-bulan dan di-cache di
 * modul ini untuk seluruh kunjungan, jadi tanpa versi sebuah deploy buku baru
 * tidak akan pernah terlihat sampai peramban dimatikan. Naikkan versi setiap
 * kali scripts/generasi-buku-analisa.mjs menghasilkan berkas baru.
 */
const VERSI_BUKU = "2026-09-22";

function unduh() {
  return fetch(`${berkasPublik("data/buku-analisa.json")}?v=${VERSI_BUKU}`)
    .then((respon) => {
      if (!respon.ok) throw new Error(`HTTP ${respon.status} saat memuat buku pembukaan`);
      return respon.json();
    })
    .catch((error) => {
      console.error("Gagal memuat buku pembukaan:", error);
      return {};
    });
}

/** Muat tabel buku (janji yang sama dikembalikan untuk panggilan berikutnya). */
export function muatBuku() {
  janji ||= unduh().then((peta) => {
    /*
     * Hasil kosong ({}) berarti unduhannya gagal (buku asli selalu berisi
     * belasan ribu posisi) — jangan cache kegagalan: kosongkan lagi supaya
     * analisis berikutnya mencoba mengunduh ulang, bukan memakai buku kosong
     * selama sisa kunjungan tanpa ada yang tahu.
     */
    if (!peta || Object.keys(peta).length === 0) janji = null;
    return peta;
  });
  return janji;
}

/**
 * Fungsi pencari nama pembukaan untuk sebuah FEN — bentuk yang dipakai
 * penilaian (`openings(fen)`), sekaligus tetap cocok bila yang diberikan
 * peta biasa.
 */
export async function cariNamaPembukaan() {
  const peta = await muatBuku();
  return (fen) => peta[kunciFen(fen)];
}
