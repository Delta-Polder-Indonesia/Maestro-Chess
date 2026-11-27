/**
 * Logika tanda bantu papan (mark petak + panah) — diadopsi dari ChessClub
 * (`src/lib/tandaBantu.js`), ditulis ulang untuk fitur ini. Aturan mengikuti
 * isepic-chess-ui / chess.com:
 *   - Klik kanan petak: belum ada mark → tambah; warna sama → hapus mark itu;
 *     warna beda → ganti warna.
 *   - Seret klik kanan (asal → tujuan): pasangan sama dengan panah yang ada →
 *     hapus panah itu; selain itu tambah panah.
 *   - Klik kiri di papan: hapus SEMUA tanda (ditangani papan lewat onHapusTanda).
 *
 * `togglePetak`/`togglePanah` murni (tanpa React) agar mudah diuji.
 */
import { useCallback, useState } from "react";

export function tandaKosong() {
  return { panah: [], petak: {} };
}

export function togglePetak(lama, petak, warna) {
  if (lama.petak[petak] === warna) {
    const sisa = { ...lama.petak };
    delete sisa[petak];
    return { ...lama, petak: sisa };
  }
  return { ...lama, petak: { ...lama.petak, [petak]: warna } };
}

export function togglePanah(lama, from, to, warna) {
  const ada = lama.panah.some((p) => p.from === from && p.to === to);
  const panah = ada
    ? lama.panah.filter((p) => !(p.from === from && p.to === to))
    : [...lama.panah, { from, to, warna }];
  return { ...lama, panah };
}

export function useTandaBantu() {
  const [tanda, setTanda] = useState(tandaKosong);
  const tandaPetak = useCallback((petak, warna) => {
    setTanda((lama) => togglePetak(lama, petak, warna));
  }, []);
  const tandaPanah = useCallback((from, to, warna) => {
    setTanda((lama) => togglePanah(lama, from, to, warna));
  }, []);
  const hapusSemuaTanda = useCallback(() => setTanda(tandaKosong()), []);
  return { tanda, setTanda, tandaPetak, tandaPanah, hapusSemuaTanda };
}
