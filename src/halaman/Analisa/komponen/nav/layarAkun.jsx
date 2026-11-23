/*
 * Layar "Akun" — daftar akun di kiri, panel tarik partai di kanan.
 */
import { useContext, useEffect, useRef, useState } from "react";
import { useI18n } from "../../../../lib/i18n.jsx";
import PanelLayar from "./PanelLayar.jsx";
import DaftarAkun from "../../akun/DaftarAkun.jsx";
import PanelTarikPartai from "../../akun/PanelTarikPartai.jsx";
import { bacaDaftarAkun, tambahKeDaftar, hapusDariDaftar } from "../../akun/daftarAkun.js";
import { bacaRevisiBasis, hapusKoleksi, langgananRevisi, pastikanKoleksi } from "../../basisData.js";
import { bukaDB } from "../../database/migrasi.js";
import { AnalyzeContext } from "../../konteks/analyzeKonteks.js";
import { ErrorsContext } from "../../konteks/errorsKonteks.js";
import { pushPageWarning } from "../errors/pushPageError.js";
import { bersihkanCacheAntiCheat } from "../../akun/antiCheatRiwayat.js";
import { akunSedangDihapus, aktifkanKembaliAkun, denganKunciAkun, mulaiPenghapusanAkun, tandaiPenghapusanAkun } from "../../akun/koordinasiAkun.js";

