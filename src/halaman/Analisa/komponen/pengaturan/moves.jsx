/* Port dari Brilliant-Chess (MIT, © 2025 Delo) — jangan sunting massal tanpa cek README. */
import { ConfigContext, boardThemes, bacaTeks, tulis } from "../../../../modul/sesi/preferensi.js";
import { memo, useContext, useEffect, useState } from "react";
import { BISHOP, ROOK, WHITE } from "chess.js";
import PieceSVG from "../svg/piece.jsx";
import SoundMax from "../svg/soundMax.jsx";
import SoundMute from "../svg/sound-mute.jsx";
import { useI18n } from "../../../../lib/i18n.jsx";
import SakelarPengaturan from "./sakelarPengaturan.jsx";
import BarisPengaturan from "./barisPengaturan.jsx";
const IsiMoves = memo(function IsiMoves({ aktif, boardTheme, showLegalMoves, setShowLegalMoves, animateMoves, setAnimateMoves, boardSounds, setBoardSounds, cocok = () => true, deskripsi = () => null }) {
  const { t } = useI18n();
  const [animateMovesMoved, setAnimateMovesMoved] = useState(false);
  useEffect(() => {
    // Panel yang tersembunyi tetap terpasang, tetapi animasinya tidak perlu
    // berjalan di belakang tab lain.
    if (!aktif) return undefined;
    const interval = setInterval(() => {
      setAnimateMovesMoved((prev) => !prev);
    }, 2e3);
    return () => clearInterval(interval);
  }, [aktif]);
  useEffect(() => {
    const showLegalMoves2 = bacaTeks("showLegalMoves");
    if (!showLegalMoves2) return;
    const numberShowLegalMoves = Number(showLegalMoves2);
    if (!isNaN(numberShowLegalMoves)) {
      setShowLegalMoves(Boolean(numberShowLegalMoves));
    } else {
      tulis("showLegalMoves", "1");
      setShowLegalMoves(true);
    }
  }, [setShowLegalMoves]);
  function toggleShowLegalMoves() {
    const newShowLegalMoves = !showLegalMoves;
    tulis("showLegalMoves", String(Number(newShowLegalMoves)));
    setShowLegalMoves(newShowLegalMoves);
  }
  useEffect(() => {
    const animateMoves2 = bacaTeks("animateMoves");
    if (!animateMoves2) return;
    const numberAnimateMoves = Number(animateMoves2);
    if (!isNaN(numberAnimateMoves)) {
      setAnimateMoves(Boolean(numberAnimateMoves));
    } else {
      tulis("animateMoves", "1");
      setAnimateMoves(true);
    }
  }, [setAnimateMoves]);
  function toggleAnimateMoves() {
    const newAnimateMoves = !animateMoves;
    tulis("animateMoves", String(Number(newAnimateMoves)));
    setAnimateMoves(newAnimateMoves);
  }
  useEffect(() => {
    const boardSounds2 = bacaTeks("boardSounds");
    if (!boardSounds2) return;
    const numberBoardSounds = Number(boardSounds2);
    if (!isNaN(numberBoardSounds)) {
      setBoardSounds(Boolean(numberBoardSounds));
    } else {
      tulis("boardSounds", "1");
      setBoardSounds(true);
    }
  }, [setBoardSounds]);
  function toggleBoardSounds() {
    const newBoardSounds = !boardSounds;
    tulis("boardSounds", String(Number(newBoardSounds)));
    setBoardSounds(newBoardSounds);
  }
  const labelLegal = t("analisa.pengaturan.langkahLegal");
  const labelAnimasi = t("analisa.pengaturan.animasi");
  const labelSuara = t("analisa.pengaturan.suara");
  return <section>
            {cocok("langkahLegal", labelLegal) ? <BarisPengaturan
      judul={<button onClick={toggleShowLegalMoves} type="button" className="flex flex-1 flex-row gap-2 items-center text-left font-medium text-foreground">
        <div className="grid grid-cols-2 w-fit">
          {Array.from({ length: 4 }).map((_, i) => {
            const isEvenCol = i % 2 === 0;
            const isEvenRow = Math.floor(i / 2) % 2 === 0;
            const squareColor = isEvenCol ? isEvenRow ? boardThemes[boardTheme].white : boardThemes[boardTheme].black : isEvenRow ? boardThemes[boardTheme].black : boardThemes[boardTheme].white;
            return <div key={i} style={{ backgroundColor: squareColor }} className="h-5 w-5 relative">
              {i === 2 ? <>
                <PieceSVG className="absolute z-10 top-0 left-0" piece={BISHOP} size={20} color={WHITE} />
                <div className="w-full h-full opacity-50 absolute top-0 left-0" style={{ backgroundColor: boardThemes[boardTheme].highlight }} />
              </> : null}
              {i === 1 && showLegalMoves ? <div className="absolute w-full h-full top-0 left-0 flex justify-center items-center pointer-events-auto"><div className="bg-black opacity-[25%] w-[30%] h-[30%] rounded-full" /></div> : null}
            </div>;
          })}
        </div>
        <span className="text-[13.5px]">{labelLegal}</span>
      </button>}
      deskripsi={deskripsi("langkahLegal")}
    >
      <SakelarPengaturan checked={showLegalMoves} onCheckedChange={toggleShowLegalMoves} aria-label={labelLegal} />
    </BarisPengaturan> : null}
    {cocok("animasi", labelAnimasi) ? <BarisPengaturan
      judul={<button onClick={toggleAnimateMoves} type="button" className="flex flex-1 flex-row gap-2 items-center text-left font-medium text-foreground">
        <div className="grid grid-cols-2 w-fit">
          {Array.from({ length: 4 }).map((_, i) => {
            const isEvenCol = i % 2 === 0;
            const isEvenRow = Math.floor(i / 2) % 2 === 0;
            const squareColor = isEvenCol ? isEvenRow ? boardThemes[boardTheme].white : boardThemes[boardTheme].black : isEvenRow ? boardThemes[boardTheme].black : boardThemes[boardTheme].white;
            return <div key={i} style={{ backgroundColor: squareColor }} className="h-5 w-5 relative">
              {i === 2 ? <>
                <PieceSVG style={{ transform: animateMovesMoved ? "translateX(20px)" : "", transition: animateMoves ? "150ms" : "", transitionTimingFunction: animateMoves ? "linear" : "" }} className="absolute z-10 top-0 left-0" piece={ROOK} size={20} color={WHITE} />
                <div className="w-full h-full opacity-50 absolute top-0 left-0" style={{ backgroundColor: boardThemes[boardTheme].highlight }} />
              </> : null}
              {i === 3 ? <div className="w-full h-full opacity-50 absolute top-0 left-0" style={{ backgroundColor: boardThemes[boardTheme].highlight }} /> : null}
            </div>;
          })}
        </div>
        <span className="text-[13.5px]">{labelAnimasi}</span>
      </button>}
      deskripsi={deskripsi("animasi")}
    >
      <SakelarPengaturan checked={animateMoves} onCheckedChange={toggleAnimateMoves} aria-label={labelAnimasi} />
    </BarisPengaturan> : null}
    {cocok("suara", labelSuara) ? <BarisPengaturan
      judul={<button onClick={toggleBoardSounds} type="button" className="flex flex-1 flex-row gap-2 items-center text-left font-medium text-foreground">
        <div className="w-[40px] h-[40px] flex justify-center items-center">
          <SoundMax display={boardSounds} size={35} />
          <SoundMute display={!boardSounds} size={35} />
        </div>
        <span className="text-[13.5px]">{labelSuara}</span>
      </button>}
      deskripsi={deskripsi("suara")}
    >
      <SakelarPengaturan checked={boardSounds} onCheckedChange={toggleBoardSounds} aria-label={labelSuara} />
    </BarisPengaturan> : null}
          </section>;
});

function Moves({ aktif = true, cocok, deskripsi }) {
  const config = useContext(ConfigContext);
  const [boardTheme] = config.boardTheme;
  const [showLegalMoves, setShowLegalMoves] = config.showLegalMoves;
  const [animateMoves, setAnimateMoves] = config.animateMoves;
  const [boardSounds, setBoardSounds] = config.boardSounds;
  return <IsiMoves aktif={aktif} boardTheme={boardTheme} showLegalMoves={showLegalMoves} setShowLegalMoves={setShowLegalMoves} animateMoves={animateMoves} setAnimateMoves={setAnimateMoves} boardSounds={boardSounds} setBoardSounds={setBoardSounds} cocok={cocok} deskripsi={deskripsi} />;
}
export default memo(Moves);
