/* Port dari Brilliant-Chess (MIT, © 2025 Delo) — jangan sunting massal tanpa cek README. */
import { capitalizeFirst } from "../menu/analyze/selectChessComData.js";
import { ConfigContext, defaultUsedRatings, boardThemes, bacaTeks, tulis } from "../../../../modul/sesi/preferensi.js";
import { memo, useContext, useEffect } from "react";
import { useI18n } from "../../../../lib/i18n.jsx";
import { QUEEN, WHITE } from "chess.js";
import PieceSVG from "../svg/piece.jsx";
import RatingSVG from "../svg/rating.jsx";
import SakelarPengaturan from "./sakelarPengaturan.jsx";
import BarisPengaturan from "./barisPengaturan.jsx";
import PilihRingkas from "./pilihRingkas.jsx";

// Fallback konteks beridentitas stabil (memo) bila provider lama tanpa evalDisplay.
const BAWAAN_EVAL = ["cp", () => {}];
const BAWAAN_TABLEBASE = [false, () => {}];
const ratings = [
  "brilliant",
  "great",
  "best",
  "critical",
  "excellent",
  "good",
  "book",
  "inaccuracy",
  "mistake",
  "miss",
  "blunder",
  "forced"
];
export { ratings as daftarRating };
function serializeRatings(usedRatings2) {
  const serializedRatings = [];
  for (const rating of ratings) {
    if (usedRatings2[rating]) serializedRatings.push(1);
    else serializedRatings.push(0);
  }
  return serializedRatings.join("");
}
function unserializeRatings(serializedUsedRatings) {
  const unserializedRatings = { ...defaultUsedRatings };
  const serializedRatings = serializedUsedRatings.split("").map(Number);
  if (serializedRatings.length !== ratings.length) throw new Error("Invalid serialized ratings");
  for (const [i, rating] of ratings.entries()) {
    if (isNaN(serializedRatings[i])) throw new Error("Invalid serialized ratings");
    if (serializedRatings[i]) unserializedRatings[rating] = true;
    else unserializedRatings[rating] = false;
  }
  return unserializedRatings;
}
const IsiRatings = memo(function IsiRatings({ usedRatings2, setUsedRatings, boardTheme, highlightByRating, setHighlightByRating, evalDisplay, setEvalDisplay, tablebase, setTablebase, cocok = () => true, deskripsi = () => null }) {
  const { t } = useI18n();
  useEffect(() => {
    const serializedUsedRatings = bacaTeks("usedRatings");
    if (!serializedUsedRatings) return;
    try {
      const usedRatings3 = unserializeRatings(serializedUsedRatings);
      setUsedRatings(usedRatings3);
    } catch (error) {
      console.error("Gagal membaca pengaturan penilaian:", error);
      tulis("usedRatings", serializeRatings(defaultUsedRatings));
      setUsedRatings(defaultUsedRatings);
    }
  }, [setUsedRatings]);
  useEffect(() => {
    const highlightByRating2 = bacaTeks("highlightByRating");
    if (!highlightByRating2) return;
    const numberHighlightByRating = Number(highlightByRating2);
    if (!isNaN(numberHighlightByRating)) {
      setHighlightByRating(Boolean(numberHighlightByRating));
    } else {
      tulis("highlightByRating", "1");
      setHighlightByRating(true);
    }
  }, [setHighlightByRating]);
  function toggleHighlightByRating() {
    const newHighlightByRating = !highlightByRating;
    tulis("highlightByRating", String(Number(newHighlightByRating)));
    setHighlightByRating(newHighlightByRating);
  }
  function changeEvalDisplay(id) {
    const sah = id === "wdl" ? "wdl" : "cp";
    setEvalDisplay(sah);
    tulis("evalDisplay", sah);
  }
  function toggleTablebase() {
    const baru = !tablebase;
    setTablebase(baru);
    tulis("tablebase", String(Number(baru)));
  }
  const labelTablebase = t("analisa.pengaturan.tablebase");
  const labelFormat = t("analisa.pengaturan.formatSkor");
  const labelSorot = t("analisa.pengaturan.sorotLabel");
  return <section>
    {cocok("formatSkor", labelFormat) ? <BarisPengaturan
      judul={<span className="text-[13.5px] font-medium text-foreground">{labelFormat}</span>}
      deskripsi={deskripsi("formatSkor")}
    >
      <PilihRingkas nilai={evalDisplay} onChange={changeEvalDisplay} ariaLabel={labelFormat} lebar="w-[150px]" pilihan={[{ id: "cp", label: t("analisa.pengaturan.opsiEval.cp") }, { id: "wdl", label: t("analisa.pengaturan.opsiEval.wdl") }]} />
    </BarisPengaturan> : null}
            {cocok("tablebase", labelTablebase) ? <BarisPengaturan
      judul={<span className="text-[13.5px] font-medium text-foreground">{labelTablebase}</span>}
      deskripsi={deskripsi("tablebase")}
    >
      <SakelarPengaturan checked={tablebase} onCheckedChange={toggleTablebase} aria-label={labelTablebase} />
    </BarisPengaturan> : null}
    {cocok("sorotLabel", labelSorot) ? <BarisPengaturan
      judul={<button onClick={toggleHighlightByRating} type="button" className="flex flex-1 flex-row gap-2 items-center text-left font-medium text-foreground">
        <div className="grid grid-cols-2 w-fit">
          {Array.from({ length: 4 }).map((_, i) => {
            const isEvenCol = i % 2 === 0;
            const isEvenRow = Math.floor(i / 2) % 2 === 0;
            const squareColor = isEvenCol ? isEvenRow ? boardThemes[boardTheme].white : boardThemes[boardTheme].black : isEvenRow ? boardThemes[boardTheme].black : boardThemes[boardTheme].white;
            return <div key={i} style={{ backgroundColor: squareColor }} className="h-5 w-5 relative">
              {i === 2 || i === 3 ? <div className="w-full h-full absolute top-0 left-0 opacity-50" style={{ backgroundColor: highlightByRating ? "var(--highlightGreat)" : boardThemes[boardTheme].highlight }} /> : null}
              {i === 3 ? <>
                <PieceSVG className="absolute z-10 top-0 left-0" piece={QUEEN} size={20} color={WHITE} />
                <RatingSVG rating="great" size={12} className="absolute top-0 right-0 translate-x-1/2 translate-y-[-50%]" />
              </> : null}
            </div>;
          })}
        </div>
        <span className="text-[13.5px]">{labelSorot}</span>
      </button>}
      deskripsi={deskripsi("sorotLabel")}
    >
      <SakelarPengaturan checked={highlightByRating} onCheckedChange={toggleHighlightByRating} aria-label={labelSorot} />
    </BarisPengaturan> : null}
    {ratings.filter((rating) => rating !== "critical").map((rating, i) => {
    const label = capitalizeFirst(rating);
    if (!cocok(`rating.${rating}`, label)) return null;
    function toggleRating() {
      const baru = !usedRatings2[rating];
      const newUsedRatings = {
        ...usedRatings2,
        [rating]: baru,
        // `critical` tampil sebagai `best`, jadi saklarnya ikut — tidak ada
        // pengaturan terpisah untuk label yang tidak punya ikon sendiri.
        ...(rating === "best" ? { critical: baru } : {})
      };
      setUsedRatings(newUsedRatings);
      tulis("usedRatings", serializeRatings(newUsedRatings));
    }
    return <BarisPengaturan
      key={i}
      judul={<button onClick={toggleRating} type="button" className="flex flex-1 flex-row gap-2 items-center text-left font-medium text-foreground">
        <RatingSVG rating={rating} size={35} className="w-[40px] h-[40px] flex justify-center items-center" />
        <span className="text-[13.5px]">{label}</span>
      </button>}
      deskripsi={deskripsi("labelPenilaian")}
    >
      <SakelarPengaturan checked={usedRatings2[rating]} onCheckedChange={toggleRating} aria-label={label} />
    </BarisPengaturan>;
  })}
        </section>;
});

function Ratings({ cocok, deskripsi }) {
  const config = useContext(ConfigContext);
  const [usedRatings2, setUsedRatings] = config.usedRatings;
  const [boardTheme] = config.boardTheme;
  const [highlightByRating, setHighlightByRating] = config.highlightByRating;
  const [evalDisplay, setEvalDisplay] = config.evalDisplay ?? BAWAAN_EVAL;
  const [tablebase, setTablebase] = config.tablebase ?? BAWAAN_TABLEBASE;
  return <IsiRatings usedRatings2={usedRatings2} setUsedRatings={setUsedRatings} boardTheme={boardTheme} highlightByRating={highlightByRating} setHighlightByRating={setHighlightByRating} evalDisplay={evalDisplay} setEvalDisplay={setEvalDisplay} tablebase={tablebase} setTablebase={setTablebase} cocok={cocok} deskripsi={deskripsi} />;
}
export default memo(Ratings);
