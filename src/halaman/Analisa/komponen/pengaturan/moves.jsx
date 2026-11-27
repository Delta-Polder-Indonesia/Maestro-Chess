/* Port dari Brilliant-Chess (MIT, © 2025 Delo) — jangan sunting massal tanpa cek README. */
import { ConfigContext, boardThemes, bacaTeks, tulis, DAFTAR_KOLEKSI_SUARA } from "../../../../modul/sesi/preferensi.js";
import { memo, useContext, useEffect, useState } from "react";
import { BISHOP, ROOK, WHITE } from "chess.js";
import PieceSVG from "../svg/piece.jsx";
import SoundMax from "../svg/soundMax.jsx";
import SoundMute from "../svg/sound-mute.jsx";
import { useI18n } from "../../../../lib/i18n.jsx";
import SakelarPengaturan from "./sakelarPengaturan.jsx";
import BarisPengaturan from "./barisPengaturan.jsx";
import PilihRingkas from "./pilihRingkas.jsx";
import GeserPengaturan from "./geserPengaturan.jsx";
// Fallback konteks beridentitas stabil agar memo IsiMoves tidak bocor saat
// konsumen ConfigContext lain berubah (lihat penjelasan di themes.jsx).
const SETTER_KOSONG = () => {};
const BAWAAN_SOROT_LANGKAH = [true, SETTER_KOSONG];
const BAWAAN_AUTO_PROMOSI = [false, SETTER_KOSONG];
const BAWAAN_VOLUME = [100, SETTER_KOSONG];
const BAWAAN_KECEPATAN = ["normal", SETTER_KOSONG];
const BAWAAN_MATERIAL = ["all", SETTER_KOSONG];
const BAWAAN_PRATINJAU = [false, SETTER_KOSONG];
const BAWAAN_GULIR = [false, SETTER_KOSONG];
const BAWAAN_KOLEKSI = ["standard", SETTER_KOSONG];
const OPSI_KECEPATAN = ["fast", "normal", "slow"];
const OPSI_MATERIAL = ["diff", "all", "none"];
const IsiMoves = memo(function IsiMoves({ aktif, boardTheme, showLegalMoves, setShowLegalMoves, animateMoves, setAnimateMoves, boardSounds, setBoardSounds, moveHighlight, setMoveHighlight, autoPromote, setAutoPromote, volume, setVolume, animationSpeed, setAnimationSpeed, materialDisplay, setMaterialDisplay, previewBoardOnHover, setPreviewBoardOnHover, boardScroll, setBoardScroll, soundCollection, setSoundCollection, cocok = () => true, deskripsi = () => null }) {
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
  // Tier 1 adopsi En Croissant: sorot langkah terakhir & auto-promosi menteri.
  // Provider sudah menginisialisasi dari penyimpanan; sakelar cukup menulis.
  function toggleMoveHighlight() {
    const baru = !moveHighlight;
    tulis("moveHighlight", String(Number(baru)));
    setMoveHighlight(baru);
  }
  function toggleAutoPromote() {
    const baru = !autoPromote;
    tulis("autoPromote", String(Number(baru)));
    setAutoPromote(baru);
  }
  // Tier 2: volume suara, kecepatan animasi, tampilan material.
  function changeVolume(nilai) {
    const angka = Math.min(100, Math.max(0, Math.round(Number(nilai) || 0)));
    setVolume(angka);
    tulis("volume", String(angka));
  }
  function changeAnimationSpeed(nilai) {
    const sah = OPSI_KECEPATAN.includes(nilai) ? nilai : "normal";
    setAnimationSpeed(sah);
    tulis("animationSpeed", sah);
  }
  function changeMaterialDisplay(nilai) {
    const sah = OPSI_MATERIAL.includes(nilai) ? nilai : "all";
    setMaterialDisplay(sah);
    tulis("materialDisplay", sah);
  }
  // Tier 3: pratinjau hover, gulir langkah, koleksi suara.
  function togglePratinjauHover() {
    const baru = !previewBoardOnHover;
    setPreviewBoardOnHover(baru);
    tulis("previewBoardOnHover", String(Number(baru)));
  }
  function toggleGulirLangkah() {
    const baru = !boardScroll;
    setBoardScroll(baru);
    tulis("boardScroll", String(Number(baru)));
  }
  function changeSoundCollection(nilai) {
    const sah = DAFTAR_KOLEKSI_SUARA.includes(nilai) ? nilai : "standard";
    setSoundCollection(sah);
    tulis("soundCollection", sah);
  }
  const labelLegal = t("analisa.pengaturan.langkahLegal");
  const labelAnimasi = t("analisa.pengaturan.animasi");
  const labelSuara = t("analisa.pengaturan.suara");
  const labelSorotLangkah = t("analisa.pengaturan.sorotLangkah");
  const labelAutoPromosi = t("analisa.pengaturan.autoPromosi");
  const labelVolume = t("analisa.pengaturan.volume");
  const labelKecepatan = t("analisa.pengaturan.kecepatanAnimasi");
  const labelMaterial = t("analisa.pengaturan.tampilanMaterial");
  const labelPratinjau = t("analisa.pengaturan.pratinjauHover");
  const labelGulir = t("analisa.pengaturan.gulirLangkah");
  const labelKoleksi = t("analisa.pengaturan.koleksiSuara");
  const pilihanKecepatan = OPSI_KECEPATAN.map((o) => ({ id: o, label: t(`analisa.pengaturan.kecepatan.${o === "fast" ? "cepat" : o === "normal" ? "normal" : "lambat"}`) }));
  const pilihanMaterial = OPSI_MATERIAL.map((o) => ({ id: o, label: t(`analisa.pengaturan.material.${o === "diff" ? "selisih" : o === "all" ? "semua" : "tanpa"}`) }));
  const pilihanKoleksi = DAFTAR_KOLEKSI_SUARA.map((o) => ({ id: o, label: t(`analisa.pengaturan.koleksi.${o}`) }));
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
    {cocok("sorotLangkah", labelSorotLangkah) ? <BarisPengaturan
      judul={<span className="text-[13.5px] font-medium text-foreground">{labelSorotLangkah}</span>}
      deskripsi={deskripsi("sorotLangkah")}
    >
      <SakelarPengaturan checked={moveHighlight} onCheckedChange={toggleMoveHighlight} aria-label={labelSorotLangkah} />
    </BarisPengaturan> : null}
    {cocok("autoPromosi", labelAutoPromosi) ? <BarisPengaturan
      judul={<span className="text-[13.5px] font-medium text-foreground">{labelAutoPromosi}</span>}
      deskripsi={deskripsi("autoPromosi")}
    >
      <SakelarPengaturan checked={autoPromote} onCheckedChange={toggleAutoPromote} aria-label={labelAutoPromosi} />
    </BarisPengaturan> : null}
    {cocok("volume", labelVolume) ? <BarisPengaturan
      judul={<span className="text-[13.5px] font-medium text-foreground">{labelVolume}</span>}
      deskripsi={deskripsi("volume")}
    >
      <GeserPengaturan nilai={volume} onChange={changeVolume} ariaLabel={labelVolume} satuan="%" labelNaik={t("analisa.pengaturan.naikkan")} labelTurun={t("analisa.pengaturan.turunkan")} hintSeret={t("analisa.pengaturan.seretNilai")} />
    </BarisPengaturan> : null}
    {cocok("koleksiSuara", labelKoleksi) ? <BarisPengaturan
      judul={<span className="text-[13.5px] font-medium text-foreground">{labelKoleksi}</span>}
      deskripsi={deskripsi("koleksiSuara")}
    >
      <PilihRingkas ariaLabel={labelKoleksi} lebar="w-[160px]" nilai={DAFTAR_KOLEKSI_SUARA.includes(soundCollection) ? soundCollection : "standard"} pilihan={pilihanKoleksi} onChange={changeSoundCollection} />
    </BarisPengaturan> : null}
    {cocok("kecepatanAnimasi", labelKecepatan) ? <BarisPengaturan
      judul={<span className="text-[13.5px] font-medium text-foreground">{labelKecepatan}</span>}
      deskripsi={deskripsi("kecepatanAnimasi")}
    >
      <PilihRingkas ariaLabel={labelKecepatan} lebar="w-[160px]" nilai={OPSI_KECEPATAN.includes(animationSpeed) ? animationSpeed : "normal"} pilihan={pilihanKecepatan} onChange={changeAnimationSpeed} />
    </BarisPengaturan> : null}
    {cocok("tampilanMaterial", labelMaterial) ? <BarisPengaturan
      judul={<span className="text-[13.5px] font-medium text-foreground">{labelMaterial}</span>}
      deskripsi={deskripsi("tampilanMaterial")}
    >
      <PilihRingkas ariaLabel={labelMaterial} lebar="w-[160px]" nilai={OPSI_MATERIAL.includes(materialDisplay) ? materialDisplay : "all"} pilihan={pilihanMaterial} onChange={changeMaterialDisplay} />
    </BarisPengaturan> : null}
    {cocok("pratinjauHover", labelPratinjau) ? <BarisPengaturan
      judul={<span className="text-[13.5px] font-medium text-foreground">{labelPratinjau}</span>}
      deskripsi={deskripsi("pratinjauHover")}
    >
      <SakelarPengaturan checked={previewBoardOnHover} onCheckedChange={togglePratinjauHover} aria-label={labelPratinjau} />
    </BarisPengaturan> : null}
    {cocok("gulirLangkah", labelGulir) ? <BarisPengaturan
      judul={<span className="text-[13.5px] font-medium text-foreground">{labelGulir}</span>}
      deskripsi={deskripsi("gulirLangkah")}
    >
      <SakelarPengaturan checked={boardScroll} onCheckedChange={toggleGulirLangkah} aria-label={labelGulir} />
    </BarisPengaturan> : null}
          </section>;
});

