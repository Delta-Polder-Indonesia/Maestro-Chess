// Fasad publik modul Analisis; mencakup fondasi engine, deteksi fase, kurva peluang, hasil sesi, dan konvensi evaluasi.
export { DAFTAR_ENGINE, ENGINE_BAKU, EngineCatur, cariEngine, hashUntukEngine, wasmSupported, wasmThreadsSupported } from "./mesin.js";
export {
  DAFTAR_FASE,
  FASE_AKHIR,
  FASE_MENENGAH,
  FASE_PEMBUKAAN,
  faseBerikutnya,
  isEndMiddlegame,
  isEndOpening,
  papanDariFen,
} from "./fase.js";
export { CP_CEILING, FAKTOR_PELUANG, batasiCp, peluangMenang } from "./peluang.js";
export {
  ambilPetaAnalisis,
  bersihkanAnalisis,
  catatAnalisis,
  hapusAnalisis,
  jumlahAnalisis,
  langgananAnalisis,
} from "./analisisTersimpan.js";
export {
  MATE_DISAMPAIKAN,
  STATUS_EVALUASI,
  apakahMateTerminal,
  cpBaku,
  evalSiap,
  langkahTerpaksa,
  normalisasiEval,
  ratingTampilan,
  tandaMate,
} from "./evaluasi.js";
