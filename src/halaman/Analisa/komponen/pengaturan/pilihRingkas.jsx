/**
 * Dropdown ringkas gaya NumberField reui/Base UI: kotak seperti input berisi
 * area teks (pratinjau opsional + label pilihan) dan kolom chevron ▲/▼ bertumpuk.
 * Chevron memindahkan pilihan sebelumnya/berikutnya (membungkus) TANPA membuka
 * daftar; klik area teks membuka popover listbox ber-scroll (maks 200px) berisi
 * nama-nama pilihan. Lebar bisa diatur per pemakaian (set bidak 10rem, tema
 * papan 12rem).
 *
 * Aksesibel: area teks `aria-haspopup="listbox"` + `aria-expanded` +
 * `aria-controls`, daftar `role="listbox"`, tiap pilihan `role="option"` +
 * `aria-selected` (di tombol, `li` presentation — sama seperti SelectDaftar,
 * agar tidak ada interactive bersarang di dalam option), navigasi
 * panah/Home/End/Enter/Space/Escape/Tab saat terbuka, panah atas/bawah memindah
 * pilihan saat tertutup, klik di luar menutup. Fokus kembali ke trigger saat
 * daftar ditutup lewat keyboard/pilihan, dan opsi aktif digulirkan ke area
 * tampak. Chevron diberi `data-stepper` agar tidak dihitung sebagai kontrol
 * utama oleh pencarian pengaturan. `onPratinjau` (opsional) dipanggil saat hover
 * opsi dan dikosongkan sekali saat daftar ditutup.
 *
 * Posisi: panel pengaturan bergulir (`overflow-y-auto`), sehingga popover
 * `absolute` akan terpotong di baris bawah. Karena itu posisi diukur saat buka
 * dan dipasang `fixed` (keluar dari kliping leluhur), membalik ke atas bila
 * ruang bawah sempit dan membatasi tinggi ke ruang tersedia; diukur ulang saat
 * gulir/resize. Bila pengukuran tidak tersedia (SSR/uji tanpa DOM), jatuh balik
 * ke posisi absolut seperti semula.
 *
 * Bebas impor selain react agar kontrak deps-map pengaturan tetap sederhana;
 * chevron memakai SVG inline.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";

const TINGGI_MAKS = 200;
const TINGGI_MIN = 96;
const JARAK = 4;

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
  const [posisi, setPosisi] = useState(null);
  const wadah = useRef(null);
  const triggerRef = useRef(null);
  const daftarRef = useRef(null);
  const opsiRef = useRef([]);
  // Callback pratinjau disimpan di ref supaya identitasnya yang berubah tiap
  // render tidak membuat efek dokumen (fokus + pendengar) dipasang ulang.
  const pratinjau = useRef(onPratinjau);
  pratinjau.current = onPratinjau;
  const idDasar = useId();
  const idDaftar = `${idDasar}-daftar`;
  const terpilih = pilihan.find((p) => p.id === nilai) ?? pilihan[0];
  const indeks = pilihan.findIndex((p) => p.id === nilai);

  // Ukur trigger terhadap viewport: pilih arah dengan ruang terbanyak dan
  // batasi tinggi daftar agar tidak melewati tepi layar maupun panel.
  const ukur = useCallback(() => {
    const el = wadah.current;
    if (!el || typeof el.getBoundingClientRect !== "function") return;
    if (typeof window === "undefined") return;
    const kotak = el.getBoundingClientRect();
    const tinggiLayar = window.innerHeight || 0;
    const lebarLayar = window.innerWidth || 0;
    const ruangBawah = tinggiLayar - kotak.bottom - JARAK;
    const ruangAtas = kotak.top - JARAK;
    const keBawah = ruangBawah >= TINGGI_MIN || ruangBawah >= ruangAtas;
    const baru = {
      kanan: Math.max(8, lebarLayar - kotak.right),
      lebar: kotak.width,
      maks: Math.max(TINGGI_MIN, Math.min(TINGGI_MAKS, keBawah ? ruangBawah : ruangAtas)),
      keBawah,
      atas: kotak.bottom + JARAK,
      bawah: tinggiLayar - kotak.top + JARAK,
    };
    // Selama menggulir, posisi sering tidak berubah — jangan picu render ulang.
    setPosisi((lama) => (
      lama && lama.kanan === baru.kanan && lama.lebar === baru.lebar && lama.maks === baru.maks
        && lama.keBawah === baru.keBawah && lama.atas === baru.atas && lama.bawah === baru.bawah
        ? lama
        : baru
    ));
  }, []);

  useEffect(() => {
    if (!buka) return undefined;
    ukur();
    daftarRef.current?.focus?.();
    const klikLuar = (e) => { if (wadah.current && !wadah.current.contains(e.target)) setBuka(false); };
    const pasangUlang = () => ukur();
    const adaDocument = typeof document !== "undefined";
    const adaWindow = typeof window !== "undefined";
    // pointerdown mencakup sentuh/pena, bukan hanya mouse.
    if (adaDocument) document.addEventListener("pointerdown", klikLuar);
    if (adaWindow) {
      window.addEventListener("scroll", pasangUlang, true);
      window.addEventListener("resize", pasangUlang);
    }
    return () => {
      if (adaDocument) document.removeEventListener("pointerdown", klikLuar);
      if (adaWindow) {
        window.removeEventListener("scroll", pasangUlang, true);
        window.removeEventListener("resize", pasangUlang);
      }
    };
  }, [buka, ukur]);

  // Pratinjau hover dibersihkan saat mount tertutup dan setiap kali daftar
  // ditutup — sekali per transisi, bukan tiap render (identitas callback berubah
  // tiap render tidak lagi memicu pembersihan berulang).
  useEffect(() => {
    if (!buka) pratinjau.current?.(null);
  }, [buka]);

  // Opsi aktif selalu terlihat meski daftar digulir (aria-activedescendant
  // tidak menggulir sendiri seperti fokus native).
  useEffect(() => {
    if (buka) opsiRef.current[aktif]?.scrollIntoView?.({ block: "nearest" });
  }, [aktif, buka]);

  function tutup(fokus) {
    setBuka(false);
    if (fokus) triggerRef.current?.focus?.();
  }

  function pilih(id) { onChange(id); tutup(true); }

  // Stepper: pindah pilihan sebelumnya/berikutnya (membungkus ujung daftar),
  // tanpa membuka daftar — seperti menaikkan/menurunkan nilai NumberField.
  function geser(delta) {
    if (!pilihan.length) return;
    const i = indeks < 0 ? 0 : indeks;
    const baru = (i + delta + pilihan.length) % pilihan.length;
    onChange(pilihan[baru].id);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") { e.preventDefault(); tutup(true); return; }
    if (e.key === "Tab") { tutup(true); return; }
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

  // Terukur → fixed (lolos kliping panel bergulir). Belum terukur → absolut.
  const gayaDaftar = posisi
    ? {
      position: "fixed",
      right: posisi.kanan,
      width: posisi.lebar,
      maxHeight: posisi.maks,
      ...(posisi.keBawah ? { top: posisi.atas } : { bottom: posisi.bawah }),
    }
    : undefined;
  const kelasPosisi = posisi ? "" : "absolute right-0 top-full mt-1 max-h-[200px]";

  return (
    <div ref={wadah} className={`relative ${lebar}`}>
      <div className="flex h-8 items-stretch overflow-hidden rounded-borderRoundness border border-border bg-backgroundDropdown transition-colors hover:border-foregroundGrey focus-within:border-backgroundBoxBoxHighlightedHover">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={buka}
          aria-controls={buka ? idDaftar : undefined}
          onClick={() => { setAktif(Math.max(0, indeks)); if (!buka) ukur(); setBuka((b) => !b); }}
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
          id={idDaftar}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          aria-activedescendant={`${idDasar}-${aktif}`}
          onKeyDown={onKeyDown}
          style={gayaDaftar}
          className={`${kelasPosisi} z-[1200] overflow-y-auto rounded-[6px] border border-border bg-backgroundDropdown py-1 shadow-lg focus:outline-none`}
        >
          {pilihan.map((p, i) => {
            const dipilih = p.id === nilai;
            return (
              <li key={p.id} role="presentation">
                <button
                  ref={(el) => { opsiRef.current[i] = el; }}
                  type="button"
                  role="option"
                  id={`${idDasar}-${i}`}
                  aria-selected={dipilih}
                  tabIndex={-1}
                  onClick={() => pilih(p.id)}
                  onMouseEnter={() => { setAktif(i); pratinjau.current?.(p.id); }}
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
