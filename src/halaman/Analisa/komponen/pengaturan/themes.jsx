/* Port dari Brilliant-Chess (MIT, © 2025 Delo) — jangan sunting massal tanpa cek README.
 * Tema papan & set bidak mengikuti bentuk UI En Croissant (BoardSelect/PiecesSelect):
 * dropdown ringkas; ikon bidak terpilih ditampilkan di baris (di luar dropdown),
 * dropdown set bidak hanya nama, dropdown tema memakai swatch + nama. */
import { ConfigContext, boardThemes, bacaTeks, tulis } from "../../../../modul/sesi/preferensi.js";
import { memo, useContext, useEffect, useState } from "react";
import { useI18n } from "../../../../lib/i18n.jsx";
import BarisPengaturan from "./barisPengaturan.jsx";
import PilihRingkas from "./pilihRingkas.jsx";
import { DAFTAR_SET_BIDAK, BIDAK_PRATINJAU, SET_BAWAAN, idSetBidak, urlBidak } from "./setBidak.js";

function SwatchTema({ theme }) {
  return (
    <span aria-hidden="true" className="flex h-6 w-12 shrink-0 overflow-hidden rounded-[3px] border border-border">
      <span className="h-full w-1/2" style={{ backgroundColor: theme.white }} />
      <span className="h-full w-1/2" style={{ backgroundColor: theme.black }} />
    </span>
  );
}

// Enam bidak putih set terpilih (urutan En Croissant: benteng, kuda, gajah,
// menteri, raja, pion) ditampilkan di baris, bukan di dalam dropdown.
function PratinjauBidak({ set }) {
  return (
    <span aria-hidden="true" className="hidden shrink-0 items-center gap-1 sm:flex">
      {BIDAK_PRATINJAU.map((p) => (
        <img key={p} src={urlBidak(set, p)} alt="" draggable={false} className="h-8 w-8 select-none object-contain" />
      ))}
    </span>
  );
}

// Opsi koordinat mengikuti nilai En Croissant (no/edge/all); "edge" adalah
// tampilan Maestro semula (label di petak tepi), "all" melabeli tiap petak.
const OPSI_KOORDINAT = ["no", "edge", "all"];
// Fallback konteks harus beridentitas stabil agar memo IsiThemes tidak bocor
// saat konsumen lain memperbarui ConfigContext (setter baru tiap render akan
// memaksa render ulang). Karena itu pasangan bawaan dibuat di tingkat modul.
const SETTER_KOSONG = () => {};
const BAWAAN_KOORDINAT = ["edge", SETTER_KOSONG];
const BAWAAN_SET_BIDAK = [SET_BAWAAN, SETTER_KOSONG];

const IsiThemes = memo(function IsiThemes({ boardTheme, setBoardTheme, pieceSet, setPieceSet, coordinates, setCoordinates, cocok = () => true, deskripsi = () => null }) {
  const { t } = useI18n();
  // Pratinjau sementara saat hover opsi set bidak (tidak persist sampai diklik).
  const [pratinjau, setPratinjau] = useState(null);
  useEffect(() => {
    const boardTheme2 = Number(bacaTeks("boardTheme"));
    if (boardThemes[boardTheme2] != null) {
      setBoardTheme(boardTheme2);
    } else {
      tulis("boardTheme", "0");
      setBoardTheme(0);
    }
  }, [setBoardTheme]);

  function changeBoardTheme(boardThemeIndex) {
    setBoardTheme(boardThemeIndex);
    tulis("boardTheme", String(boardThemeIndex));
  }
  function changePieceSet(set) {
    const sah = idSetBidak(set);
    setPieceSet(sah);
    tulis("pieceSet", sah);
  }
  function changeCoordinates(nilai) {
    const sah = OPSI_KOORDINAT.includes(nilai) ? nilai : "edge";
    setCoordinates(sah);
    tulis("coordinates", sah);
  }

  const labelTema = t("analisa.pengaturan.temaPapan");
  const labelBidak = t("analisa.pengaturan.setBidak");
  const labelKoordinat = t("analisa.pengaturan.koordinatPapan");
  const tampilTema = cocok("temaPapan", labelTema) || boardThemes.some((theme) => cocok(`tema.${theme.kunci}`, t(`analisa.tema.${theme.kunci}`)));
  const tampilBidak = cocok("setBidak", labelBidak) || DAFTAR_SET_BIDAK.some((s) => cocok(`bidak.${s.id}`, s.nama));
  const tampilKoordinat = cocok("koordinatPapan", labelKoordinat) || OPSI_KOORDINAT.some((o) => cocok(`koordinat.${o}`, t(`analisa.pengaturan.koordinat.${o === "no" ? "tanpa" : o === "edge" ? "tepi" : "semua"}`)));

  const pilihanTema = boardThemes.map((theme, i) => ({ id: String(i), label: t(`analisa.tema.${theme.kunci}`), preview: <SwatchTema theme={theme} /> }));
  const pilihanBidak = DAFTAR_SET_BIDAK.map((s) => ({ id: s.id, label: s.nama }));
  const pilihanKoordinat = OPSI_KOORDINAT.map((o) => ({ id: o, label: t(`analisa.pengaturan.koordinat.${o === "no" ? "tanpa" : o === "edge" ? "tepi" : "semua"}`) }));
  const setTampil = idSetBidak(pratinjau ?? pieceSet);

  return (
    <section>
      {tampilTema ? (
        <BarisPengaturan
          judul={<span className="text-[13.5px] font-medium text-foreground">{labelTema}</span>}
          deskripsi={deskripsi("temaPapan")}
        >
          <PilihRingkas ariaLabel={labelTema} lebar="w-[192px]" nilai={String(boardTheme)} pilihan={pilihanTema} onChange={(id) => changeBoardTheme(Number(id))} />
        </BarisPengaturan>
      ) : null}
      {tampilKoordinat ? (
        <BarisPengaturan
          judul={<span className="text-[13.5px] font-medium text-foreground">{labelKoordinat}</span>}
          deskripsi={deskripsi("koordinatPapan")}
        >
          <PilihRingkas ariaLabel={labelKoordinat} lebar="w-[160px]" nilai={OPSI_KOORDINAT.includes(coordinates) ? coordinates : "edge"} pilihan={pilihanKoordinat} onChange={changeCoordinates} />
        </BarisPengaturan>
      ) : null}
      {tampilBidak ? (
        <BarisPengaturan
          judul={<span className="text-[13.5px] font-medium text-foreground">{labelBidak}</span>}
          deskripsi={deskripsi("setBidak")}
        >
          <div className="flex items-center gap-3">
            <PratinjauBidak set={setTampil} />
            <PilihRingkas ariaLabel={labelBidak} lebar="w-[160px]" nilai={idSetBidak(pieceSet)} pilihan={pilihanBidak} onChange={changePieceSet} onPratinjau={setPratinjau} />
          </div>
        </BarisPengaturan>
      ) : null}
    </section>
  );
});

function Themes({ cocok, deskripsi }) {
  const config = useContext(ConfigContext);
  const [boardTheme, setBoardTheme] = config.boardTheme;
  const [pieceSet, setPieceSet] = config.pieceSet ?? BAWAAN_SET_BIDAK;
  const [coordinates, setCoordinates] = config.coordinates ?? BAWAAN_KOORDINAT;
  return <IsiThemes boardTheme={boardTheme} setBoardTheme={setBoardTheme} pieceSet={pieceSet} setPieceSet={setPieceSet} coordinates={coordinates} setCoordinates={setCoordinates} cocok={cocok} deskripsi={deskripsi} />;
}
export default memo(Themes);
