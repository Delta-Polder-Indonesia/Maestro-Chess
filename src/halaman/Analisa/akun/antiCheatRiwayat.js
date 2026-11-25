/**
 * Orkestrasi analisis anti-cheat lintas riwayat pemain.
 *
 * Dipakai tab "Deteksi engine" pada `DashboardAkun.jsx`. Perhitungan angkanya
 * ada di `../mesin/antiCheat.js` (murni); berkas ini hanya mengurus bagian
 * yang mahal dan berurusan dengan dunia luar:
 *
 *  1. MEMBATASI KERJA — `parsePGN` menjalankan Stockfish sekali per langkah,
 *     jadi menganalisis seluruh arsip akun berarti ribuan pencarian. Yang
 *     dianalisis hanya sejumlah partai terbaru yang diminta (bawaan
 *     `BATAS_PARTAI`) tempat `username` benar-benar bermain, pada
 *     `KEDALAMAN_AGGREGAT` ply (lebih dangkal dari
 *     kedalaman analisis tunggal) — cukup untuk metrik statistik, jauh lebih
 *     cepat.
 *  2. CACHE per id partai + kedalaman + MultiPV (pola `cachePartai`):
 *     memori sesi + penulisan-lulus ke localStorage sehingga mengulang
 *     analisis di kunjungan berikutnya tidak membayar dua kali (bisa
 *     dibersihkan lewat `bersihkanCacheAntiCheat`).
 *  3. BATAL — `AbortSignal` diteruskan ke `parsePGN`. Pembatalan menghentikan
 *     loop, tetapi hasil partai yang sudah selesai TETAP dikembalikan: sebagian
 *     gambaran lebih berguna daripada tidak sama sekali.
 *  4. PROGRES + WAKTU — callback `progres({ jenis, ke, total, … })` untuk
 *     bilah muat, dan pengukuran durasi per partai (dasar keputusan
 *     menaikkan/menurunkan kedalaman atau MULTI_PV — lihat README).
 *
 * `parserPgn` dan `cariBuku` bisa disuntikkan; uji memakai pemalsu agar tidak
 * perlu memuat worker Stockfish.
 */

import { hashPgn } from "../../../lib/pgnRingan.js";
import { GALAT_BATAL, MULTI_PV, parsePGN } from "../mesin/engine.js";
import { cariNamaPembukaan } from "../../../modul/analisis/buku.js";
import { agregatSkorPemain, hitungSkorKecurigaan, ratingDariMetadata, warnaPemainDariMetadata } from "../mesin/antiCheat.js";
import { denganKunciAkun, langgananPenghapusanAkun, periksaSinyalAkun } from "./koordinasiAkun.js";

/** Jumlah partai bawaan jika kolom jumlah dikosongkan. */
export const BATAS_PARTAI = 12;

/** Jumlah tidak sah tidak boleh berubah menjadi `limit: 0` (seluruh arsip). */
export function batasPartaiDariInput(nilai) {
  const isi = String(nilai ?? "").trim();
  if (!isi) return BATAS_PARTAI;
  const jumlah = Number(isi);
  return Number.isSafeInteger(jumlah) && jumlah > 0 ? jumlah : null;
}

/**
 * Kedalaman untuk mode agregat. Analisis tunggal memakai 10–20 ply; di sini
 * yang dibutuhkan adalah perbandingan langkah-pemain vs langkah-engine dan
 * selisih eval, keduanya sudah stabil pada kedalaman rendah, sementara
 * waktunya turun drastis karena dikalikan jumlah partai.
 */
export const KEDALAMAN_AGGREGAT = 8;

/* Cache hanya valid untuk isi PGN, engine, kedalaman, MultiPV, dan versi
 * perhitungan yang sama. Tanpa identitas engine/PGN, jangan pakai cache. */
const cacheHasilPartai = new Map();
const VERSI_PERHITUNGAN = 1;
const AWALAN_CACHE = "maestro-anticheat-cache-v";
const KUNCI_SIMPANAN_CACHE = `${AWALAN_CACHE}7`;

export function kunciCachePartai(id, kedalaman, pgn, idEngine) {
  if (!id || typeof pgn !== "string" || !pgn.trim() || !idEngine) return null;
  return JSON.stringify([VERSI_PERHITUNGAN, String(id), kedalaman, MULTI_PV, String(idEngine), hashPgn(pgn)]);
}

