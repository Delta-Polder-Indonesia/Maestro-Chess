import { tekanPanahOpsi, useDropdown } from "../../../../../modul/sesi/panel.js";
import Check from "../../svg/check.jsx";
import { IkonSort } from "./ikonDatabase.jsx";
import { statusHasil, TINGGI_BARIS, formatTanggal } from "./formatDatabase.js";
import SquareFillPlus from "../../svg/square-fill-plus.jsx";
import SquareFillMinus from "../../svg/square-fill-minus.jsx";
import SquareFillEqual from "../../svg/square-fill-equal.jsx";
import Trash from "../../svg/trash.jsx";
import { TooltipLabel } from "../../../../../components/ui/tooltip.jsx";
import { flexRender } from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown } from "lucide-react";
/*
 * Potongan tabel Partai untuk layar Basis Data: header yang bisa diurutkan,
 * satu baris partai, skeleton pemuatan, menu pilihan kolom, dan dropdown
 * generik yang juga dipakai dialog.
 *
 * Dipisah dari `layarDatabase.jsx` (Fase 3). Semua data masuk lewat props;
 * cache sesi tetap milik `layarDatabase.jsx`.
 */

/* ── Dropdown Custom ─────────────────────────────────────────────── */

/*
 * Dropdown pilihan untuk toolbar. Pengganti <select> native: dropdown
 * bawaan peramban digambar oleh OS dan warna sorotannya (biru) tidak bisa
 * diganti CSS — makanya "gantung" sendiri. Panel ini milik kita sendiri:
 * latar hitam-abu (#2a2a2a) dan sorotan/item terpilih warna HITAM.
 */
