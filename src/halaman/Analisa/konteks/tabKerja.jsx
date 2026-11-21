import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { adaPgnTitipan } from "../../../lib/titipanAnalisa.js";
import { ID_DRAF_IMPOR, buatIdDrafImpor, pekerjaan } from "../pekerjaan.js";
import { aktifkanTab, bacaSesiTab, hapusTabLain, perbaruiTab, sesiBaru, simpanSesiTab, tabBaru, tambahTab } from "../tabKerja.js";
import { TAMPILAN_ANALISA } from "./analyzeKonteks.js";
import { useBoard } from "./boardKonteks.js";

const KonteksTabKerja = createContext(null);

function storageSesi() {
  try { return globalThis.sessionStorage ?? null; } catch { return null; }
}

export function TabKerjaProvider({ children }) {
  const [awal] = useState(() => {
    const tersimpan = bacaSesiTab(storageSesi());
    // PGN kiriman dari luar workspace harus dibuka, bukan ditimpa oleh
    // pemulihan tab lama. Pertahankan tab lama dan gunakan satu tab baru.
    if (tersimpan && adaPgnTitipan()) return { sesi: tambahTab(tersimpan, tabBaru()), perluPulih: false };
    return { sesi: tersimpan ?? sesiBaru(), perluPulih: Boolean(tersimpan) };
  });
  const [sesi, setSesi] = useState(awal.sesi);
  const [perluPulih, setPerluPulih] = useState(awal.perluPulih);
  const sesiRef = useRef(sesi);
  sesiRef.current = sesi;
  const [tampilan, setTampilan] = useBoard().tampilan;
  const tampilanRef = useRef(tampilan);
  tampilanRef.current = tampilan;
  const navigasiRef = useRef({ tabId: sesi.aktifId, tampilan, versi: 0 });
  if (navigasiRef.current.tabId !== sesi.aktifId || navigasiRef.current.tampilan !== tampilan) {
    navigasiRef.current = { tabId: sesi.aktifId, tampilan, versi: navigasiRef.current.versi + 1 };
  }

  useEffect(() => {
    if (!perluPulih) simpanSesiTab(storageSesi(), sesi);
  }, [sesi, perluPulih]);

  const catat = useCallback((id, perubahan) => setSesi((lama) => perbaruiTab(lama, id, perubahan)), []);
  const tambah = useCallback((hapusId = null) => {
    const baru = tabBaru();
    setSesi((lama) => tambahTab(lama, baru, hapusId));
    return baru;
  }, []);
  const aktifkan = useCallback((id, hapusId = null) => setSesi((lama) => aktifkanTab(lama, id, hapusId)), []);
  const hapusLain = useCallback((id) => setSesi((lama) => hapusTabLain(lama, id)), []);
  const selesaiPulih = useCallback(() => setPerluPulih(false), []);

  /** Pilih draf milik tab, bukan menimpa draf yang sedang dibuka tab lain. */
  const siapkanImpor = useCallback(async (tabId, pilihanId = null, masihDipilih = () => true) => {
    await pekerjaan.init();
    const keadaan = sesiRef.current;
    const tab = keadaan.daftar.find((item) => item.id === tabId);
    if (!tab || !masihDipilih()) return null;
    let id = pilihanId || tab.drafId;
    if (!id) {
      const pekerjaanSaatIni = pekerjaan.snapshot();
      const terakhir = pekerjaanSaatIni.terakhirDrafId ?? pekerjaanSaatIni.daftar.find((item) => item.jenis === "draf")?.id ?? ID_DRAF_IMPOR;
      const dipakaiTabLain = keadaan.daftar.some((item) => item.id !== tabId && item.drafId === terakhir);
      id = dipakaiTabLain ? buatIdDrafImpor() : terakhir;
    }
    pekerjaan.tetapkanDrafAktif(id);
    catat(tabId, { drafId: id });
    return id;
  }, [catat]);

  const bukaImpor = useCallback(async (pilihanId = null) => {
    const tabId = sesiRef.current.aktifId;
    const asal = tampilanRef.current;
    const versi = navigasiRef.current.versi;
    // Permintaan lama tidak boleh muncul lagi setelah pergi dan kembali ke
    // layar yang sama selagi penyimpanan masih dibuka.
    const masihDipilih = () => navigasiRef.current.versi === versi && sesiRef.current.aktifId === tabId && tampilanRef.current === asal;
    const id = await siapkanImpor(tabId, pilihanId, masihDipilih);
    if (!id || !masihDipilih()) return false;
    setTampilan(TAMPILAN_ANALISA.IMPOR);
    return true;
  }, [setTampilan, siapkanImpor]);

  const nilai = useMemo(() => ({
    daftar: sesi.daftar,
    aktifId: sesi.aktifId,
    perluPulih,
    selesaiPulih,
    catat,
    tambah,
    aktifkan,
    hapusLain,
    siapkanImpor,
    bukaImpor,
  }), [sesi, perluPulih, selesaiPulih, catat, tambah, aktifkan, hapusLain, siapkanImpor, bukaImpor]);
  return <KonteksTabKerja.Provider value={nilai}>{children}</KonteksTabKerja.Provider>;
}

export function useTabKerja() {
  const konteks = useContext(KonteksTabKerja);
  if (!konteks) throw new Error("TabKerjaProvider is missing");
  return konteks;
}
