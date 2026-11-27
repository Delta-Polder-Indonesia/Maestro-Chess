/**
 * Pemuat malas data teka-teki (pola buku pembukaan: satu janji in-flight per
 * sumber, kegagalan tidak di-cache, URL lewat berkasPublik + versi cache).
 *
 * Sumber: public/data/teka-teki.json (skakmat), teka-teki-video.json (video),
 * teka-teki-harian/<tahun>.json (harian). Hanya berkas yang diminta diunduh —
 * data harian tidak dimuat sekaligus 20 tahun.
 *
 * Modul ini satu-satunya lapisan yang menyentuh jaringan untuk teka-teki;
 * logika lain tetap murni agar mudah diuji.
 */
import { berkasPublik } from "../../lib/asets.js";
import { normalisasiBerkas } from "./soal.js";

/** Naikkan bila berkas data berubah agar cache peramban tidak menahan versi lama. */
export const VERSI_DATA = "2026-11-27";

export const JENIS_SOAL = Object.freeze({ SKAKMAT: "skakmat", VIDEO: "video", HARIAN: "harian" });

const janji = new Map();

// Tahun terbaru snapshot harian yang dikirim di public/data/teka-teki-harian.
// Dipakai bila pemanggil tidak menyebut tahun (pemilih sumber di layar).
const TAHUN_HARIAN_TERBARU = 2026;

function jalurSumber(jenis, tahun) {
  if (jenis === JENIS_SOAL.VIDEO) return "data/teka-teki-video.json";
  if (jenis === JENIS_SOAL.HARIAN) return `data/teka-teki-harian/${Number.isFinite(Number(tahun)) ? Number(tahun) : TAHUN_HARIAN_TERBARU}.json`;
  return "data/teka-teki.json";
}

async function unduh(jenis, tahun) {
  const jalur = jalurSumber(jenis, tahun);
  try {
    const respon = await fetch(`${berkasPublik(jalur)}?v=${VERSI_DATA}`);
    if (!respon.ok) throw new Error(`HTTP ${respon.status} saat memuat ${jalur}`);
    const data = await respon.json();
    return normalisasiBerkas(data, jenis);
  } catch (error) {
    console.error("Gagal memuat data teka-teki:", error);
    return [];
  }
}

/**
 * Muat daftar soal baku untuk satu sumber. Panggilan berikutnya memakai janji
 * yang sama; hasil kosong (unduhan gagal) tidak di-cache agar bisa dicoba lagi.
 *
 * @param {"skakmat"|"video"|"harian"} jenis
 * @param {{tahun?: number}} [opsi]
 */
export function muatSoal(jenis = JENIS_SOAL.SKAKMAT, { tahun } = {}) {
  const tahunTerpilih = Number.isFinite(Number(tahun)) ? Number(tahun) : TAHUN_HARIAN_TERBARU;
  const kunci = jenis === JENIS_SOAL.HARIAN ? `${jenis}:${tahunTerpilih}` : jenis;
  if (!janji.has(kunci)) {
    janji.set(kunci, unduh(jenis, tahun).then((daftar) => {
      if (!daftar.length) janji.delete(kunci);
      return daftar;
    }));
  }
  return janji.get(kunci);
}

/** Kosongkan cache (dipakai uji dan saat sumber data diganti pengguna). */
export function resetCacheSoal() {
  janji.clear();
}
