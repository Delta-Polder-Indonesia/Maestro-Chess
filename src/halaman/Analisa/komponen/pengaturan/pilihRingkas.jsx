/**
 * Dropdown ringkas gaya NumberField reui/Base UI: kotak seperti input berisi
 * area teks (pratinjau opsional + label pilihan) dan kolom chevron ▲/▼ bertumpuk.
 * Chevron memindahkan pilihan sebelumnya/berikutnya (membungkus) TANPA membuka
 * daftar; klik area teks membuka popover listbox ber-scroll (maks 200px) berisi
 * nama-nama pilihan. Lebar bisa diatur per pemakaian (set bidak 10rem, tema
 * papan 12rem).
 *
 * Aksesibel: area teks `aria-haspopup="listbox"` + `aria-expanded`, daftar
 * `role="listbox"`, tiap pilihan `role="option"` + `aria-selected`, navigasi
 * panah/Enter/Escape saat terbuka, panah atas/bawah memindah pilihan saat
 * tertutup, klik di luar menutup. Chevron diberi `data-stepper` agar tidak
 * dihitung sebagai kontrol utama oleh pencarian pengaturan. `onPratinjau`
 * (opsional) dipanggil saat hover opsi dan dikosongkan saat tertutup. Efek
 * dokumen hanya aktif saat terbuka sehingga aman dirender tertutup di uji.
 *
 * Bebas impor selain react agar kontrak deps-map pengaturan tetap sederhana;
 * chevron memakai SVG inline.
 */
import { useEffect, useId, useRef, useState } from "react";

function Chevron({ arah }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3" aria-hidden="true">
      {arah === "atas" ? <path d="m18 15-6-6-6 6" /> : <path d="m6 9 6 6 6-6" />}
    </svg>
  );
}

export default function PilihRingkas({ id, nilai, pilihan, onChange, ariaLabel, lebar = "w-[190px]", onPratinjau, labelNaik, labelTurun }) {
  const [buka, setBuka] = useState(false);
  const [aktif, setAktif] = useState(0);
  const wadah = useRef(null);
  const daftarRef = useRef(null);
  const idDasar = useId();
  const terpilih = pilihan.find((p) => p.id === nilai) ?? pilihan[0];
  const indeks = pilihan.findIndex((p) => p.id === nilai);

  useEffect(() => {
    if (!buka) { onPratinjau?.(null); return undefined; }
    daftarRef.current?.focus();
    const klikLuar = (e) => { if (wadah.current && !wadah.current.contains(e.target)) setBuka(false); };
    document.addEventListener("mousedown", klikLuar);
    return () => document.removeEventListener("mousedown", klikLuar);
  }, [buka, onPratinjau]);

  function pilih(id) { onChange(id); setBuka(false); }

  // Stepper: pindah pilihan sebelumnya/berikutnya (membungkus ujung daftar),
  // tanpa membuka daftar — seperti menaikkan/menurunkan nilai NumberField.
  function geser(delta) {
    if (!pilihan.length) return;
    const i = indeks < 0 ? 0 : indeks;
    const baru = (i + delta + pilihan.length) % pilihan.length;
    onChange(pilihan[baru].id);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") { setBuka(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setAktif((i) => Math.min(pilihan.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAktif((i) => Math.max(0, i - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setAktif(0); }
    else if (e.key === "End") { e.preventDefault(); setAktif(pilihan.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (pilihan[aktif]) pilih(pilihan[aktif].id); }
  }

  // Saat tertutup, panah atas/bawah memindah pilihan langsung (seperti select
  // native); Enter/Space tetap membuka daftar lewat klik tombol bawaan.
  function onKeyDownTrigger(e) {
    if (buka) return;
    if (e.key === "ArrowDown") { e.preventDefault(); geser(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); geser(-1); }
  }

  const kelasChevron = "flex w-6 flex-1 items-center justify-center text-foregroundGrey transition-colors hover:bg-backgroundBoxBox hover:text-foreground focus-visible:bg-backgroundBoxBox focus-visible:text-foreground focus-visible:outline-none";

  return (
    <div ref={wadah} className={`relative ${lebar}`}>
      <div className="flex h-8 items-stretch overflow-hidden rounded-borderRoundness border border-border bg-backgroundDropdown transition-colors hover:border-foregroundGrey focus-within:border-backgroundBoxBoxHighlightedHover">
        <button
          id={id}
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={buka}
          onClick={() => { setAktif(Math.max(0, indeks)); setBuka((b) => !b); }}
          onKeyDown={onKeyDownTrigger}
          className="flex min-w-0 flex-1 items-center gap-2 px-2.5 text-left text-foreground focus-visible:outline-none"
        >
          {terpilih?.preview ? <span className="flex shrink-0 items-center">{terpilih.preview}</span> : null}
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{terpilih?.label}</span>
        </button>
        <div className="m-px flex shrink-0 flex-col overflow-hidden rounded-[3px] border border-border bg-backgroundBoxBox">
          <button type="button" data-stepper="true" aria-label={labelNaik ?? `${ariaLabel} ↑`} onClick={() => geser(-1)} className={`${kelasChevron} border-b border-border`}>
            <Chevron arah="atas" />
          </button>
          <button type="button" data-stepper="true" aria-label={labelTurun ?? `${ariaLabel} ↓`} onClick={() => geser(1)} className={kelasChevron}>
            <Chevron arah="bawah" />
          </button>
        </div>
      </div>
      {buka ? (
        <ul
          ref={daftarRef}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          aria-activedescendant={`${idDasar}-${aktif}`}
          onKeyDown={onKeyDown}
          className={`absolute right-0 z-30 mt-1 ${lebar} max-h-[200px] overflow-y-auto rounded-[6px] border border-border bg-backgroundDropdown py-1 shadow-lg focus:outline-none`}
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
                  className={`flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-[13px] hover:bg-backgroundDropdownHover ${i === aktif ? "bg-backgroundDropdownHover" : ""} ${dipilih ? "font-semibold text-foreground" : "text-foregroundGrey"}`}
                >
                  {p.preview ? <span className="flex shrink-0 items-center">{p.preview}</span> : null}
                  <span className="min-w-0 flex-1 truncate">{p.label}</span>
                  {dipilih ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0 text-backgroundBoxBoxHighlightedHover" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
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
