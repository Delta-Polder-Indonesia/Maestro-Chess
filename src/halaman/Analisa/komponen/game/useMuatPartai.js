/*
 * Memuat partai ke papan — dua bentuk masukan, satu siklus hidup.
 *
 *   - `handlePGN`: analisis penuh satu partai (parsePGN + engine + buku
 *     pembukaan), memakai `AbortController` yang dipasang di konteks.
 *   - `handleFEN`: posisi bebas tanpa riwayat langkah (parsePosition).
 *
 * Hook ini lahir dari pemecahan `game.jsx` (Fase 3). Tiga ref di bawah adalah
 * jantung perilaku balapannya, jadi kepemilikannya sengaja di sini dan
 * diberikan ke pemanggil:
 *
 *   - `muatSeqRef`  — nomor urut muatan; muatan lama yang dibatalkan tidak
 *                     boleh menyetor state ke muatan baru.
 *   - `controllerRef` — cermin `analyzeController` yang segar untuk alur async
 *                     (dipakai juga oleh `useAnalisisPapan`).
 *   - `openingsRef` — tabel nama pembukaan, diunduh saat senggang peramban
 *                     (±160 KiB, jangan di jalur kritis) dan dipakai bersama
 *                     oleh dua alur di atas.
 *
 * Semua setter datang dari `AnalyzeContext` lewat parameter: hook ini tidak
 * membaca konteks sendiri supaya ketergantungannya kelihatan di berkas
 * pemanggil.
 */
