/** Koordinasi pekerjaan akun di tab area kerja dan tab peramban satu origin. */
import { hashPgn } from "../../../lib/pgnRingan.js";
import { pastikanTidakDibatalkan } from "../../../lib/pembatalan.js";

const penghapusan = new Set();
const operasi = new Map();
const pemeriksaSinyal = new WeakMap();
const pendengarPenghapusan = new Set();
const AWALAN = "maestro-analisa-generasi-akun-";
// Pemulihan cadangan dan transaksi multi-koleksi juga memakai lock ini.
const NAMA_LOCK = "maestro-analisa-basis-akun";
let pendengarTerpasang = false;
let antreanLokal = Promise.resolve();
let lockTidakDapatDipakai = false;

function kunciAkun(platform, username) {
  return `${String(platform || "").trim().toLowerCase()}:${String(username || "").trim().toLowerCase()}`;
}

function kunciStorage(kunci) {
  // Jangan meninggalkan nama akun mentah dalam penanda setelah penghapusan.
  return AWALAN + hashPgn(kunci);
}

function bacaKeadaan(kunci) {
  try {
    if (typeof localStorage === "undefined") return { tersedia: false };
    const raw = localStorage.getItem(kunciStorage(kunci));
    if (raw === null) return { tersedia: true, versi: "0", status: "aktif" };
    const data = JSON.parse(raw);
    if (typeof data?.versi !== "string" || !["aktif", "menghapus", "terhapus"].includes(data.status)) return { tersedia: false };
    return { tersedia: true, versi: data.versi, status: data.status };
  } catch {
    return { tersedia: false };
  }
}

/** Generasi yang dapat dibandingkan dengan cadangan di memori tab lain. */
export function bacaGenerasiAkun(platform, username) {
  return bacaKeadaan(kunciAkun(platform, username));
}

function tulisKeadaan(kunci, versi, status) {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.setItem(kunciStorage(kunci), JSON.stringify({ versi, status }));
    return true;
  } catch {
    return false;
  }
}

function versiBaru() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function kabarkanPenghapusan(status, penanda, versi) {
  for (const callback of pendengarPenghapusan) {
    try { callback(status, penanda, versi); } catch { /* pendengar tidak boleh menggagalkan penghapusan */ }
  }
}

export function penandaMilikAkun(platform, username, penanda) {
  return Boolean(penanda) && penanda === kunciStorage(kunciAkun(platform, username));
}

function pasangPendengar() {
  if (pendengarTerpasang || typeof window === "undefined" || !window.addEventListener) return;
  pendengarTerpasang = true;
  window.addEventListener("storage", (event) => {
    if (!event.key?.startsWith(AWALAN)) return;
    for (const [kunci, daftar] of operasi) {
      if (kunciStorage(kunci) !== event.key) continue;
      const terbaca = bacaKeadaan(kunci).tersedia;
      for (const entri of daftar) {
        // Event dapat terlambat setelah akun ditambahkan kembali. Bandingkan
        // keadaan terkini; jika storage ditolak, batalkan untuk berjaga-jaga.
        entri.periksa();
        if (!terbaca) entri.controller.abort();
      }
    }
    try {
      const data = JSON.parse(event.newValue || "null");
      if (data?.status === "menghapus" || data?.status === "terhapus") kabarkanPenghapusan(data.status, event.key, data.versi);
    } catch { /* penanda rusak tidak boleh merobohkan halaman */ }
  });
}

export function langgananPenghapusanAkun(callback) {
  pasangPendengar();
  pendengarPenghapusan.add(callback);
  return () => pendengarPenghapusan.delete(callback);
}

export function akunSedangDihapus(platform, username) {
  const kunci = kunciAkun(platform, username);
  const keadaan = bacaKeadaan(kunci);
  return penghapusan.has(kunci) || (keadaan.tersedia && keadaan.status !== "aktif");
}

/** Periksa ulang versi sinkron, termasuk sinyal induk dari unduhan. */
export function periksaSinyalAkun(signal) {
  if (signal) pemeriksaSinyal.get(signal)?.();
}

