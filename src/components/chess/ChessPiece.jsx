import PieceSVG from "../../halaman/Analisa/komponen/svg/piece.jsx";

/** Bidak tertangkap memakai set yang sama dengan papan (bawaan Cburnett CC-BY-SA). */
export function ChessPiece({ piece, className = "w-full h-full", set }) {
  if (!piece) return null;
  const color = piece === piece.toUpperCase() ? "w" : "b";
  return <PieceSVG piece={piece.toLowerCase()} color={color} size={45} set={set} className={`${className} [&>svg]:h-full [&>svg]:w-full [&>img]:h-full [&>img]:w-full`} />;
}
