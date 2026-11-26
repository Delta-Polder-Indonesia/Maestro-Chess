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
  const boardMenuSettingsRef = useRef(null);
  return <ConfigContext.Provider value={{ boardTheme: [boardTheme, setBoardTheme], pieceSet: [pieceSet, setPieceSet], openedMenu: [openedMenu, setOpenedMenu], usedRatings: [usedRatings, setUsedRatings], highlightByRating: [highlightByRating, setHighlightByRating], showArrows: [showArrows, setShowArrows], arrowAfterMove: [arrowAfterMove, setArrowAfterMove], showLegalMoves: [showLegalMoves, setShowLegalMoves], animateMoves: [animateMoves, setAnimateMoves], boardSounds: [boardSounds, setBoardSounds], boardMenuSettingsRef }}>
            {props.children}
        </ConfigContext.Provider>;
}
export default ConfigContextProvider;
