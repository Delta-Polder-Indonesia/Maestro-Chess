/**
 * Kontrak BoardContext — state PAPAN & navigasi langkah.
 *
 * Konteks ini memuat state yang berubah karena interaksi papan (klik langkah,
 * play/pause, balik papan, garis kustom) plus preferensi yang menempel pada
 * papan (termasuk kedalaman analisis). Navigasi layar dipisahkan ke
 * TampilanContext agar perubahan layar tidak me-render ulang papan/analisis.
 * `progress`, `pageState`, `analyzingMove`, `langkahSementara`, `data`, dan
 * `analyzeController` tetap milik `ImportContext` karena berubah lebih sering.
 *
 * Bentuk nilai mengikuti konvensi lama: setiap field adalah pasangan
 * `[nilai, setter]`, satu-satunya pengecualian `gameController` yang berupa
 * objek stabil berisi `back/forward/first/last/togglePlay/play/pause`.
 *
 * Gunakan `useTampilan()` untuk membaca layar dan `useSetTampilan()` bila
 * hanya membutuhkan setter navigasi yang stabil.
 */
import { createContext, useContext } from "react";

const PEMAIN_KOSONG = Object.freeze([
  Object.freeze({ name: "", elo: "NOELO" }),
  Object.freeze({ name: "", elo: "NOELO" }),
]);

const TIDAK_ADA = () => {};

/**
 * Nilai bawaan sengaja "netral": komponen yang (keliru) dirender di luar
 * `BoardProvider` tetap mendapat bentuk yang aman, bukan `undefined`.
 */
export const BoardContext = createContext({
  game: [[], TIDAK_ADA],
  players: [PEMAIN_KOSONG, TIDAK_ADA],
  moveNumber: [0, TIDAK_ADA],
  forward: [true, TIDAK_ADA],
  white: [true, TIDAK_ADA],
  animation: [false, TIDAK_ADA],
  playing: [false, TIDAK_ADA],
  time: [0, TIDAK_ADA],
  materialAdvantage: [0, TIDAK_ADA],
  result: ["", TIDAK_ADA],
  tab: ["analyze", TIDAK_ADA],
  customLine: [{ moveNumber: -1, moves: [], arrows: {} }, TIDAK_ADA],
  returnedToNormalGame: [null, TIDAK_ADA],
  depth: [8, TIDAK_ADA],
  gameController: {
    back: TIDAK_ADA,
    forward: TIDAK_ADA,
    first: TIDAK_ADA,
    last: TIDAK_ADA,
    togglePlay: TIDAK_ADA,
    play: TIDAK_ADA,
    pause: TIDAK_ADA,
  },
});

/** State dan setter layar dipisah agar pemanggil setter tidak ikut render. */
export const TampilanContext = createContext("papan");
export const SetTampilanContext = createContext(TIDAK_ADA);

/** Baca BoardContext. Setara `useContext(BoardContext)` dengan nama pendek. */
export function useBoard() {
  return useContext(BoardContext);
}

export function useTampilan() {
  const tampilan = useContext(TampilanContext);
  const setTampilan = useContext(SetTampilanContext);
  return [tampilan, setTampilan];
}

export function useSetTampilan() {
  return useContext(SetTampilanContext);
}
