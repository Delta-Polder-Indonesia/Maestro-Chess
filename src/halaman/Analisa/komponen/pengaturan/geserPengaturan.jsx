/**
 * Slider pengaturan bergaya En Croissant (VolumeSlider/FontSizeSlider):
 * input range asli dengan aksen hijau aplikasi + angka nilai di kanan.
 * Aksesibel lewat aria-label dan nilai numerik yang terlihat. onChange
 * menerima angka sehingga pemanggil tidak perlu mengonversi string.
 */
export default function GeserPengaturan({ nilai, onChange, min = 0, max = 100, step = 1, ariaLabel, satuan = "" }) {
  return (
    <div className="flex w-[160px] items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={nilai}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-backgroundTrack accent-backgroundBoxBoxHighlightedHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-backgroundBoxBoxHighlighted"
      />
      <span className="w-10 shrink-0 text-right text-[12px] tabular-nums text-foregroundGrey">{nilai}{satuan}</span>
    </div>
  );
}
