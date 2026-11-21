import { useEffect, useState } from "react";
import { ambilSemuaKoleksi, langgananRevisi } from "../basisData.js";
import { bacaDaftarAkun } from "./daftarAkun.js";

/** Segarkan data bersama ketika panel aktif atau basis data berubah. */
export function useAkunKoleksi(aktif = true) {
  const [akunTersimpan, setAkunTersimpan] = useState(bacaDaftarAkun);
  const [koleksi, setKoleksi] = useState([]);

  useEffect(() => {
    if (!aktif) return undefined;
    let hidup = true;
    let permintaan = 0;
    function muat() {
      setAkunTersimpan(bacaDaftarAkun());
      const nomor = ++permintaan;
      ambilSemuaKoleksi().then((daftar) => {
        if (hidup && nomor === permintaan) setKoleksi(daftar);
      }).catch(() => {
        if (hidup && nomor === permintaan) setKoleksi([]);
      });
    }
    muat();
    const berhenti = langgananRevisi(muat);
    return () => { hidup = false; berhenti(); };
  }, [aktif]);

  return { akunTersimpan, koleksi };
}
