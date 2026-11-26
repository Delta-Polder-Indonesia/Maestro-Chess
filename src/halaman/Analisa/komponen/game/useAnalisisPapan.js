/*
 * Menilai satu langkah manual di papan (seret bidak ke kotak tujuan).
 *
 * Dipisah dari `game.jsx` (Fase 3). Hook ini memakai `/muatSeqRef/` yang sama
 * dengan `useMuatPartai`: bila pengguna memuat partai lain saat langkah masih
 * dinilai, hasil analisis lama BASIH dan tidak boleh menimpa `customLine`
 * muatan baru — juga tidak boleh menimpa controller yang baru (tombol Batal
 * harus tetap hidup).
 *
 * `analyzingMoveRef` disimpan di sini karena pemakainya pendengar keyboard
 * global di `game.jsx`: selama satu langkah dinilai, tombol panah dan spasi
 * diabaikan. Lupa melepasnya di salah satu jalur keluar membuat papan terkunci
 * selamanya — itu sebabnya pembersihannya ada di `finally`.
 */
import { useCallback, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { formatSquare, getCastle, invertColor, parseMove } from "../../mesin/engine.js";
import { STATUS_EVALUASI } from "../../../../modul/analisis/evaluasi.js";
import { cariNamaPembukaan } from "../../../../modul/analisis/buku.js";
import { pushPageError } from "../../../../modul/sesi/galat.js";

function sliceCustomArrows(arrows, moveNumber) {
  const hasil = {};
  for (let i = 0; i <= moveNumber; i++) hasil[i] = arrows[i] || [];
  return hasil;
}

/* Batas pencarian efektif sesuai mode Report (lihat useMuatPartai). */
function batasMode(mode, depth, movetime, nodes) {
  if (mode === "waktu") return { depth: null, movetime: movetime ?? 4000, nodes: null };
  if (mode === "node") return { depth: null, movetime: null, nodes: nodes ?? 250000 };
  return { depth, movetime: null, nodes: null };
}

export function useAnalisisPapan({
  controllerRef,
  muatSeqRef,
  openingsRef,
  data,
  depth,
  mode,
  nodes,
  movetime,
  time,
  move2,
  siapkan,
  ambilMesin,
  t,
  setErrors,
  setAnalyzeController,
  setPageState,
  setAnimation,
  setForward,
  setCustomLine,
  setAnalyzingMove,
  analyzingMove,
}) {
  const analyzingMoveRef = useRef(analyzingMove);
  useEffect(() => {
    analyzingMoveRef.current = analyzingMove;
  }, [analyzingMove]);
  /*
   * `previousKandidat` ditambahkan paling belakang supaya pemanggil lama
   * (uji dan jalur lain) tetap sah: tanpanya label "kritis" tidak muncul,
   * perilaku lainnya identik. Identitas callback dijaga agar papan yang
   * di-memo tidak ikut render ketika hanya panel navigasi yang berubah.
   */
  const analyzeMove = useCallback(async function analyzeMove(previousFen, movement, previousSacrifice, previousStaticEvals, animation2, previousBestMoveSan, previousKandidat) {
    // Baca-SAJA: dipakai untuk mendeteksi muatan baru yang dimulai selama
    // analisis berjalan — TIDAK PERNAH ditambah. Menambahkannya di sini akan
    // membuang muatan yang sedang berjalan dan memacetkannya pada "memuat".
    const nomorMuat = muatSeqRef.current;
    const chess = new Chess(previousFen);
    const unanalyzedMoveObj = chess.move(movement);
    const unanalyzedMove = {
      fen: unanalyzedMoveObj.after,
      movement: [formatSquare(movement.from), formatSquare(movement.to)],
      color: invertColor(unanalyzedMoveObj.color),
      capture: unanalyzedMoveObj.captured,
      castle: getCastle(unanalyzedMoveObj.san),
      san: unanalyzedMoveObj.san,
      clock: move2?.clock ?? { white: time || null, black: time || null },
    };
    setAnimation(animation2);
    setForward(true);
    setCustomLine((prev) => ({
      moveNumber: prev.moveNumber + 1,
      moves: [...prev.moves.slice(0, prev.moveNumber + 1), unanalyzedMove],
      // A new branch replaces the future position; arrows drawn on the old
      // continuation do not describe the new move.
      arrows: { ...sliceCustomArrows(prev.arrows, prev.moveNumber), [prev.moveNumber + 1]: [] },
    }));
    setAnalyzingMove(true);
    if (data.format === "fen") setPageState("analyzeCustom");
    /*
     * Analisis langkah manual. Semua jalur keluar HARUS melepas
     * `analyzingMove`: kalau tidak, papan terkunci selamanya (tombol dan
     * tombol panah semuanya memeriksa bendera ini) dan pengguna harus
     * memuat ulang halaman. Karena itu pembersihannya ada di `finally`,
     * bukan setelah `await`.
     */
    let move3;
    let dibatalkan = false;
    try {
      // Controller yang sudah dibatalkan (tombol Batal / ganti engine) tidak
      // bisa dipakai lagi: signal aborted memacetkan setiap analisis berikutnya
      // secara diam-diam. Ganti dengan yang baru sebelum melanjutkan — TAPI
      // hanya bila yang terpasang MASIH controller mati itu (blok sinkron,
      // tak ada render yang bisa menyela): muatan baru yang memasang
      // controller segar saat langkah ini menunggu tidak boleh ditimpa.
      if (controllerRef.current.signal.aborted) {
        const baru = new AbortController();
        controllerRef.current = baru;
        setAnalyzeController(baru);
      }
      const signal = controllerRef.current.signal;
      // Lihat catatan balapan buku di handlePGN: langkah manual pun menunggu
      // tabel buku yang sama (berselang dengan penyiapan engine) sebelum dinilai.
      const janjiBuku = openingsRef.current
        ? Promise.resolve(openingsRef.current)
        : cariNamaPembukaan().catch((error) => {
            console.error("Gagal menyiapkan buku pembukaan:", error);
            return {};
          });
      const mesin = ambilMesin() ?? (await siapkan().catch((error) => {
        if (!signal.aborted) console.error("Gagal menyiapkan engine untuk langkah:", error);
        return null;
      }));
      const buku = await janjiBuku;
      // Muatan baru dimulai saat menunggu → hasil analisis ini pasti basi;
      // berhenti di sini (`finally` tetap melepas kunci papan).
      if (muatSeqRef.current !== nomorMuat) return;
      // Dibatalkan saat MENUNGGU engine/buku (tombol Batal / ganti engine
      // mendarat di sela `await`): ini pembatalan, bukan kegagalan — capnya
      // "dibatalkan" dan tidak ada kabar galat. (`signal` diambil sebelum
      // `await`, jadi nilainya di sini adalah status saat menunggu.)
      if (signal.aborted) {
        dibatalkan = true;
      } else if (mesin) {
        const chess2 = new Chess(previousFen);
        const move4 = chess2.move(movement);
        const batas = batasMode(mode, depth, movetime, nodes);
        move3 = await parseMove(
          mesin,
          batas.depth,
          move4,
          chess2,
          previousStaticEvals,
          previousBestMoveSan,
          previousSacrifice,
          buku,
          () => {
            throw new Error("canceled");
          },
          signal,
          undefined,
          previousKandidat ?? [],
          batas.movetime,
          batas.nodes
        );
      }
    } catch (e) {
      // Batal (tombol Batal / ganti engine) bukan galat yang perlu
      // ditampilkan; sisanya dilaporkan supaya tidak hilang diam-diam.
      const kunci = e?.kunci ?? e?.message;
      const batal = kunci === "canceled" || kunci === "pencarian dibatalkan" || kunci === "permintaan digantikan";
      if (!batal) {
        console.error("Gagal menganalisis langkah papan:", e);
        pushPageError(setErrors, t("analisa.galat.analisisJudul"), String(e?.message ?? e));
      } else {
        dibatalkan = true;
        // Signal ini sudah mati; ganti dengan yang baru supaya langkah
        // berikutnya tetap bisa dinilai, bukan langsung "canceled" — TAPI
        // hanya bila yang terpasang masih yang mati: menimpa controller
        // muatan baru membuat tombol Batal lumpuh untuk muatan itu.
        if (controllerRef.current.signal.aborted) {
          const baru = new AbortController();
          controllerRef.current = baru;
          setAnalyzeController(baru);
        }
      }
      move3 = undefined;
    } finally {
      setAnimation(false);
      setAnalyzingMove(false);
    }

    /*
     * Bila analisis gagal/dibatalkan, langkahnya tetap ada di papan sebagai
     * langkah "belum dinilai" — menyisipkan `undefined` ke dalam daftar akan
     * merobohkan render (getMoves membaca `.movement` dari elemen ini).
     */
    /*
     * Tulis hasil HANYA bila tak ada muatan baru yang dimulai selama analisis
     * berjalan — customLine milik muatan baru tidak boleh ditimpa hasil basi
     * (balapan seret-langkah vs muat partai).
     */
    if (muatSeqRef.current !== nomorMuat) return;
    if (!move3) {
      // Analisis gagal/dibatalkan: langkahnya tetap ada sebagai "belum
      // dinilai", dan placeholder-nya dicap supaya downstream (grafik,
      // ekspor) bisa membedakan batal vs gagal vs valid.
      const cap = dibatalkan ? STATUS_EVALUASI.DIBATALKAN : STATUS_EVALUASI.GAGAL;
      setCustomLine((prev) => {
        const index = prev.moves.indexOf(unanalyzedMove);
        if (index < 0) return prev;
        const sasaran = prev.moves[index];
        if (sasaran.previousStaticEvals || sasaran.statusEvaluasi) return prev;
        const daftar = prev.moves.slice();
        daftar[index] = { ...sasaran, statusEvaluasi: cap };
        return { ...prev, moves: daftar };
      });
      return;
    }
    setCustomLine((prev) => {
      // Navigation can move the cursor, or discard a PGN variation, while the
      // engine is still evaluating. Update the original placeholder instead
      // of whichever move happens to be selected when the result arrives.
      const index = prev.moves.indexOf(unanalyzedMove);
      if (index < 0) return prev;
      const daftar = prev.moves.slice();
      daftar[index] = { ...move3, clock: unanalyzedMove.clock };
      return { ...prev, moves: daftar };
    });
  }, [
    controllerRef, muatSeqRef, openingsRef, data.format, depth, mode, nodes, movetime, time, move2,
    siapkan, ambilMesin, t, setErrors, setAnalyzeController, setPageState,
    setAnimation, setForward, setCustomLine, setAnalyzingMove,
  ]);

  return { analyzeMove, analyzingMoveRef };
}
