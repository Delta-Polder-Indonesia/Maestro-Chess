/*
 * Layar "Akun" — daftar akun di kiri, panel tarik partai di kanan.
 */
import { useContext, useEffect, useRef, useState } from "react";
import PanelLayar from "./PanelLayar.jsx";
import DaftarAkun from "../../akun/DaftarAkun.jsx";
import PanelTarikPartai from "../../akun/PanelTarikPartai.jsx";
import { bacaDaftarAkun, tambahKeDaftar, hapusDariDaftar } from "../../akun/daftarAkun.js";
import { bacaRevisiBasis, hapusKoleksi, langgananRevisi, pastikanKoleksi } from "../../basisData.js";
import { AnalyzeContext } from "../../konteks/analyzeKonteks.js";

export default function LayarAkun({ onTutup, onAkunDihapus, akunTab, aktif = true }) {
  const analyzeContext = useContext(AnalyzeContext);
  const [username, setUsername] = akunTab ?? analyzeContext.akun;
  const [daftar, setDaftar] = useState(() => bacaDaftarAkun());
  const [revisiBasis, setRevisiBasis] = useState(() => bacaRevisiBasis());
  const kendaliTarikRef = useRef(null);
  const akunSedangDipilih = (platform, nama) =>
    username?.platform === platform &&
    String(username?.username || "").toLowerCase() === String(nama || "").toLowerCase();

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
    const list = bacaDaftarAkun();
    if (username?.username) {
      const ada = list.some(
        (a) =>
          a.platform === username.platform &&
          String(a.username || "").toLowerCase() === String(username.username || "").toLowerCase(),
      );
      if (!ada) {
        tambahKeDaftar({ platform: username.platform, username: username.username });
      }
    }
    /*
     * Selaraskan SELURUH daftar ke basis data, bukan hanya akun aktif:
     * bila IndexedDB pernah dibersihkan (atau akun ditambahkan sebelum
     * koleksinya sempat tersimpan), akun-akun lain tidak punya koleksi dan
     * tidak akan pernah muncul di layar Database.
     */
    for (const a of bacaDaftarAkun()) {
      if (a?.platform && a?.username) {
        pastikanKoleksi({ platform: a.platform, username: a.username }).catch(() => {});
      }
    }
    setDaftar(bacaDaftarAkun());
  }, [username?.username, username?.platform]);

  function tambahAkunHandler(platform, nama) {
    if (!akunSedangDipilih(platform, nama)) kendaliTarikRef.current?.abort();
    const list = tambahKeDaftar({ platform, username: nama });
    setDaftar(list);
    setUsername({ platform, username: nama });
    pastikanKoleksi({ platform, username: nama }).catch(() => {});
  }

  function hapusAkunHandler(platform, nama) {
    const aktif = akunSedangDipilih(platform, nama);
    // Cancel before starting deletion, not only after React switches panels.
    if (aktif) kendaliTarikRef.current?.abort();
    const list = hapusDariDaftar(platform, nama);
    setDaftar(list);
    // Pemilihan akun terpisah per tab, tetapi penghapusan akun bersifat
    // bersama. Bersihkan hanya tab yang masih menunjuk akun yang dihapus.
    onAkunDihapus?.(platform, nama, list[0]);
    hapusKoleksi(`${platform}:${String(nama || "").trim().toLowerCase()}`).catch(() => {});
    if (aktif) {
      const berikut = list[0];
      if (!berikut) {
        setUsername({ platform: "", username: "" });
        onTutup();
        return;
      }
      setUsername({ platform: berikut.platform, username: berikut.username });
    }
  }

  return (
    <PanelLayar>
      <div className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4 lg:flex-row">
        {/* Kolom kiri: daftar akun - di HP max 45vh biar statistik tetap kelihatan */}
        <div className="flex w-full shrink-0 flex-col gap-3 lg:w-1/2 lg:min-h-0 max-h-[45vh] sm:max-h-[38vh] lg:max-h-none overflow-y-auto lg:overflow-visible">
          <DaftarAkun
            daftar={daftar}
            aktif={username}
            tabAktif={aktif}
            revisi={revisiBasis}
            onPilih={(p, u) => {
              if (!akunSedangDipilih(p, u)) kendaliTarikRef.current?.abort();
              const updated = tambahKeDaftar({ platform: p, username: u });
              setDaftar(updated);
              setUsername({ platform: p, username: u });
              pastikanKoleksi({ platform: p, username: u }).catch(() => {});
            }}
            onHapus={hapusAkunHandler}
            onTambah={tambahAkunHandler}
          />
        </div>

        {/* Kolom kanan: tarik partai akun aktif */}
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-2 lg:w-1/2 overflow-y-auto">
          <div className="min-h-0 min-w-0 flex-1 flex flex-col">
            <div className="flex h-full w-full flex-col p-1" data-uji="akun-kartu-kanan">
              <div className="flex min-h-48 lg:min-h-0 flex-1 flex-col overflow-hidden rounded-[0.4rem] border border-border bg-backgroundBox">
                <PanelTarikPartai
                  akun={username}
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
