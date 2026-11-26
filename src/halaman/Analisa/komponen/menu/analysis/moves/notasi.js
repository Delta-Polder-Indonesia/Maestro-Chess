/**
 * Notasi langkah (adopsi En Croissant: letters/symbols/lan).
 *
 * Modul MURNI tanpa React/DOM supaya mudah diuji dan dipakai daftar langkah.
 * - "letters": SAN apa adanya (Nf3, e4, O-O) — perilaku Maestro semula.
 * - "symbols": huruf bidak diganti figurine (♘f3, ♕e8=♕); langkah pion tetap.
 * - "lan": Long Algebraic Notation dari petak asal→tujuan (e2e4, g1f3, e7e8q).
 *
 * `movement` adalah pasangan petak terformat [{col,row},{col,row}] yang sudah
 * disimpan tiap entri langkah (lihat useAnalisisPapan), sehingga LAN tidak
 * perlu menebak dari SAN. Bila movement tak tersedia, LAN jatuh kembali ke SAN.
 */
import { deformatSquare } from "../../../../mesin/engine.js";

const FIGURINE = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘" };

/** Ganti huruf bidak dengan figurine: huruf awal langkah bidak +.piece promosi. */
export function figurine(san) {
  if (!san) return san;
  // Langkah pion diawali huruf file (a–h), bukan K/Q/R/B/N, sehingga huruf
  // awal yang merupakan bidak selalu piece indicator. Promosi mengikuti "=".
  return san
    .replace(/^[KQRBN]/, (huruf) => FIGURINE[huruf])
    .replace(/=([KQRBN])/g, (_, huruf) => `=${FIGURINE[huruf]}`);
}

/** Notasi tampil untuk satu langkah sesuai mode preferensi. */
export function notasiLangkah(san, movement, mode) {
  if (mode === "symbols") return figurine(san);
  if (mode === "lan") {
    if (movement && movement[0] && movement[1]) {
      const promosi = /=([KQRBN])/.exec(san ?? "")?.[1];
      return deformatSquare(movement[0]) + deformatSquare(movement[1]) + (promosi ? promosi.toLowerCase() : "");
    }
    return san;
  }
  return san;
}
