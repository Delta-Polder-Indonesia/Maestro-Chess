/*
 * Layar "Papan" — beranda area kerja.
 *
 * Menggantikan menu "Report Analisa" di bilah navigasi: menu itu kini
 * bernama "Papan" dan membuka dashboard berisi kartu-kartu fitur.
 *
 * Proporsi mengikuti beranda en-croissant (`NewTabHome.tsx`):
 *  - kartu          : padding 24px, radius 8px, border 1px, shadow halus;
 *  - ikon           : 60px, monokrom mengikuti warna teks;
 *  - judul          : 16px / 500;
 *  - deskripsi      : 14px / dimmed;
 *  - tombol         : hijau solid #8BC550 dengan teks hitam, tinggi 42px, full width;
 *  - tata letak     : lima kartu per baris pada layar lebar, sisanya lanjut di bawah.
 *
 * Fitur yang sudah tersedia langsung membuka layarnya; fitur yang belum
 * dikerjakan diberi lencana "Segera hadir" dan tombolnya dinonaktifkan.
 */
import PanelLayar from "./PanelLayar.jsx";
import DaftarPekerjaan from "./daftarPekerjaan.jsx";
import { useI18n } from "../../../../lib/i18n.jsx";

/* ── Ikon kartu (monokrom, ikut warna teks kartu) ───────────────────── */

