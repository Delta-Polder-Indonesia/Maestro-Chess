import { Chess, WHITE } from "chess.js";

export function getMoves(game, moveNumber, customLine, returnedToNormalGame) {
  const previousMove = (() => {
    if (customLine.moveNumber === 0) {
      return game[moveNumber];
    }
    if (customLine.moveNumber > 0) {
      return customLine.moves[customLine.moveNumber - 1];
    }
    return game[moveNumber - 1];
  })();
  const move2 = (() => {
    if (customLine.moveNumber >= 0) {
      return customLine.moves[customLine.moveNumber];
    }
    return game[moveNumber];
  })();
  const nextMove = (() => {
    if (customLine.moveNumber >= 0) {
      return customLine.moves[customLine.moveNumber + 1];
    }
    // The first manual move is still the next position after rewinding a FEN
    // line. Keep its full FEN/capture/castle data for backward animation.
    if (game.length === 1 && customLine.moves.length > 0) {
      return customLine.moves[0];
    }
    if (returnedToNormalGame) {
      return { ...game[moveNumber], movement: returnedToNormalGame };
    }
    return game[moveNumber + 1];
  })();
  return { previousMove, move: move2, nextMove };
}

/** Bidak tertangkap pada posisi partai dan jalur kustom yang sedang terlihat. */
export function getCapturedPieces(game, moveNumber, customLine) {
  const captured = { white: [], black: [] };
  for (let i = 0; i <= moveNumber && i < game.length; i++) {
    const move = game[i];
    if (move.capture) captured[move.color === WHITE ? "black" : "white"].push(move.capture);
  }
  for (let i = 0; i <= customLine.moveNumber; i++) {
    const move = customLine.moves[i];
    if (move.capture) captured[move.color === WHITE ? "black" : "white"].push(move.capture);
  }
  return captured;
}

export function getArrows(arrows, moveNumber, customLine) {
  if (customLine.moveNumber < 0) {
    return arrows[moveNumber];
  }
  return customLine.arrows[customLine.moveNumber];
}

export function getCustomResult(move2) {
  if (!move2?.fen) return "";
  let chess;
  try {
    chess = new Chess(move2.fen);
  } catch (error) {
    console.error("Gagal membaca posisi untuk hasil papan:", error);
    return "";
  }
  const color = move2.color;
  if (chess.isCheckmate()) return color === WHITE ? "0-1" : "1-0";
  if (chess.isDraw()) return "1/2-1/2";
  return "";
}

export function formatPlayerLabel(player, fallbackName) {
  const name = String(player?.name ?? "").trim() || String(fallbackName ?? "");
  const elo = String(player?.elo ?? "").trim();
  return elo && elo !== "NOELO" ? `${name} (${elo})` : name;
}
