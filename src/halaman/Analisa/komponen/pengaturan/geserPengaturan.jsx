/**
 * Kontrol angka pengaturan gaya NumberField reui (Base UI): input angka dengan
 * tombol chevron naik/turun bertumpuk di kanan, plus "scrub area" — readout
 * nilai yang bisa klik-tahan lalu geser kiri/kanan untuk mengubah nilai tanpa
 * slider (drag-to-scrub, seperti Blender/Base UI). Inilah "geser" tanpa membuka
 * slider: nilai berpindah saat diseret, sambil tetap bisa diketik langsung.
 *
 * Aksesibel: input spinbutton native (ArrowUp/Down, PageUp/Down, Home/End),
 * tombol chevron berlabel, nilai dijepit ke rentang [min,max]. onChange menerima
 * angka. Mengetik memakai pola draft hybrid seperti input kedalaman/Elo: angka
 * sah dalam rentang langsung disimpan, teks parsial ditunggu sampai blur.
 *
 * Bebas impor selain react agar kontrak deps-map pengaturan tetap sederhana;
 * chevron memakai SVG inline (bukan lucide) supaya komponen tetap mandiri.
 */
import { useEffect, useRef, useState } from "react";

// px gerakan pointer per satu langkah scrub (Base UI pixelSensitivity = 2).
const SENSITIVITAS_SCRUB = 2;

function jepit(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function Chevron({ arah }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-2.5" aria-hidden="true">
      {arah === "atas" ? <path d="m18 15-6-6-6 6" /> : <path d="m6 9 6 6 6-6" />}
    </svg>
  );
}

export default function GeserPengaturan({
  nilai, onChange, min = 0, max = 100, step = 1, ariaLabel, satuan = "",
  labelNaik, labelTurun, hintSeret,
}) {
  const [draf, setDraf] = useState(String(nilai));
  const scrub = useRef(null);
  useEffect(() => { setDraf(String(nilai)); }, [nilai]);

  // Simpan nilai final (blur/Enter): jepit + bulatkan; teks kosong → nilai lama.
  function commit(teks) {
    const n = Number(teks);
    const sah = String(teks).trim() !== "" && Number.isFinite(n) ? jepit(Math.round(n), min, max) : nilai;
    setDraf(String(sah));
    if (sah !== nilai) onChange(sah);
  }

  // Ubah langsung (chevron/scrub/keyboard): jepit ke rentang, simpan seketika.
  function ubahLangsung(n) {
    const sah = jepit(n, min, max);
    setDraf(String(sah));
    if (sah !== nilai) onChange(sah);
  }
  const dasar = Number.isFinite(nilai) ? nilai : min;
  function naik() { ubahLangsung(dasar + step); }
  function turun() { ubahLangsung(dasar - step); }

  function ketik(e) {
    const teks = e.target.value;
    setDraf(teks);
    if (teks.trim() === "") return;
    const n = Number(teks);
    if (!Number.isFinite(n)) return;
    // Hanya simpan bila angka bulat sah dalam rentang (pola kedalaman/Elo):
    // biarkan user mengetik '2' yang ingin jadi '20' tanpa dijepit prematur.
    if (n >= min && n <= max && String(Math.round(n)) === teks.trim() && n !== nilai) onChange(n);
  }

  function tombol(e) {
    switch (e.key) {
      case "Enter": e.preventDefault(); commit(draf); break;
      case "Escape": e.preventDefault(); setDraf(String(nilai)); break;
      case "ArrowUp": e.preventDefault(); naik(); break;
      case "ArrowDown": e.preventDefault(); turun(); break;
      case "PageUp": e.preventDefault(); ubahLangsung(dasar + step * 10); break;
      case "PageDown": e.preventDefault(); ubahLangsung(dasar - step * 10); break;
      case "Home": e.preventDefault(); ubahLangsung(min); break;
      case "End": e.preventDefault(); ubahLangsung(max); break;
      default: break;
    }
  }

  // Scrub: klik-tahan pada readout lalu geser horizontal. Nilai dilacak di ref
  // agar tidak bergantung closure basi saat drag cepat melintasi banyak event.
  function mulaiScrub(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    scrub.current = { sisa: 0, nilai: dasar };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function gerakScrub(e) {
    const s = scrub.current;
    if (!s) return;
    s.sisa += e.movementX ?? 0;
    let langkah = 0;
    while (s.sisa >= SENSITIVITAS_SCRUB) { langkah++; s.sisa -= SENSITIVITAS_SCRUB; }
    while (s.sisa <= -SENSITIVITAS_SCRUB) { langkah--; s.sisa += SENSITIVITAS_SCRUB; }
    if (langkah) {
      s.nilai = jepit(s.nilai + langkah * step, min, max);
      setDraf(String(s.nilai));
      onChange(s.nilai);
    }
  }
  function akhirScrub(e) {
    if (!scrub.current) return;
    scrub.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  const kelasChevron = "flex w-5 flex-1 items-center justify-center text-foregroundGrey transition-colors hover:bg-backgroundBoxBoxHighlightedHover hover:text-foreground focus-visible:bg-backgroundBoxBoxHighlightedHover focus-visible:text-foreground focus-visible:outline-none";

  return (
    <div className="flex w-[132px] flex-col gap-1">
      <span
        aria-hidden="true"
        title={hintSeret ?? ariaLabel}
        onPointerDown={mulaiScrub}
        onPointerMove={gerakScrub}
        onPointerUp={akhirScrub}
        onPointerCancel={akhirScrub}
        className="cursor-ew-resize touch-none select-none self-end text-[11px] font-medium tabular-nums text-foregroundGrey"
      >{nilai}{satuan}</span>
      <div className="flex h-7 items-stretch overflow-hidden rounded-borderRoundness border border-border bg-backgroundBoxBox transition-colors focus-within:border-backgroundBoxBoxHighlighted">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={draf}
          aria-label={ariaLabel}
          inputMode="numeric"
          onChange={ketik}
          onBlur={() => commit(draf)}
          onKeyDown={tombol}
          className="angka-input w-full min-w-0 flex-1 bg-transparent px-2 text-start text-[12.5px] tabular-nums text-foreground outline-none"
        />
        {satuan ? <span className="pointer-events-none flex items-center pr-1 text-[11px] text-foregroundGrey">{satuan}</span> : null}
        <div className="m-px flex shrink-0 flex-col overflow-hidden rounded-[3px] border border-border bg-backgroundBoxBoxHover">
          <button type="button" aria-label={labelNaik ?? `${ariaLabel} +`} onClick={naik} className={`${kelasChevron} border-b border-border`}>
            <Chevron arah="atas" />
          </button>
          <button type="button" aria-label={labelTurun ?? `${ariaLabel} −`} onClick={turun} className={kelasChevron}>
            <Chevron arah="bawah" />
          </button>
        </div>
      </div>
    </div>
  );
}