/** Daftarkan unduhan/tulisan agar penghapusan dapat membatalkan semuanya. */
export function daftarkanOperasiAkun(platform, username, sinyalAsal) {
  pasangPendengar();
  const kunci = kunciAkun(platform, username);
  const awal = bacaKeadaan(kunci);
  const controller = new AbortController();
  const batalkan = () => controller.abort();
  const periksa = () => {
    periksaSinyalAkun(sinyalAsal);
    const sekarang = bacaKeadaan(kunci);
    if (sinyalAsal?.aborted || penghapusan.has(kunci) ||
      (awal.tersedia
        ? (!sekarang.tersedia || sekarang.versi !== awal.versi || sekarang.status !== "aktif")
        : (sekarang.tersedia && (sekarang.versi !== "0" || sekarang.status !== "aktif")))) controller.abort();
  };
  pemeriksaSinyal.set(controller.signal, periksa);
  periksa();
  if (!controller.signal.aborted) sinyalAsal?.addEventListener("abort", batalkan, { once: true });
  let daftar = operasi.get(kunci);
  if (!daftar) operasi.set(kunci, daftar = new Set());
  const entri = { controller, periksa };
  daftar.add(entri);
  return {
    signal: controller.signal,
    periksa,
    selesai() {
      sinyalAsal?.removeEventListener("abort", batalkan);
      pemeriksaSinyal.delete(controller.signal);
      daftar.delete(entri);
      if (daftar.size === 0 && operasi.get(kunci) === daftar) operasi.delete(kunci);
    },
  };
}

/** Apakah peramban dapat mengunci operasi di semua tab pada origin ini. */
export function kunciLintasTabTersedia() {
  try { return !lockTidakDapatDipakai && typeof globalThis.navigator?.locks?.request === "function"; } catch { return false; }
}

/** Serialisasi mutasi lintas tab dengan Web Locks; antrean lokal sebagai fallback. */
export async function denganKunciAkun(aksi, { signal, wajib = false } = {}) {
  if (kunciLintasTabTersedia()) {
    let masuk = false;
    try {
      return await globalThis.navigator.locks.request(NAMA_LOCK, signal ? { signal } : {}, () => {
        masuk = true;
        return aksi();
      });
    } catch (error) {
      if (masuk || error?.name === "AbortError") throw error;
      // Ada implementasi yang mengekspos API tetapi menolak permintaan.
      // Jangan menulis snapshot seolah-olah lock lintas tab telah diperoleh.
      lockTidakDapatDipakai = true;
    }
  }
  if (wajib && typeof window !== "undefined") throw new Error("Koordinasi antar-tab tidak tersedia");
  let lepaskan;
  const sebelumnya = antreanLokal;
  antreanLokal = new Promise((resolve) => { lepaskan = resolve; });
  await sebelumnya;
  try {
    pastikanTidakDibatalkan(signal);
    return await aksi();
  } finally {
    lepaskan();
  }
}

/** Kunci lokal sebelum menunggu lock peramban; batalkan pekerjaan aktif. */
export function mulaiPenghapusanAkun(platform, username) {
  const kunci = kunciAkun(platform, username);
  if (penghapusan.has(kunci)) return null;
  penghapusan.add(kunci);
  for (const entri of operasi.get(kunci) ?? []) entri.controller.abort();
  kabarkanPenghapusan("menghapus", kunciStorage(kunci));
  return () => penghapusan.delete(kunci);
}

/** Dipanggil DI DALAM lock: generasi lama tidak boleh menyimpan lagi. */
export function tandaiPenghapusanAkun(platform, username) {
  if (typeof window === "undefined") return { selesai: () => true };
  const kunci = kunciAkun(platform, username);
  const keadaan = bacaKeadaan(kunci);
  if (!keadaan.tersedia) return null;
  const versi = versiBaru();
  if (!tulisKeadaan(kunci, versi, "menghapus")) return null;
  return {
    selesai(berhasil) {
      const tersimpan = tulisKeadaan(kunci, versi, berhasil ? "terhapus" : "aktif");
      if (tersimpan && berhasil) kabarkanPenghapusan("terhapus", kunciStorage(kunci), versi);
      return tersimpan;
    },
  };
}

/** Penambahan eksplisit mengaktifkan lagi akun yang sebelumnya dihapus.
 * Pemanggil harus memegang lock yang sama dengan penghapusan. */
export function aktifkanKembaliAkun(platform, username) {
  const kunci = kunciAkun(platform, username);
  const keadaan = bacaKeadaan(kunci);
  // Tanpa storage akun hanya bersifat sementara; penghapusan permanen juga
  // tidak akan dilaporkan sukses dalam keadaan ini.
  if (!keadaan.tersedia || keadaan.status === "aktif") return true;
  return tulisKeadaan(kunci, versiBaru(), "aktif");
}
