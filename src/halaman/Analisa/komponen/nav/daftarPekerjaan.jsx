import { ChevronRight, FileClock, FileText, RotateCw } from "lucide-react";
import { useI18n } from "../../../../lib/i18n.jsx";
import { usePekerjaan } from "../../usePekerjaan.js";

/** Daftar ini berisi pekerjaan yang benar-benar bisa dibuka kembali. */
export default function DaftarPekerjaan({ onBuka, onUlang }) {
  const { t, bahasa } = useI18n();
  const { siap, tersedia, menyimpan, daftar, aktif } = usePekerjaan();
  const formatTanggal = new Intl.DateTimeFormat(bahasa === "en" ? "en-US" : "id-ID", {
    dateStyle: "medium", timeStyle: "short",
  });

  return (
    <section
      data-uji="pekerjaan-daftar"
      aria-labelledby="judul-pekerjaan"
      className={`pb-8 ${daftar.length ? "order-first mb-6 mt-2 sm:order-none sm:mb-0 sm:mt-8" : "mt-8"}`}
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-backgroundBoxBox text-foregroundGrey">
          <FileClock size={19} aria-hidden="true" />
        </span>
        <div>
          <h2 id="judul-pekerjaan" className="text-base font-semibold text-foreground">{t("analisa.pekerjaan.judul")}</h2>
          <p className="mt-1 text-sm leading-5 text-foregroundGrey">{t("analisa.pekerjaan.keterangan")}</p>
          {siap && tersedia ? (
            <p role="status" className="mt-1 text-xs text-foregroundGrey">{t(menyimpan ? "analisa.pekerjaan.menyimpan" : "analisa.pekerjaan.tersimpan")}</p>
          ) : null}
        </div>
      </div>

      {!siap ? (
        <p className="rounded-lg border border-border bg-backgroundBoxBox px-4 py-5 text-sm text-foregroundGrey">{t("analisa.pekerjaan.memuat")}</p>
      ) : daftar.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-backgroundBoxBox/50 px-4 py-6 text-sm text-foregroundGrey">
          <p className="font-medium text-foreground">{t("analisa.pekerjaan.kosongJudul")}</p>
          <p className="mt-1">{t("analisa.pekerjaan.kosongIsi")}</p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border bg-backgroundBoxBox">
          {daftar.map((item) => {
            const draf = item.jenis === "draf";
            const berjalan = item.status === "berjalan" && item.id === aktif.id && aktif.berjalan;
            const belumSelesai = !draf && !["selesai", "baru"].includes(item.status) && !berjalan;
            const judul = draf ? [t("analisa.pekerjaan.draf"), item.judul].filter(Boolean).join(" · ") : item.judul || t(
              item.format === "fen" ? "analisa.pekerjaan.posisi" : "analisa.pekerjaan.laporan",
            );
            const status = draf ? t("analisa.pekerjaan.statusDraf") : berjalan
              ? t("analisa.pekerjaan.statusBerjalan") : belumSelesai
                ? t(item.adaHasil ? "analisa.pekerjaan.statusHasilLama" : "analisa.pekerjaan.statusTerputus")
                : t(item.status === "baru" ? "analisa.pekerjaan.statusBaru" : "analisa.pekerjaan.statusSelesai");
            const tanggal = Number.isFinite(item.waktu) && item.waktu > 0 ? new Date(item.waktu) : null;
            const waktu = tanggal && !Number.isNaN(tanggal.getTime()) ? tanggal : null;
            const aksi = belumSelesai && !item.adaHasil ? onUlang : onBuka;
            const labelAksi = belumSelesai && !item.adaHasil
              ? t("analisa.pekerjaan.ulang") : t("analisa.pekerjaan.buka");
            return (
              <li key={item.id} data-uji="pekerjaan-item" data-pekerjaan-id={item.id} className="flex flex-wrap items-center border-b border-border last:border-b-0 sm:flex-nowrap">
                <button
                  type="button"
                  data-uji="pekerjaan-buka"
                  onClick={() => aksi(item)}
                  aria-label={`${labelAksi}: ${judul}`}
                  className="flex w-full min-w-0 flex-none items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-backgroundBoxBoxHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-backgroundBoxBoxHighlighted sm:w-auto sm:flex-1"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-backgroundBox text-foregroundGrey">
                    <FileText size={18} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{judul}</span>
                    <span className="mt-1 block text-xs leading-4 text-foregroundGrey">
                      {status}{waktu ? <> · <time dateTime={waktu.toISOString()}>{formatTanggal.format(waktu)}</time></> : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-backgroundBoxBoxHighlighted">{labelAksi}</span>
                  <ChevronRight size={16} className="shrink-0 text-foregroundGrey" aria-hidden="true" />
                </button>
                {belumSelesai && item.adaHasil ? (
                  <button
                    type="button"
                    data-uji="pekerjaan-ulang"
                    onClick={() => onUlang(item)}
                    className="mb-3 ml-16 mr-4 inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foregroundGrey transition-colors hover:bg-backgroundBoxBoxHover hover:text-foreground sm:mb-0 sm:ml-0"
                  >
                    <RotateCw size={13} aria-hidden="true" /> {t("analisa.pekerjaan.ulang")}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
