/**
 * Panel tablebase endgame (adopsi En Croissant TablebaseInfo): muncul otomatis
 * saat bidak ≤7 dan preferensi tablebase aktif. Badge hasil posisi + kisi
 * langkah terurut terbaik dulu; klik langkah memainkannya di papan.
 *
 * Data dari modul murni ../../../../../modul/analisis/tablebase.js (fetch
 * Lichess, cache per-FEN). Abort saat posisi berganti; kegagalan tampil sebagai
 * pesan, bukan panel kosong diam-diam.
 */
import { useContext, useEffect, useState } from "react";
import { useI18n } from "../../../../../lib/i18n.jsx";
import { ConfigContext } from "../../../../../modul/sesi/preferensi.js";
import { ambilTablebase, jumlahBidak, hasilPihak, KATEGORI_50_LANGKAH } from "../../../../../modul/analisis/tablebase.js";

const BAWAAN_TABLEBASE = [false, () => {}];

function labelHasil(pihak, t) {
  if (pihak === "putih") return t("analisa.tablebase.putihMenang");
  if (pihak === "hitam") return t("analisa.tablebase.hitamMenang");
  if (pihak === "seri") return t("analisa.tablebase.seri");
  return t("analisa.tablebase.tidakDiketahui");
}

function warnaHasil(pihak) {
  if (pihak === "putih") return { backgroundColor: "var(--evaluationBarWhite)", color: "var(--foregroundBlack)" };
  if (pihak === "hitam") return { backgroundColor: "var(--evaluationBarBlack)", color: "var(--foreground)" };
  return { backgroundColor: "#8a8a8a", color: "#ffffff" };
}

function labelLangkah(m, t) {
  if (m.category === "draw" || m.category === "blessed-loss" || m.category === "cursed-win") return t("analisa.tablebase.seri");
  if (m.category === "unknown" || m.category === "maybe-win" || m.category === "maybe-loss") return t("analisa.tablebase.tidakDiketahui");
  if (m.dtm != null) return t("analisa.tablebase.dtm", { n: Math.abs(m.dtm) });
  if (m.dtz != null) return t("analisa.tablebase.dtz", { n: Math.abs(m.dtz) });
  return "";
}

export default function Tablebase({ fen, turn, onMain }) {
  const { t } = useI18n();
  const config = useContext(ConfigContext);
  const [aktif] = config.tablebase ?? BAWAAN_TABLEBASE;
  const [buka, setBuka] = useState(false);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("diam");
  const [galat, setGalat] = useState("");

  const layak = Boolean(aktif && fen && jumlahBidak(fen) <= 7);
  useEffect(() => {
    if (!layak) { setData(null); setStatus("diam"); setGalat(""); return undefined; }
    const controller = new AbortController();
    setStatus("memuat");
    setGalat("");
    ambilTablebase(fen, { signal: controller.signal })
      .then((hasil) => { if (!controller.signal.aborted) { setData(hasil); setStatus("siap"); } })
      .catch((e) => { if (!controller.signal.aborted) { setGalat(String(e?.message ?? e)); setStatus("gagal"); } });
    return () => controller.abort();
  }, [fen, layak]);

  if (!layak) return null;
  const pihakJalan = turn === "w" || turn === "white" ? "white" : "black";
  const pihak = data ? hasilPihak(data.category, pihakJalan) : null;

  return (
    <div className="w-full rounded-borderRoundness border border-border bg-backgroundBox text-foreground">
      <button
        type="button"
        onClick={() => setBuka((b) => !b)}
        aria-expanded={buka}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-backgroundBoxBoxHighlighted"
      >
        <span className="text-[13px] font-bold">{t("analisa.tablebase.judul")}</span>
        <span className="flex items-center gap-2">
          {status === "memuat" ? <span className="text-[11px] text-foregroundGrey">{t("analisa.tablebase.memuat")}</span> : null}
          {status === "gagal" ? <span className="text-[11px] text-foregroundDestructive">{t("analisa.tablebase.gagal")}</span> : null}
          {pihak ? <span className="rounded-[3px] px-2 py-0.5 text-[11px] font-bold" style={warnaHasil(pihak)}>{labelHasil(pihak, t)}</span> : null}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 shrink-0 text-foregroundGrey transition-transform ${buka ? "rotate-180" : ""}`} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </span>
      </button>
      {buka ? (
        <div className="border-t border-border px-3 py-2">
          {status === "gagal" ? <p className="text-[11px] text-foregroundGrey">{galat}</p> : null}
          {pihak && KATEGORI_50_LANGKAH.includes(data.category) ? <p className="mb-2 text-[11px] text-foregroundGrey">{t("analisa.tablebase.aturan50")}</p> : null}
          {data && data.moves.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {data.moves.map((m) => (
                <button
                  key={m.uci}
                  type="button"
                  onClick={() => onMain?.(m.uci)}
                  aria-label={t("analisa.tablebase.langkahAria", { san: m.san })}
                  className="flex items-center justify-between gap-1 rounded-[3px] border border-border bg-backgroundBoxBox px-2 py-1 text-left transition-colors hover:bg-backgroundBoxBoxHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-backgroundBoxBoxHighlighted"
                >
                  <span className="truncate text-[12px] font-semibold">{m.san}</span>
                  <span className="shrink-0 text-[10px] text-foregroundGrey">{labelLangkah(m, t)}</span>
                </button>
              ))}
            </div>
          ) : null}
          {data && data.moves.length === 0 && status === "siap" ? <p className="text-[11px] text-foregroundGrey">{t("analisa.tablebase.tanpaLangkah")}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
