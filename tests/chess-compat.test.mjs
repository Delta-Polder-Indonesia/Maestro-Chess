import assert from "node:assert/strict";
import test from "node:test";
import { BLACK, BISHOP, Chess, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE } from "chess.js";

test("chess.js exposes the piece and color constants used by the board", () => {
  assert.deepEqual([WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING], ["w", "b", "p", "n", "b", "r", "q", "k"]);
});

test("PGN metadata and verbose move history remain compatible", () => {
  const game = new Chess();
  game.loadPgn('[White "Alice"]\n[Black "Bob"]\n[WhiteElo "1234"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 1-0');
  assert.deepEqual(game.header(), { White: "Alice", Black: "Bob", WhiteElo: "1234", Result: "1-0" });
  const history = game.history({ verbose: true });
  assert.deepEqual(history.map((move) => move.san), ["e4", "e5", "Nf3", "Nc6"]);
  assert.equal(history[0].before, new Chess().fen());
  assert.equal(history[0].after, history[1].before);
  assert.equal(history.at(-1).after, game.fen());

  const withoutHeaders = new Chess();
  withoutHeaders.loadPgn("1. e4 e5 1-0");
  assert.deepEqual(withoutHeaders.header(), {});
  assert.throws(() => new Chess().loadPgn("not a PGN"));
});

test("FEN, attackers, captures, castling, en passant and promotion remain compatible", () => {
  const game = new Chess();
  game.move("e4");
  game.move("d5");
  assert.deepEqual(game.attackers("d5", WHITE), ["e4"]);
  const beforeCapture = game.fen();
  const capture = game.move("exd5");
  assert.equal(capture.before, beforeCapture);
  assert.equal(capture.after, game.fen());
  assert.equal(capture.captured, PAWN);
  assert.deepEqual(game.get("d5"), { type: PAWN, color: WHITE });
  assert.equal(game.board().length, 8);

  const castle = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  assert.equal(castle.move("O-O").san, "O-O");
  assert.deepEqual(castle.get("g1"), { type: KING, color: WHITE });
  assert.deepEqual(castle.get("f1"), { type: ROOK, color: WHITE });

  const enPassant = new Chess("rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3");
  assert.equal(enPassant.move("exd6").captured, PAWN);
  assert.equal(enPassant.get("d5"), undefined);
  assert.deepEqual(enPassant.get("d6"), { type: PAWN, color: WHITE });

  const promotion = new Chess("7k/P7/8/8/8/8/8/K7 w - - 0 1");
  assert.equal(promotion.move({ from: "a7", to: "a8", promotion: QUEEN }).promotion, QUEEN);
  assert.deepEqual(promotion.get("a8"), { type: QUEEN, color: WHITE });
  assert.throws(() => new Chess("not a FEN"));
});

test("checkmate and stalemate detection remain compatible", () => {
  const mate = new Chess();
  for (const move of ["f3", "e5", "g4", "Qh4#"]) mate.move(move);
  assert.equal(mate.isCheck(), true);
  assert.equal(mate.isCheckmate(), true);
  assert.equal(mate.isGameOver(), true);
  assert.equal(mate.isDraw(), false);

  const stalemate = new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
  assert.equal(stalemate.isDraw(), true);
  assert.equal(stalemate.isGameOver(), true);
  assert.equal(stalemate.isCheckmate(), false);
});
