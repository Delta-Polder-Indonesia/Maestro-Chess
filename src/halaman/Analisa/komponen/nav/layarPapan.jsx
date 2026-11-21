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
 *  - tombol         : varian "light" (tint warna aksen), tinggi 42px, full width;
 *  - panel terbaru  : padding 16px, judul 18px / 600;
 *  - empty state    : tinggi 200px, ikon 48px opacity 0.3, teks 14px dimmed;
 *  - baris terbaru  : padding 12px/6px, ikon 20px, nama 14px / 500,
 *                     waktu relatif 12px dimmed.
 *
 * Fitur yang sudah tersedia langsung membuka layarnya; fitur yang belum
 * dikerjakan diberi lencana "Segera hadir" dan tombolnya dinonaktifkan.
 */
import { useEffect, useState } from "react";
import PanelLayar from "./PanelLayar.jsx";
import { useI18n } from "../../../../lib/i18n.jsx";
import { ambilDaftarPartai } from "../../basisData.js";

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
            : "cursor-pointer bg-backgroundBoxBoxHighlighted/15 text-backgroundBoxBoxHighlighted hover:bg-backgroundBoxBoxHighlighted/25"
        }`}
      >
        {labelTombol}
      </button>
    </div>
  );
}

/* ── Panel file terbaru ─────────────────────────────────────────────── */

function labelHasil(hasil) {
  if (hasil === "white") return "1-0";
  if (hasil === "black") return "0-1";
  if (hasil === "draw") return "½-½";
  return "*";
}

function formatTanggal(timestamp, bahasa) {
  if (!timestamp) return "—";
  const tanggal = new Date(timestamp);
  if (Number.isNaN(tanggal.getTime())) return "—";
  return tanggal.toLocaleDateString(bahasa === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "2 hari lalu" / "2 days ago", seperti dayjs.fromNow() di en-croissant. */
function waktuRelatif(timestamp, bahasa) {
  if (!timestamp) return "—";
  const tanggal = new Date(timestamp);
  if (Number.isNaN(tanggal.getTime())) return "—";
  const detik = Math.round((tanggal.getTime() - Date.now()) / 1000);
  const satuan = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  try {
    const rtf = new Intl.RelativeTimeFormat(bahasa === "en" ? "en" : "id", { numeric: "auto" });
    for (const [unit, ukuran] of satuan) {
      if (Math.abs(detik) >= ukuran) return rtf.format(Math.round(detik / ukuran), unit);
    }
    return rtf.format(detik, "second");
  } catch {
    return formatTanggal(timestamp, bahasa);
  }
}

function IkonFile({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M5 13V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3" />
      <path d="M2 19h7" />
      <path d="M6 16l3 3-3 3" />
    </svg>
  );
}

function IkonJam({ className = "h-3.5 w-3.5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  );
}

function FileTerbaru({ daftar, memuat, bahasa, onBuka, onDatabase, t }) {
  return (
    <section className="rounded-lg border border-border bg-backgroundBoxBox p-4 shadow-sm">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">{t("analisa.papan.terbaru.judul")}</h2>
        <button
          type="button"
          onClick={onDatabase}
          className="cursor-pointer rounded px-2 py-1 text-xs font-medium text-foregroundGrey transition-colors hover:bg-backgroundBoxBoxHover hover:text-foregroundHighlighted"
        >
          {t("analisa.papan.terbaru.keDatabase")}
        </button>
      </div>

      {memuat ? (
        <div className="flex h-[200px] items-center justify-center">
          <p className="text-sm text-foregroundGrey">{t("analisa.papan.terbaru.memuat")}</p>
        </div>
      ) : daftar.length === 0 ? (
        <div className="flex h-[200px] flex-col items-center justify-center gap-2">
          <IkonJam className="h-12 w-12 opacity-30" />
          <p className="text-sm text-foregroundGrey">{t("analisa.papan.terbaru.kosong")}</p>
        </div>
      ) : (
        <div className="max-h-[300px] overflow-y-auto">
          <ul className="flex flex-col gap-0.5">
            {daftar.map((partai) => {
              const putih = partai.whiteName || t("analisa.papan.terbaru.tanpaNama");
              const hitam = partai.blackName || t("analisa.papan.terbaru.tanpaNama");
              return (
                <li key={partai.id ?? `${putih}-${hitam}-${partai.timestamp}`}>
                  <button
                    type="button"
                    onClick={() => onBuka(partai)}
                    aria-label={t("analisa.papan.terbaru.buka", { putih, hitam })}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 rounded px-3 py-1.5 text-left transition-colors hover:bg-backgroundBoxBoxHover"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-foregroundGrey">
                        <IkonFile />
                      </span>
                      <span className="truncate text-sm font-medium text-foreground">
                        {putih} <span className="text-foregroundGrey">vs</span> {hitam}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="rounded bg-backgroundBoxBoxHover px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foregroundGrey">
                        {labelHasil(partai.result)}
                      </span>
                      <span
                        className="flex items-center gap-1 text-foregroundGrey"
                        title={formatTanggal(partai.timestamp, bahasa)}
                      >
                        <IkonJam />
                        <span className="text-xs">{waktuRelatif(partai.timestamp, bahasa)}</span>
                      </span>
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

/* ── Layar ──────────────────────────────────────────────────────────── */

export default function LayarPapan({ onAnalisa, onImpor, onDatabase }) {
  const { t, bahasa } = useI18n();
  const [daftar, setDaftar] = useState([]);
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    let aktif = true;
    ambilDaftarPartai({ limit: 10, sertakanPgn: true })
      .then((hasil) => {
        if (!aktif) return;
        setDaftar(Array.isArray(hasil?.partai) ? hasil.partai : []);
      })
      .catch(() => {
        if (aktif) setDaftar([]);
      })
      .finally(() => {
        if (aktif) setMemuat(false);
      });
    return () => {
      aktif = false;
    };
  }, []);

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
  ];

  function bukaFile(partai) {
    if (!partai?.pgn) return;
    onAnalisa({ format: "pgn", string: partai.pgn });
  }

  return (
    <PanelLayar lebarMaks="max-w-[1400px]">
      <h1 className="sr-only">{t("analisa.papan.judul")}</h1>
      <div className="flex flex-col gap-6 pt-2.5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {kartu.map((k) => (
            <Kartu key={k.kunci} t={t} {...k} />
          ))}
        </div>

        <FileTerbaru
          daftar={daftar}
          memuat={memuat}
          bahasa={bahasa}
          onBuka={bukaFile}
          onDatabase={onDatabase}
          t={t}
        />
      </div>
    </PanelLayar>
  );
}
