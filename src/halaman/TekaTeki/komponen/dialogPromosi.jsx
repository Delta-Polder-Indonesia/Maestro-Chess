/**
 * Dialog promosi teka-teki — pemain wajib memilih bidak (menteri/benteng/gajah/
 * kuda) saat pion mencapai baris akhir, pola ChessClub PromotionDialog. Escape
 * atau klik latar membatalkan. Pilihan diteruskan sebagai tipe chess.js (q/r/b/n).
 */
import { useEffect, useRef } from "react";
import PieceSVG from "../../Analisa/komponen/svg/piece.jsx";
import { useI18n } from "../../../lib/i18n.jsx";

const PILIHAN = ["q", "r", "b", "n"];

export default function DialogPromosi({ warna, onPilih, onBatal }) {
  const { t } = useI18n();
  const wadah = useRef(null);
  useEffect(() => {
    wadah.current?.querySelector("button")?.focus();
    function tekan(e) {
      if (e.key === "Escape") { e.preventDefault(); onBatal(); }
    }
    document.addEventListener("keydown", tekan);
    return () => document.removeEventListener("keydown", tekan);
  }, [onBatal]);

  return (
    <div
      className="absolute inset-0 z-[90] flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={t("tekaTeki.promosi.judul")}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onBatal(); }}
    >
      <div ref={wadah} className="flex flex-col gap-2 rounded-borderRoundness border border-border bg-backgroundBoxDarker p-3 shadow-lg">
        <span className="text-center text-[12px] font-medium text-foreground">{t("tekaTeki.promosi.judul")}</span>
        <div className="flex gap-1.5">
          {PILIHAN.map((tipe) => (
            <button
              key={tipe}
              type="button"
              aria-label={t(`tekaTeki.promosi.${tipe}`)}
              onClick={() => onPilih(tipe)}
              className="flex h-14 w-14 items-center justify-center rounded-borderRoundness border border-border bg-backgroundDropdown p-1 transition-colors hover:bg-backgroundBoxBoxHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-backgroundBoxBoxHighlighted"
            >
              <PieceSVG piece={tipe} color={warna} size="100%" className="h-full w-full" />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onBatal}
          className="rounded-borderRoundness border border-border bg-backgroundDropdown py-1 text-[12px] text-foregroundGrey transition-colors hover:text-foreground"
        >{t("tekaTeki.promosi.batal")}</button>
      </div>
    </div>
  );
}
