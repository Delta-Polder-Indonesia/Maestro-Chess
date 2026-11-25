// Fasad publik modul Analisis; mencakup fondasi engine, deteksi fase permainan, dan kurva peluang menang.
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
