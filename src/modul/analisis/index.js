// Fasad publik modul Analisis; cakupan saat ini mencakup fondasi engine dan deteksi fase permainan.
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
