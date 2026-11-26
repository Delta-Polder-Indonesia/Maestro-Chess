/* Port dari Brilliant-Chess (MIT, © 2025 Delo) — jangan sunting massal tanpa cek README. */
import { ConfigContext, boardThemes, bacaTeks, tulis } from "../../../../modul/sesi/preferensi.js";
import { memo, useContext, useEffect } from "react";
import { Arrow } from "../game/board.jsx";
import PieceSVG from "../svg/piece.jsx";
import { QUEEN, WHITE } from "chess.js";
import { useI18n } from "../../../../lib/i18n.jsx";
import SakelarPengaturan from "./sakelarPengaturan.jsx";
import BarisPengaturan from "./barisPengaturan.jsx";
// Fallback konteks beridentitas stabil agar memo IsiBestMoves tidak bocor.
const SETTER_KOSONG = () => {};
const BAWAAN_HAPUS_PANAH = [true, SETTER_KOSONG];
const IsiBestMoves = memo(function IsiBestMoves({ boardTheme, showArrows, setShowArrows, arrowAfterMove, setArrowAfterMove, eraseArrowsOnClick, setEraseArrowsOnClick, cocok = () => true, deskripsi = () => null }) {
  const { t } = useI18n();
  useEffect(() => {
    const showArrows2 = bacaTeks("showArrows");
    if (!showArrows2) return;
    const numberShowArrows = Number(showArrows2);
    if (!isNaN(numberShowArrows)) {
      setShowArrows(Boolean(numberShowArrows));
    } else {
      tulis("showArrows", "1");
      setShowArrows(true);
    }
  }, [setShowArrows]);
  function toggleShowArrows() {
    const newShowArrows = !showArrows;
    tulis("showArrows", String(Number(newShowArrows)));
    setShowArrows(newShowArrows);
  }
  useEffect(() => {
    const arrowAfterMove2 = bacaTeks("arrowAfterMove");
    if (!arrowAfterMove2) return;
    const numberArrowAfterMove = Number(arrowAfterMove2);
    if (!isNaN(numberArrowAfterMove)) {
      setArrowAfterMove(Boolean(numberArrowAfterMove));
    } else {
      tulis("arrowAfterMove", "1");
      setArrowAfterMove(true);
    }
  }, [setArrowAfterMove]);
  function toggleArrowAfterMove() {
    const newArrowAfterMove = !arrowAfterMove;
    tulis("arrowAfterMove", String(Number(newArrowAfterMove)));
    setArrowAfterMove(newArrowAfterMove);
  }
  // Tier 1 adopsi En Croissant: klik kiri menghapus panah/coretan bila aktif.
  function toggleEraseArrowsOnClick() {
    const baru = !eraseArrowsOnClick;
    tulis("eraseArrowsOnClick", String(Number(baru)));
    setEraseArrowsOnClick(baru);
  }
  const labelPanah = t("analisa.pengaturan.tampilPanah");
  const labelSetelah = t("analisa.pengaturan.panahSetelahLangkah");
  const labelHapusPanah = t("analisa.pengaturan.hapusPanahKlik");
  return <section>
            {cocok("tampilPanah", labelPanah) ? <BarisPengaturan
      judul={<button onClick={toggleShowArrows} type="button" className="flex flex-1 flex-row gap-2 items-center text-left font-medium text-foreground">
        <div className="grid grid-cols-2 w-fit relative">
          {Array.from({ length: 4 }).map((_, i) => {
            const isEvenCol = i % 2 === 0;
            const isEvenRow = Math.floor(i / 2) % 2 === 0;
            const squareColor = isEvenCol ? isEvenRow ? boardThemes[boardTheme].white : boardThemes[boardTheme].black : isEvenRow ? boardThemes[boardTheme].black : boardThemes[boardTheme].white;
            return <div key={i} style={{ backgroundColor: squareColor }} className="h-5 w-5 relative">
              {i === 2 ? <PieceSVG className="absolute z-10 top-0 left-0" piece={QUEEN} size={20} color={WHITE} /> : null}
            </div>;
          })}
          {showArrows ? <Arrow move={[{ col: 0, row: 1 }, { col: 1, row: 1 }]} squareSize={20} white class="fill-bestArrow stroke-bestArrow" /> : null}
        </div>
        <span className="text-[13.5px]">{labelPanah}</span>
      </button>}
      deskripsi={deskripsi("tampilPanah")}
    >
      <SakelarPengaturan checked={showArrows} onCheckedChange={toggleShowArrows} aria-label={labelPanah} />
    </BarisPengaturan> : null}
    {cocok("panahSetelahLangkah", labelSetelah) ? <BarisPengaturan
      judul={<button onClick={toggleArrowAfterMove} type="button" className="flex flex-1 flex-row gap-2 items-center text-left font-medium text-foreground">
        <div className="grid grid-cols-2 w-fit relative">
          {Array.from({ length: 4 }).map((_, i) => {
            const isEvenCol = i % 2 === 0;
            const isEvenRow = Math.floor(i / 2) % 2 === 0;
            const squareColor = isEvenCol ? isEvenRow ? boardThemes[boardTheme].white : boardThemes[boardTheme].black : isEvenRow ? boardThemes[boardTheme].black : boardThemes[boardTheme].white;
            return <div key={i} style={{ backgroundColor: squareColor }} className="h-5 w-5 relative">
              {(i === 2 || i === 3) && arrowAfterMove ? <div className="w-full h-full absolute top-0 left-0 opacity-50" style={{ backgroundColor: "var(--highlightBoard)" }} /> : null}
              {i === 2 && !arrowAfterMove || i === 3 && arrowAfterMove ? <PieceSVG className="absolute z-10 top-0 left-0" piece={QUEEN} size={20} color={WHITE} /> : null}
              {(i === 2 || i === 3) && arrowAfterMove ? <div className="w-full h-full opacity-50 absolute top-0 left-0" style={{ backgroundColor: boardThemes[boardTheme].highlight }} /> : null}
            </div>;
          })}
          <Arrow move={[{ col: 0, row: 1 }, { col: 1, row: 1 }]} squareSize={20} white class="fill-bestArrow stroke-bestArrow" />
        </div>
        <span className="text-[13.5px]">{labelSetelah}</span>
      </button>}
      deskripsi={deskripsi("panahSetelahLangkah")}
    >
      <SakelarPengaturan checked={arrowAfterMove} onCheckedChange={toggleArrowAfterMove} aria-label={labelSetelah} />
    </BarisPengaturan> : null}
    {cocok("hapusPanahKlik", labelHapusPanah) ? <BarisPengaturan
      judul={<span className="text-[13.5px] font-medium text-foreground">{labelHapusPanah}</span>}
      deskripsi={deskripsi("hapusPanahKlik")}
    >
      <SakelarPengaturan checked={eraseArrowsOnClick} onCheckedChange={toggleEraseArrowsOnClick} aria-label={labelHapusPanah} />
    </BarisPengaturan> : null}
        </section>;
});

function BestMoves({ cocok, deskripsi }) {
  const config = useContext(ConfigContext);
  const [boardTheme] = config.boardTheme;
  const [showArrows, setShowArrows] = config.showArrows;
  const [arrowAfterMove, setArrowAfterMove] = config.arrowAfterMove;
  const [eraseArrowsOnClick, setEraseArrowsOnClick] = config.eraseArrowsOnClick ?? BAWAAN_HAPUS_PANAH;
  return <IsiBestMoves boardTheme={boardTheme} showArrows={showArrows} setShowArrows={setShowArrows} arrowAfterMove={arrowAfterMove} setArrowAfterMove={setArrowAfterMove} eraseArrowsOnClick={eraseArrowsOnClick} setEraseArrowsOnClick={setEraseArrowsOnClick} cocok={cocok} deskripsi={deskripsi} />;
}
export default memo(BestMoves);