import { useCallback, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { bacaPartaiPGN, formatSquare, parsePGN, parsePosition } from "../../mesin/engine.js";
import { cariNamaPembukaan } from "../../mesin/buku.js";
import { pushPageError, pushPageWarning } from "../../../../modul/sesi/galat.js";
import { hashPgn } from "../../../../lib/pgnRingan.js";
import { ringkasAnalisis } from "../../mesin/ringkasanAnalisis.js";
import { catatAnalisis } from "../../../../modul/analisis/analisisTersimpan.js";
import { adaPgnTitipan } from "../../../../modul/sesi/titipan.js";
import { snapshotLaporanAman } from "../../../../modul/pekerjaan/index.js";
import { gameStartSound } from "./gameStartSound.js";

export function useMuatPartai({
  data,
  depth,
  pekerjaanLaporan,
  analyzeController,
  boardSoundsRef,
  siapkan,
  t,
  setErrors,
  setAnalyzeController,
  setPageState,
  setTab,
  setProgress,
  setLangkahSementara,
  setTime,
  setPlayers,
  setGame,
  setResult,
  setAnimation,
  setArrows,
  setCustomLine,
  setAnalyzingMove,
  setMoveNumber,
  setWhite,
  setPlaying,
  setForward,
  setReturnedToNormalGame,
}) {
  const openingsRef = useRef(null);
  // Nomor urut muatan partai: muatan yang lebih lama dibatalkan oleh yang
  // lebih baru sehingga hasilnya tidak saling menimpa (`related key` ada di
  // useEffect [data]).
  const muatSeqRef = useRef(0);
  /*
   * Cermin controller untuk alur async: `analyzeController` (state) hanya
   * segar saat render, sedangkan `handlePGN`/`analyzeMove` hidup melintasi
   * banyak render — membaca state dari closure basi berarti membatalkan
   * controller yang SALAH. Ref ini disinkronkan tiap render (mencakup
   * penulis luar seperti ganti engine di pengaturan) dan dibaca semua alur
   * async; penulis di berkas ini selalu memperbarui keduanya berbarengan.
   */
  const controllerRef = useRef(analyzeController);
  controllerRef.current = analyzeController;
  // `boardSoundsRef` disinkronkan oleh pemanggil tanpa me-render ulang papan.
  // Baca nilainya saat bunyi benar-benar diputar, termasuk di timer tertunda.
  // Label "langkah buku": tabel nama pembukaan milik situs ini sendiri
  // (dibangun oleh scripts/generasi-buku-analisa.mjs). Bentuknya fungsi
  // pencarian (fen) => nama, bukan peta mentah, agar penghitung langkah di
  // FEN bisa diabaikan — tabel upstream tidak pernah cocok karena itu.
  useEffect(() => {
    /*
     * Tabel bukunya ±160 KiB — jangan diunduh di jalur kritis pemuatan
     * halaman (Lighthouse mencatatnya sebagai item payload terbesar).
     * Ditunda ke waktu senggang peramban; belum ada partai yang butuh nama
     * pembukaan pada detik-detik pertama, dan `cariNamaPembukaan` men-cache
     * janjinya jadi jalur lain (muat partai/impor) tetap berbagi unduhan.
     */
    let hidup = true;
    const muat = () =>
      cariNamaPembukaan().then((pencari) => {
        if (hidup) openingsRef.current = pencari;
      });
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(muat, { timeout: 5000 });
      return () => {
        hidup = false;
        window.cancelIdleCallback?.(id);
      };
    }
    const id = setTimeout(muat, 1500);
    id?.unref?.();
    return () => {
      hidup = false;
      clearTimeout(id);
    };
  }, []);

  function createArrowsObject(length) {
    const newArrows = {};
    Array.from({ length }).forEach((_, i) => {
      newArrows[i] = [];
    });
    return newArrows;
  }
  const cleanArrows = useCallback(() => {
    setArrows({ 0: [] });
  }, [setArrows]);
  const terapkanSnapshot = useCallback((snapshot) => {
    setGame(snapshot.game);
    setPlayers(snapshot.players);
    setTime(snapshot.time ?? 0);
    setResult(snapshot.result ?? "");
    setMoveNumber(snapshot.moveNumber);
    setWhite(snapshot.white);
    setTab(snapshot.tab);
    setCustomLine(snapshot.customLine);
    setArrows(snapshot.arrows);
    setAnimation(false);
    setForward?.(true);
    setReturnedToNormalGame?.(null);
    setPlaying(false);
    setAnalyzingMove(false);
    setProgress(0);
    setLangkahSementara([]);
    setPageState(snapshot.pageState);
  }, [setGame, setPlayers, setTime, setResult, setMoveNumber, setWhite, setTab, setCustomLine, setArrows, setAnimation, setForward, setReturnedToNormalGame, setPlaying, setAnalyzingMove, setProgress, setLangkahSementara, setPageState]);

  const handlePGN = useCallback(async (pgn, depth2, terkini, signal, muatan, pertahankan) => {
    setPageState("loading");
    setPlaying(false);
    if (!pertahankan) setTab("summary");
    setProgress(0);
    setLangkahSementara([]);
    if (!pgn?.trim()) {
      pushPageError(setErrors, t("analisa.galat.pgnJudul"), t("analisa.galat.pgnIsi"));
      pekerjaanLaporan?.gagal(muatan.pekerjaanId);
      setPageState("default");
      return;
    }

    // Tombol Batal juga bekerja saat engine/buku masih disiapkan, bukan cuma
    // saat pencarian UCI sudah berjalan. Muatan lama tidak boleh menutup yang baru.
    const batal = () => {
      if (!terkini()) return;
      setPageState("default");
      setProgress(0);
      setLangkahSementara([]);
    };
    signal.addEventListener("abort", batal, { once: true });
    try {
      const partai = bacaPartaiPGN(pgn);
      if (signal.aborted || !terkini()) return;
      pekerjaanLaporan?.metadata(muatan.pekerjaanId, partai.metadata);
      // Berkas multi-partai: hanya partai pertama yang dianalisis — katakan,
      // jangan diam (pengguna menempel 100 partai lalu heran sisanya hilang).
      if ((partai.jumlahPartai ?? 1) > 1) {
        pushPageWarning(setErrors, t("analisa.multiPartai.judul"), t("analisa.multiPartai.isi", { n: partai.jumlahPartai }));
      }
      setLangkahSementara(partai.kerangka);

      // Buku pembukaan diunduh bersamaan dengan penyiapan engine.
      const janjiBuku = openingsRef.current
        ? Promise.resolve(openingsRef.current)
        : cariNamaPembukaan().catch((error) => {
            console.error("Gagal menyiapkan buku pembukaan:", error);
            return {};
          });
      const mesin = await siapkan().catch((error) => {
        throw new Error(signal.aborted ? "canceled" : "mesin", { cause: error });
      });
      if (signal.aborted || !terkini()) return;
      const buku = await janjiBuku;
      if (signal.aborted || !terkini()) return;

      // Posisi belum dinilai tetap berada pada garis tengah. Sumbu X berasal
      // dari seluruh partai dan tidak berubah setiap kali onLangkah terpanggil.
      const laporkanLangkah = (dinilai) => {
        if (!terkini() || signal.aborted) return;
        setLangkahSementara(partai.kerangka.map((posisi, i) => dinilai[i] ?? posisi));
      };
      const laporkanProgres = (nilai) => {
        if (terkini() && !signal.aborted) setProgress(nilai);
      };
      const { metadata, moves } = await parsePGN(mesin, pgn, depth2, buku, laporkanProgres, signal, {
        partai, onLangkah: laporkanLangkah,
      });
      if (!terkini() || signal.aborted) return;
      setTime(metadata.time);
      // Nama kosong tetap kosong di state: label terjemahan dipilih saat
      // render, sehingga ganti bahasa tidak perlu menganalisis ulang partai.
      setPlayers(metadata.players);
      setGame(moves);
      /*
       * Daftarkan hasil partai ini ke peta analisis sesi — padanan case
       * `analysis/terminal` di acuan (`features/workspace/reducer.ts`):
       * `{ ...resultsByGameId, [gameId]: result }` hanya untuk status
       * `complete`. Peta itu yang dibaca layar Wawasan sebagai `analysisMap`,
       * persis `ChessWorkspace.tsx` meneruskan `state.analysis.resultsByGameId`.
       *
       * Kuncinya HASH TEKS PGN, bukan id basis data: di titik ini papan hanya
       * memegang teks PGN (layar Database/Impor melempar `{ format, string }`
       * tanpa id). Layar Wawasan menerjemahkan hash itu kembali ke `p.id`
       * lewat `hashPgn(p.pgn)`, jadi kedua sisi bertemu tanpa perlu mengubah
       * alur data partai.
       */
      catatAnalisis(hashPgn(pgn), ringkasAnalisis(moves));
      setResult(metadata.result);
      setAnimation(false);
      if (!pertahankan) {
        setArrows(createArrowsObject(moves.length));
        setCustomLine({ moveNumber: -1, moves: [], arrows: {} });
      }
      setAnalyzingMove(false);
      if (boardSoundsRef.current) setTimeout(() => {
        if (boardSoundsRef.current) gameStartSound.play();
      }, 100);
      setPageState("analyze");
      pekerjaanLaporan?.selesai({ id: muatan.pekerjaanId, metadata, moves, pageState: "analyze", depth: depth2, pertahankan });
    } catch (e) {
      if ((e?.kunci ?? e?.message) !== "canceled" && !signal.aborted) {
        console.error("Gagal memuat atau menganalisis PGN:", e);
      }
      if (!terkini()) return;
      pekerjaanLaporan?.gagal(muatan.pekerjaanId);
      switch (e?.kunci ?? e?.message) {
        case "pgn":
          pushPageError(setErrors, t("analisa.galat.pgnJudul"), t("analisa.galat.pgnIsi"));
          break;
        case "canceled":
          setAnalyzeController(new AbortController());
          break;
        case "mesin":
          pushPageError(setErrors, t("analisa.galat.engineJudul"), t("analisa.galat.engineIsi"));
          break;
        default:
          pushPageError(setErrors, t("analisa.galat.analisisJudul"), String(e?.message ?? e));
      }
      setPageState("default");
    } finally {
      signal.removeEventListener("abort", batal);
      if (terkini()) {
        setProgress(0);
        setLangkahSementara([]);
        if (!pertahankan) setMoveNumber(0);
      }
    }
  }, [t, siapkan, pekerjaanLaporan, boardSoundsRef, setErrors, setAnalyzeController, setPageState, setPlaying, setTab, setProgress, setLangkahSementara, setTime, setPlayers, setGame, setResult, setAnimation, setArrows, setCustomLine, setAnalyzingMove, setMoveNumber]);
  const handleFEN = useCallback(async (fen, terkini, sinyal, muatan, pertahankan) => {
    /*
     * Halaman dibuka dengan PGN titipan dari teka-teki (lihat
     * `src/modul/sesi/titipan.js`): keadaan awal `data` masih `{fen, ""}`, jadi
     * tanpa penjagaan ini jalur "tanpa FEN" di bawah menggambar papan POSISI
     * AWAL sebagai `default` sebelum PGN titipan sempat dibaca. Biarkan
     * `loading` (kerangka papan) — pengimpor di `areaKerja.jsx` mengambil alih
     * beberapa milidetik kemudian.
     */
    if (!fen?.trim() && adaPgnTitipan()) return;
    let move3;
    try {
      move3 = await new Promise((resolve, reject) => {
        (async () => {
          setPageState("loading");
          setPlaying(false);
          setProgress(0);
          setAnalyzingMove(false);
          if (!pertahankan) {
            setTime(0);
            setPlayers([{ name: "", elo: "?" }, { name: "", elo: "?" }]);
            setWhite(true);
            setMoveNumber(0);
            setResult("");
            setTab("moves");
            setCustomLine({ moveNumber: -1, moves: [], arrows: {} });
            cleanArrows();
          }
          if (!fen?.trim()) {
            // Tanpa FEN: papan bebas dari posisi awal, saran engine langsung
            // ditampilkan setelah engine siap (lihat efek di bawah).
            const chess2 = new Chess();
            const fen2 = chess2.fen();
            const bestMove = chess2.move({ from: "e2", to: "e4" });
            const move5 = {
              fen: fen2,
              color: chess2.turn(),
              bestMove: [formatSquare(bestMove.from), formatSquare(bestMove.to)],
              bestMoveSan: bestMove.san,
              previousStaticEvals: [["cp", "-30"]],
              clock: { white: null, black: null },
            };
            const game = [move5];
            setGame(game);
            setPageState("default");
            pekerjaanLaporan?.siapKosong(muatan.pekerjaanId, game);
            return null;
          }
          const mesin = await siapkan().catch((error) => {
            if (!sinyal.aborted) console.error("Gagal menyiapkan engine untuk FEN:", error);
            return null;
          });
          if (sinyal.aborted || !terkini()) return null;
          if (!mesin) {
            pushPageError(setErrors, t("analisa.galat.engineJudul"), t("analisa.galat.engineIsi"));
            return null;
          }
          let chess;
          try {
            chess = new Chess(fen);
          } catch (error) {
            throw new Error("fen", { cause: error });
          }
          const signal = sinyal;
          function handleAbort() {
            reject(new Error("canceled"));
            signal.removeEventListener("abort", handleAbort);
          }
          return parsePosition(mesin, chess, depth, signal, handleAbort);
        })().then(resolve, reject);
      });
    } catch (e) {
      if ((e?.kunci ?? e?.message) !== "canceled" && !sinyal.aborted) {
        console.error("Gagal memuat atau menganalisis FEN:", e);
      }
      // Muatan lama yang dibatalkan tidak boleh menimpa muatan baru.
      if (!terkini()) return;
      pekerjaanLaporan?.gagal(muatan.pekerjaanId);
      switch (e?.kunci ?? e?.message) {
        case "fen":
          pushPageError(setErrors, t("analisa.galat.fenJudul"), t("analisa.galat.fenIsi"));
          break;
        case "canceled":
          setAnalyzeController(new AbortController());
          break;
        case "mesin":
          pushPageError(setErrors, t("analisa.galat.engineJudul"), t("analisa.galat.engineIsi"));
          break;
        default:
          pushPageError(setErrors, t("analisa.galat.analisisJudul"), String(e?.message ?? e));
      }
      setPageState("default");
      return;
    }
    if (!move3) {
      if (terkini()) {
        if (fen?.trim()) pekerjaanLaporan?.gagal(muatan.pekerjaanId);
        setPageState("default");
      }
      return;
    }
    if (!terkini()) return;
    const moves = [{ ...move3, clock: { white: null, black: null } }];
    setGame(moves);
    setPageState("analyzeCustom");
    pekerjaanLaporan?.selesai({
      id: muatan.pekerjaanId, metadata: { players: [{ name: "", elo: "?" }, { name: "", elo: "?" }], time: 0, result: "" },
      moves, pageState: "analyzeCustom", depth, pertahankan,
    });
  }, [t, depth, siapkan, cleanArrows, pekerjaanLaporan, setErrors, setAnalyzeController, setPageState, setTime, setPlayers, setWhite, setPlaying, setMoveNumber, setResult, setTab, setProgress, setCustomLine, setAnalyzingMove, setGame]);

  // Bahasa/suara tidak boleh memulai ulang analisis. Snapshot yang dipulihkan
  // adalah satu-satunya pengecualian saat data berganti: pasang hasilnya
  // langsung tanpa memanggil engine. Perubahan depth berikutnya tetap dianalisis.
  const penanganRef = useRef(null);
  penanganRef.current = { handlePGN, handleFEN, terapkanSnapshot, pekerjaanLaporan, t };
  const terakhirMuat = useRef(null);
  useEffect(() => {
    const sebelumnya = terakhirMuat.current;
    if (sebelumnya?.data === data && sebelumnya.depth === depth) return;
    const dataBaru = sebelumnya?.data !== data;
    terakhirMuat.current = { data, depth };
    const { format, string } = data;
    // Mengganti depth pada papan bebas tidak boleh menghapus variasi manual.
    if (!dataBaru && format === "fen" && !string?.trim()) return;

    const penangan = penanganRef.current;
    const snapshotAwal = dataBaru && data.rekamAwal?.snapshot
      ? snapshotLaporanAman(data.rekamAwal.snapshot) : null;
    const pertahankan = Boolean(snapshotAwal || (!dataBaru && penangan.pekerjaanLaporan?.punyaSnapshot(data.pekerjaanId)));

    // Naikkan urutan SEBELUM abort: hasil proses lama tidak boleh menimpa baru.
    muatSeqRef.current += 1;
    const nomor = muatSeqRef.current;
    const terkini = () => muatSeqRef.current === nomor;
    setErrors([]);
    controllerRef.current.abort();
    const baru = new AbortController();
    controllerRef.current = baru;
    setAnalyzeController(baru);

    if (dataBaru && data.pemulihan) {
      const record = data.pemulihan;
      const snapshot = snapshotLaporanAman(record.snapshot);
      if (!snapshot) {
        pushPageError(setErrors, penangan.t("analisa.pekerjaan.rusakJudul"), penangan.t("analisa.pekerjaan.rusakIsi"));
        return;
      }
      penangan.pekerjaanLaporan?.pulih(data, record, snapshot);
      penangan.terapkanSnapshot(snapshot);
      if (format === "pgn") catatAnalisis(hashPgn(string), ringkasAnalisis(snapshot.game));
      if (!["selesai", "baru"].includes(record.status)) {
        pushPageWarning(setErrors, penangan.t("analisa.pekerjaan.terputusJudul"), penangan.t("analisa.pekerjaan.hasilSebelumnya"));
      }
      if (snapshot.customLine.moves.some((langkah) => !langkah.previousStaticEvals || ["dibatalkan", "gagal"].includes(langkah.statusEvaluasi))) {
        pushPageWarning(setErrors, penangan.t("analisa.pekerjaan.variasiJudul"), penangan.t("analisa.pekerjaan.variasiIsi"));
      }
      return;
    }

    // Analisis ulang hasil sebelumnya dimulai dari snapshot yang dipilih,
    // bukan dari papan laporan lain yang kebetulan masih terlihat.
    if (snapshotAwal) penangan.terapkanSnapshot(snapshotAwal);
    penangan.pekerjaanLaporan?.mulai({ data, depth });
    baru.signal.addEventListener("abort", () => {
      if (terkini()) penangan.pekerjaanLaporan?.gagal(data.pekerjaanId);
    }, { once: true });
    switch (format) {
      case "pgn":
        penangan.handlePGN(string, depth, terkini, baru.signal, data, pertahankan);
        break;
      case "fen":
        penangan.handleFEN(string, terkini, baru.signal, data, pertahankan);
        break;
    }
  }, [data, depth, setAnalyzeController, setErrors]);

  // Unmount sungguhan membatalkan pekerjaan, tetapi siklus cleanup/pasang
  // ulang StrictMode pada mount tidak boleh membatalkan analisis yang sama.
  const timerTutup = useRef(null);
  useEffect(() => {
    clearTimeout(timerTutup.current);
    return () => {
      timerTutup.current = setTimeout(() => {
        muatSeqRef.current += 1;
        controllerRef.current.abort();
      }, 0);
      timerTutup.current?.unref?.();
    };
  }, []);

  return { controllerRef, muatSeqRef, openingsRef };
}
