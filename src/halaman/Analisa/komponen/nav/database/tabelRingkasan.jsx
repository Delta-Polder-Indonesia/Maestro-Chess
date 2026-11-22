import { useState, useEffect, useMemo } from "react";
import { ambilDaftarPartai } from "../../../basisData.js";
import { statusHasil, formatTanggal, BIRU } from "./formatDatabase.js";
import SquareFillPlus from "../../svg/square-fill-plus.jsx";
import SquareFillMinus from "../../svg/square-fill-minus.jsx";
import SquareFillEqual from "../../svg/square-fill-equal.jsx";
import { useLegacyTable, getCoreRowModel } from "@tanstack/react-table/legacy";
import { IkonSearch } from "./ikonDatabase.jsx";
import { MenuKolom, HeaderKolom } from "./tabelPartai.jsx";
import DualRingSpinner from "../../loading/DualRingSpinner.jsx";
import Database from "../../svg/database.jsx";
import { flexRender } from "@tanstack/react-table";
/*
 * Tabel Ringkasan (mode "data") layar Basis Data: daftar partai terbaru
 * koleksi, filter pencarian/periode, dan paginasi internal.
 *
 * Dipisah dari `layarDatabase.jsx` (Fase 3); datanya dibaca lewat
 * `basisData.js` berdasarkan props (`koleksiId`, `revisi`), bukan state modul.
 */

/* ── Tabel Ringkasan (mode "data") ──────────────────────────────────── */

/* Pencarian, pengurutan dan pagination berlaku pada SELURUH koleksi di
 * basis data. Hanya metadata halaman yang terlihat dikirim ke tabel; teks PGN
 * dapat dicari oleh kueri tanpa dibawa seluruhnya ke React. */
const PERIODE_MUNDUR = [
  { nilai: "mingguan", hari: 7 },
  { nilai: "bulanan", hari: 31 },
  { nilai: "tahunan", hari: 366 },
  { nilai: "semua", hari: 0 },
];

