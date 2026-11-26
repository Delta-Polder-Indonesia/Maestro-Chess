/* Port dari Brilliant-Chess (MIT, © 2025 Delo) — jangan sunting massal tanpa cek README. */
import { useState, useRef, useEffect } from "react";
import { ConfigContext, defaultUsedRatings, DAFTAR_AKSEN, DAFTAR_KOLEKSI_SUARA } from "./configKonteks.js";
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
  // Tier 3: pratinjau hover & gulir langkah opt-in (perilaku Maestro semula
  // tidak memilikinya); koleksi suara, ukuran font, dan aksen divalidasi ke
  // daftar yang sama dengan pilihan UI (satu sumber di configKonteks.js).
  const [previewBoardOnHover, setPreviewBoardOnHover] = useState(() => bacaBoolean("previewBoardOnHover", false));
  const [boardScroll, setBoardScroll] = useState(() => bacaBoolean("boardScroll", false));
  const [soundCollection, setSoundCollection] = useState(() => {
    const nilai = bacaTeks("soundCollection", "standard");
    return DAFTAR_KOLEKSI_SUARA.includes(nilai) ? nilai : "standard";
  });
  const [fontSize, setFontSize] = useState(() => {
    const nilai = bacaAngka("fontSize", 100);
    return Number.isFinite(nilai) ? Math.min(200, Math.max(50, Math.round(nilai))) : 100;
  });
  const [accentColor, setAccentColor] = useState(() => {
    const nilai = bacaTeks("accentColor", "hijau");
    return DAFTAR_AKSEN.some((aksen) => aksen.id === nilai) ? nilai : "hijau";
  });
  const [theme, setTheme] = useState(() => {
    const nilai = bacaTeks("theme", "dark");
    return nilai === "auto" || nilai === "light" || nilai === "dark" ? nilai : "dark";
  });
  const [evalDisplay, setEvalDisplay] = useState(() => {
    const nilai = bacaTeks("evalDisplay", "cp");
    return nilai === "wdl" ? "wdl" : "cp";
  });
  const [tablebase, setTablebase] = useState(() => bacaBoolean("tablebase", false));
  // Ukuran font akar dan warna aksen diterapkan ke root dokumen seperti
  // App.tsx En Croissant (fontSize %) dan Mantine primaryColor. Hanya selama
  // provider Analisa terpasang; cleanup memulihkan tampilan semula sehingga
  // halaman lain tidak ikut berubah. Di Node (uji/SSR) efek ini noop.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const akar = document.documentElement;
    akar.style.fontSize = fontSize === 100 ? "" : `${fontSize}%`;
    return () => { akar.style.fontSize = ""; };
  }, [fontSize]);
  // Aksen diterapkan ke elemen .analisa-root (bukan root dokumen): halaman
  // Analisa mendefinisikan ulang --backgroundBoxBoxHighlighted dari
  // --analisa-backgroundBoxBoxHighlighted di analisa.css, sehingga override
  // harus berada pada elemen itu sendiri (inline mengalahkan stylesheet).
  // Dialog Analisa di-portal ke .analisa-root sehingga ikut mewarisi aksen.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const akar = document.querySelector(".analisa-root");
    if (!akar) return undefined;
    const aksen = DAFTAR_AKSEN.find((entri) => entri.id === accentColor);
    if (aksen && aksen.id !== "hijau") {
      akar.style.setProperty("--analisa-backgroundBoxBoxHighlighted", aksen.dasar);
      akar.style.setProperty("--analisa-backgroundBoxBoxHighlightedHover", aksen.hover);
    } else {
      akar.style.removeProperty("--analisa-backgroundBoxBoxHighlighted");
      akar.style.removeProperty("--analisa-backgroundBoxBoxHighlightedHover");
    }
    return () => {
      akar.style.removeProperty("--analisa-backgroundBoxBoxHighlighted");
      akar.style.removeProperty("--analisa-backgroundBoxBoxHighlightedHover");
    };
  }, [accentColor]);
  // Tema terang/gelap: data-tema pada .analisa-root mengaktifkan blok palet
  // terang di analisa.css. "auto" mengikuti prefers-color-scheme dan berubah
  // saat sistem berganti. Cleanup melepas atribut agar halaman lain tetap gelap.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const akar = document.querySelector(".analisa-root");
    if (!akar) return undefined;
    const media = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
    const terapkan = () => {
      const terang = theme === "light" || (theme === "auto" && Boolean(media?.matches));
      if (terang) akar.setAttribute("data-tema", "terang");
      else akar.removeAttribute("data-tema");
    };
    terapkan();
    if (theme === "auto" && media?.addEventListener) {
      media.addEventListener("change", terapkan);
      return () => { media.removeEventListener("change", terapkan); akar.removeAttribute("data-tema"); };
    }
    return () => akar.removeAttribute("data-tema");
  }, [theme]);
  const boardMenuSettingsRef = useRef(null);
  return <ConfigContext.Provider value={{ boardTheme: [boardTheme, setBoardTheme], pieceSet: [pieceSet, setPieceSet], openedMenu: [openedMenu, setOpenedMenu], usedRatings: [usedRatings, setUsedRatings], highlightByRating: [highlightByRating, setHighlightByRating], showArrows: [showArrows, setShowArrows], arrowAfterMove: [arrowAfterMove, setArrowAfterMove], showLegalMoves: [showLegalMoves, setShowLegalMoves], animateMoves: [animateMoves, setAnimateMoves], boardSounds: [boardSounds, setBoardSounds], coordinates: [coordinates, setCoordinates], moveHighlight: [moveHighlight, setMoveHighlight], autoPromote: [autoPromote, setAutoPromote], eraseArrowsOnClick: [eraseArrowsOnClick, setEraseArrowsOnClick], volume: [volume, setVolume], animationSpeed: [animationSpeed, setAnimationSpeed], materialDisplay: [materialDisplay, setMaterialDisplay], moveNotation: [moveNotation, setMoveNotation], previewBoardOnHover: [previewBoardOnHover, setPreviewBoardOnHover], boardScroll: [boardScroll, setBoardScroll], soundCollection: [soundCollection, setSoundCollection], fontSize: [fontSize, setFontSize], accentColor: [accentColor, setAccentColor], theme: [theme, setTheme], evalDisplay: [evalDisplay, setEvalDisplay], tablebase: [tablebase, setTablebase], boardMenuSettingsRef }}>
            {props.children}
        </ConfigContext.Provider>;
}
export default ConfigContextProvider;
