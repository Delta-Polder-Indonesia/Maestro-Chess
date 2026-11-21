import { KUNCI_FITUR } from "./riwayatFitur.js";

export const KUNCI_SESI_TAB = "maestro-analisa-tab-v1";

export function idTabBaru() {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `tab:${id}`;
}

export function tabBaru(id = idTabBaru()) {
  return { id, tampilan: "papan", laporanId: null, drafId: null };
}

export function sesiBaru() {
  const tab = tabBaru();
  return { daftar: [tab], aktifId: tab.id };
}

function idAman(id) {
  return typeof id === "string" && id.length > 0 && id.length <= 200;
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
        laporanId: idAman(tab.laporanId) ? tab.laporanId : null,
        drafId: idAman(tab.drafId) ? tab.drafId : null,
      });
    }
    if (!daftar.length || !daftar.some((tab) => tab.id === nilai.aktifId)) return null;
    return { daftar, aktifId: nilai.aktifId };
  } catch {
    return null;
  }
}

export function simpanSesiTab(storage, sesi) {
  try { storage?.setItem(KUNCI_SESI_TAB, JSON.stringify({ versi: 1, daftar: sesi.daftar, aktifId: sesi.aktifId })); } catch { /* tab tetap bekerja dalam memori */ }
}

export function perbaruiTab(sesi, id, perubahan) {
  let berubah = false;
  const daftar = sesi.daftar.map((tab) => {
    if (tab.id !== id) return tab;
    const berikut = { ...tab, ...perubahan };
    if (tab.tampilan === berikut.tampilan && tab.laporanId === berikut.laporanId && tab.drafId === berikut.drafId) return tab;
    berubah = true;
    return berikut;
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