function bacaSimpananCache() {
  try {
    if (typeof localStorage === "undefined") return {};
    const mentah = localStorage.getItem(KUNCI_SIMPANAN_CACHE);
    const urai = mentah ? JSON.parse(mentah) : null;
    return urai && typeof urai === "object" && !Array.isArray(urai) ? urai : {};
  } catch {
    return {};
  }
}

function tulisSimpananCache(objek) {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KUNCI_SIMPANAN_CACHE, JSON.stringify(objek));
  } catch { /* cache memori tetap jalan */ }
}

let cacheSudahDimuat = false;

// Cache di memori tab lain juga harus gugur ketika akun dihapus. Perubahan
// cache antartab dimuat ulang agar hasil yang lebih baru tidak tertutup salinan lama.
langgananPenghapusanAkun(() => { cacheHasilPartai.clear(); cacheSudahDimuat = false; });
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("storage", (event) => {
    if (!event.key?.startsWith(AWALAN_CACHE)) return;
    cacheHasilPartai.clear();
    cacheSudahDimuat = false;
  });
}

function pastikanCacheDimuat() {
  if (cacheSudahDimuat) return;
  cacheSudahDimuat = true;
  for (const [kunci, nilai] of Object.entries(bacaSimpananCache())) {
    if (!cacheHasilPartai.has(kunci) && nilai && typeof nilai === "object") cacheHasilPartai.set(kunci, nilai);
  }
}

export function bacaCachePartai(id, kedalaman, pgn, idEngine) {
  const kunci = kunciCachePartai(id, kedalaman, pgn, idEngine);
  if (!kunci) return null;
  pastikanCacheDimuat();
  return cacheHasilPartai.get(kunci) ?? null;
}

export function simpanCachePartai(id, kedalaman, hasil, pgn, idEngine) {
  const kunci = kunciCachePartai(id, kedalaman, pgn, idEngine);
  if (!kunci || !hasil) return;
  pastikanCacheDimuat();
  cacheHasilPartai.set(kunci, hasil);
  const cermin = bacaSimpananCache();
  cermin[kunci] = hasil;
  tulisSimpananCache(cermin);
}

/** Versi lama tidak memiliki pemilik yang andal; hapus seluruh cache deteksi. */
export function bersihkanCacheAntiCheat() {
  cacheHasilPartai.clear();
  cacheSudahDimuat = true;
  try {
    if (typeof localStorage === "undefined") return true;
    const storage = localStorage;
    const kunci = new Set(Array.from({ length: 7 }, (_, i) => `${AWALAN_CACHE}${i + 1}`));
    for (let i = 0; i < storage.length; i++) {
      const nama = storage.key(i);
      if (nama?.startsWith(AWALAN_CACHE)) kunci.add(nama);
    }
    for (const nama of kunci) storage.removeItem(nama);
    return true;
  } catch {
    return false;
  }
}

export function ukuranCacheAntiCheat() {
  pastikanCacheDimuat();
  return cacheHasilPartai.size;
}

/** Warna `username` pada satu partai, dari metadata basis data. */
export function warnaPemainPadaPartai(partai, username) {
  const nama = String(username ?? "").trim().toLowerCase();
  if (!nama) return null;
  if (String(partai?.whiteName ?? "").trim().toLowerCase() === nama) return "w";
  if (String(partai?.blackName ?? "").trim().toLowerCase() === nama) return "b";
  return null;
}

/**
 * Pilih partai yang layak dianalisis: punya teks PGN, `username` ikut bermain,
 * terbaru lebih dulu, maksimal `batas` partai.
 */
export function pilihPartaiUntukAnalisis(partai, username, { batas = BATAS_PARTAI } = {}) {
  const nama = String(username ?? "").trim().toLowerCase();
  const layak = (Array.isArray(partai) ? partai : []).filter((p) => {
    if (!p || typeof p.pgn !== "string" || !p.pgn.trim()) return false;
    return nama ? warnaPemainPadaPartai(p, username) !== null : true;
  });
  const terbaru = [...layak].sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
  return Number.isFinite(batas) && batas > 0 ? terbaru.slice(0, batas) : terbaru;
}

/**
 * Jalankan analisis agregat atas riwayat pemain.
 *
 * @returns {Promise<{agregat: object, dianalisis: number, total: number,
 *   dariCache: number, dibatalkan: boolean, galat: object[]}>}
 */
