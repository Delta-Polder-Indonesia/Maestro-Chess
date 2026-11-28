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
  // onBatal dibuat ulang setiap render induk; disimpan di ref supaya efek fokus
  // berjalan sekali per pembukaan dialog, bukan memindahkan fokus tiap render.
  const batalRef = useRef(onBatal);
  batalRef.current = onBatal;
  useEffect(() => {
    // Pemicu = elemen yang sedang fokus saat dialog dibuka (petak papan).
    const pemicu = document.activeElement;
    const tombol = () => Array.from(wadah.current?.querySelectorAll("button") ?? []);
    tombol()[0]?.focus();
    function tekan(e) {
      if (e.key === "Escape") { e.preventDefault(); batalRef.current(); return; }
      if (e.key !== "Tab") return;
      // Focus trap: Tab/Shift+Tab berputar di dalam dialog selama terbuka.
      const daftar = tombol();
      if (!daftar.length) return;
      const pertama = daftar[0];
      const terakhir = daftar[daftar.length - 1];
      const aktif = document.activeElement;
      const diDalam = !!wadah.current?.contains?.(aktif);
      if (e.shiftKey && (!diDalam || aktif === pertama)) { e.preventDefault(); terakhir.focus(); }
      else if (!e.shiftKey && (!diDalam || aktif === terakhir)) { e.preventDefault(); pertama.focus(); }
    }
    document.addEventListener("keydown", tekan);
    return () => {
      document.removeEventListener("keydown", tekan);
      // Pulihkan fokus ke pemicu bila masih ada di dokumen.
      if (pemicu && typeof pemicu.focus === "function" && document.contains?.(pemicu)) pemicu.focus();
    };
  }, []);

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
