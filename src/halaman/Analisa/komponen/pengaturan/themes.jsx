/* Port dari Brilliant-Chess (MIT, © 2025 Delo) — jangan sunting massal tanpa cek README.
 * Tema papan & set bidak kini berupa dropdown ringkas (gaya En Croissant)
 * alih-alih deretan baris sakelar per tema, agar tidak memakan tempat. */
import { ConfigContext, boardThemes, bacaTeks, tulis } from "../../../../modul/sesi/preferensi.js";
import { memo, useContext, useEffect } from "react";
import { useI18n } from "../../../../lib/i18n.jsx";
import BarisPengaturan from "./barisPengaturan.jsx";
import PilihRingkas from "./pilihRingkas.jsx";
import { DAFTAR_SET_BIDAK, BIDAK_PRATINJAU, SET_BAWAAN, idSetBidak, urlBidak } from "./setBidak.js";

function SwatchTema({ theme }) {
  return (
    <span aria-hidden="true" className="flex h-[18px] w-[26px] shrink-0 overflow-hidden rounded-[3px] border border-border">
      <span className="h-full w-1/2" style={{ backgroundColor: theme.white }} />
      <span className="h-full w-1/2" style={{ backgroundColor: theme.black }} />
    </span>
  );
}

function PratinjauBidak({ set }) {
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center">
      {BIDAK_PRATINJAU.map((p, i) => (
        <img key={p} src={urlBidak(set, p)} alt="" draggable={false} className={`h-4 w-4 select-none object-contain ${i ? "-ml-1" : ""}`} />
      ))}
    </span>
  );
}

const IsiThemes = memo(function IsiThemes({ boardTheme, setBoardTheme, pieceSet, setPieceSet, cocok = () => true, deskripsi = () => null }) {
  const { t } = useI18n();
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

  const labelTema = t("analisa.pengaturan.temaPapan");
  const labelBidak = t("analisa.pengaturan.setBidak");
  const tampilTema = cocok("temaPapan", labelTema) || boardThemes.some((theme) => cocok(`tema.${theme.kunci}`, t(`analisa.tema.${theme.kunci}`)));
  const tampilBidak = cocok("setBidak", labelBidak) || DAFTAR_SET_BIDAK.some((s) => cocok(`bidak.${s.id}`, s.nama));

  const pilihanTema = boardThemes.map((theme, i) => ({ id: String(i), label: t(`analisa.tema.${theme.kunci}`), preview: <SwatchTema theme={theme} /> }));
  const pilihanBidak = DAFTAR_SET_BIDAK.map((s) => ({ id: s.id, label: s.nama, preview: <PratinjauBidak set={s.id} /> }));

  return (
    <section>
      {tampilTema ? (
        <BarisPengaturan
          judul={<span className="text-[13.5px] font-medium text-foreground">{labelTema}</span>}
          deskripsi={deskripsi("temaPapan")}
        >
          <PilihRingkas ariaLabel={labelTema} nilai={String(boardTheme)} pilihan={pilihanTema} onChange={(id) => changeBoardTheme(Number(id))} />
        </BarisPengaturan>
      ) : null}
      {tampilBidak ? (
        <BarisPengaturan
          judul={<span className="text-[13.5px] font-medium text-foreground">{labelBidak}</span>}
          deskripsi={deskripsi("setBidak")}
        >
          <PilihRingkas ariaLabel={labelBidak} nilai={idSetBidak(pieceSet)} pilihan={pilihanBidak} onChange={changePieceSet} />
        </BarisPengaturan>
      ) : null}
    </section>
  );
});

function Themes({ cocok, deskripsi }) {
  const config = useContext(ConfigContext);
  const [boardTheme, setBoardTheme] = config.boardTheme;
  const [pieceSet, setPieceSet] = config.pieceSet ?? [SET_BAWAAN, () => {}];
  return <IsiThemes boardTheme={boardTheme} setBoardTheme={setBoardTheme} pieceSet={pieceSet} setPieceSet={setPieceSet} cocok={cocok} deskripsi={deskripsi} />;
}
export default memo(Themes);
