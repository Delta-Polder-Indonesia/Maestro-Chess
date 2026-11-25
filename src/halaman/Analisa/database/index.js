/**
 * Barrel internal basis data Analisa.
 *
 * Bus revisi berada di `./revisiBasis.js`, terpisah dari repository agar
 * repository tidak perlu mengimpor kembali barrel ini. Re-export langsung
 * mempertahankan live binding dan seluruh nama internal yang sudah ada.
 * Fasad publik yang dibekukan tetap `../basisData.js`, yang hanya
 * mengekspor 18 nama lama.
 */
export { bacaRevisiBasis, langgananRevisi, revisiBasis, naikkanRevisi } from "./revisiBasis.js";

export * from "./migrasi.js";
export * from "./partai.js";
export * from "./koleksi.js";
export * from "./statistik.js";
export * from "./akun.js";
