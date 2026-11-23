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
import { ENGINE_BAKU, cariEngine } from "../../../lib/engineCatur.js";
import { EngineAnalisis } from "../mesin/engine.js";
import { hashUntukEngine, wasmSupported } from "../mesin/cekWasm.js";
import { bacaAngka, bacaTeks, tulis } from "../penyimpanan.js";
import { KonteksMesin } from "./mesinKonteks.js";

/** Batas waktu pencarian (ms). null = tanpa batas waktu tambahan. */
function jepitBatasWaktu(nilai) {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  return Number.isFinite(nilai) ? Math.min(60000, Math.max(1000, Math.round(nilai))) : null;
}

export function MesinProvider({ children }) {
  // The visible state starts with the same value on the server and during
  // hydration. Restore the ref immediately, however: a child effect can ask
  // for an engine before this provider's effects run. Only known IDs are used.
  const [idEngine, setIdEngineState] = useState(ENGINE_BAKU);
  const idEngineRef = useRef(null);
  if (idEngineRef.current === null) idEngineRef.current = cariEngine(bacaTeks("engine", ENGINE_BAKU)).id;
  const [didukung] = useState(() => (typeof window === "undefined" ? true : wasmSupported()));
  const [status, setStatus] = useState("mati"); // mati | memuat | siap | gagal
  const [galat, setGalat] = useState("");
  const mesinRef = useRef(null);
  const generasiRef = useRef(0);
  /*
   * Opsi UCI per engine (Hash MB, Threads, Skill Level & batas waktu). Ref dipakai supaya
   * `buat` yang selalu dibuat ulang memakai nilai terkini tanpa dependensi
   * berubah. Pilihan pengguna bertahan di localStorage; bila penyimpanan
   * diblokir, nilai state tetap berlaku untuk sesi ini.
   */
  const opsiRef = useRef({
    hash: Math.min(128, Math.max(16, Math.round(bacaAngka("hash", hashUntukEngine())))),
    threads: 1,
    skill: (() => {
      const nilai = bacaAngka("skill", null);
      return nilai === null ? null : Math.min(20, Math.max(0, Math.round(nilai)));
    })(),
    movetime: jepitBatasWaktu(bacaAngka("movetime", null)),
  });
  const [opsi, setOpsiState] = useState(opsiRef.current);
  // Nilai bawaan dipakai panel pengaturan untuk tombol "Reset".
  const opsiBawaan = useRef({ hash: hashUntukEngine(), skill: null, movetime: null }).current;

  const ubahOpsi = useCallback((perubahan) => {
    const hash = Number.isFinite(perubahan.hash)
      ? Math.min(128, Math.max(16, Math.round(perubahan.hash)))
      : opsiRef.current.hash;
    const skill = "skill" in perubahan
      ? perubahan.skill === null
        ? null
        : Number.isFinite(perubahan.skill)
          ? Math.min(20, Math.max(0, Math.round(perubahan.skill)))
          : opsiRef.current.skill
      : opsiRef.current.skill;
    const movetime = "movetime" in perubahan
      ? jepitBatasWaktu(perubahan.movetime)
      : opsiRef.current.movetime;
    // The distributed Lite build is single-threaded regardless of saved UI state.
    const aman = { hash, threads: 1, skill, movetime };
    opsiRef.current = aman;
    setOpsiState(aman);
    mesinRef.current?.terapkanOpsi?.(aman);
    if (Number.isFinite(perubahan.hash)) tulis("hash", hash);
    if ("skill" in perubahan) tulis("skill", skill === null ? "" : skill);
    if ("movetime" in perubahan) tulis("movetime", movetime === null ? "" : movetime);
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
      skill: opsiRef.current.skill,
      movetime: opsiRef.current.movetime,
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
    const mesin = mesinRef.current ?? buat(idEngineRef.current);
    mesinRef.current = mesin;
    const generasiAwal = generasiRef.current;
    setStatus((s) => (s === "siap" ? s : "memuat"));
    try {
      await mesin.siapkan();
      // A resolved startup can race a selection change before this microtask
      // resumes. Never hand a destroyed, superseded engine to the caller.
      if (mesinRef.current !== mesin || generasiRef.current !== generasiAwal) throw new Error("engine diganti");
      setStatus("siap");
      setGalat("");
      return mesin;
    } catch (e) {
      if (mesinRef.current !== mesin || generasiRef.current !== generasiAwal) throw e;
      setStatus("gagal");
      setGalat(e?.message ?? String(e));
      throw e;
    }
  }, [buat]);

  const gantiEngine = useCallback(
    (id) => {
      const pilihan = cariEngine(id).id;
      idEngineRef.current = pilihan;
      setIdEngineState(pilihan);
      tulis("engine", pilihan);
      setStatus("mati");
      setGalat("");
      buat(pilihan);
    },
    [buat]
  );

  useEffect(() => {
    // If a child selected an engine in its mount effect, use the newer ref
    // rather than overwriting it with the value originally read from storage.
    setIdEngineState(idEngineRef.current);
  }, []);

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
    /** Opsi UCI aktif (Hash MB, Threads, Skill Level & batas waktu). */
    opsi,
    /** Nilai awal opsi di atas, dipakai tombol Reset. */
    opsiBawaan,
    /** Ubah opsi UCI — langsung disetel ke worker bila sudah ada. */
    ubahOpsi,
    /** Instance engine aktif, atau null bila belum pernah dimuat. */
    ambilMesin,
    didukung,
  };

  return <KonteksMesin.Provider value={nilai}>{children}</KonteksMesin.Provider>;
}
