/**
 * Provider BoardContext: state papan + navigasi langkah.
 *
 * State papan dipisahkan dari `konteks/analyze.jsx`: nilai yang berubah sangat
 * sering (progress, pageState, analyzingMove, langkahSementara, data, dan
 * analyzeController) hidup di `ImportProvider` sehingga perubahan itu tidak
 * lagi me-render provider ini. Controller juga menjaga riwayat langkah manual
 * pada posisi tanpa riwayat utama, seperti FEN.
 *
 * Urutan pemanggilan hook dipertahankan supaya urutan inisialisasi (termasuk
 * `bacaAngka("kedalaman", 13)` dan `t(...)` untuk nama pemain bawaan) tetap
 * sama seperti sebelumnya.
 *
 * Port dari Brilliant-Chess (MIT, © 2025 Delo) — jangan sunting massal tanpa
 * cek README.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../../lib/i18n.jsx";
import { bacaAngka } from "../../../modul/sesi/preferensi.js";
import { normalisasiPemain, TAMPILAN_ANALISA } from "./analyzeKonteks.js";
import { BoardContext, SetTampilanContext, TampilanContext } from "./boardKonteks.js";

export function BoardProvider({ children }) {
  const { t } = useI18n();
  const [game, setGame] = useState([]);
  // Empty names use the translated fallback below, including after a
  // language change. Real PGN player names remain untouched.
  const [players, setPlayers] = useState(() => [
    { name: "", elo: "?" },
    { name: "", elo: "?" },
  ]);
  const playersAman = useMemo(
    () => normalisasiPemain(players, [t("analisa.pemain.putih"), t("analisa.pemain.hitam")]),
    [players, t]
  );
  const [moveNumber, setMoveNumber] = useState(0);
  const [forward, setForward] = useState(true);
  const [animation, setAnimation] = useState(true);
  const [white, setWhite] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [materialAdvantage, setMaterialAdvantage] = useState(0);
  const [result2, setResult] = useState("");
  const [tab, setTab] = useState("analyze");
  const [customLine, setCustomLine] = useState({ moveNumber: -1, moves: [], arrows: {} });
  const [returnedToNormalGame, setReturnedToNormalGame] = useState(null);
  /*
   * Kedalaman tersimpan. Kuncinya HARUS "kci-analisa-kedalaman" — sama
   * dengan yang ditulis form.jsx dan panel pengaturan. Sebelumnya di
   * `analyze.jsx` dibaca kunci "kci-analisa-depth" yang tidak pernah ditulis
   * siapa pun, jadi pilihan pengguna selalu kembali ke 13 setiap kali
   * halaman dibuka.
   *
   * Default papan Analisa tetap 13 (cukup dalam untuk analisis serius
   * di perangkat desktop); layar Deteksi Engine memakai
   * KEDALAMAN_AGGREGAT=8 yang terpisah (lebih ringan untuk agregat
   * banyak partai) dan tidak menyentuh state ini.
   */
  const [depth, setDepth] = useState(() => {
    const tersimpan = bacaAngka("kedalaman", 13);
    return Math.min(20, Math.max(6, Math.round(tersimpan)));
  });
  const [tampilan, setTampilan] = useState(TAMPILAN_ANALISA.PAPAN);
  const moveNumberRef = useRef(moveNumber);
  const customLineRef = useRef(customLine);
  const gameLengthRef = useRef(game.length);
  useEffect(() => {
    customLineRef.current = customLine;
  }, [customLine]);
  useEffect(() => {
    moveNumberRef.current = moveNumber;
  }, [moveNumber]);
  useEffect(() => {
    gameLengthRef.current = game.length;
  }, [game.length]);
  /*
   * Stabil antar-render: isinya hanya membaca ref + setter (keduanya stabil),
   * jadi tidak perlu dibuat ulang — dan karena `gameController` masuk ke
   * nilai konteks, kestabilan ini mencegah seluruh konsumen konteks
   * me-render ulang setiap kali provider me-render.
   */
  const gameController = useMemo(
    () => ({
      back: () => {
        if (customLineRef.current.moveNumber > 0) {
          setForward(false);
          setAnimation(true);
          setReturnedToNormalGame(null);
          setCustomLine((prev) => ({ ...prev, moveNumber: prev.moveNumber - 1 }));
        } else if (customLineRef.current.moveNumber === 0) {
          setForward(false);
          setAnimation(true);
          setReturnedToNormalGame(customLineRef.current.moves[0]?.movement ?? null);
          // A FEN (or another position without a main line) has nowhere else
          // to go forward. Keep its manual line while displaying the origin;
          // a PGN variation still exits to its existing main line as before.
          if (gameLengthRef.current === 1) {
            setCustomLine((prev) => ({ ...prev, moveNumber: -1 }));
          } else {
            setCustomLine({ moveNumber: -1, moves: [], arrows: {} });
          }
        } else if (moveNumberRef.current > 0) {
          setForward(false);
          setAnimation(true);
          setReturnedToNormalGame(null);
          setMoveNumber((prev) => prev - 1);
        }
      },
      forward: () => {
        setReturnedToNormalGame(null);
        if (customLineRef.current.moveNumber >= 0 || (gameLengthRef.current === 1 && customLineRef.current.moves.length > 0)) {
          if (customLineRef.current.moveNumber < customLineRef.current.moves.length - 1) {
            setForward(true);
            setAnimation(true);
            setCustomLine((prev) => ({ ...prev, moveNumber: prev.moveNumber + 1 }));
          }
          return;
        } else if (moveNumberRef.current < gameLengthRef.current - 1) {
          setForward(true);
          setAnimation(true);
          setMoveNumber((prev) => prev + 1);
        }
      },
      first: () => {
        if (customLineRef.current.moveNumber >= 0) {
          setAnimation(false);
          setReturnedToNormalGame(customLineRef.current.moves[0]?.movement ?? null);
          if (gameLengthRef.current === 1) {
            setCustomLine((prev) => ({ ...prev, moveNumber: -1 }));
          } else {
            setCustomLine({ moveNumber: -1, moves: [], arrows: {} });
          }
        } else {
          setAnimation(false);
          setReturnedToNormalGame(null);
          setMoveNumber(0);
        }
      },
      last: () => {
        setReturnedToNormalGame(null);
        if (customLineRef.current.moveNumber >= 0 || (gameLengthRef.current === 1 && customLineRef.current.moves.length > 0)) {
          setAnimation(false);
          setCustomLine((prev) => ({ ...prev, moveNumber: prev.moves.length - 1 }));
        } else {
          setAnimation(false);
          setMoveNumber(gameLengthRef.current - 1);
        }
      },
      togglePlay: () => {
        setPlaying((prev) => !prev);
      },
      play: () => {
        setPlaying(true);
      },
      pause: () => {
        setPlaying(false);
      },
    }),
    []
  );
  /*
   * Dependensinya adalah seluruh NILAI state yang diekspor (setter stabil,
   * tak perlu disebut). Menambah state ke provider ini WAJIB menambahkannya
   * di sini.
   */
  const nilai = useMemo(
    () => ({
      game: [game, setGame],
      players: [playersAman, setPlayers],
      moveNumber: [moveNumber, setMoveNumber],
      forward: [forward, setForward],
      white: [white, setWhite],
      animation: [animation, setAnimation],
      playing: [playing, setPlaying],
      time: [time, setTime],
      materialAdvantage: [materialAdvantage, setMaterialAdvantage],
      result: [result2, setResult],
      tab: [tab, setTab],
      customLine: [customLine, setCustomLine],
      returnedToNormalGame: [returnedToNormalGame, setReturnedToNormalGame],
      depth: [depth, setDepth],
      gameController,
    }),
    [
      game,
      playersAman,
      moveNumber,
      forward,
      white,
      animation,
      playing,
      time,
      materialAdvantage,
      result2,
      tab,
      customLine,
      returnedToNormalGame,
      depth,
      gameController,
    ]
  );
  return (
    <TampilanContext.Provider value={tampilan}>
      <SetTampilanContext.Provider value={setTampilan}>
        <BoardContext.Provider value={nilai}>{children}</BoardContext.Provider>
      </SetTampilanContext.Provider>
    </TampilanContext.Provider>
  );
}
