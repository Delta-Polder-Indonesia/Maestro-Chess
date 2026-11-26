import { createContext } from "react";

export const defaultUsedRatings = {
  brilliant: true,
  great: true,
  best: true,
  critical: true,
  excellent: true,
  good: true,
  book: true,
  inaccuracy: true,
  mistake: true,
  miss: true,
  blunder: true,
  forced: true
};

export const ConfigContext = createContext({
  openedMenu: [null, () => {
  }],
  boardTheme: [0, () => {
  }],
  pieceSet: ["cburnett", () => {
  }],
  usedRatings: [defaultUsedRatings, () => {
  }],
  highlightByRating: [true, () => {
  }],
  showArrows: [true, () => {
  }],
  arrowAfterMove: [true, () => {
  }],
  showLegalMoves: [true, () => {
  }],
  animateMoves: [true, () => {
  }],
  boardSounds: [true, () => {
  }],
  // Preferensi papan adopsi En Croissant (Tier 1). Bawaan mempertahankan
  // tampilan/perilaku Maestro saat ini: koordinat tepi, sorot langkah aktif,
  // promosi manual, dan klik kiri menghapus panah.
  coordinates: ["edge", () => {
  }],
  moveHighlight: [true, () => {
  }],
  autoPromote: [false, () => {
  }],
  eraseArrowsOnClick: [true, () => {
  }],
  boardMenuSettingsRef: { current: null }
});
