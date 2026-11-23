/**
 * Sakelar ON/OFF bergaya mock en-croissant di prompt.md: pil 46x22, teks
 * status di dalam, dan bujur putih yang bergeser. Warnanya memakai token
 * aplikasi (hijau aksen) supaya tetap selaras dengan tema Analisa.
 * Status visual disembunyikan dari pembaca layar karena tersedia lewat aria-checked.
 */
export default function SakelarPengaturan({ checked, onCheckedChange, "aria-label": label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-[22px] w-[46px] shrink-0 cursor-pointer items-center rounded-full p-[2px] transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-backgroundBoxBoxHighlighted ${
        checked ? "bg-backgroundBoxBoxHighlighted" : "bg-foregroundBlackDark"
      }`}
    >
      <span aria-hidden="true" className={`pointer-events-none text-[9.5px] font-bold tracking-tight transition-all duration-200 ${
        checked ? "pl-[6px] text-foregroundBlackDark" : "pl-[21px] text-[#e5e5e5]"
      }`}>
        {checked ? "ON" : "OFF"}
      </span>
      <span aria-hidden="true" className={`pointer-events-none absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all duration-200 ${
        checked ? "right-[2px]" : "left-[2px]"
      }`} />
    </button>
  );
}
