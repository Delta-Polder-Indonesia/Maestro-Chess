/**
 * Layar "Engine" — pengelola engine analisis.
 *
 * Tata letak mengikuti halaman Engines En Croissant / prompt.md: dua panel,
 * kiri daftar kartu yang bisa dicari, kanan pengaturan engine terpilih. Panel
 * kanan memakai komponen `PengaturanMesin` yang dipindah dari layar
 * Pengaturan — bukan salinan — supaya pilihan engine, status worker, dan
 * kedalaman tetap memakai satu sumber yang sama dengan papan.
 */
import { useContext, useId, useMemo, useRef, useState } from "react";
import { useI18n } from "../../../../lib/i18n.jsx";
import { DAFTAR_ENGINE } from "../../../../lib/engineCatur.js";
import { gambar } from "../../../../lib/asets.js";
import { AnalyzeContext } from "../../konteks/analyzeKonteks.js";
import { useMesin } from "../../konteks/mesinKonteks.js";
import PanelLayar from "./PanelLayar.jsx";
import PengaturanMesin from "../pengaturan/mesin.jsx";
import Gambar from "../Gambar.jsx";

function Statistik({ label, nilai }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-foregroundGrey">{label}</span>
      <span className="text-sm font-bold text-white">{nilai || "?"}</span>
    </div>
  );
}

function KartuEngine({ entri, terpilih, onPilih, labelVersi, labelElo, dataUji }) {
  const versi = /\d+(?:\.\d+)*/.exec(entri.label)?.[0] ?? "-";
  const berkas = entri.url.split("/").pop() ?? "-";
  return (
    <button
      type="button"
      data-uji={dataUji}
      aria-pressed={terpilih}
      onClick={onPilih}
      className={`flex w-full flex-col gap-3.5 rounded-[6px] border-2 bg-[#2A2A2A] p-3.5 text-left transition-colors ${
        terpilih
          ? "border-[#8BC550] shadow-[0_0_0_1px_rgba(139,197,80,0.18)]"
          : "border-transparent hover:border-border"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Gambar
          src={gambar("/images/stockfish.webp")}
          alt="Stockfish"
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-[0.25rem] border border-border object-cover"
        />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-white">{entri.label}</span>
          <span className="block truncate text-[11px] text-foregroundGrey">{berkas}</span>
        </div>
      </div>
      <div className="flex justify-between pr-3.5">
        <Statistik label={labelElo} nilai={entri.elo} />
        <Statistik label={labelVersi} nilai={versi} />
      </div>
    </button>
  );
}

function TidakAdaEngine({ teks, petunjuk = null }) {
  return (
    <div className="grid h-full place-items-center p-4 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-backgroundBoxBox text-foregroundGrey">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <rect x="9" y="9" width="6" height="6" />
            <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
          </svg>
        </span>
        <p className="font-bold text-foregroundGrey">{teks}</p>
        {petunjuk ? <p className="text-xs text-foregroundGrey">{petunjuk}</p> : null}
      </div>
    </div>
  );
}

export default function LayarEngine() {
  const { t } = useI18n();
  const { idEngine, gantiEngine, setop } = useMesin();
  const analyzeContext = useContext(AnalyzeContext);
  const [cari, setCari] = useState("");
  const cariRef = useRef(null);
  const idCari = useId();

  const daftarTampil = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    if (!kata) return DAFTAR_ENGINE;
    return DAFTAR_ENGINE.filter((entri) =>
      [entri.label, entri.url.split("/").pop() ?? ""].some((nilai) => nilai.toLowerCase().includes(kata)));
  }, [cari]);

  /**
   * Samakan dengan tindakan pemilih engine di panel pengaturan: batalkan
   * pencarian yang sedang berjalan sebelum worker diganti, supaya bestmove
   * dari engine lama tidak dilaporkan sebagai galat engine baru.
   */
  function pilihEngine(id) {
    if (id === idEngine) return;
    const [controller, setController] = analyzeContext.analyzeController;
    controller.abort();
    setController(new AbortController());
    setop();
    gantiEngine(id);
  }

  return (
    <PanelLayar
      judul={t("analisa.engine.judul")}
      kepalaRapat
      headerKanan={
        <button
          type="button"
          data-uji="engine-tampilkan"
          aria-label={t("analisa.engine.bukaFolder")}
          title={t("analisa.engine.bukaFolder")}
          onClick={() => { setCari(""); cariRef.current?.focus(); }}
          className="flex h-8 w-8 items-center justify-center rounded-[4px] text-foregroundGrey transition-colors hover:bg-backgroundBoxBoxHover hover:text-foreground"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:overflow-hidden">
        <div className="flex min-h-0 w-full flex-col lg:flex-1">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[6px] border-2 border-border bg-backgroundBox">
            <div className="flex shrink-0 items-center gap-2 p-2.5">
              <div className="flex h-[34px] min-w-0 flex-1 items-center gap-2 rounded-[4px] border border-border bg-backgroundBoxBox px-2.5 focus-within:border-[#228be6]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-foregroundGrey" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  id={idCari}
                  ref={cariRef}
                  data-uji="engine-cari"
                  type="search"
                  value={cari}
                  onChange={(event) => setCari(event.target.value)}
                  placeholder={t("analisa.engine.cari")}
                  aria-label={t("analisa.engine.cari")}
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-foregroundGrey"
                />
              </div>
              <button
                type="button"
                data-uji="engine-tambah"
                aria-label={t("analisa.engine.tambah")}
                title={t("analisa.engine.tambahTidakTersedia")}
                disabled
                className="flex h-[34px] w-[34px] shrink-0 cursor-not-allowed items-center justify-center rounded-[4px] border border-border bg-backgroundBoxBox text-foregroundGrey opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
            <div className="shrink-0 border-b border-border" />
            <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable] p-2.5">
              {daftarTampil.length ? (
                <div data-uji="engine-daftar" className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {daftarTampil.map((entri) => (
                    <KartuEngine
                      key={entri.id}
                      entri={entri}
                      terpilih={entri.id === idEngine}
                      onPilih={() => pilihEngine(entri.id)}
                      labelVersi={t("analisa.pengaturan.versiMesin")}
                      labelElo={t("analisa.pengaturan.elo")}
                      dataUji={`engine-kartu-${entri.id}`}
                    />
                  ))}
                </div>
              ) : (
                <TidakAdaEngine
                  teks={t("analisa.engine.tidakCocok")}
                  petunjuk={t("analisa.engine.kosongIsi")}
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 w-full flex-col lg:flex-1">
          <div data-uji="engine-panel" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[6px] border-2 border-border bg-backgroundBox">
            <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable] p-4 sm:p-5">
              <PengaturanMesin />
            </div>
          </div>
        </div>
      </div>
    </PanelLayar>
  );
}
