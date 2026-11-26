/**
 * Pratinjau papan saat hover langkah (adopsi En Croissant AnalysisRow:
 * papan mini view-only 200px yang melayang di dekat baris langkah).
 *
 * Murni presentasional: menerima FEN posisi setelah langkah, pasangan
 * kotak langkah terakhir, orientasi papan, set bidak, dan warna tema dari
 * pemanggil (moves.jsx) — tidak berlangganan konteks apa pun sehingga
 * mudah diuji dan tidak menambah render papan utama.
 *
 * Dirender lewat portal ke document.body agar tidak terpotong overflow
 * panel langkah; pointer-events none supaya tidak mengganggu hover baris.
 */
import { createPortal } from "react-dom";
import { Chess } from "chess.js";
import { urlBidak } from "../../../pengaturan/setBidak.js";

const UKURAN = 200;
const KOTAK = UKURAN / 8;

/**
 * Papan mini untuk satu posisi. `movement` adalah pasangan {col,row}
 * (row 0 = rank 1, sama seperti formatSquare papan utama); `putih` adalah
 * orientasi papan utama. `top`/`left` adalah koordinat viewport baris yang
 * di-hover — pratinjau ditaruh di kiri baris dan dijepit ke tepi layar.
 */
export default function PratinjauPapan({ fen, movement, putih = true, pieceSet = "cburnett", tema, top = 0, left = 0 }) {
  if (typeof document === "undefined" || !fen) return null;
  let papan;
  try {
    papan = new Chess(fen).board();
  } catch {
    return null;
  }
  const sorot = new Set();
  if (Array.isArray(movement)) {
    for (const kotak of movement) {
      if (!kotak || typeof kotak.col !== "number" || typeof kotak.row !== "number") continue;
      const dr = putih ? 7 - kotak.row : kotak.row;
      const dc = putih ? kotak.col : 7 - kotak.col;
      sorot.add(`${dr}-${dc}`);
    }
  }
  const kiri = Math.max(8, left - UKURAN - 8);
  const atas = Math.max(8, Math.min(top, (window.innerHeight || UKURAN + 16) - UKURAN - 8));
  const warnaPutih = tema?.white ?? "#ebecd0";
  const warnaHitam = tema?.black ?? "#779556";
  const warnaSorot = tema?.highlight ?? "#ffff33";
  return createPortal(
    <div
      aria-hidden="true"
      data-pratinjau-papan="1"
      className="pointer-events-none fixed z-[100] overflow-hidden rounded-[3px] shadow-lg ring-1 ring-black/40"
      style={{ top: atas, left: kiri, width: UKURAN, height: UKURAN }}
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(8, ${KOTAK}px)` }}>
        {Array.from({ length: 64 }).map((_, i) => {
          const dr = Math.floor(i / 8);
          const dc = i % 8;
          const barisPapan = putih ? dr : 7 - dr;
          const kolomPapan = putih ? dc : 7 - dc;
          const bidak = papan[barisPapan]?.[kolomPapan];
          const terang = (dr + dc) % 2 === 0;
          const disorot = sorot.has(`${dr}-${dc}`);
          const karakter = bidak ? (bidak.color === "w" ? bidak.type.toUpperCase() : bidak.type) : null;
          const src = karakter ? urlBidak(pieceSet, karakter) : null;
          return (
            <div
              key={i}
              data-kotak-pratinjau={`${dr}-${dc}`}
              className="relative"
              style={{ width: KOTAK, height: KOTAK, backgroundColor: terang ? warnaPutih : warnaHitam }}
            >
              {disorot ? <div className="absolute inset-0 opacity-50" style={{ backgroundColor: warnaSorot }} /> : null}
              {src ? <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" /> : null}
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