function Moves({ aktif = true, cocok, deskripsi }) {
  const config = useContext(ConfigContext);
  const [boardTheme] = config.boardTheme;
  const [showLegalMoves, setShowLegalMoves] = config.showLegalMoves;
  const [animateMoves, setAnimateMoves] = config.animateMoves;
  const [boardSounds, setBoardSounds] = config.boardSounds;
  const [moveHighlight, setMoveHighlight] = config.moveHighlight ?? BAWAAN_SOROT_LANGKAH;
  const [autoPromote, setAutoPromote] = config.autoPromote ?? BAWAAN_AUTO_PROMOSI;
  const [volume, setVolume] = config.volume ?? BAWAAN_VOLUME;
  const [animationSpeed, setAnimationSpeed] = config.animationSpeed ?? BAWAAN_KECEPATAN;
  const [materialDisplay, setMaterialDisplay] = config.materialDisplay ?? BAWAAN_MATERIAL;
  const [previewBoardOnHover, setPreviewBoardOnHover] = config.previewBoardOnHover ?? BAWAAN_PRATINJAU;
  const [boardScroll, setBoardScroll] = config.boardScroll ?? BAWAAN_GULIR;
  const [soundCollection, setSoundCollection] = config.soundCollection ?? BAWAAN_KOLEKSI;
  return <IsiMoves aktif={aktif} boardTheme={boardTheme} showLegalMoves={showLegalMoves} setShowLegalMoves={setShowLegalMoves} animateMoves={animateMoves} setAnimateMoves={setAnimateMoves} boardSounds={boardSounds} setBoardSounds={setBoardSounds} moveHighlight={moveHighlight} setMoveHighlight={setMoveHighlight} autoPromote={autoPromote} setAutoPromote={setAutoPromote} volume={volume} setVolume={setVolume} animationSpeed={animationSpeed} setAnimationSpeed={setAnimationSpeed} materialDisplay={materialDisplay} setMaterialDisplay={setMaterialDisplay} previewBoardOnHover={previewBoardOnHover} setPreviewBoardOnHover={setPreviewBoardOnHover} boardScroll={boardScroll} setBoardScroll={setBoardScroll} soundCollection={soundCollection} setSoundCollection={setSoundCollection} cocok={cocok} deskripsi={deskripsi} />;
}
export default memo(Moves);
