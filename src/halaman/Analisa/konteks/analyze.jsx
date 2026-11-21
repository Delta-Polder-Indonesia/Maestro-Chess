/* Port dari Brilliant-Chess (MIT, © 2025 Delo) — jangan sunting massal tanpa cek README. */
/**
 * Lapisan kompatibilitas AnalyzeContext (Fase 2).
 *
 * State halaman kini tinggal di dua provider yang lebih sempit:
 *
 *   BoardProvider  — state papan & navigasi (game, players, moveNumber,
 *                    forward, animation, white, playing, time,
 *                    materialAdvantage, result, tab, customLine,
 *                    returnedToNormalGame, depth, gameController). Tampilan
 *                    layar disediakan lewat konteks navigasi terpisah.
 *   ImportProvider — state muatan PGN & analisis (data, pageState, progress,
 *                    analyzeController, analyzingMove, langkahSementara)
 *
 * Berkas ini menyusun keduanya kembali menjadi SATU nilai `AnalyzeContext`
 * dengan pasangan `[nilai, setter]` dan `gameController` seperti sebelumnya;
 * `players` sudah dinormalisasi. Navigasi layar dibaca terpisah lewat
 * `useTampilan()` supaya perpindahan layar tidak menyebar ke semua konsumen.
 *
 * `akun` sengaja tetap di sini: ia bukan state papan maupun state impor, dan
 * pemecahan konteks akun di luar lingkup fase ini.
 *
 * Nilai gabungan tetap dibuat ulang saat state papan atau impor berubah.
 * Konsumen yang hanya memerlukan salah satunya dapat memakai `useBoard()`
 * atau `useImport()` langsung.
 */
import { useMemo, useState } from "react";
import { AnalyzeContext } from "./analyzeKonteks.js";
import { BoardProvider } from "./board.jsx";
import { ImportProvider } from "./import.jsx";
import { useBoard } from "./boardKonteks.js";
import { useImport } from "./importKonteks.js";

/**
 * Penyusun nilai gabungan. Harus berada DI DALAM kedua provider supaya bisa
 * membaca keduanya. Satu-satunya state miliknya sendiri: `akun`.
 */
function PenyambungKonteks({ children }) {
  const board = useBoard();
  const imp = useImport();
  const [akun, setAkun] = useState({ platform: "chessCom", username: "" });

  /*
   * Urutan field dipertahankan sama dengan versi lama supaya diff mudah
   * dibaca; dependensinya cukup ketiga sumber (board, imp, akun) karena
   * masing-masing sudah di-memo di providernya.
   */
  const nilaiKonteks = useMemo(
    () => ({
      data: imp.data,
      pageState: imp.pageState,
      game: board.game,
      players: board.players,
      moveNumber: board.moveNumber,
      forward: board.forward,
      white: board.white,
      animation: board.animation,
      playing: board.playing,
      time: board.time,
      materialAdvantage: board.materialAdvantage,
      result: board.result,
      progress: imp.progress,
      langkahSementara: imp.langkahSementara,
      tab: board.tab,
      analyzeController: imp.analyzeController,
      customLine: board.customLine,
      returnedToNormalGame: board.returnedToNormalGame,
      analyzingMove: imp.analyzingMove,
      akun: [akun, setAkun],
      depth: board.depth,
      gameController: board.gameController,
    }),
    [board, imp, akun]
  );

  return <AnalyzeContext.Provider value={nilaiKonteks}>{children}</AnalyzeContext.Provider>;
}

function AnalyzeContextProvider(props) {
  return (
    <BoardProvider>
      <ImportProvider>
        <PenyambungKonteks>{props.children}</PenyambungKonteks>
      </ImportProvider>
    </BoardProvider>
  );
}

export default AnalyzeContextProvider;
