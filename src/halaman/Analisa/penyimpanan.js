/**
 * Akses localStorage yang aman untuk halaman Analisa.
 *
 * `localStorage` BUKAN API yang selalu tersedia: di mode penyamaran Safari,
 * saat kuota penuh, atau ketika pengguna memblokir cookie pihak pertama,
 * bahkan `getItem` melempar SecurityError. Komponen pengaturan hasil port
 * memanggilnya langsung di dalam useEffect/onClick, sehingga satu lemparan
 * merobohkan seluruh halaman Analisa — bukan hanya fitur simpan-pilihan.
 *
 * Kunci Maestro terpisah dari ChessClub meskipun kedua situs memakai origin
 * yang sama. Pengaturan Maestro lama dibaca sebagai fallback tanpa dihapus.
 */

const AWALAN = "maestro-analisa-";
const KUNCI_LAMA = {
  kedalaman: "depth", boardTheme: "boardTheme", usedRatings: "usedRatings",
  highlightByRating: "highlightByRating", showArrows: "showArrows",
  arrowAfterMove: "arrowAfterMove", showLegalMoves: "showLegalMoves",
  animateMoves: "animateMoves", boardSounds: "boardSounds",
  chesscom: "chesscom", lichessorg: "lichessorg",
};

function gudang() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Baca string mentah; `bawaan` bila tidak ada atau penyimpanan diblokir. */
export function bacaTeks(kunci, bawaan = null) {
  try {
    const storage = gudang();
    const sekarang = storage?.getItem(AWALAN + kunci);
    if (sekarang != null) return sekarang;
    let lama = KUNCI_LAMA[kunci] ? storage?.getItem(KUNCI_LAMA[kunci]) : null;
    // The old 11-bit format did not have a separate critical-move flag.
    if (kunci === "usedRatings" && /^[01]{11}$/.test(lama ?? "")) {
      lama = lama.slice(0, 3) + lama[2] + lama.slice(3);
    }
    return lama ?? bawaan;
  } catch {
    return bawaan;
  }
}

/** Tulis nilai; diam-diam diabaikan bila penyimpanan tidak bisa ditulis. */
export function tulis(kunci, nilai) {
  try {
    gudang()?.setItem(AWALAN + kunci, String(nilai));
  } catch {
    /* mode pribadi / kuota penuh — pilihan tidak tersimpan, tidak fatal */
  }
}

/** Baca angka; `bawaan` bila kosong, bukan angka, atau penyimpanan diblokir. */
export function bacaAngka(kunci, bawaan) {
  const mentah = bacaTeks(kunci, null);
  if (mentah === null || mentah === "") return bawaan;
  const nilai = Number(mentah);
  return Number.isFinite(nilai) ? nilai : bawaan;
}

/** Baca boolean yang disimpan sebagai "0"/"1"; `bawaan` bila belum pernah diset. */
export function bacaBoolean(kunci, bawaan) {
  const angka = bacaAngka(kunci, null);
  return angka === null ? bawaan : Boolean(angka);
}

/** Tulis boolean dalam bentuk "0"/"1" (format yang dipakai panel pengaturan). */
export function tulisBoolean(kunci, nilai) {
  tulis(kunci, Number(Boolean(nilai)));
}
