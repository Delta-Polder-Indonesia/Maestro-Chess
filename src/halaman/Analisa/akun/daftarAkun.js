/**
 * Daftar akun yang pernah dipakai pada halaman Analisa (memakai penyimpanan.js).
 *
 * Meniru atom `sessions` pada En Croissant: daftar akun { platform, username }
 * yang ditampilkan sebagai kartu profil di kolom kiri layar akun. Disimpan
 * sebagai JSON di localStorage (kunci `kci-analisa-daftar-akun`) sehingga daftar
 * tetap ada meski halaman dimuat ulang — persis seperti perilaku akun pada
 * halaman akun referensi.
 */
import { bacaTeks, cobaBacaTeks, tulis } from "../../../modul/sesi/preferensi.js";

const KEY = "daftar-akun";

/** Baca daftar akun; kembalikan [] bila rusak/penyimpanan diblokir. */
export function bacaDaftarAkun() {
  try {
    const mentah = bacaTeks(KEY, "[]");
    const pars = JSON.parse(mentah || "[]");
    return Array.isArray(pars) ? pars : [];
  } catch {
    return [];
  }
}

/** Tulis daftar akun penuh. */
export function simpanDaftarAkun(list) {
  return tulis(KEY, JSON.stringify(list));
}

/** Tambah akun bila belum ada; kembalikan daftar terbaru. */
export function tambahKeDaftar(akun) {
  const list = bacaDaftarAkun();
  const ada = list.some(
    (a) =>
      a.platform === akun.platform &&
      String(a.username || "").toLowerCase() === String(akun.username || "").toLowerCase(),
  );
  const baru = ada ? list : [...list, akun];
  simpanDaftarAkun(baru);
  return baru;
}

/** Hapus hanya bila daftar asli berhasil dibaca dan daftar baru disimpan. */
export function hapusDariDaftar(platform, username) {
  const dibaca = cobaBacaTeks(KEY);
  if (!dibaca.berhasil) return { tersimpan: false, daftar: [] };
  try {
    const lama = JSON.parse(dibaca.nilai || "[]");
    if (!Array.isArray(lama)) return { tersimpan: false, daftar: [] };
    const daftar = lama.filter(
      (a) => !(a.platform === platform &&
        String(a.username || "").toLowerCase() === String(username || "").toLowerCase()),
    );
    return { tersimpan: simpanDaftarAkun(daftar), daftar };
  } catch {
    return { tersimpan: false, daftar: [] };
  }
}
