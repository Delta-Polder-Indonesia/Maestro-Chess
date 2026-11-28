/**
 * Sakelar ringkas gaya Mantine (pola switch puzzle En Croissant): track 38x20,
 * kenop putih 14px yang bergeser, tanpa teks ON/OFF — dipakai pada grid 2x2
 * pengaturan latihan supaya muat di panel kanan dan sesuai referensi.
 * Warna aktif memakai token aksen aplikasi agar tetap selaras dengan tema.
 */
export default function SakelarRingkas({ checked, onCheckedChange, "aria-label": label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-5 w-[38px] shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-backgroundBoxBoxHighlighted ${
        checked ? "border-backgroundBoxBoxHighlighted bg-backgroundBoxBoxHighlighted" : "border-border bg-backgroundTrack"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full bg-white shadow transition-all duration-150 ${
          checked ? "left-[20px]" : "left-[2px]"
        }`}
      />
    </button>
  );
}
