/**
 * Grup "Tampilan" (adopsi En Croissant kategori appearance): tema antarmuka
 * (segmented auto/light/dark, ThemeButton), ukuran font (slider 50–200%,
 * FontSizeSlider) dan warna aksen (kisi swatch, ColorControl).
 *
 * Tema dan aksen diterapkan ke elemen .analisa-root oleh provider selama
 * Analisa aktif (halaman mendefinisikan ulang variabel warna dari namespace
 * --analisa-*); ukuran font ke root dokumen. Tema mengubah palet permukaan;
 * aksen menulis --analisa-backgroundBoxBoxHighlighted(Hover) sehingga seluruh
 * kontrol beraksen ikut berubah. Bawaan: dark, 100%, hijau asli Maestro —
 * tanpa regresi visual.
 */
import { ConfigContext, tulis, DAFTAR_AKSEN } from "../../../../modul/sesi/preferensi.js";
import { memo, useContext } from "react";
import { useI18n } from "../../../../lib/i18n.jsx";
import BarisPengaturan from "./barisPengaturan.jsx";
import GeserPengaturan from "./geserPengaturan.jsx";
import PilihTema from "./pilihTema.jsx";

// Fallback konteks beridentitas stabil agar memo IsiTampilan tidak bocor.
const SETTER_KOSONG = () => {};
const BAWAAN_FONT = [100, SETTER_KOSONG];
const BAWAAN_AKSEN = ["hijau", SETTER_KOSONG];
const BAWAAN_TEMA = ["dark", SETTER_KOSONG];
const DAFTAR_TEMA = ["auto", "light", "dark"];

const IsiTampilan = memo(function IsiTampilan({ fontSize, setFontSize, accentColor, setAccentColor, theme, setTheme, cocok = () => true, deskripsi = () => null }) {
  const { t } = useI18n();
  function changeFontSize(nilai) {
    const angka = Math.min(200, Math.max(50, Math.round(Number(nilai) || 100)));
    setFontSize(angka);
    tulis("fontSize", String(angka));
  }
  function changeAccent(id) {
    const sah = DAFTAR_AKSEN.some((aksen) => aksen.id === id) ? id : "hijau";
    setAccentColor(sah);
    tulis("accentColor", sah);
  }
  function changeTheme(id) {
    const sah = DAFTAR_TEMA.includes(id) ? id : "dark";
    setTheme(sah);
    tulis("theme", sah);
  }
  const labelTema = t("analisa.pengaturan.tema");
  const labelFont = t("analisa.pengaturan.ukuranFont");
  const labelAksen = t("analisa.pengaturan.warnaAksen");
  return <section>
    {cocok("tema", labelTema) ? <BarisPengaturan
      judul={<span className="text-[13.5px] font-medium text-foreground">{labelTema}</span>}
      deskripsi={deskripsi("tema")}
    >
      <PilihTema nilai={theme} onChange={changeTheme} ariaLabel={labelTema} pilihan={DAFTAR_TEMA.map((id) => ({ id, label: t(`analisa.pengaturan.opsiTema.${id}`) }))} />
    </BarisPengaturan> : null}
    {cocok("ukuranFont", labelFont) ? <BarisPengaturan
      judul={<span className="text-[13.5px] font-medium text-foreground">{labelFont}</span>}
      deskripsi={deskripsi("ukuranFont")}
    >
      <GeserPengaturan nilai={fontSize} onChange={changeFontSize} min={50} max={200} step={10} ariaLabel={labelFont} satuan="%" labelNaik={t("analisa.pengaturan.naikkan")} labelTurun={t("analisa.pengaturan.turunkan")} hintSeret={t("analisa.pengaturan.seretNilai")} />
    </BarisPengaturan> : null}
    {cocok("warnaAksen", labelAksen) ? <BarisPengaturan
      judul={<span className="text-[13.5px] font-medium text-foreground">{labelAksen}</span>}
      deskripsi={deskripsi("warnaAksen")}
    >
      <div className="flex w-[160px] flex-wrap gap-1.5" role="group" aria-label={labelAksen}>
        {DAFTAR_AKSEN.map((aksen) => {
          const nama = t(`analisa.pengaturan.aksen.${aksen.id}`);
          const terpilih = accentColor === aksen.id;
          return <button
            key={aksen.id}
            type="button"
            aria-label={nama}
            aria-pressed={terpilih}
            onClick={() => changeAccent(aksen.id)}
            className="flex h-6 w-6 items-center justify-center rounded-[4px] ring-1 ring-black/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-backgroundBoxBoxHighlighted"
            style={{ backgroundColor: aksen.dasar }}
          >
            {terpilih ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-white" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg> : null}
          </button>;
        })}
      </div>
    </BarisPengaturan> : null}
  </section>;
});

function Tampilan({ cocok, deskripsi }) {
  const config = useContext(ConfigContext);
  const [fontSize, setFontSize] = config.fontSize ?? BAWAAN_FONT;
  const [accentColor, setAccentColor] = config.accentColor ?? BAWAAN_AKSEN;
  const [theme, setTheme] = config.theme ?? BAWAAN_TEMA;
  return <IsiTampilan fontSize={fontSize} setFontSize={setFontSize} accentColor={accentColor} setAccentColor={setAccentColor} theme={theme} setTheme={setTheme} cocok={cocok} deskripsi={deskripsi} />;
}
export default memo(Tampilan);
