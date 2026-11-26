/**
 * Dropdown ringkas mengikuti bentuk UI En Croissant (PiecesSelect/BoardSelect):
 * trigger seperti kotak input (pratinjau opsional + label + chevron) yang
 * membuka popover listbox ber-scroll (maks 200px). Lebar bisa diatur per
 * pemakaian (set bidak 10rem, tema papan 12rem).
 *
 * Aksesibel: trigger `aria-haspopup="listbox"`, daftar `role="listbox"`,
 * tiap pilihan `role="option"` + `aria-selected`, navigasi panah/Enter/Escape,
 * klik di luar menutup. `onPratinjau` (opsional) dipanggil saat hover opsi dan
 * dikosongkan saat tertutup — dipakai untuk pratinjau bidak langsung di baris.
 * Efek dokumen hanya aktif saat terbuka sehingga aman dirender tertutup di uji.
 */
import { useEffect, useId, useRef, useState } from "react";

export default function PilihRingkas({ nilai, pilihan, onChange, ariaLabel, lebar = "w-[190px]", onPratinjau }) {
  const [buka, setBuka] = useState(false);
  const [aktif, setAktif] = useState(0);
  const wadah = useRef(null);
  const daftarRef = useRef(null);
  const idDasar = useId();
  const terpilih = pilihan.find((p) => p.id === nilai) ?? pilihan[0];

  useEffect(() => {
    if (!buka) { onPratinjau?.(null); return undefined; }
    daftarRef.current?.focus();
    const klikLuar = (e) => { if (wadah.current && !wadah.current.contains(e.target)) setBuka(false); };
    document.addEventListener("mousedown", klikLuar);
    return () => document.removeEventListener("mousedown", klikLuar);
  }, [buka, onPratinjau]);

  function pilih(id) { onChange(id); setBuka(false); }

  function onKeyDown(e) {
    if (e.key === "Escape") { setBuka(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setAktif((i) => Math.min(pilihan.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAktif((i) => Math.max(0, i - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setAktif(0); }
    else if (e.key === "End") { e.preventDefault(); setAktif(pilihan.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (pilihan[aktif]) pilih(pilihan[aktif].id); }
  }

  return (
    <div ref={wadah} className={`relative ${lebar}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={buka}
        onClick={() => { setAktif(Math.max(0, pilihan.findIndex((p) => p.id === nilai))); setBuka((b) => !b); }}
        className="flex w-full items-center gap-2 rounded-borderRoundness border border-border bg-[#272727] px-2.5 py-1.5 text-left text-foreground hover:border-foregroundGrey focus-visible:border-[#8BC550] focus-visible:outline-none"
      >
        {terpilih?.preview ? <span className="flex shrink-0 items-center">{terpilih.preview}</span> : null}
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{terpilih?.label}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 shrink-0 text-foregroundGrey transition-transform ${buka ? "rotate-180" : ""}`} aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {buka ? (
        <ul
          ref={daftarRef}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          aria-activedescendant={`${idDasar}-${aktif}`}
          onKeyDown={onKeyDown}
          className={`absolute right-0 z-30 mt-1 ${lebar} max-h-[200px] overflow-y-auto rounded-[6px] border border-border bg-backgroundBox py-1 shadow-lg focus:outline-none`}
        >
          {pilihan.map((p, i) => {
            const dipilih = p.id === nilai;
            return (
              <li key={p.id} id={`${idDasar}-${i}`} role="option" aria-selected={dipilih}>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => pilih(p.id)}
                  onMouseEnter={() => { setAktif(i); onPratinjau?.(p.id); }}
                  className={`flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-[13px] hover:bg-backgroundBoxBox ${i === aktif ? "bg-backgroundBoxBox" : ""} ${dipilih ? "font-semibold text-foreground" : "text-foregroundGrey"}`}
                >
                  {p.preview ? <span className="flex shrink-0 items-center">{p.preview}</span> : null}
                  <span className="min-w-0 flex-1 truncate">{p.label}</span>
                  {dipilih ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0 text-[#8BC550]" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