export function TabelRingkasan({ koleksiId, t, locale, revisi, username, totalKoleksi, tanganiAnalisa }) {
  /* null = masih memuat; [] = sudah dimuat tapi kosong */
  const [daftar, setDaftar] = useState(null);
  const [galat, setGalat] = useState(false);
  const [totalCocok, setTotalCocok] = useState(0);
  const [periode, setPeriode] = useState("semua");
  const [cari, setCari] = useState("");
  const [cariTunda, setCariTunda] = useState("");
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  useEffect(() => {
    const timer = setTimeout(() => setCariTunda(cari.trim()), 200);
    return () => clearTimeout(timer);
  }, [cari]);

  useEffect(() => {
    setPagination((p) => p.pageIndex ? { ...p, pageIndex: 0 } : p);
  }, [koleksiId, revisi]);

  useEffect(() => {
    let hidup = true;
    const p = PERIODE_MUNDUR.find((x) => x.nilai === periode);
    const sejak = p?.hari ? Date.now() - p.hari * 86400000 : 0;
    const kolomUrut = { whiteName: "putih", blackName: "hitam", timestamp: "tanggal", plyCount: "langkah" };
    const urut = kolomUrut[sorting[0]?.id] || "tanggal";
    const arah = sorting.length ? (sorting[0].desc ? "desc" : "asc") : "desc";
    // String kosong berarti semua koleksi, bukan koleksi kosong.
    setDaftar(null);
    setGalat(false);
    (async () => {
      try {
        const hasil = await ambilDaftarPartai({
          koleksiId, cari: cariTunda, sejak, urut, arah,
          limit: pagination.pageSize,
          offset: pagination.pageIndex * pagination.pageSize,
          sertakanPgn: false,
        });
        if (hasil?.galat) throw new Error("basis data tidak dapat dibaca");
        if (!hidup) return;
        const total = hasil?.total ?? 0;
        const halamanTerakhir = Math.max(0, Math.ceil(total / pagination.pageSize) - 1);
        if (pagination.pageIndex > halamanTerakhir) {
          setPagination((lama) => ({ ...lama, pageIndex: halamanTerakhir }));
          return;
        }
        setTotalCocok(total);
        setDaftar(hasil?.partai || []);
      } catch {
        if (hidup) { setGalat(true); setDaftar([]); }
      }
    })();
    return () => { hidup = false; };
  }, [koleksiId, revisi, periode, cariTunda, sorting, pagination]);

  const dataTampil = daftar || [];

  const kolom = useMemo(
    () => [
      {
        id: "nomor",
        header: "#",
        enableSorting: false,
        cell: (info) => pagination.pageIndex * pagination.pageSize + info.row.index + 1,
      },
      {
        accessorKey: "whiteName",
        header: t("analisa.basisData.putih"),
        cell: (info) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{info.row.original.whiteName || "—"}</div>
            <div className="truncate text-[10px] tabular-nums text-foregroundGrey">
              {info.row.original.whiteElo || ""}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "blackName",
        header: t("analisa.basisData.hitam"),
        cell: (info) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{info.row.original.blackName || "—"}</div>
            <div className="truncate text-[10px] tabular-nums text-foregroundGrey">
              {info.row.original.blackElo || ""}
            </div>
          </div>
        ),
      },
      {
        id: "hasil",
        header: t("analisa.basisData.hasilTabel"),
        enableSorting: false,
        cell: (info) => {
          const g = info.row.original;
          const whiteWon = g.result === "white";
          const blackWon = g.result === "black";
          const status = statusHasil(g, username);
          return (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-semibold text-foregroundGrey">
                {whiteWon ? "1 - 0" : blackWon ? "0 - 1" : status === "draw" ? "½ - ½" : "*"}
              </span>
              {status === "win" ? (
                <SquareFillPlus className="h-3.5 w-3.5 shrink-0 text-winGreen" />
              ) : status === "loss" ? (
                <SquareFillMinus className="h-3.5 w-3.5 shrink-0 text-lossRed" />
              ) : status === "draw" ? (
                <SquareFillEqual className="h-3.5 w-3.5 shrink-0 text-foregroundGrey" />
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "event",
        header: t("analisa.basisData.event"),
        enableSorting: false,
        cell: (info) => (
          <div className="truncate whitespace-nowrap text-xs text-foregroundGrey">
            {info.row.original.event || "—"}
          </div>
        ),
      },
      {
        accessorKey: "timestamp",
        header: t("analisa.basisData.tanggal"),
        cell: (info) => (
          <div className="whitespace-nowrap">
            <div className="text-xs text-foregroundGrey">
              {formatTanggal(info.row.original.timestamp, locale, info.row.original.tanggalPgn) || "—"}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-foregroundGrey">
              {info.row.original.timeClass || ""}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "plyCount",
        header: t("analisa.basisData.langkah"),
        cell: (info) => (
          <div className="text-center text-xs font-semibold tabular-nums text-foreground">
            {info.row.original.plyCount ?? "-"}
          </div>
        ),
      },
      {
        accessorKey: "site",
        header: t("analisa.basisData.situs"),
        enableSorting: false,
        cell: (info) => (
          <div className="truncate whitespace-nowrap text-[10px] uppercase tracking-wider text-foregroundGrey">
            {info.row.original.site || info.row.original.url || ""}
          </div>
        ),
      },
    ],
    [t, locale, username, pagination.pageIndex, pagination.pageSize],
  );

  const tabel = useLegacyTable({
    data: dataTampil,
    columns: kolom,
    state: { sorting, pagination },
    onSortingChange: (perubahan) => {
      setSorting(perubahan);
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
    manualSorting: true,
    manualPagination: true,
    enableMultiSort: false,
    rowCount: totalCocok,
    getCoreRowModel: getCoreRowModel(),
  });

  const aktifHal = tabel.getState().pagination.pageIndex + 1;
  const totalHal = tabel.getPageCount();

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-3">
      {/* Toolbar: pencarian + filter periode pada tombol Kolom - responsive */}
      <div className="flex shrink-0 flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-2">
        <div className="relative w-full sm:w-56">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-foregroundGrey">
            <IkonSearch className="h-4 w-4" />
          </div>
          <input
            type="search"
            value={cari}
            onChange={(e) => {
              setCari(e.target.value);
              setPagination((p) => p.pageIndex ? { ...p, pageIndex: 0 } : p);
            }}
            placeholder={t("analisa.basisData.cariPlaceholder")}
            aria-label={t("analisa.basisData.cariPlaceholder")}
            className="w-full rounded-borderRoundness border border-border bg-backgroundBoxBox pl-9 pr-3 py-1.5 text-sm text-foreground outline-none transition-colors placeholder:text-foregroundGrey hover:border-borderHighlighted focus:border-borderHighlighted"
          />
        </div>
        <MenuKolom t={t} nilai={periode} onPilih={(nilai) => {
          setPeriode(nilai);
          setPagination((p) => p.pageIndex ? { ...p, pageIndex: 0 } : p);
        }} />
      </div>

      {daftar === null ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
          <DualRingSpinner color={BIRU} />
          <p className="text-sm text-foregroundGrey">{t("analisa.basisData.memuatData")}</p>
        </div>
      ) : galat ? (
        <p role="alert" className="py-6 text-center text-sm text-lossRed">{t("analisa.statistik.galatBasis")}</p>
      ) : dataTampil.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center">
          <Database width={32} height={32} className="fill-foregroundGrey/30" />
          <p className="font-bold text-foreground">
            {cariTunda || periode !== "semua"
              ? t("analisa.partai.tidakCocok")
              : t("analisa.basisData.kosongJudul")}
          </p>
        </div>
      ) : (
        <>
          <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-auto border border-border rounded-borderRoundness bg-backgroundBox [scrollbar-gutter:stable] -mx-3 sm:mx-0 w-[calc(100%+1.5rem)] sm:w-full">
            <table className="w-full min-w-[640px] sm:min-w-0 table-fixed border-collapse text-sm">
              <colgroup>
                <col style={{ width: "5%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "13%" }} />
              </colgroup>
              <thead className="sticky top-0 z-10 select-none border-b border-border bg-backgroundBox">
                <tr>
                  {tabel.getHeaderGroups()[0].headers.map((h) => (
                    <th
                      key={h.id}
                      className={`px-2 py-2 text-xs font-semibold uppercase tracking-wide text-foregroundGrey ${
                        h.id === "site" ? "text-right" : "text-left"
                      }`}
                    >
                      <HeaderKolom kolom={h} t={t} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabel.getRowModel().rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => tanganiAnalisa(r.original)}
                    className="cursor-pointer select-none border-b border-border/50 transition-colors hover:bg-backgroundBoxHover focus-within:bg-backgroundBoxHover"
                  >
                    {r.getVisibleCells().map((c) => (
                      <td
                        key={c.id}
                        className={`px-2 py-2 align-middle ${
                          c.column.id === "nomor"
                            ? "whitespace-nowrap text-xs tabular-nums text-foregroundGrey"
                            : c.column.id === "langkah" || c.column.id === "site"
                              ? "text-right"
                              : ""
                        }`}
                      >
                        {c.column.id === "nomor" ? (
                          <button
                            type="button"
                            aria-label={`${pagination.pageIndex * pagination.pageSize + r.index + 1}: ${t("analisa.basisData.analisaSekarang")}: ${r.original.whiteName || t("analisa.basisData.putih")} – ${r.original.blackName || t("analisa.basisData.hitam")}`}
                            onClick={(e) => { e.stopPropagation(); tanganiAnalisa(r.original); }}
                            className="-mx-1 rounded px-1 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-backgroundBoxBoxHighlighted"
                          >
                            {flexRender(c.column.columnDef.cell, c.getContext())}
                          </button>
                        ) : flexRender(c.column.columnDef.cell, c.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginasi ringkas */}
          <div className="flex shrink-0 items-center justify-between gap-2 text-xs">
            <span className="text-foregroundGrey">
              {t("analisa.basisData.baris", {
                jumlah: totalCocok,
                total: Math.max(totalCocok, Number(totalKoleksi) || 0),
              })}
            </span>
            <div className="flex items-center gap-2">
              {totalHal > 1 ? (
                <span className="text-foregroundGrey">
                  {t("analisa.basisData.halaman", { aktif: aktifHal, total: totalHal })}
                </span>
              ) : null}
              <button
                type="button"
                disabled={!tabel.getCanPreviousPage()}
                onClick={() => tabel.previousPage()}
                className="rounded-borderRoundness border border-border bg-backgroundBoxBox px-3 py-1 text-xs text-foreground transition-colors hover:bg-backgroundBoxBoxHover disabled:opacity-40 disabled:hover:bg-backgroundBoxBox cursor-pointer disabled:cursor-not-allowed"
              >
                {t("analisa.basisData.sebelumnya")}
              </button>
              <button
                type="button"
                disabled={!tabel.getCanNextPage()}
                onClick={() => tabel.nextPage()}
                className="rounded-borderRoundness border border-border bg-backgroundBoxBox px-3 py-1 text-xs text-foreground transition-colors hover:bg-backgroundBoxBoxHover disabled:opacity-40 disabled:hover:bg-backgroundBoxBox cursor-pointer disabled:cursor-not-allowed"
              >
                {t("analisa.basisData.berikutnya")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
