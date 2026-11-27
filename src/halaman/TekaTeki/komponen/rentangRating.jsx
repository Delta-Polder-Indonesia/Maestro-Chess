/**
 * Rentang rating dua-thumb (pola RangeSlider puzzle En Croissant): satu track
 * dengan dua kenop yang bisa diseret (scrub) maupun digeser lewat keyboard,
 * segmen terisi di antara keduanya, dan label ujung 600 / 2800 plus readout
 * rentang aktif. Kenop minimum tak pernah melewati maksimum dan sebaliknya.
 *
 * Saat mode progresif aktif rentang ini dinonaktifkan — kesulitan ditentukan
 * otomatis dari rating soal terakhir, bukan dipilih manual.
 *
 * Hanya bergantung pada react agar mandiri; posisi kenop memakai style React
 * (bukan atribut style string) sehingga tetap sah di bawah CSP situs ini.
 */
import { useRef } from "react";

export default function RentangRating({
  nilaiMin, nilaiMax, onChangeMin, onChangeMax,
  min = 600, max = 2800, step = 50,
  disabled = false, labelMin, labelMax, labelRentang,
}) {
  const trackRef = useRef(null);
  const minRef = useRef(nilaiMin); minRef.current = nilaiMin;
  const maxRef = useRef(nilaiMax); maxRef.current = nilaiMax;
  const seret = useRef(null);

  const persen = (n) => ((n - min) / (max - min)) * 100;

  function nilaiDariX(clientX) {
    const el = trackRef.current;
    if (!el || !Number.isFinite(clientX)) return null;
    const rect = el.getBoundingClientRect();
    const rasio = rect.width ? (clientX - rect.left) / rect.width : 0;
    const mentah = min + Math.min(1, Math.max(0, rasio)) * (max - min);
    return Math.min(max, Math.max(min, Math.round(mentah / step) * step));
  }

  function mulai(e, which) {
    if (disabled) return;
    e.preventDefault();
    seret.current = which;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function gerak(e, which) {
    if (disabled || seret.current !== which) return;
    if (e.buttons !== undefined && e.buttons === 0) { selesai(e, which); return; }
    const n = nilaiDariX(e.clientX);
    if (n === null) return;
    if (which === "min") onChangeMin(Math.min(n, maxRef.current));
    else onChangeMax(Math.max(n, minRef.current));
  }
  function selesai(e, which) {
    if (seret.current !== which) return;
    seret.current = null;
    const el = e.currentTarget;
    if (typeof el?.hasPointerCapture === "function") {
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture?.(e.pointerId);
    } else el?.releasePointerCapture?.(e.pointerId);
  }

  function tombol(e, which) {
    if (disabled) return;
    const sekarang = which === "min" ? nilaiMin : nilaiMax;
    let baru;
    switch (e.key) {
      case "ArrowLeft": case "ArrowDown": baru = sekarang - step; break;
      case "ArrowRight": case "ArrowUp": baru = sekarang + step; break;
      case "PageDown": baru = sekarang - step * 10; break;
      case "PageUp": baru = sekarang + step * 10; break;
      case "Home": baru = min; break;
      case "End": baru = max; break;
      default: return;
    }
    e.preventDefault();
    baru = Math.min(max, Math.max(min, baru));
    if (which === "min") onChangeMin(Math.min(baru, nilaiMax));
    else onChangeMax(Math.max(baru, nilaiMin));
  }

  const kenop = (which) => {
    const nilai = which === "min" ? nilaiMin : nilaiMax;
    return (
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={which === "min" ? labelMin : labelMax}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={nilai}
        aria-disabled={disabled || undefined}
        data-uji={`rentang-${which}`}
        onPointerDown={(e) => mulai(e, which)}
        onPointerMove={(e) => gerak(e, which)}
        onPointerUp={(e) => selesai(e, which)}
        onPointerCancel={(e) => selesai(e, which)}
        onLostPointerCapture={(e) => selesai(e, which)}
        onKeyDown={(e) => tombol(e, which)}
        className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none rounded-full border-4 border-backgroundBoxBoxHighlighted bg-white shadow transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-backgroundBoxBoxHighlighted [@media(pointer:coarse)]:h-6 [@media(pointer:coarse)]:w-6"
        style={{ left: `${persen(nilai)}%` }}
      />
    );
  };

  return (
    <div className={disabled ? "opacity-50" : ""} aria-disabled={disabled || undefined}>
      <div
        ref={trackRef}
        aria-label={labelRentang}
        className="relative h-8 select-none"
      >
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-backgroundTrack" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-backgroundBoxBoxHighlighted"
          style={{ left: `${persen(nilaiMin)}%`, width: `${persen(nilaiMax) - persen(nilaiMin)}%` }}
        />
        {kenop("min")}
        {kenop("max")}
      </div>
      <div className="flex items-center justify-between text-[11px] tabular-nums text-foregroundGrey">
        <span>{min}</span>
        <span className="font-medium text-foreground">{nilaiMin} – {nilaiMax}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
