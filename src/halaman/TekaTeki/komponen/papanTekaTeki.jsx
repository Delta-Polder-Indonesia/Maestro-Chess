/**
 * Pembungkus papan teka-teki: memiliki keadaan interaksi (petak terpilih,
 * sasaran langkah sah, promosi, tanda bantu) dan meneruskan peristiwa drag/klik
 * dari PapanInteraktif ke sesi (`onLangkah`). Tema/set bidak/koordinat dibaca
 * dari ConfigContext (Pengaturan umum), sama seperti papan Analisa.
 *
 * Papan interaktifnya diadopsi dari ChessClub (drag bidak hantu, pointer capture,
 * slop 5px, klik-untuk-jalan, klik-kanan batal seret) — lihat papanInteraktif.jsx.
 */
import { useContext, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { ConfigContext } from "../../../modul/sesi/preferensi.js";
import { formatSquare } from "../../Analisa/mesin/engine.js";
import PapanInteraktif from "./papanInteraktif.jsx";
import DialogPromosi from "./dialogPromosi.jsx";
import { useTandaBantu } from "../logika/tandaBantu.js";

const KOORDINAT = { no: "tidak", edge: "tepi", all: "semua" };

export default function PapanTekaTeki({ fen, pihak, ukuran, onLangkah, petunjuk, langkahAkhir, terkunci }) {
  const config = useContext(ConfigContext);
  const boardTheme = config.boardTheme[0];
  const pieceSet = config.pieceSet?.[0] ?? "cburnett";
  const coordinates = config.coordinates?.[0] ?? "edge";
  const [terpilih, setTerpilih] = useState(null);
  const [promosi, setPromosi] = useState(null); // { from, to, warna }
  const { tanda, tandaPetak, tandaPanah, hapusSemuaTanda } = useTandaBantu();

  // Posisi berganti (langkah dimainkan / soal baru) → pilihan lama dibersihkan.
  useEffect(() => { setTerpilih(null); }, [fen]);

  const { sasaran, sasaranTangkap } = useMemo(() => {
    if (!terpilih || !fen || terkunci) return { sasaran: [], sasaranTangkap: [] };
    try {
      const langkah = new Chess(fen).moves({ square: terpilih, verbose: true });
      return {
        sasaran: langkah.map((m) => m.to),
        sasaranTangkap: langkah.filter((m) => m.captured).map((m) => m.to),
      };
    } catch {
      return { sasaran: [], sasaranTangkap: [] };
    }
  }, [fen, terpilih, terkunci]);

  function cobaLangkah(from, to, promo) {
    if (terkunci || !fen || !to || from === to) return;
    let game;
    try { game = new Chess(fen); } catch { return; }
    const bidak = game.get(from);
    const legal = game.moves({ square: from, verbose: true }).some((m) => m.to === to);
    const butuhPromosi = bidak?.type === "p" && (to[1] === "8" || to[1] === "1") && legal;
    if (butuhPromosi && !promo) { setPromosi({ from, to, warna: bidak.color }); return; }
    setTerpilih(null);
    onLangkah(promo ? { from, to, promotion: promo } : { from, to });
  }

  function pilihPetak(sq) {
    if (terkunci || !fen) return;
    try {
      const game = new Chess(fen);
      const bidak = game.get(sq);
      setTerpilih(bidak && bidak.color === game.turn() ? sq : null);
    } catch { setTerpilih(null); }
  }

  function klikPetak(sq) {
    if (terkunci || !fen) return;
    if (terpilih && sasaran.includes(sq)) { cobaLangkah(terpilih, sq); return; }
    if (terpilih === sq) { setTerpilih(null); return; }
    pilihPetak(sq);
  }

  // Petunjuk sesi (petak → panah) dipetakan ke sorotan petak asal/tujuan papan.
  const petunjukPapan = useMemo(() => {
    if (petunjuk?.panah) return { from: formatSquare(petunjuk.panah.from), to: formatSquare(petunjuk.panah.to) };
    if (petunjuk?.petak) { const kotak = formatSquare(petunjuk.petak); return { from: kotak, to: kotak }; }
    return null;
  }, [petunjuk]);

  if (!fen) {
    return <div style={{ width: ukuran, height: ukuran }} className="animate-pulse rounded-[3px] bg-backgroundBox ring-1 ring-black/10" aria-hidden="true" />;
  }

  return (
    <div className="relative" style={{ width: ukuran, height: ukuran }}>
      <PapanInteraktif
        fen={fen}
        orientasi={pihak}
        terpilih={terpilih}
        sasaran={sasaran}
        sasaranTangkap={sasaranTangkap}
        petunjuk={petunjukPapan}
        langkahAkhir={langkahAkhir}
        terkunci={terkunci}
        setBidak={pieceSet}
        tema={boardTheme}
        tampilKoordinat={KOORDINAT[coordinates] ?? "tepi"}
        onKlik={klikPetak}
        onPilih={pilihPetak}
        onMulaiSeret={pilihPetak}
        onSelesaiSeret={(from, to, klikUlang) => {
          if (klikUlang) { setTerpilih(null); return; }
          cobaLangkah(from, to);
        }}
        onBatalSeret={() => setTerpilih(null)}
        onJatuh={cobaLangkah}
        onTandaPetak={tandaPetak}
        onTandaPanah={tandaPanah}
        onHapusTanda={hapusSemuaTanda}
        tanda={tanda}
      />
      {promosi && (
        <DialogPromosi
          warna={promosi.warna}
          onPilih={(tipe) => { const { from, to } = promosi; setPromosi(null); cobaLangkah(from, to, tipe); }}
          onBatal={() => { setPromosi(null); setTerpilih(null); }}
        />
      )}
    </div>
  );
}
