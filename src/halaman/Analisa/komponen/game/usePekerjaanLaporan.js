import { useEffect, useMemo, useRef } from "react";
import { buatManajerLaporan } from "../../manajerLaporan.js";
import { daftarkanPembacaLaporan, simpanLaporanAktif } from "../../pekerjaan.js";

/** Simpan tiap perubahan papan, bukan tiap detak progres engine. */
export function usePekerjaanLaporan(papan) {
  const papanRef = useRef(papan);
  papanRef.current = papan;
  const manajer = useMemo(() => buatManajerLaporan(() => papanRef.current), []);
  const timerTutup = useRef(null);
  const { data, game, moveNumber, white, time, result, tab, customLine, arrows, pageState, depth } = papan;

  useEffect(() => {
    manajer.simpan();
  }, [manajer, data, game, moveNumber, white, time, result, tab, customLine, arrows, pageState, depth]);

  useEffect(() => {
    // Cleanup/pasang ulang StrictMode pada mount bukan penutupan sungguhan.
    clearTimeout(timerTutup.current);
    const lepas = daftarkanPembacaLaporan(manajer.baca);
    const saatDisembunyikan = () => {
      if (document.visibilityState === "hidden") simpanLaporanAktif();
    };
    window.addEventListener("pagehide", simpanLaporanAktif);
    document.addEventListener("visibilitychange", saatDisembunyikan);
    return () => {
      lepas();
      window.removeEventListener("pagehide", simpanLaporanAktif);
      document.removeEventListener("visibilitychange", saatDisembunyikan);
      timerTutup.current = setTimeout(() => manajer.tutup(), 0);
    };
  }, [manajer]);

  return manajer;
}
