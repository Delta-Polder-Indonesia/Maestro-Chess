import { useState } from "react";
import { useI18n } from "../../../../lib/i18n.jsx";
import { daftarRiwayat, KUNCI_FITUR } from "../../riwayatFitur.js";
import { usePekerjaan } from "../../usePekerjaan.js";

const BATAS_TERBARU = 10;
// Formatter Intl mahal dibuat berulang untuk tiap baris saat riwayat berubah.
// Hanya ada dua locale UI; gunakan kembali formatter, bukan hasil tanggalnya
// (waktu relatif tetap dihitung ulang saat daftar di-render).
const formatTanggal = new Map();
const formatRelatif = new Map();

function IkonFile({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M5 13V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3" />
      <path d="M2 19h7" />
      <path d="M6 16l3 3-3 3" />
    </svg>
  );
}

function IkonJam({ className = "h-3.5 w-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  );
}

function formatWaktu(timestamp, bahasa) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  const tanggal = new Date(timestamp);
  if (Number.isNaN(tanggal.getTime())) return null;
  const locale = bahasa === "en" ? "en-US" : "id-ID";
  if (!formatTanggal.has(locale)) {
    formatTanggal.set(locale, new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }));
  }
  const lengkap = formatTanggal.get(locale).format(tanggal);
  const detik = Math.round((tanggal.getTime() - Date.now()) / 1000);
  const satuan = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  const [unit, ukuran] = satuan.find(([, nilai]) => Math.abs(detik) >= nilai) ?? ["second", 1];
  const singkatan = bahasa === "en"
    ? { year: "y", month: "mo", week: "w", day: "d", hour: "h", minute: "m" }
    : { year: "th", month: "bln", week: "mg", day: "hr", hour: "j", minute: "m" };
  const ringkas = unit === "second" ? (bahasa === "en" ? "now" : "baru")
    : `${detik > 0 ? "+" : ""}${Math.abs(Math.round(detik / ukuran))}${singkatan[unit]}`;
  try {
    const localeRelatif = bahasa === "en" ? "en" : "id";
    if (!formatRelatif.has(localeRelatif)) {
      formatRelatif.set(localeRelatif, new Intl.RelativeTimeFormat(localeRelatif, { numeric: "auto" }));
    }
    return { lengkap, ringkas, relatif: formatRelatif.get(localeRelatif).format(Math.round(detik / ukuran), unit), iso: tanggal.toISOString() };
  } catch (error) {
    console.error("Gagal memformat waktu relatif pekerjaan:", error);
    return { lengkap, ringkas, relatif: lengkap, iso: tanggal.toISOString() };
  }
}

/** Bentuk panel tetap seperti beranda semula; barisnya membuka fitur terakhir. */
export default function DaftarPekerjaan({ onBuka }) {
  const { t, bahasa } = useI18n();
  const { siap, tersedia, menyimpan, daftar, aktif } = usePekerjaan();
  const [lihatSemua, setLihatSemua] = useState(false);
  const riwayat = daftarRiwayat(daftar);
  const ditampilkan = lihatSemua ? riwayat : riwayat.slice(0, BATAS_TERBARU);

  return (
    <section data-uji="pekerjaan-daftar" aria-labelledby="judul-pekerjaan" className="rounded-lg border border-border bg-backgroundBoxBox p-4 shadow-sm">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 id="judul-pekerjaan" className="text-lg font-semibold text-foreground">{t("analisa.pekerjaan.judul")}</h2>
        <button
          type="button"
          data-uji="pekerjaan-lihat-semua"
          disabled={riwayat.length <= BATAS_TERBARU}
          aria-expanded={lihatSemua}
          onClick={() => setLihatSemua((nilai) => !nilai)}
          className="cursor-pointer rounded px-2 py-1 text-xs font-medium text-foregroundGrey transition-colors hover:bg-backgroundBoxBoxHover hover:text-foregroundHighlighted disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-foregroundGrey"
        >
          {t(lihatSemua ? "analisa.pekerjaan.lebihSedikit" : "analisa.pekerjaan.lihatSemua")}
        </button>
      </div>
      {siap && tersedia ? (
        <span data-uji="pekerjaan-status" role="status" className="sr-only">{t(menyimpan ? "analisa.pekerjaan.menyimpan" : "analisa.pekerjaan.tersimpan")}</span>
      ) : null}

      {!siap ? (
        <div className="flex h-[200px] items-center justify-center">
          <p className="text-sm text-foregroundGrey">{t("analisa.pekerjaan.memuat")}</p>
        </div>
      ) : riwayat.length === 0 ? (
        <div className="flex h-[200px] flex-col items-center justify-center gap-2">
          <IkonJam className="h-12 w-12 opacity-30" />
          <p className="text-sm text-foregroundGrey">{t("analisa.pekerjaan.kosong")}</p>
        </div>
      ) : (
        <div data-uji="pekerjaan-scroll" role="region" aria-labelledby="judul-pekerjaan" tabIndex={0} className="h-[200px] overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable] focus-visible:outline focus-visible:outline-2 focus-visible:outline-backgroundBoxBoxHighlighted">
          <ul className="flex flex-col gap-0.5">
            {ditampilkan.map(({ item, fitur, pekerjaan }) => {
              const draf = pekerjaan?.jenis === "draf";
              const berjalan = pekerjaan?.status === "berjalan" && pekerjaan.id === aktif.id && aktif.berjalan;
              const belumSelesai = pekerjaan && !draf && !["selesai", "baru"].includes(pekerjaan.status) && !berjalan;
              const judul = [t(KUNCI_FITUR[fitur]), pekerjaan?.judul].filter(Boolean).join(" · ");
              const status = !pekerjaan ? null : draf ? "Draf" : berjalan ? "Berjalan" : belumSelesai ? "Terputus" : pekerjaan.status === "baru" ? "Baru" : "Selesai";
              const keterangan = status ? t(`analisa.pekerjaan.status${status === "Terputus" && pekerjaan.adaHasil ? "HasilLama" : status}`) : null;
              const waktu = formatWaktu(item.waktu, bahasa);
              const label = [`${t("analisa.pekerjaan.buka")}: ${judul}`, keterangan, waktu?.relatif].filter(Boolean).join(". ");
              return (
                <li key={item.id} data-uji="pekerjaan-item" data-pekerjaan-id={item.id} data-fitur={fitur} className="min-w-0">
                  <button
                    type="button"
                    data-uji="pekerjaan-buka"
                    onClick={() => onBuka(item)}
                    aria-label={label}
                    className="flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-backgroundBoxBoxHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-backgroundBoxBoxHighlighted sm:gap-3 sm:px-3"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-foregroundGrey"><IkonFile /></span>
                      <span className="truncate text-sm font-medium text-foreground">{judul}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {status ? (
                        <span title={keterangan} className="rounded bg-backgroundBoxBoxHover px-1.5 py-0.5 text-[10px] font-semibold text-foregroundGrey">
                          {t(`analisa.pekerjaan.singkat${status}`)}
                        </span>
                      ) : null}
                      {waktu ? (
                        <span className="flex items-center gap-1 text-foregroundGrey" title={`${waktu.relatif} · ${waktu.lengkap}`}>
                          <span className="hidden sm:inline-flex"><IkonJam /></span>
                          <time dateTime={waktu.iso} className="text-xs">
                            <span className="sm:hidden">{waktu.ringkas}</span>
                            <span className="hidden sm:inline">{waktu.relatif}</span>
                          </time>
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