function Ikon({ nama }) {
  const umum = {
    className: "h-[60px] w-[60px]",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (nama === "play") {
    return (
      <svg {...umum}>
        <circle cx="12" cy="6.5" r="3" />
        <path d="M8.5 10.5h7" />
        <path d="M9.5 10.5l-1 6.5h7l-1-6.5" />
        <path d="M6.5 20h11" />
        <path d="M8 17l-1.5 3" />
        <path d="M16 17l1.5 3" />
      </svg>
    );
  }

  if (nama === "board") {
    return (
      <svg {...umum}>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="4" y="4" width="4" height="4" fill="currentColor" stroke="none" />
        <rect x="12" y="4" width="4" height="4" fill="currentColor" stroke="none" />
        <rect x="8" y="8" width="4" height="4" fill="currentColor" stroke="none" />
        <rect x="16" y="8" width="4" height="4" fill="currentColor" stroke="none" />
        <rect x="4" y="12" width="4" height="4" fill="currentColor" stroke="none" />
        <rect x="12" y="12" width="4" height="4" fill="currentColor" stroke="none" />
        <rect x="8" y="16" width="4" height="4" fill="currentColor" stroke="none" />
        <rect x="16" y="16" width="4" height="4" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (nama === "target") {
    return (
      <svg {...umum}>
        <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0" />
        <path d="M12 7a5 5 0 1 0 5 5" />
        <path d="M13 3.055a9 9 0 1 0 7.941 7.945" />
        <path d="M15 6v3h3l3-3h-3V3z" />
        <path d="M15 9l-3 3" />
      </svg>
    );
  }

  if (nama === "import") {
    return (
      <svg {...umum}>
        <path d="M14 3v4a1 1 0 0 0 1 1h4" />
        <path d="M5 13V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2h-5.5" />
        <path d="M2 19h7" />
        <path d="M6 16l3 3-3 3" />
      </svg>
    );
  }

  if (nama === "puzzle") {
    return (
      <svg {...umum}>
        <path d="M4 7h3a1 1 0 0 0 1-1V5a2 2 0 0 1 4 0v1a1 1 0 0 0 1 1h3a1 1 0 0 1 1 1v3a1 1 0 0 0 1 1h1a2 2 0 0 1 0 4h-1a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-1a2 2 0 0 0-4 0v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a2 2 0 0 0 0-4H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
      </svg>
    );
  }

  if (nama === "deteksi") {
    return (
      <svg {...umum}>
        <path d="M12 3l7 3v5c0 4.4-2.9 8.4-7 10-4.1-1.6-7-5.6-7-10V6l7-3z" />
        <path d="M12 8v4" />
        <path d="M12 15h.01" />
      </svg>
    );
  }

  if (nama === "wawasan") {
    return (
      <svg {...umum}>
        <path d="M4 20V4" />
        <path d="M4 20h16" />
        <path d="M7 15l4-4 3 2 5-6" />
        <path d="M16 7h3v3" />
      </svg>
    );
  }

  // report
  return (
    <svg {...umum}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <rect x="7" y="12" width="3" height="5" />
      <rect x="12" y="8" width="3" height="9" />
      <rect x="17" y="5" width="3" height="12" />
    </svg>
  );
}

/* ── Kartu fitur ────────────────────────────────────────────────────── */

function Kartu({ kunci, ikon, judul, deskripsi, labelTombol, segera, onClick, t }) {
  return (
    <div
      data-uji={`papan-kartu-${kunci}`}
      className="relative flex h-full flex-col items-center justify-between rounded-lg border border-border bg-backgroundBoxBox p-6 text-center shadow-sm"
    >
      {segera ? (
        <span className="absolute right-2.5 top-2.5 rounded bg-backgroundBoxBoxHover px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foregroundGrey">
          {t("analisa.papan.segera")}
        </span>
      ) : null}

      <span className="flex items-center justify-center text-foreground">
        <Ikon nama={ikon} />
      </span>

      <div className="w-full">
        <h2 className="text-base font-medium leading-6 text-foreground">{judul}</h2>
        <p className="mt-1 text-sm leading-5 text-foregroundGrey">{deskripsi}</p>
      </div>

      <button
        type="button"
        onClick={onClick}
        disabled={segera}
        data-uji={`papan-tombol-${kunci}`}
        className={`mt-4 h-[42px] w-full rounded-lg px-4 text-sm font-medium transition-colors ${
          segera
            ? "cursor-not-allowed bg-backgroundBoxBoxHover text-foregroundGrey opacity-60"
            : "cursor-pointer bg-[#8BC550] font-bold text-black hover:bg-[#81b64c]"
        }`}
      >
        {labelTombol}
      </button>
    </div>
  );
}

/* ── Layar ──────────────────────────────────────────────────────────── */

export default function LayarPapan({ onReport, onImpor, onDeteksiEngine, onWawasan, onBukaPekerjaan }) {
  const { t } = useI18n();

  const kartu = [
    {
      kunci: "main",
      ikon: "play",
      judul: t("analisa.papan.kartu.main.judul"),
      deskripsi: t("analisa.papan.kartu.main.deskripsi"),
      labelTombol: t("analisa.papan.kartu.main.tombol"),
      segera: true,
    },
    {
      kunci: "analisa",
      ikon: "board",
      judul: t("analisa.papan.kartu.analisa.judul"),
      deskripsi: t("analisa.papan.kartu.analisa.deskripsi"),
      labelTombol: t("analisa.papan.kartu.analisa.tombol"),
      segera: true,
    },
    {
      kunci: "report",
      ikon: "report",
      judul: t("analisa.papan.kartu.report.judul"),
      deskripsi: t("analisa.papan.kartu.report.deskripsi"),
      labelTombol: t("analisa.papan.kartu.report.tombol"),
      onClick: onReport,
    },
    {
      kunci: "repertoar",
      ikon: "target",
      judul: t("analisa.papan.kartu.repertoar.judul"),
      deskripsi: t("analisa.papan.kartu.repertoar.deskripsi"),
      labelTombol: t("analisa.papan.kartu.repertoar.tombol"),
      segera: true,
    },
    {
      kunci: "impor",
      ikon: "import",
      judul: t("analisa.papan.kartu.impor.judul"),
      deskripsi: t("analisa.papan.kartu.impor.deskripsi"),
      labelTombol: t("analisa.papan.kartu.impor.tombol"),
      onClick: onImpor,
    },
    {
      kunci: "puzzle",
      ikon: "puzzle",
      judul: t("analisa.papan.kartu.puzzle.judul"),
      deskripsi: t("analisa.papan.kartu.puzzle.deskripsi"),
      labelTombol: t("analisa.papan.kartu.puzzle.tombol"),
      segera: true,
    },
    {
      kunci: "deteksi-engine",
      ikon: "deteksi",
      judul: t("analisa.papan.kartu.deteksiEngine.judul"),
      deskripsi: t("analisa.papan.kartu.deteksiEngine.deskripsi"),
      labelTombol: t("analisa.papan.kartu.deteksiEngine.tombol"),
      onClick: onDeteksiEngine,
    },
    {
      kunci: "wawasan",
      ikon: "wawasan",
      judul: t("analisa.papan.kartu.wawasan.judul"),
      deskripsi: t("analisa.papan.kartu.wawasan.deskripsi"),
      labelTombol: t("analisa.papan.kartu.wawasan.tombol"),
      onClick: onWawasan,
    },
  ];

  return (
    <PanelLayar lebarMaks="max-w-[1400px]">
      <h1 className="sr-only">{t("analisa.papan.judul")}</h1>
      <div className="flex flex-col gap-6 pt-2.5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {kartu.map((k) => (
            <Kartu key={k.kunci} t={t} {...k} />
          ))}
        </div>
        <DaftarPekerjaan onBuka={onBukaPekerjaan} />
      </div>
    </PanelLayar>
  );
}
