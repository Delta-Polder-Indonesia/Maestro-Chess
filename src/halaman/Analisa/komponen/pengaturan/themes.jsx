/* Port dari Brilliant-Chess (MIT, © 2025 Delo) — jangan sunting massal tanpa cek README. */
import { ConfigContext, boardThemes, bacaTeks, tulis } from "../../../../modul/sesi/preferensi.js";
import { memo, useContext, useEffect } from "react";
import { useI18n } from "../../../../lib/i18n.jsx";
import SakelarPengaturan from "./sakelarPengaturan.jsx";
import BarisPengaturan from "./barisPengaturan.jsx";

const IsiThemes = memo(function IsiThemes({ boardTheme, setBoardTheme, cocok = () => true, deskripsi = () => null }) {
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
  return <section>
            {boardThemes.map((theme, i) => {
    const label = t(`analisa.tema.${theme.kunci}`);
    if (!cocok(`tema.${theme.kunci}`, label)) return null;
    return <BarisPengaturan
      key={i}
      judul={<button onClick={() => changeBoardTheme(i)} type="button" className="flex items-center gap-2 text-left font-medium text-foreground">
        <div aria-hidden="true" className="grid shrink-0 grid-cols-2 w-fit">
          {Array.from({ length: 4 }).map((_, i2) => {
            const isEvenCol = i2 % 2 === 0;
            const isEvenRow = Math.floor(i2 / 2) % 2 === 0;
            const squareColor = isEvenCol ? isEvenRow ? theme.white : theme.black : isEvenRow ? theme.black : theme.white;
            return <div key={i2} style={{ backgroundColor: squareColor }} className="h-5 w-5" />;
          })}
        </div>
        <span className="text-[13.5px]">{label}</span>
      </button>}
      deskripsi={deskripsi("temaPapan")}
    >
      <SakelarPengaturan
        checked={boardTheme === i}
        onCheckedChange={() => changeBoardTheme(i)}
        aria-label={label}
      />
    </BarisPengaturan>;
  })}
        </section>;
});

function Themes({ cocok, deskripsi }) {
  const [boardTheme, setBoardTheme] = useContext(ConfigContext).boardTheme;
  return <IsiThemes boardTheme={boardTheme} setBoardTheme={setBoardTheme} cocok={cocok} deskripsi={deskripsi} />;
}
export default memo(Themes);
