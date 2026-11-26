import { createContext } from "react";

// Palet warna aksen (adopsi En Croissant ColorControl: kisi swatch). "hijau"
// adalah aksen Maestro semula — nilai hex-nya persis variabel CSS lama sehingga
// bawaan tidak mengubah tampilan. Provider menulis pasangan ini ke
// --backgroundBoxBoxHighlighted/--backgroundBoxBoxHighlightedHover saat aktif.
export const DAFTAR_AKSEN = [
  { id: "hijau", dasar: "#81b64c", hover: "#8bc550" },
  { id: "biru", dasar: "#3b82f6", hover: "#60a5fa" },
  { id: "merah", dasar: "#ef4444", hover: "#f87171" },
  { id: "jingga", dasar: "#f97316", hover: "#fb923c" },
  { id: "kuning", dasar: "#eab308", hover: "#facc15" },
  { id: "toska", dasar: "#14b8a6", hover: "#2dd4bf" },
  { id: "ungu", dasar: "#8b5cf6", hover: "#a78bfa" },
  { id: "merahMuda", dasar: "#ec4899", hover: "#f472b6" },
];

// Koleksi suara yang tersedia (adopsi En Croissant SoundSelect). "standard"
// memakai berkas public/sounds/*.mp3 Maestro semula; koleksi lain memakai
// berkas Move/Capture/Check(/Castles) di public/sounds/<koleksi>/. Daftar ini
// adalah sumber tunggal untuk validasi preferensi dan pilihan UI; lib/suara.js
// menjaga daftar asetnya sendiri dan keduanya dikunci sejajar oleh tes.
export const DAFTAR_KOLEKSI_SUARA = ["standard", "futuristic", "lisp", "nes", "piano", "robot", "sfx", "woodland"];

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
  // Tier 2 adopsi En Croissant — sumber tunggal preferensi papan ("1 pintu").
  // Bawaan mempertahankan perilaku kini: volume penuh, animasi normal,
  // material tampil semua, notasi huruf (SAN).
  volume: [100, () => {
  }],
  animationSpeed: ["normal", () => {
  }],
  materialDisplay: ["all", () => {
  }],
  moveNotation: ["letters", () => {
  }],
  // Tier 3 adopsi En Croissant. Bawaan mempertahankan perilaku Maestro:
  // pratinjau hover & gulir langkah belum ada sebelumnya sehingga opt-in
  // (EC menyalakannya), koleksi suara standar, font 100%, aksen hijau asli.
  previewBoardOnHover: [false, () => {
  }],
  boardScroll: [false, () => {
  }],
  soundCollection: ["standard", () => {
  }],
  fontSize: [100, () => {
  }],
  accentColor: ["hijau", () => {
  }],
  boardMenuSettingsRef: { current: null }
});