export async function analisisRiwayatAntiCheat({
  partai,
  username = "",
  mesin,
  kedalaman = KEDALAMAN_AGGREGAT,
  batas = BATAS_PARTAI,
  sinyal = null,
  progres = null,
  parserPgn = parsePGN,
  cariBuku = cariNamaPembukaan,
  paksa = false,
} = {}) {
  const batasPilihan = batasPartaiDariInput(batas);
  if (batasPilihan === null) throw new RangeError("Jumlah partai harus berupa bilangan bulat positif.");
  const daftar = pilihPartaiUntukAnalisis(partai, username, { batas: batasPilihan });
  const hasilPartai = [];
  const galat = [];
  let dariCache = 0;
  // Pengukuran durasi per partai (di luar cache) — lihat README roadmap.
  const durasiPerPartai = [];
  let totalDurasiMs = 0;

  // Tabel buku dipakai untuk menandai langkah "book" agar tidak ikut dinilai.
  // Kegagalan unduh tidak boleh menggagalkan seluruh analisis.
  let openings;
  try {
    openings = (await cariBuku?.()) ?? {};
  } catch {
    openings = {};
  }

  for (let i = 0; i < daftar.length; i++) {
    periksaSinyalAkun(sinyal);
    if (sinyal?.aborted) break;
    const p = daftar[i];
    const warna = warnaPemainPadaPartai(p, username) ?? null;
    const tersimpan = paksa ? null : bacaCachePartai(p.id, kedalaman, p.pgn, mesin?.idEngine);
    let hasil = tersimpan;

    if (!hasil) {
      const mulai = Date.now();
      try {
        const { metadata, moves } = await parserPgn(mesin, p.pgn, kedalaman, openings, () => {}, sinyal, {
          multiPv: MULTI_PV,
          // Deteksi memakai kedalaman tetap + MultiPV; jangan terkena batas
          // waktu panel pengaturan agar hasilnya tetap dapat dibandingkan.
          movetime: null,
        });
        // Parser/worker dapat menyelesaikan jawaban setelah sinyal dibatalkan.
        // Jangan isi kembali cache setelah akun dihapus.
        periksaSinyalAkun(sinyal);
        if (sinyal?.aborted) break;
        const rating = ratingDariMetadata(metadata);
        hasil = { metadata, hasil: hitungSkorKecurigaan(moves, { rating }) };
        const ms = Date.now() - mulai;
        durasiPerPartai.push({ id: p.id, ms });
        totalDurasiMs += ms;
        // Pemeriksaan generasi dan penulisan cache harus atomik terhadap
        // penghapusan akun di tab peramban lain.
        await denganKunciAkun(() => {
          periksaSinyalAkun(sinyal);
          if (!sinyal?.aborted) simpanCachePartai(p.id, kedalaman, hasil, p.pgn, mesin?.idEngine);
        }, { signal: sinyal });
        if (sinyal?.aborted) break;
      } catch (e) {
        if (sinyal?.aborted || e?.kunci === GALAT_BATAL) break;
        galat.push({ id: p.id, pesan: e?.message ?? String(e) });
        progres?.({ jenis: "galat", ke: i + 1, total: daftar.length, id: p.id, pesan: galat[galat.length - 1].pesan });
        continue;
      }
    } else {
      dariCache++;
    }

    /*
     * Partai ini SUDAH selesai diurai — hasilnya disimpan apa pun yang terjadi
     * sesudahnya. Tombol Batal menghentikan partai BERIKUTNYA, bukan membuang
     * kerja yang sudah dibayar; sebagian gambaran tetap lebih berguna daripada
     * tidak sama sekali.
     */
    hasilPartai.push({
      id: p.id,
      timestamp: p.timestamp,
      timeClass: p.timeClass,
      warna: warna ?? warnaPemainDariMetadata(hasil.metadata, username),
      metadata: hasil.metadata,
      hasil: hasil.hasil,
    });
    progres?.({
      jenis: "progres",
      ke: hasilPartai.length,
      total: daftar.length,
      id: p.id,
      dariCache: Boolean(tersimpan),
    });

    if (sinyal?.aborted) break;
  }

  return {
    agregat: agregatSkorPemain(hasilPartai, username),
    dianalisis: hasilPartai.length,
    total: daftar.length,
    dariCache,
    dibatalkan: Boolean(sinyal?.aborted),
    galat,
    durasi: {
      totalMs: totalDurasiMs,
      rataMs: durasiPerPartai.length ? Math.round(totalDurasiMs / durasiPerPartai.length) : null,
      perPartai: durasiPerPartai,
    },
  };
}
