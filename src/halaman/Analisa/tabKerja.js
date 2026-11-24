import { KUNCI_FITUR } from "../../modul/pekerjaan/index.js";

export const KUNCI_SESI_TAB = "maestro-analisa-tab-v1";

export function idTabBaru() {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `tab:${id}`;
}

/** Pilihan akun milik tab; daftar akun dan koleksinya tetap data bersama. */
export function normalisasiAkunTab(akun) {
  return {
    platform: akun?.platform === "lichessOrg" ? "lichessOrg" : "chessCom",
    username: typeof akun?.username === "string" && akun.username.length <= 200 ? akun.username.trim() : "",
  };
}

export function tabBaru(id = idTabBaru(), akun = null) {
  return { id, tampilan: "papan", tampilanPapan: "papan", laporanId: null, drafId: null, akun: normalisasiAkunTab(akun) };
}

export function sesiBaru() {
  const tab = tabBaru();
  return { daftar: [tab], aktifId: tab.id };
}

function idAman(id) {
  return typeof id === "string" && id.length > 0 && id.length <= 200;
}

function layarPapan(tampilan) {
  return tampilan === "papan" || tampilan === "bermain";
}

/** Tujuan terakhir tiap tab di area Papan, terpisah dari layar fitur aktif. */
function tujuanPapan(tab) {
  if (layarPapan(tab.tampilan)) return tab.tampilan;
  if (layarPapan(tab.tampilanPapan)) return tab.tampilanPapan;
  // Sesi versi lama belum menyimpan tujuan papan. Jika pengguna sedang di
  // fitur lain dan ada laporan, pulihkan laporan itu alih-alih menghilangkan
  // tabnya; sesi yang jelas berada di beranda tetap berada di beranda.
  return idAman(tab.laporanId) ? "bermain" : "papan";
}

/** Hanya simpan penunjuk; isi laporan dan draf tetap di penyimpanan pekerjaan. */
export function bacaSesiTab(storage) {
  try {
    const nilai = JSON.parse(storage?.getItem(KUNCI_SESI_TAB) ?? "null");
    if (nilai?.versi !== 1 || !Array.isArray(nilai.daftar) || !idAman(nilai.aktifId)) return null;
    const daftar = [];
    const idTerlihat = new Set();
    for (const tab of nilai.daftar) {
      if (!idAman(tab?.id) || idTerlihat.has(tab.id) ||
        (tab.tampilan !== "papan" && !Object.hasOwn(KUNCI_FITUR, tab.tampilan))) continue;
      idTerlihat.add(tab.id);
      daftar.push({
        id: tab.id,
        tampilan: tab.tampilan,
        tampilanPapan: tujuanPapan(tab),
        laporanId: idAman(tab.laporanId) ? tab.laporanId : null,
        drafId: idAman(tab.drafId) ? tab.drafId : null,
        akun: normalisasiAkunTab(tab.akun),
      });
    }
    if (!daftar.length || !daftar.some((tab) => tab.id === nilai.aktifId)) return null;
    return { daftar, aktifId: nilai.aktifId };
  } catch (error) {
    console.error("Gagal membaca sesi tab Analisa:", error);
    return null;
  }
}

export function simpanSesiTab(storage, sesi) {
  try {
    if (!storage || typeof storage.setItem !== "function") return false;
    storage.setItem(KUNCI_SESI_TAB, JSON.stringify({ versi: 1, daftar: sesi.daftar, aktifId: sesi.aktifId }));
    return true;
  } catch (error) {
    console.error("Gagal menyimpan sesi tab Analisa:", error);
    return false; // tab tetap bekerja dalam memori
  }
}

export function perbaruiTab(sesi, id, perubahan) {
  let berubah = false;
  const daftar = sesi.daftar.map((tab) => {
    if (tab.id !== id) return tab;
    const berikut = { ...tab, ...perubahan };
    berikut.tampilanPapan = layarPapan(berikut.tampilan) ? berikut.tampilan
      : layarPapan(perubahan.tampilanPapan) ? perubahan.tampilanPapan : tujuanPapan(tab);
    if (Object.hasOwn(perubahan, "akun")) berikut.akun = normalisasiAkunTab(perubahan.akun);
    if (tab.tampilan === berikut.tampilan && tab.tampilanPapan === berikut.tampilanPapan &&
      tab.laporanId === berikut.laporanId && tab.drafId === berikut.drafId &&
      tab.akun?.platform === berikut.akun?.platform && tab.akun?.username === berikut.akun?.username) return tab;
    berubah = true;
    return berikut;
  });
  return berubah ? { ...sesi, daftar } : sesi;
}

/** Akun yang dihapus bersama tidak boleh tetap terpilih di tab lain. */
export function hapusPilihanAkun(sesi, platform, nama, pengganti) {
  const kunci = String(nama || "").trim().toLowerCase();
  if (!kunci) return sesi;
  let berubah = false;
  const daftar = sesi.daftar.map((tab) => {
    if (tab.akun?.platform !== platform || String(tab.akun?.username || "").trim().toLowerCase() !== kunci) return tab;
    berubah = true;
    return { ...tab, akun: normalisasiAkunTab(pengganti) };
  });
  return berubah ? { ...sesi, daftar } : sesi;
}

export function tambahTab(sesi, tab = tabBaru(), hapusId = null) {
  return { daftar: [...sesi.daftar.filter((item) => item.id !== hapusId), tab], aktifId: tab.id };
}

export function aktifkanTab(sesi, id, hapusId = null) {
  if (!sesi.daftar.some((tab) => tab.id === id) || id === hapusId) return sesi;
  return { daftar: hapusId ? sesi.daftar.filter((tab) => tab.id !== hapusId) : sesi.daftar, aktifId: id };
}

export function hapusTabLain(sesi, id) {
  if (id === sesi.aktifId || !sesi.daftar.some((tab) => tab.id === id)) return sesi;
  return { ...sesi, daftar: sesi.daftar.filter((tab) => tab.id !== id) };
}
