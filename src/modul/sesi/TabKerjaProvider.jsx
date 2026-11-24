import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { adaPgnTitipan } from "../../lib/titipanAnalisa.js";
import { ID_DRAF_IMPOR, buatIdDrafImpor, pekerjaan } from "../pekerjaan/index.js";
import { aktifkanTab, bacaSesiTab, hapusPilihanAkun, hapusTabLain, normalisasiAkunTab, perbaruiTab, sesiBaru, simpanSesiTab, tabBaru, tambahTab } from "./tabKerja.js";
import { TAMPILAN_ANALISA } from "../../halaman/Analisa/konteks/analyzeKonteks.js";
import { useTampilan } from "../../halaman/Analisa/konteks/boardKonteks.js";

const KonteksTabKerja = createContext(null);

function storageSesi() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch (error) {
    console.error("Gagal mengakses penyimpanan sesi tab:", error);
    return null;
  }
}

export function TabKerjaProvider({ children }) {
  const [awal] = useState(() => {
    const tersimpan = bacaSesiTab(storageSesi());
    // PGN kiriman dari luar workspace harus dibuka, bukan ditimpa oleh
    // pemulihan tab lama. Pertahankan tab lama dan gunakan satu tab baru.
    if (tersimpan && adaPgnTitipan()) {
      const akun = tersimpan.daftar.find((tab) => tab.id === tersimpan.aktifId)?.akun;
      return { sesi: tambahTab(tersimpan, tabBaru(undefined, akun)), perluPulih: false };
    }
    return { sesi: tersimpan ?? sesiBaru(), perluPulih: Boolean(tersimpan) };
  });
  const [sesi, setSesi] = useState(awal.sesi);
  const [perluPulih, setPerluPulih] = useState(awal.perluPulih);
  const [sesiTersedia, setSesiTersedia] = useState(true);
  const sesiRef = useRef(sesi);
  const pembukaPapanRef = useRef(null);
  sesiRef.current = sesi;
  const [tampilan, setTampilan] = useTampilan();
  const tampilanRef = useRef(tampilan);
  tampilanRef.current = tampilan;
  const navigasiRef = useRef({ tabId: sesi.aktifId, tampilan, versi: 0 });
  if (navigasiRef.current.tabId !== sesi.aktifId || navigasiRef.current.tampilan !== tampilan) {
    navigasiRef.current = { tabId: sesi.aktifId, tampilan, versi: navigasiRef.current.versi + 1 };
  }

  useEffect(() => {
    if (!perluPulih) setSesiTersedia(simpanSesiTab(storageSesi(), sesi));
  }, [sesi, perluPulih]);

  const catat = useCallback((id, perubahan) => setSesi((lama) => perbaruiTab(lama, id, perubahan)), []);
  const tambah = useCallback((hapusId = null) => {
    const akunSaatIni = sesiRef.current.daftar.find((tab) => tab.id === sesiRef.current.aktifId)?.akun;
    const baru = tabBaru(undefined, akunSaatIni);
    setSesi((lama) => {
      // Tab baru mewarisi pilihan awal agar alur Akun → fitur tetap nyaman;
      // setelah dibuat, pilihan masing-masing tab berubah secara mandiri.
      const akun = lama.daftar.find((tab) => tab.id === lama.aktifId)?.akun;
      return tambahTab(lama, { ...baru, akun: normalisasiAkunTab(akun) }, hapusId);
    });
    return baru;
  }, []);
  const aktifkan = useCallback((id, hapusId = null) => setSesi((lama) => aktifkanTab(lama, id, hapusId)), []);
  const hapusLain = useCallback((id) => setSesi((lama) => hapusTabLain(lama, id)), []);
  const hapusAkunTerpilih = useCallback((platform, nama, pengganti) => {
    setSesi((lama) => hapusPilihanAkun(lama, platform, nama, pengganti));
  }, []);
  const selesaiPulih = useCallback(() => setPerluPulih(false), []);

  // AreaKerja memiliki logika pemulihan laporan dan konfirmasi analisis.
  // Navigasi di sebelahnya memakai handler yang sama, bukan mengganti layar
  // menjadi beranda dan secara tidak sengaja mengubah isi tab laporan.
  const daftarkanPembukaPapan = useCallback((buka) => {
    pembukaPapanRef.current = buka;
    return () => { if (pembukaPapanRef.current === buka) pembukaPapanRef.current = null; };
  }, []);
  const bukaPapan = useCallback(() => {
    if (pembukaPapanRef.current) return pembukaPapanRef.current();
    setTampilan(TAMPILAN_ANALISA.PAPAN);
    return undefined;
  }, [setTampilan]);

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
    sesiTersedia,
    selesaiPulih,
    catat,
    tambah,
    aktifkan,
    hapusLain,
    hapusAkunTerpilih,
    daftarkanPembukaPapan,
    bukaPapan,
    siapkanImpor,
    bukaImpor,
  }), [sesi, perluPulih, sesiTersedia, selesaiPulih, catat, tambah, aktifkan, hapusLain, hapusAkunTerpilih, daftarkanPembukaPapan, bukaPapan, siapkanImpor, bukaImpor]);
  return <KonteksTabKerja.Provider value={nilai}>{children}</KonteksTabKerja.Provider>;
}

export function useTabKerja() {
  const konteks = useContext(KonteksTabKerja);
  if (!konteks) throw new Error("TabKerjaProvider is missing");
  return konteks;
}
