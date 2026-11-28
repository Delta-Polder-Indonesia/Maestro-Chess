/**
 * Preferensi latihan teka-teki — MILIK FITUR, bukan pengaturan umum aplikasi.
 *
 * Berbeda dari warna papan / set bidak / tampilan yang bersifat umum dan tinggal
 * di layar Pengaturan "satu pintu", preferensi ini mengatur sifat kerja sesi
 * teka-teki itu sendiri (rentang rating, tema, progresif, sembunyikan rating,
 * lompat cepat, catat waktu). Karena itu ia disimpan dan disunting di dalam
 * layar teka-teki — persis pola En Croissant yang menaruh preferensi puzzle di
 * panel puzzle, bukan di halaman Settings umum.
 *
 * Persistensi memakai fasad penyimpanan sesi yang aman (localStorage bisa
 * diblokir); nilai tetap hidup di state layar walau penyimpanan gagal.
 */
import { useCallback, useRef, useState } from "react";
import { bacaAngka, bacaBoolean, bacaTeks, tulis, tulisBoolean } from "../../../modul/sesi/preferensi.js";

export const RATING_BAWAH = 600;
export const RATING_ATAS = 2800;

function bacaRating(kunci, bawaan) {
  const nilai = bacaAngka(kunci, bawaan);
  return Number.isFinite(nilai) ? Math.min(RATING_ATAS, Math.max(RATING_BAWAH, Math.round(nilai))) : bawaan;
}

/** Kunci state pendek → kunci penyimpanan "puzzle…" (format lama tetap dibaca). */
function kunciSimpan(kunci) {
  return `puzzle${kunci.charAt(0).toUpperCase()}${kunci.slice(1)}`;
}

export default function usePreferensiTekaTeki() {
  const [prefs, setPrefs] = useState(() => ({
    ratingMin: bacaRating("puzzleRatingMin", 1000),
    ratingMax: bacaRating("puzzleRatingMax", 1500),
    tema: bacaTeks("puzzleTema", ""),
    progresif: bacaBoolean("puzzleProgresif", false),
    sembunyiRating: bacaBoolean("puzzleSembunyiRating", false),
    lompatCepat: bacaBoolean("puzzleLompatCepat", true),
    catatWaktu: bacaBoolean("puzzleCatatWaktu", true),
  }));
  // Cermin untuk penjepitan min/max tanpa closure basi saat seret cepat.
  const ref = useRef(prefs);
  ref.current = prefs;

  const ubah = useCallback((kunci, nilai) => {
    let sah = nilai;
    if (kunci === "ratingMin") sah = Math.min(Math.round(nilai), ref.current.ratingMax);
    if (kunci === "ratingMax") sah = Math.max(Math.round(nilai), ref.current.ratingMin);
    setPrefs((lama) => (lama[kunci] === sah ? lama : { ...lama, [kunci]: sah }));
    if (typeof sah === "boolean") tulisBoolean(kunciSimpan(kunci), sah);
    else tulis(kunciSimpan(kunci), String(sah));
  }, []);

  return { ...prefs, ubah };
}
