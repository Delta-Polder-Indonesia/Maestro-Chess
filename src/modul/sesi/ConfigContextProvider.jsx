/* Port dari Brilliant-Chess (MIT, © 2025 Delo) — jangan sunting massal tanpa cek README. */
import { useState, useRef } from "react";
import { ConfigContext, defaultUsedRatings } from "./configKonteks.js";
import { bacaAngka, bacaBoolean, bacaTeks } from "./penyimpanan.js";
import { boardThemes } from "./boardThemes.js";

function bacaRating() {
  const nilai = bacaTeks("usedRatings", "");
  const kunci = Object.keys(defaultUsedRatings);
  if (!new RegExp(`^[01]{${kunci.length}}$`).test(nilai)) return defaultUsedRatings;
  return Object.fromEntries(kunci.map((nama, i) => [nama, nilai[i] === "1"]));
}

function ConfigContextProvider(props) {
  const [openedMenu, setOpenedMenu] = useState(null);
  const [boardTheme, setBoardTheme] = useState(() => {
    const tema = bacaAngka("boardTheme", 0);
    return Number.isInteger(tema) && boardThemes[tema] ? tema : 0;
  });
  // Set bidak disimpan sebagai string mentah; validasi ke registri dilakukan
  // di lapisan render (idSetBidak) agar modul sesi tidak bergantung pada halaman.
  const [pieceSet, setPieceSet] = useState(() => bacaTeks("pieceSet", "cburnett") || "cburnett");
  const [usedRatings, setUsedRatings] = useState(bacaRating);
  const [highlightByRating, setHighlightByRating] = useState(() => bacaBoolean("highlightByRating", true));
  const [showArrows, setShowArrows] = useState(() => bacaBoolean("showArrows", true));
  const [arrowAfterMove, setArrowAfterMove] = useState(() => bacaBoolean("arrowAfterMove", true));
  const [showLegalMoves, setShowLegalMoves] = useState(() => bacaBoolean("showLegalMoves", true));
  const [animateMoves, setAnimateMoves] = useState(() => bacaBoolean("animateMoves", true));
  const [boardSounds, setBoardSounds] = useState(() => bacaBoolean("boardSounds", true));
  // Tier 1 adopsi En Croissant. Koordinat divalidasi ke enum di sini (string
  // mentah), sementara boolean memakai format "0"/"1" yang sama seperti sakelar
  // lain. Tidak ada impor baru agar graf fasad preferensi tetap terkunci.
  const [coordinates, setCoordinates] = useState(() => {
    const nilai = bacaTeks("coordinates", "edge");
    return nilai === "no" || nilai === "edge" || nilai === "all" ? nilai : "edge";
  });
  const [moveHighlight, setMoveHighlight] = useState(() => bacaBoolean("moveHighlight", true));
  const [autoPromote, setAutoPromote] = useState(() => bacaBoolean("autoPromote", false));
  const [eraseArrowsOnClick, setEraseArrowsOnClick] = useState(() => bacaBoolean("eraseArrowsOnClick", true));
  // Tier 2: volume (0..100), kecepatan animasi, tampilan material, notasi langkah.
  const [volume, setVolume] = useState(() => {
    const nilai = bacaAngka("volume", 100);
    return Number.isFinite(nilai) ? Math.min(100, Math.max(0, Math.round(nilai))) : 100;
  });
  const [animationSpeed, setAnimationSpeed] = useState(() => {
    const nilai = bacaTeks("animationSpeed", "normal");
    return nilai === "fast" || nilai === "normal" || nilai === "slow" ? nilai : "normal";
  });
  const [materialDisplay, setMaterialDisplay] = useState(() => {
    const nilai = bacaTeks("materialDisplay", "all");
    return nilai === "diff" || nilai === "all" || nilai === "none" ? nilai : "all";
  });
  const [moveNotation, setMoveNotation] = useState(() => {
    const nilai = bacaTeks("moveNotation", "letters");
    return nilai === "letters" || nilai === "symbols" || nilai === "lan" ? nilai : "letters";
  });
  const boardMenuSettingsRef = useRef(null);
  return <ConfigContext.Provider value={{ boardTheme: [boardTheme, setBoardTheme], pieceSet: [pieceSet, setPieceSet], openedMenu: [openedMenu, setOpenedMenu], usedRatings: [usedRatings, setUsedRatings], highlightByRating: [highlightByRating, setHighlightByRating], showArrows: [showArrows, setShowArrows], arrowAfterMove: [arrowAfterMove, setArrowAfterMove], showLegalMoves: [showLegalMoves, setShowLegalMoves], animateMoves: [animateMoves, setAnimateMoves], boardSounds: [boardSounds, setBoardSounds], coordinates: [coordinates, setCoordinates], moveHighlight: [moveHighlight, setMoveHighlight], autoPromote: [autoPromote, setAutoPromote], eraseArrowsOnClick: [eraseArrowsOnClick, setEraseArrowsOnClick], volume: [volume, setVolume], animationSpeed: [animationSpeed, setAnimationSpeed], materialDisplay: [materialDisplay, setMaterialDisplay], moveNotation: [moveNotation, setMoveNotation], boardMenuSettingsRef }}>
            {props.children}
        </ConfigContext.Provider>;
}
export default ConfigContextProvider;