export default function LayarAkun({ onAkunDihapus, akunTab, aktif = true }) {
  const { t } = useI18n();
  const analyzeContext = useContext(AnalyzeContext);
  const setErrors = useContext(ErrorsContext).errors[1];
  const aktifRef = useRef(aktif);
  aktifRef.current = aktif;
  useEffect(() => () => { aktifRef.current = false; }, []);
  const [username, setUsername] = akunTab ?? analyzeContext.akun;
  const usernameRef = useRef(username);
  usernameRef.current = username;
  const [daftar, setDaftar] = useState(() => bacaDaftarAkun());
  const [revisiBasis, setRevisiBasis] = useState(() => bacaRevisiBasis());
  const kendaliTarikRef = useRef(null);
  const hapusBerjalanRef = useRef(false);
  const [sedangHapus, setSedangHapus] = useState(false);
  const [galatHapus, setGalatHapus] = useState(false);
  const akunSedangDipilih = (platform, nama) =>
    usernameRef.current?.platform === platform &&
    String(usernameRef.current?.username || "").toLowerCase() === String(nama || "").toLowerCase();

  // Daftar akun dan jumlah partai adalah data bersama. Segarkan saat kembali
  // ke tab ini serta ketika basis berubah, tanpa mereset pilihan akun lokal.
  useEffect(() => {
    if (!aktif) return undefined;
    const segarkan = () => {
      setDaftar(bacaDaftarAkun());
      setRevisiBasis(bacaRevisiBasis());
    };
    segarkan();
    return langgananRevisi(segarkan);
  }, [aktif]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.addEventListener) return undefined;
    const sinkronkan = (event) => {
      if (event.key !== "maestro-analisa-daftar-akun") return;
      const list = bacaDaftarAkun();
      setDaftar(list);
      const terpilih = usernameRef.current;
      if (!terpilih?.username || !akunSedangDihapus(terpilih.platform, terpilih.username)) return;
      kendaliTarikRef.current?.abort();
      const berikut = list[0];
      onAkunDihapus?.(terpilih.platform, terpilih.username, berikut);
      setUsername(berikut ? { platform: berikut.platform, username: berikut.username } : { platform: "", username: "" });
    };
    window.addEventListener("storage", sinkronkan);
    return () => window.removeEventListener("storage", sinkronkan);
  }, [onAkunDihapus, setUsername]);

  useEffect(() => {
    let hidup = true;
    void (async () => {
      const list = await denganKunciAkun(() => {
        const sekarang = bacaDaftarAkun();
        if (!hidup || !username?.username || akunSedangDihapus(username.platform, username.username)) return sekarang;
        const ada = sekarang.some((a) => a.platform === username.platform &&
          String(a.username || "").toLowerCase() === String(username.username || "").toLowerCase());
        return ada ? sekarang : tambahKeDaftar({ platform: username.platform, username: username.username });
      });
      if (!hidup) return;
      // Semua koleksi diselaraskan, dengan pemeriksaan generasi masing-masing.
      for (const a of list) {
        if (a?.platform && a?.username) pastikanKoleksi({ platform: a.platform, username: a.username }).catch(() => {});
      }
      setDaftar(list);
    })();
    return () => { hidup = false; };
  }, [username?.username, username?.platform]);

  async function tambahAkunHandler(platform, nama) {
    if (hapusBerjalanRef.current) return;
    const list = await denganKunciAkun(() => {
      if (hapusBerjalanRef.current || !aktifkanKembaliAkun(platform, nama)) return null;
      return tambahKeDaftar({ platform, username: nama });
    });
    if (!list) {
      if (!hapusBerjalanRef.current) pushPageWarning(setErrors, t("analisa.akun.tambahBaru"), t("analisa.akun.aktifkanGagal"), { persisten: true });
      return;
    }
    if (!akunSedangDipilih(platform, nama)) kendaliTarikRef.current?.abort();
    setDaftar(list);
    setUsername({ platform, username: nama });
    pastikanKoleksi({ platform, username: nama }).catch(() => {});
  }

  async function pilihAkunHandler(platform, nama) {
    if (hapusBerjalanRef.current) return;
    const list = await denganKunciAkun(() => {
      if (hapusBerjalanRef.current || akunSedangDihapus(platform, nama)) return null;
      return tambahKeDaftar({ platform, username: nama });
    });
    if (!list) return;
    if (!akunSedangDipilih(platform, nama)) kendaliTarikRef.current?.abort();
    setDaftar(list);
    setUsername({ platform, username: nama });
    pastikanKoleksi({ platform, username: nama }).catch(() => {});
  }

  function laporHapusGagal() {
    setGalatHapus(true);
    // Penghapusan dapat selesai setelah pengguna berpindah tab; peringatan
    // global tetap terlihat, sedangkan panel aktif memiliki pesan inline.
    if (!aktifRef.current) pushPageWarning(setErrors, t("analisa.akun.hapus"), t("analisa.akun.hapusGagal"), { persisten: true });
  }

  async function hapusAkunHandler(platform, nama) {
    if (hapusBerjalanRef.current) return;
    // Semua unduhan, tulisan dan deteksi untuk akun ini di tab workspace
    // lain dibatalkan sebelum transaksi penghapusan dimulai.
    const selesai = mulaiPenghapusanAkun(platform, nama);
    if (!selesai) return;
    hapusBerjalanRef.current = true;
    setSedangHapus(true);
    setGalatHapus(false);
    const dipilih = akunSedangDipilih(platform, nama);
    if (dipilih) kendaliTarikRef.current?.abort();
    try {
      const koleksiId = `${platform}:${String(nama || "").trim().toLowerCase()}`;
      const hasil = await denganKunciAkun(async () => {
        // Pemulihan harus selesai sebelum penanda diubah; tidak boleh ada
        // migrasi cadangan atau tulisan akun lain di tengah penghapusan.
        const db = await bukaDB({ terkunci: true });
        const penanda = tandaiPenghapusanAkun(platform, nama);
        if (!penanda) return null;
        let berhasil = false;
        try {
          if (!(await hapusKoleksi(koleksiId, { terkunci: true, dbTerbuka: db })) || !bersihkanCacheAntiCheat()) return null;
          const hasilDaftar = hapusDariDaftar(platform, nama);
          if (!hasilDaftar.tersimpan || !penanda.selesai(true)) return null;
          berhasil = true;
          return hasilDaftar;
        } finally {
          if (!berhasil) penanda.selesai(false);
        }
      }, { wajib: true });
      if (!hasil) {
        laporHapusGagal();
        return;
      }
      const list = hasil.daftar;
      setDaftar(list);
      // Pilihan di tab lain diganti hanya setelah setiap langkah berhasil.
      onAkunDihapus?.(platform, nama, list[0]);
      if (akunSedangDipilih(platform, nama)) {
        const berikut = list[0];
        if (!berikut) {
          // Tetap di layar Akun agar daftar kosong dan tombol tambah akun
          // terlihat; penghapusan bukan permintaan untuk membuka papan.
          setUsername({ platform: "", username: "" });
        } else {
          setUsername({ platform: berikut.platform, username: berikut.username });
        }
      }
    } catch {
      laporHapusGagal();
    } finally {
      selesai();
      hapusBerjalanRef.current = false;
      setSedangHapus(false);
    }
  }

  return (
    <PanelLayar>
      <h1 className="sr-only">{t("analisa.nav.akun")}</h1>
      {galatHapus ? <p role="alert" data-uji="hapus-akun-gagal" className="rounded-borderRoundness border border-lossRed px-3 py-2 text-sm text-lossRed">{t("analisa.akun.hapusGagal")}</p> : null}
      {sedangHapus ? <p role="status" className="px-3 py-2 text-sm text-foregroundGrey">{t("analisa.akun.menghapus")}</p> : null}
      <div className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4 lg:flex-row">
        {/* Kolom kiri: daftar akun - di HP max 45vh biar statistik tetap kelihatan */}
        <div className="flex w-full shrink-0 flex-col gap-3 lg:w-1/2 lg:min-h-0 max-h-[45vh] sm:max-h-[38vh] lg:max-h-none overflow-y-auto lg:overflow-visible">
          <DaftarAkun
            daftar={daftar}
            aktif={username}
            tabAktif={aktif}
            revisi={revisiBasis}
            disabled={sedangHapus}
            onPilih={pilihAkunHandler}
            onHapus={hapusAkunHandler}
            onTambah={tambahAkunHandler}
          />
        </div>

        {/* Kolom kanan: tarik partai akun aktif */}
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-2 overflow-y-auto lg:w-1/2">
          <div className="min-h-0 min-w-0 flex-1 flex flex-col">
            <div className="flex h-full w-full flex-col" data-uji="akun-kartu-kanan">
              <div className="flex min-h-48 lg:min-h-0 flex-1 flex-col overflow-hidden rounded-[6px] border-2 border-border bg-backgroundBox">
                <PanelTarikPartai
                  akun={username}
                  disabled={sedangHapus}
                  abortRef={kendaliTarikRef}
                  onSelesai={() => setRevisiBasis(bacaRevisiBasis())}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </PanelLayar>
  );
}
