import { tokenHasilPgn } from "./pgnRingan.js";

/** Hasil belum selesai atau tidak tersedia bukan otomatis seri. */
export function normalisasiHasil(hasil) {
  const h = String(hasil ?? "").trim().toLowerCase();
  if (h === "1-0" || h === "white") return "white";
  if (h === "0-1" || h === "black") return "black";
  if (h === "1/2-1/2" || h === "½-½" || h === "draw") return "draw";
  return "unknown";
}

export function hasilDariPgn(pgn) {
  return normalisasiHasil(tokenHasilPgn(pgn));
}

const HASIL_SERI_CHESS_COM = new Set([
  "draw", "agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient",
]);

/** Metadata pemenang/seri dari API, dengan hasil PGN sebagai cadangan. */
export function hasilChessCom(game) {
  if (game?.white?.result === "win") return "white";
  if (game?.black?.result === "win") return "black";
  const dariPgn = hasilDariPgn(game?.pgn);
  if (dariPgn !== "unknown") return dariPgn;
  if ([game?.white?.result, game?.black?.result].some((h) => HASIL_SERI_CHESS_COM.has(h))) return "draw";
  return "unknown";
}

export function hasilLichess(game) {
  if (game?.winner === "white" || game?.winner === "black") return game.winner;
  const dariPgn = hasilDariPgn(game?.pgn);
  if (dariPgn !== "unknown") return dariPgn;
  if (game?.status === "draw" || game?.status === "stalemate") return "draw";
  return "unknown";
}
