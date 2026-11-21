import PieceSVG from "../../halaman/Analisa/komponen/svg/piece.jsx";

/** Captured pieces use the same CC-BY-SA Cburnett artwork as the board. */
export function ChessPiece({ piece, className = "w-full h-full" }) {
  if (!piece) return null;
  const color = piece === piece.toUpperCase() ? "w" : "b";
  return <PieceSVG piece={piece.toLowerCase()} color={color} size={45} className={`${className} [&>svg]:h-full [&>svg]:w-full`} />;
}
