/**
 * Konteks engine analisis.
 *
 * Semua komponen halaman Analisa (papan, panel langkah, pemutar partai) harus
 * memakai SATU worker Stockfish: tiap worker mengunduh ±7 MB WASM, jadi dua
 * worker sekaligus berarti dua kali lipat ukuran dan dua kali beban CPU.
 *
 * Provider ini yang memiliki worker tersebut:
 *  - dibuat malas (saat analisis pertama diminta),
 *  - dibangun ulang bila pengguna mengganti engine di panel Pengaturan,
 *  - dibuang saat halaman ditutup.
 *
 * Status (`mati | memuat | siap | gagal`) dibaca toolbar halaman untuk
 * menampilkan badge "engine", dan dipakai panel muat untuk menulis
 * "mengunduh engine…" sebelum persentase langkah muncul.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ENGINE_BAKU } from "../../../lib/engineCatur.js";
import { EngineAnalisis } from "../mesin/engine.js";
import { hashUntukEngine, wasmSupported } from "../mesin/cekWasm.js";
import { tulis } from "../penyimpanan.js";
import { KonteksMesin } from "./mesinKonteks.js";

export function MesinProvider({ children }) {
  // Do not restore a ChessClub selection pointing at an engine we do not ship.
  const [idEngine, setIdEngineState] = useState(ENGINE_BAKU);
  const [didukung] = useState(() => (typeof window === "undefined" ? true : wasmSupported()));
  const [status, setStatus] = useState("mati"); // mati | memuat | siap | gagal
  const [galat, setGalat] = useState("");
  const mesinRef = useRef(null);
  const generasiRef = useRef(0);
  /*
   * Opsi UCI per engine (Hash MB & Threads). Ref dipakai supaya `buat` yang
   * selalu dibuat ulang memakai nilai terkini tanpa dependensi berubah.
   */
  const opsiRef = useRef({ hash: hashUntukEngine(), threads: 1 });
  const [opsi, setOpsiState] = useState(opsiRef.current);

  const ubahOpsi = useCallback((perubahan) => {
    const hash = Number.isFinite(perubahan.hash)
      ? Math.min(128, Math.max(16, Math.round(perubahan.hash)))
      : opsiRef.current.hash;
    // The distributed Lite build is single-threaded regardless of saved UI state.
    const aman = { hash, threads: 1 };
    opsiRef.current = aman;
    setOpsiState(aman);
    mesinRef.current?.terapkanOpsi?.(aman);
  }, []);

  const buat = useCallback((id) => {
    // Naikkan generasi supaya Siapkan yang masih menunggu startup lama
    // tidak menimpa status engine baru dengan "gagal".
    generasiRef.current += 1;
    mesinRef.current?.hancurkan();
    const generasi = generasiRef.current;
    const mesin = new EngineAnalisis({
      idEngine: id,
      hash: opsiRef.current.hash,
      threads: opsiRef.current.threads,
      onError: (error) => {
        if (generasiRef.current !== generasi || mesinRef.current !== mesin) return;
        console.error("Engine analisis gagal:", error);
        setStatus("gagal");
        setGalat(error?.message ?? String(error));
      },
    });
    mesinRef.current = mesin;
    return mesin;
  }, []);

  /** Engine siap pakai (dimuat bila belum ada). Boleh dipanggil berulang. */
  const Siapkan = useCallback(async () => {
    const mesin = mesinRef.current ?? buat(idEngine);
    mesinRef.current = mesin;
    const generasiAwal = generasiRef.current;
    setStatus((s) => (s === "siap" ? s : "memuat"));
    try {
      await mesin.siapkan();
      // Jika engine sudah diganti selama menunggu, jangan timpa status baru.
      if (mesinRef.current !== mesin || generasiRef.current !== generasiAwal) return mesin;
      setStatus("siap");
      setGalat("");
      return mesin;
    } catch (e) {
      if (mesinRef.current !== mesin || generasiRef.current !== generasiAwal) throw e;
      setStatus("gagal");
      setGalat(e?.message ?? String(e));
      throw e;
    }
  }, [buat, idEngine]);

  const gantiEngine = useCallback(
    () => {
      setIdEngineState(ENGINE_BAKU);
      tulis("engine", ENGINE_BAKU);
      setStatus("mati");
      setGalat("");
      buat(ENGINE_BAKU);
    },
    [buat]
  );

  /** Batal pencarian aktif (tombol Batal pada panel muat). */
  const setop = useCallback(() => {
    mesinRef.current?.setop();
  }, []);

  // Identitas stabil: perubahan status worker tidak perlu membangun ulang
  // papan yang hanya memerlukan akses ke instance terkini.
  const ambilMesin = useCallback(() => mesinRef.current, []);

  useEffect(() => {
    return () => {
      generasiRef.current += 1;
      mesinRef.current?.hancurkan();
      mesinRef.current = null;
    };
  }, []);

  const nilai = {
    idEngine,
    gantiEngine,
    status,
    galat,
    siapkan: Siapkan,
    setop,
    /** Opsi UCI aktif (Hash MB & Threads). */
    opsi,
    /** Ubah opsi UCI — langsung disetel ke worker bila sudah ada. */
    ubahOpsi,
    /** Instance engine aktif, atau null bila belum pernah dimuat. */
    ambilMesin,
    didukung,
  };

  return <KonteksMesin.Provider value={nilai}>{children}</KonteksMesin.Provider>;
}