export function DropdownPilih({ ariaLabel, nilai, opsi, onPilih, sejajar = "kiri", keAtas = false, labelKhusus, kontenAtas }) {
  const { terbuka, wadahRef, pemicuRef, idDaftar, tekanPemicu, toggle, keluarFokus, tutupDanFokus } = useDropdown();

  const aktif = opsi.find((o) => o.nilai === nilai) ?? opsi[0];
  const labelTampil = labelKhusus !== undefined ? labelKhusus : (aktif?.label ?? "");

  return (
    <div ref={wadahRef} onBlur={keluarFokus} className="relative">
      <button
        type="button"
        ref={pemicuRef}
        aria-label={`${ariaLabel}: ${labelTampil}`}
        aria-haspopup="listbox"
        aria-controls={terbuka ? idDaftar : undefined}
        aria-expanded={terbuka}
        onKeyDown={tekanPemicu}
        onClick={toggle}
        className="flex cursor-pointer items-center justify-between gap-2 rounded-borderRoundness border border-border bg-backgroundBoxBox px-3 py-1.5 text-xs text-foreground outline-none transition-colors hover:border-borderHighlighted"
      >
        <span className="max-w-[220px] truncate">{labelTampil}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-foregroundGrey transition-transform ${terbuka ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {terbuka ? (
        <div
          className={`absolute z-[1200] w-max min-w-full max-w-[320px] rounded-borderRoundness border border-border bg-[#2a2a2a] shadow-2xl ${
            keAtas ? "bottom-full mb-1" : "top-full mt-1"
          } ${
            sejajar === "kanan" ? "right-0" : "left-0"
          }`}
        >
          {kontenAtas ? <div className="border-b border-border p-2">{kontenAtas}</div> : null}
          <ul id={idDaftar} role="listbox" aria-label={ariaLabel} onKeyDown={tekanPanahOpsi} className="py-1">
          {opsi.map((o) => {
            const dipilih = o.nilai === nilai;
            return (
              <li key={o.nilai || "_default"} role="presentation">
                <button
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={dipilih}
                  onClick={() => {
                    onPilih(o.nilai);
                    tutupDanFokus();
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 whitespace-nowrap px-3 py-1.5 text-left text-xs transition-colors hover:bg-black hover:text-white ${
                    dipilih ? "bg-black font-semibold text-white" : "text-foreground"
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {dipilih ? <Check className="h-3 w-3 shrink-0 text-foregroundHighlighted" /> : null}
                </button>
              </li>
            );
          })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ── Komponen Baris Skeleton ───────────────────────────────────────── */

export function BarisSkeleton() {
  return (
    <tr className="h-[56px] border-b border-border/50">
      {/* Pemain — struktur sama persis dengan BarisPartai */}
      <td className="py-2 pl-4 pr-2 overflow-hidden">
        <div className="grid h-5 grid-cols-2 items-center gap-x-2 text-[13px] leading-5">
          <span className="h-2.5 w-20 rounded-sm bg-foregroundGrey/15" />
          <span className="h-2.5 w-24 rounded-sm bg-foregroundGrey/15" />
        </div>
      </td>

      {/* Hasil */}
      <td className="py-2 px-2 whitespace-nowrap">
        <div className="flex h-5 items-center justify-center gap-1.5">
          <span className="h-2.5 w-9 rounded-sm bg-foregroundGrey/15" />
          <span className="h-3.5 w-3.5 rounded-sm bg-foregroundGrey/10" />
        </div>
      </td>

      {/* Event */}
      <td className="py-2 px-2 whitespace-nowrap">
        <span className="block h-2.5 w-28 rounded-sm bg-foregroundGrey/15" />
      </td>

      {/* Tanggal */}
      <td className="py-2 px-2 whitespace-nowrap">
        <div className="space-y-1.5">
          <span className="block h-2.5 w-16 rounded-sm bg-foregroundGrey/15" />
          <span className="block h-2 w-10 rounded-sm bg-foregroundGrey/10" />
        </div>
      </td>

      {/* Langkah */}
      <td className="py-2 px-2 text-right whitespace-nowrap">
        <span className="ml-auto block h-2.5 w-5 rounded-sm bg-foregroundGrey/15" />
      </td>

      {/* Situs */}
      <td className="py-2 px-2 text-right whitespace-nowrap">
        <span className="ml-auto block h-2.5 w-12 rounded-sm bg-foregroundGrey/10" />
      </td>

    </tr>
  );
}

/* ── Komponen Header Tabel ─────────────────────────────────────────── */

export function HeaderTabel({ urut, ubahUrut, t }) {
  const kolom = [
    {
      kunci: "pemain",
      label: t("analisa.basisData.pemain"),
      align: "text-left",
      padding: "py-2 pl-4 pr-2",
      subKolom: [
        { label: t("analisa.basisData.putih"), kiri: true },
        { label: t("analisa.basisData.hitam"), kiri: false },
      ],
    },
    {
      kunci: "hasil",
      label: t("analisa.basisData.hasilTabel"),
      align: "text-center",
      padding: "py-2 px-2",
    },
    {
      kunci: "eventSitus",
      label: "Event",
      align: "text-left",
      padding: "py-2 px-2 hidden sm:table-cell",
      tanpaSort: true,
      kelasTh: "hidden sm:table-cell",
    },
    {
      kunci: "tanggal",
      label: t("analisa.basisData.tanggal"),
      align: "text-left",
      padding: "py-2 px-2",
    },
    {
      kunci: "langkah",
      label: t("analisa.basisData.langkah"),
      align: "text-center",
      padding: "py-2 px-2",
    },
    {
      kunci: "situs",
      label: t("analisa.basisData.situs"),
      align: "text-right",
      padding: "py-2 px-2 hidden lg:table-cell",
      tanpaSort: true,
      kelasTh: "hidden lg:table-cell",
    },
  ];

  return (
    <thead className="sticky top-0 bg-backgroundBoxDarker border-b border-border z-10 select-none">
      <tr>
        {kolom.map((k) => (
          <th
            key={k.kunci}
            className={`${k.padding} ${k.align} bg-backgroundBoxDarker text-xs font-semibold uppercase tracking-wide text-foregroundGrey ${k.kelasTh || ""}`}
          >
            {k.subKolom ? (
              <div className="grid grid-cols-2 gap-x-2">
                {k.subKolom.map((sub) => (
                  <button
                    key={sub.label}
                    type="button"
                    onClick={() => ubahUrut(k.kunci)}
                    className={`inline-flex items-center cursor-pointer transition-colors hover:text-foregroundHighlighted justify-start`}
                  >
                    {sub.label}
                    {!sub.kiri && (
                      <IkonSort aktif={urut.kolom === k.kunci} arah={urut.arah} />
                    )}
                  </button>
                ))}
              </div>
            ) : k.tanpaSort ? (
              k.label
            ) : (
              <button
                type="button"
                onClick={() => ubahUrut(k.kunci)}
                className="inline-flex items-center hover:text-foregroundHighlighted transition-colors cursor-pointer"
              >
                {k.label}
                <IkonSort aktif={urut.kolom === k.kunci} arah={urut.arah} />
              </button>
            )}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/* ── Komponen Baris Data Partai ─────────────────────────────────────── */


export function BarisPartai({ game, locale, tanganiAnalisa, bukaDialogHapusPartai, perspectiveUser, t }) {
  const whiteWon = game.result === "white";
  const blackWon = game.result === "black";
  const status = statusHasil(game, perspectiveUser);
  const putih = game.whiteName || t("analisa.basisData.putih");
  const hitam = game.blackName || t("analisa.basisData.hitam");

  return (
    <tr
      tabIndex={0}
      aria-label={`${t("analisa.basisData.analisaSekarang")}: ${putih} – ${hitam}`}
      onClick={() => tanganiAnalisa(game)}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          tanganiAnalisa(game);
        }
      }}
      className={`cursor-pointer select-none border-b border-border/50 transition-colors hover:bg-backgroundBoxHover group ${TINGGI_BARIS}`}
    >
      {/* Pemain — putih di kiri, hitam di kanan, nama di atas ELO di bawah */}
      <td className="py-2 pl-4 pr-2 overflow-hidden">
        <div className="flex items-center gap-1">
          <div className="grid min-w-0 flex-1 grid-cols-2 items-center gap-x-2 text-[13px] leading-5">
            <div className="min-w-0">
              <div className="truncate font-medium">{putih}</div>
              <div className="truncate text-[10px] tabular-nums text-foregroundGrey">
                {game.whiteElo || ""}
              </div>
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium">{hitam}</div>
              <div className="truncate text-[10px] tabular-nums text-foregroundGrey">
                {game.blackElo || ""}
              </div>
            </div>
          </div>
          <TooltipLabel label={t("analisa.basisData.hapusPartai")}>
            <button
              type="button"
              aria-label={`${t("analisa.basisData.hapusPartai")}: ${putih} – ${hitam}`}
              onClick={(e) => bukaDialogHapusPartai(e, game)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-borderRoundness text-foregroundGrey hover:bg-backgroundBoxBoxHover hover:text-lossRed focus-visible:outline focus-visible:outline-2 focus-visible:outline-lossRed"
            >
              <Trash className="h-4 w-4" />
            </button>
          </TooltipLabel>
        </div>
      </td>

      {/* Hasil */}
      <td className="py-2 px-2 text-center whitespace-nowrap">
        <div className="flex flex-row items-center justify-center gap-1.5">
          <span className="font-semibold text-xs font-mono text-foregroundGrey">
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
      </td>

      {/* Event - hidden on mobile */}
      <td className="px-2 py-2 whitespace-nowrap text-xs text-foregroundGrey hidden sm:table-cell">
        <div className="truncate">{game.event || "—"}</div>
      </td>

      {/* Tanggal */}
      <td className="py-2 px-2 whitespace-nowrap text-xs text-foregroundGrey">
        <div>{formatTanggal(game.timestamp, locale, game.tanggalPgn) || "—"}</div>
        <div className="text-[10px] text-foregroundGrey font-mono uppercase tracking-wider">
          {game.timeClass || ""}
        </div>
      </td>

      {/* Langkah */}
      <td className="py-2 px-2 text-center whitespace-nowrap text-xs font-semibold tabular-nums text-foreground">
        {game.plyCount ?? "-"}
      </td>

      {/* Situs - hidden on mobile/tablet */}
      <td className="py-2 px-2 text-right whitespace-nowrap text-[10px] uppercase tracking-wider text-foregroundGrey hidden lg:table-cell">
        <div className="truncate">{game.site || game.url || ""}</div>
      </td>

    </tr>
  );
}

export function HeaderKolom({ kolom, t: _t }) {
  const label = flexRender(kolom.column.columnDef.header, kolom.getContext());
  if (!kolom.column.getCanSort()) return label;
  return (
    <button
      type="button"
      onClick={kolom.column.getToggleSortingHandler()}
      className="inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-foregroundHighlighted"
    >
      {label}
      <ArrowUpDown
        className={`h-3 w-3 ${
          kolom.column.getIsSorted() ? "text-foregroundHighlighted" : "text-foregroundGrey"
        }`}
        aria-hidden="true"
      />
    </button>
  );
}

export function MenuKolom({ t, nilai, onPilih }) {
  const { terbuka, wadahRef, pemicuRef, idDaftar, tekanPemicu, toggle, keluarFokus, tutupDanFokus } = useDropdown();

  const opsi = [
    { nilai: "mingguan", label: t("analisa.basisData.periodeMingguan") },
    { nilai: "bulanan", label: t("analisa.basisData.periodeBulanan") },
    { nilai: "tahunan", label: t("analisa.basisData.periodeTahunan") },
    { nilai: "semua", label: t("analisa.basisData.periodeSemua") },
  ];

  return (
    <div ref={wadahRef} onBlur={keluarFokus} className="relative">
      <button
        type="button"
        ref={pemicuRef}
        aria-label={`${t("analisa.basisData.kolom")}: ${opsi.find((o) => o.nilai === nilai)?.label ?? ""}`}
        aria-haspopup="listbox"
        aria-controls={terbuka ? idDaftar : undefined}
        aria-expanded={terbuka}
        onKeyDown={tekanPemicu}
        onClick={toggle}
        className="flex cursor-pointer items-center gap-1.5 rounded-borderRoundness border border-border bg-backgroundBoxBox px-3 py-1.5 text-xs text-foreground outline-none transition-colors hover:border-borderHighlighted"
      >
        {t("analisa.basisData.kolom")}
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-foregroundGrey transition-transform ${terbuka ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {terbuka ? (
        <ul
          id={idDaftar}
          role="listbox"
          aria-label={t("analisa.basisData.kolom")}
          onKeyDown={tekanPanahOpsi}
          className="absolute right-0 top-full z-[1200] mt-1 w-max min-w-[140px] overflow-hidden rounded-borderRoundness border border-border bg-[#2a2a2a] py-1 shadow-2xl"
        >
          {opsi.map((o) => {
            const dipilih = o.nilai === nilai;
            return (
              <li key={o.nilai} role="presentation">
                <button
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={dipilih}
                  onClick={() => {
                    onPilih(o.nilai);
                    tutupDanFokus();
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 whitespace-nowrap px-3 py-1.5 text-left text-xs transition-colors hover:bg-black hover:text-white ${
                    dipilih ? "bg-black font-semibold text-white" : "text-foreground"
                  }`}
                >
                  <span>{o.label}</span>
                  {dipilih ? (
                    <Check className="h-3 w-3 shrink-0 text-foregroundHighlighted" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
