import { pekerjaan } from "./pekerjaan.js";

// Peta label terjemahan untuk setiap fitur. Dipakai saat render (label tab
// kerja maupun baris File Terbaru), bukan disimpan. Beranda bukan entri
// riwayat: setiap kembali ke File Terbaru akan membuka beranda itu sendiri.
export const KUNCI_FITUR = Object.freeze({
  bermain: "analisa.papan.kartu.report.judul",
  akun: "analisa.nav.akun",
  database: "analisa.nav.database",
  engine: "analisa.nav.engine",
  impor: "analisa.papan.kartu.impor.judul",
  "teka-teki": "analisa.papan.kartu.puzzle.judul",
  "deteksi-engine": "analisa.nav.deteksiEngine",
  wawasan: "analisa.nav.wawasan",
  pengaturan: "analisa.nav.pengaturan",
});

// Scope "File Terbaru": hanya fitur pada nav papan (beranda) yang dicatat dan
// ditampilkan — Report Analisa (bermain), Impor Permainan, Teka-Teki, Deteksi
// Engine, dan Wawasan. Menu bilah samping (Akun/Database/Engine/Pengaturan)
// sengaja tidak dicatat. Kartu papan yang belum tersedia (Main Catur, Papan
// Analisis, Repertoar Baru) belum punya layar sehingga belum bisa dikunjungi.
const FITUR_DICATAT = Object.freeze(["bermain", "impor", "teka-teki", "deteksi-engine", "wawasan"]);

function targetSah(fitur, id) {
  return typeof id === "string" && (
    (fitur === "bermain" && id.startsWith("laporan:")) ||
    (fitur === "impor" && id.startsWith("draf:"))
  );
}

/** Catat kunjungan terakhir per fitur papan, dan per laporan/draf bila ada. */
export function catatFitur(fitur, targetId = null, store = pekerjaan, waktu = Date.now()) {
  if (!FITUR_DICATAT.includes(fitur)) return;
  const target = targetSah(fitur, targetId) ? targetId : null;
  const id = `fitur:${fitur}${target ? `:${target}` : ""}`;
  store.simpan({ id, jenis: "fitur", fitur, targetId: target, waktu });
}

/**
 * Riwayat fitur mencakup laporan/draf yang sudah disimpan versi sebelumnya,
 * tanpa menampilkan dua baris untuk kunjungan dan pekerjaan yang sama.
 */
export function daftarRiwayat(daftar) {
  const items = Array.isArray(daftar) ? daftar : [];
  const pekerjaanLama = items.filter((item) => ["laporan", "draf"].includes(item?.jenis));
  const perId = new Map(pekerjaanLama.map((item) => [item.id, item]));
  const fitur = items.filter((item) => item?.jenis === "fitur" && FITUR_DICATAT.includes(item.fitur) &&
    (!item.targetId || targetSah(item.fitur, item.targetId)));
  const terwakili = new Set(fitur.map((item) => item.targetId).filter(Boolean));
  const waktu = (item) => Number.isFinite(item.waktu) ? item.waktu : 0;
  const terbaruBertarget = new Map();
  for (const item of fitur) {
    if (!item.targetId) continue;
    terbaruBertarget.set(item.fitur, Math.max(terbaruBertarget.get(item.fitur) ?? 0, waktu(item)));
  }
  const entriFitur = fitur
    .filter((item) => item.targetId || waktu(item) > (terbaruBertarget.get(item.fitur) ?? 0) || !terbaruBertarget.has(item.fitur))
    .map((item) => ({ item, fitur: item.fitur, pekerjaan: perId.get(item.targetId) ?? null }));
  const entriLama = pekerjaanLama.filter((item) => !terwakili.has(item.id)).map((item) => ({
    item,
    fitur: item.jenis === "laporan" ? "bermain" : "impor",
    pekerjaan: item,
  }));
  return [...entriFitur, ...entriLama].sort((a, b) => waktu(b.item) - waktu(a.item));
}
