/** PGN soal untuk dikirim ke papan Analisa (tombol "Analisa posisi ini"). */
import { Chess } from "chess.js";

export default function pgnDariSoal(soal) {
  if (!soal) return "";
  try {
    const papan = new Chess(soal.fen);
    papan.header("Event", "Teka-teki", "FEN", soal.fen, "SetUp", "1");
    for (const langkah of soal.langkah) papan.move({ from: langkah.from, to: langkah.to, promotion: langkah.promotion });
    return papan.pgn();
  } catch {
    return "";
  }
}
