/**
 * Sakelar ON/OFF mengikuti geometri Switch `size="lg"` dari en-croissant:
 * track 56x30, label ON/OFF di dalam track, dan bujur putih 22px yang
 * bergeser. Warna aktif memakai token hijau aplikasi agar tetap selaras
 * dengan tema Analisa. Status visual disembunyikan dari pembaca layar
 * karena tersedia lewat aria-checked.
 */
export default function SakelarPengaturan({ checked, onCheckedChange, "aria-label": label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-[30px] w-[56px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-backgroundBoxBoxHighlighted ${
        checked ? "bg-backgroundBoxBoxHighlighted" : "bg-backgroundTrack"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 h-[22px] w-[31px] -translate-y-1/2 text-center text-[9px] font-semibold leading-[22px] transition-all duration-150 ease-in-out ${
          checked ? "left-[3px] text-white" : "left-[25px] text-foregroundSwitchOff"
        }`}
      >
        {checked ? "ON" : "OFF"}
      </span>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-all duration-150 ease-in-out ${
          checked ? "left-[31px]" : "left-[3px]"
        }`}
      />
    </button>
  );
}
