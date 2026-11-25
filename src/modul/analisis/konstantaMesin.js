/**
 * Konstanta murni konfigurasi pencarian analisis posisi.
 *
 * Anti-cheat yang serius tidak menilai langkah dari `bestmove` tunggal saja:
 * setiap posisi dianalisis dengan MultiPV sehingga langkah pemain bisa
 * DIPERINGKAT di antara N kandidat terbaik (rank 1 = langkah terbaik, 2–5 =
 * masih dalam kelompok engine, di luar daftar = paling buruk). Nilai 5 adalah
 * keseimbangan biaya (MultiPV memperlambat pencarian ±20–40% pada kedalaman
 * sama) dan ketajaman sinyal; Lichess memakai pendekatan serupa untuk metrik
 * "move match". Konstanta ini juga membentuk `AMBANG.peringkatJenuh` di
 * `dasarAntiCheat.js` (`MULTI_PV + 1`) — ubah keduanya bersamaan lewat satu sumber ini.
 */
export const MULTI_PV = 5;
