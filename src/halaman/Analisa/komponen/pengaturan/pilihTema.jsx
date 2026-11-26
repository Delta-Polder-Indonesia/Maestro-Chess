/**
 * Pemilih tema antarmuka bergaya En Croissant ThemeButton: segmented control
 * tiga pilihan (auto/light/dark) dengan ikon perangkat/matahari/bulan.
 * Semantik radiogroup — satu pilihan aktif, bisa dinavigasi dengan panah.
 *
 * `pilihan` adalah [{ id, label }] (label sudah diterjemahkan pemanggil);
 * ikon dipetakan dari id agar komponen tetap murni presentasional.
 */
const IKON = {
  // IconDeviceDesktop (tabler)
  auto: <path d="M3 5h18v11H3zM8 21h8M12 17v4" />,
  // IconSun (tabler)
  light: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  // IconMoon (tabler)
  dark: <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" />,
};

export default function PilihTema({ nilai, onChange, ariaLabel, pilihan }) {
  function tekanPanah(e, indeks) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const arah = e.key === "ArrowRight" ? 1 : -1;
    const berikut = (indeks + arah + pilihan.length) % pilihan.length;
    onChange(pilihan[berikut].id);
  }
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex shrink-0 items-center gap-0.5 rounded-borderRoundness border border-border bg-backgroundDropdown p-0.5">
      {pilihan.map((opsi, indeks) => {
        const aktif = nilai === opsi.id;
        return (
          <button
            key={opsi.id}
            type="button"
            role="radio"
            aria-checked={aktif}
            aria-label={opsi.label}
            tabIndex={aktif ? 0 : -1}
            onClick={() => onChange(opsi.id)}
            onKeyDown={(e) => tekanPanah(e, indeks)}
            className={`flex items-center gap-1.5 rounded-[3px] px-2.5 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-backgroundBoxBoxHighlighted ${aktif ? "bg-backgroundBoxBoxHighlighted text-foregroundBlackDark" : "text-foregroundGrey hover:text-foreground"}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">{IKON[opsi.id]}</svg>
            <span>{opsi.label}</span>
          </button>
        );
      })}
    </div>
  );
}
