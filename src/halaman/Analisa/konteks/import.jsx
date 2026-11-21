/**
 * Provider ImportContext: state muatan PGN + jalannya analisis.
 *
 * Enam state di sini dipindahkan apa adanya dari `konteks/analyze.jsx`
 * (Fase 2): nilai awal, lazy initializer (`adaPgnTitipan()`), dan
 * `new AbortController()` per-mount semuanya dipertahankan persis. Yang
 * berubah hanya letaknya — sehingga perubahan `progress` (tiap langkah
 * analisis) tidak lagi me-render `BoardProvider`.
 *
 * Alasan `analyzeController` ikut di sini: ia hidup sepanjang satu jalannya
 * analisis (dibatalkan/diganti saat analisis baru), bukan sepanjang
 * navigasi papan.
 */
import { useCallback, useMemo, useState } from "react";
import { adaPgnTitipan } from "../../../lib/titipanAnalisa.js";
import { buatIdPekerjaan, pekerjaan, simpanLaporanAktif } from "../pekerjaan.js";
import { ImportContext } from "./importKonteks.js";

export function ImportProvider({ children }) {
  const [data, setDataState] = useState(() => ({
    format: "fen", string: "", pekerjaanId: buatIdPekerjaan(), awalPekerjaan: true,
  }));
  // Muatan baru mendapat id baru; pemulihan membawa id lama. Papan "Mulai
  // baru" yang benar-benar masih kosong dipakai ulang saat pertama diisi,
  // agar tidak meninggalkan entri kosong setiap kali pengguna mengimpor PGN.
  const setData = useCallback((berikut) => {
    simpanLaporanAktif();
    const idBaru = buatIdPekerjaan();
    const keadaan = pekerjaan.snapshot();
    const papanKosong = keadaan.daftar.find((item) => item.id === keadaan.aktif.id && item.status === "baru");
    setDataState((sebelum) => {
      const nilai = typeof berikut === "function" ? berikut(sebelum) : berikut;
      if (!nilai || nilai === sebelum) return sebelum;
      const id = nilai.pekerjaanId ?? (papanKosong?.id === sebelum.pekerjaanId ? papanKosong.id : idBaru);
      return { ...nilai, pekerjaanId: id };
    });
  }, []);
  /*
   * Bila halaman dibuka dengan PGN titipan dari teka-teki (tombol "Analisa"),
   * mulai dalam keadaan `loading`. Tanpa ini render PERTAMA papan memakai
   * posisi/`pageState` bawaan dan pengguna sempat melihat papan posisi awal
   * ±1 detik sebelum posisi soal datang. `loading` juga sudah dikenali panel
   * ringkasan (`memuatPartai`) maupun papan (kerangka), jadi tidak ada
   * keadaan baru yang perlu ditangani layar lain.
   */
  const [pageState, setPageState] = useState(() => (adaPgnTitipan() ? "loading" : "default"));
  const [progress, setProgress] = useState(0);
  // Malas (per-mount), BUKAN lajang modul: `abortControllerInstance` dipakai
  // bersama semua mount provider (termasuk StrictMode ganda + uji) sehingga
  // membatalkan di satu tempat mematikan controller tempat lain.
  const [analyzeController, setAnalyzeController] = useState(() => new AbortController());
  const [analyzingMove, setAnalyzingMove] = useState(false);
  /* Posisi lengkap dari PGN; eval tiap posisi diisi selama analisis berjalan. */
  const [langkahSementara, setLangkahSementara] = useState([]);

  const nilai = useMemo(
    () => ({
      data: [data, setData],
      pageState: [pageState, setPageState],
      progress: [progress, setProgress],
      analyzeController: [analyzeController, setAnalyzeController],
      analyzingMove: [analyzingMove, setAnalyzingMove],
      langkahSementara: [langkahSementara, setLangkahSementara],
    }),
    [data, pageState, progress, analyzeController, analyzingMove, langkahSementara]
  );
  return <ImportContext.Provider value={nilai}>{children}</ImportContext.Provider>;
}
