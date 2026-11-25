// Fasad internal wawasan profil pemain; sengaja tidak diekspor lewat barrel utama agar index.js tetap pada daftar ekspor stabil.
export {
  LABEL_PEMBUKAAN,
  agregasiWawasan,
  ekstraksHeaderPgn,
  extractFirstMovesFromPgn,
  filterPartaiWawasan,
  formatEcoUrlName,
  hitungHasil,
  hitungPembukaanTeratas,
  hitungStreak,
  hitungTaktikal,
  hitungTrenRating,
  parsePgnHeaders,
  warnaPemain,
} from "./wawasanProfil.js";
