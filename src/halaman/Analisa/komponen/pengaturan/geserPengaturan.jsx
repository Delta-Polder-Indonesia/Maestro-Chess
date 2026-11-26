/**
 * Slider pengaturan dengan tanda tick + label referensi (pola "Slider with tick
 * marks" reui.io, diselaraskan dengan tema Maestro). Track + thumb bulat memakai
 * input range asli (aksesibel: keyboard, aria-valuenow) sehingga tes dan perilaku
 * numerik tetap sama; di bawahnya deret tick — tick utama lebih tinggi dan
 * berangka, tick minor lebih pendek tanpa angka (aria-hidden).
 *
 * `tickMinor` = jarak antar-tick; `tickMajor` = jarak tick berlabel. Nilai saat
 * ini tampil kecil di kanan atas track. onChange menerima angka.
 */
function buatTicks(min, max, minor, major) {
  const daftar = [];
  const langkah = minor > 0 ? minor : 1;
  for (let v = min; v <= max + 1e-9; v += langkah) {
    const nilai = Math.round(v);
    const utama = nilai === min || nilai === max || (major > 0 && nilai % major === 0);
    daftar.push({ nilai, utama });
  }
  return daftar;
}

export default function GeserPengaturan({
  nilai, onChange, min = 0, max = 100, step = 1, ariaLabel, satuan = "",
  tickMinor, tickMajor,
}) {
  const minor = tickMinor ?? Math.max(step, Math.round((max - min) / 20));
  const major = tickMajor ?? Math.round((max - min) / 4);
  const ticks = buatTicks(min, max, minor, major);
  return (
    <div className="flex w-[220px] flex-col gap-1">
      <span className="self-end text-[12px] font-medium tabular-nums text-foregroundGrey">{nilai}{satuan}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={nilai}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
        className="geser-pengaturan w-full"
      />
      <span aria-hidden="true" className="flex w-full items-start justify-between px-[7px] text-[10px] font-medium leading-none text-foregroundGrey">
        {ticks.map((tick) => (
          <span key={tick.nilai} className="flex w-0 flex-col items-center gap-1">
            <span className={tick.utama ? "h-1.5 w-px bg-foregroundGrey" : "h-[3px] w-px bg-foregroundGrey/60"} />
            <span className={tick.utama ? "tabular-nums" : "opacity-0"}>{tick.nilai}</span>
          </span>
        ))}
      </span>
    </div>
  );
}
