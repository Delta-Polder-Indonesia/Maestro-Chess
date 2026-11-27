/**
 * Papan teka-teki: memakai ulang komponen papan Analisa (tidak diduplikasi).
 * Papan memanggil `analyzeMove(fen, langkah)` saat bidak dilepas — di sini
 * diteruskan ke sesi teka-teki untuk dinilai terhadap solusi.
 *
 * Orientasi mengikuti pihak pemain (kebalikan giliran FEN soal), sama seperti
 * PuzzleBoard En Croissant. Petunjuk ditampilkan sebagai sorotan petak lalu
 * panah, memakai kosakata panah papan yang sudah ada.
 */
import { useCallback, useMemo, useState } from "react";
import Board from "../../Analisa/komponen/game/board.jsx";
import { formatSquare } from "../../Analisa/mesin/engine.js";

const noop = () => {};

export default function PapanTekaTeki({ fen, pihak, ukuran, onLangkah, petunjuk, t, terkunci }) {
  const [drag, setDrag] = useState({ is: false, id: "" });
  const [panahGambar, setPanahGambar] = useState([]);

  const panahPetunjuk = useMemo(() => {
    if (petunjuk?.panah) return [[formatSquare(petunjuk.panah.from), formatSquare(petunjuk.panah.to)]];
    if (petunjuk?.petak) { const kotak = formatSquare(petunjuk.petak); return [[kotak, kotak]]; }
    return [];
  }, [petunjuk]);

  const arrows = useMemo(() => [...panahGambar, ...panahPetunjuk], [panahGambar, panahPetunjuk]);
  const pushArrow = useCallback((panah) => setPanahGambar((lama) => [...lama, panah]), []);
  const cleanArrows = useCallback(() => setPanahGambar([]), []);
  const analyzeMove = useCallback((_fen, langkah) => { if (!terkunci) onLangkah(langkah); }, [onLangkah, terkunci]);

  if (!fen) {
    return <div style={{ width: ukuran, height: ukuran }} className="animate-pulse rounded-[3px] bg-backgroundBox ring-1 ring-black/10" aria-hidden="true" />;
  }
  return (
    <Board
      t={t}
      fen={fen}
      white={pihak === "w"}
      boardSize={ukuran}
      forward
      drag={drag}
      setDrag={setDrag}
      arrows={arrows}
      pushArrow={pushArrow}
      cleanArrows={cleanArrows}
      analyzeMove={analyzeMove}
      analyzingMove={terkunci}
      setPlaying={noop}
      setMaterialAdvantage={noop}
      setAnimation={noop}
      animation={false}
      gameEnded={terkunci}
      move={[]}
      nextMove={[]}
    />
  );
}
