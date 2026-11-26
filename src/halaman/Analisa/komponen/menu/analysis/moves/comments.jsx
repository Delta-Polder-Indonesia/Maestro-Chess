/* Port dari Brilliant-Chess (MIT, © 2025 Delo) — jangan sunting massal tanpa cek README. */
import { useContext } from "react";
import RatingSVG from "../../../svg/rating.jsx";
import { useI18n } from "../../../../../../lib/i18n.jsx";
import { apakahMateTerminal } from "../../../../../../modul/analisis/evaluasi.js";
import { ConfigContext, tulis } from "../../../../../../modul/sesi/preferensi.js";

// Fallback konteks beridentitas stabil agar FormatEval tidak bocor saat memo.
const BAWAAN_EVAL = ["cp", () => {}];

/**
 * Kartu penjelasan satu langkah: label penilaian (brilian/blunder/…),
 * skor evaluasi posisi, dan kalimat komentar engine.
 *
 * Kalimat komentar TIDAK lagi dibekukan di objek hasil analisis; mesin hanya
 * menulis `commentKey` + `commentIndex` (lihat ../../../../mesin/penilaian.js)
 * dan teksnya diambil dari kamus di sini. Akibatnya bahasa bisa diganti kapan
 * saja tanpa menganalisis ulang partai. Untuk label "book", `comment` berisi
 * nama pembukaan dari tabel buku dan dipakai apa adanya.
 */

/** Format kalimat penghubung per label ("e4 adalah langkah brilian"). */
const FORMAT_LABEL = {
  book: "adalahLangkahA",
  forced: "adalah",
  brilliant: "adalah",
  great: "adalahLangkahA",
  best: "adalah",
  critical: "adalah",
  excellent: "adalah",
  good: "adalah",
  inaccuracy: "adalahLangkahAn",
  mistake: "adalahLangkahA",
  miss: "adalahLangkahA",
  blunder: "adalahLangkahA",
};

/**
 * Bentuk skor UCI mentah → teks siap tampil.
 * `evaluation = ["cp", "34"]` atau `["mate", "2"]`; skor engine selalu relatif
 * terhadap pihak yang bergilir, jadi dinormalisasi ke sudut pandang `white`.
 */
function FormatEval({ evaluation, white, smaller, best, wdl }) {
  const { t } = useI18n();
  const config = useContext(ConfigContext);
  const [evalDisplay, setEvalDisplay] = config.evalDisplay ?? BAWAAN_EVAL;
  const angka = Number(evaluation?.[1]) / 100 * (white ? 1 : -1);
  let karakter = "";
  if (angka > 0) karakter = "+";
  if (angka < 0) karakter = "-";

  let teks;
  // Mate terminal (["mate","0"] atau warisan ["mate"]) = partai sudah berakhir,
  // jadi tampil hasil 0-1/1-0 — bukan "M0" (dan bukan "M-1" saat `best`).
  if (evaluation?.[0] === "mate" && !apakahMateTerminal(evaluation)) {
    teks = `${karakter}M${Math.abs(Number(evaluation[1])) - Number(Boolean(best))}`;
  } else if (!evaluation?.[1] || apakahMateTerminal(evaluation)) {
    teks = white ? "0-1" : "1-0";
  } else {
    teks = `${karakter}${Math.abs(angka).toFixed(2)}`;
  }

  // Klik skor berganti centipawn ↔ WDL (semantik ScoreBubble En Croissant).
  function toggle() {
    const berikut = evalDisplay === "wdl" ? "cp" : "wdl";
    setEvalDisplay(berikut);
    tulis("evalDisplay", berikut);
  }
  function tekan(e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
  }
  const lebar = smaller ? "46px" : "61px";
  const judul = t("analisa.pengaturan.klikEval");

  // WDL hanya bila tersedia dan bukan skor mate. `wdl` mentah relatif terhadap
  // pihak yang bergilir; normalisasi ke sudut pandang putih seperti `angka`.
  const bolehWdl = evalDisplay === "wdl" && Array.isArray(wdl) && wdl.length === 3 && evaluation?.[0] !== "mate";
  if (bolehWdl) {
    const [m, s, k] = white ? wdl : [wdl[2], wdl[1], wdl[0]];
    const total = m + s + k || 1000;
    const pct = (x) => Math.round((x / total) * 100);
    const [pm, ps, pk] = [pct(m), pct(s), pct(k)];
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={tekan}
        aria-pressed={true}
        aria-label={`${t("analisa.pengaturan.formatSkor")}: ${pm}/${ps}/${pk}`}
        title={judul}
        style={{ width: lebar, fontSize: smaller ? "10px" : "11px", height: smaller ? "22px" : "28px" }}
        className="flex cursor-pointer select-none items-center overflow-hidden rounded-borderRoundness font-extrabold text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-backgroundBoxBoxHighlighted"
      >
        <span className="flex h-full items-center justify-center" style={{ width: `${pm}%`, backgroundColor: "var(--evaluationBarWhite)", color: "var(--foregroundBlack)" }}>{pm > 20 ? pm : ""}</span>
        <span className="flex h-full items-center justify-center" style={{ width: `${ps}%`, backgroundColor: "#8a8a8a", color: "#ffffff" }}>{ps > 20 ? ps : ""}</span>
        <span className="flex h-full items-center justify-center" style={{ width: `${pk}%`, backgroundColor: "var(--evaluationBarBlack)", color: "var(--foreground)" }}>{pk > 20 ? pk : ""}</span>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={toggle}
      onKeyDown={tekan}
      aria-pressed={false}
      aria-label={`${t("analisa.pengaturan.formatSkor")}: ${teks}`}
      title={judul}
      style={{
        fontSize: smaller ? "14px" : "",
        padding: smaller ? "2px" : "",
        width: smaller ? "46px" : "",
        backgroundColor: karakter === "-" ? "var(--evaluationBarBlack)" : "var(--evaluationBarWhite)",
        color: karakter === "-" ? "var(--foreground)" : "var(--foregroundBlack)",
        filter: karakter === "-" ? "" : "brightness(0.9)",
      }}
      className="cursor-pointer select-none rounded-borderRoundness py-1 font-extrabold w-[61px] text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-backgroundBoxBoxHighlighted"
    >
      {teks}
    </div>
  );
}

function Comments({ comment, commentKey, commentIndex, rating, moveSan, evaluation, white, wdl, overallGameComment }) {
  const { t } = useI18n();

  const komentar = commentKey
    ? t(`analisa.komentar.${commentKey}.${Number(commentIndex) || 0}`)
    : comment;

  if (!komentar || !rating || !moveSan) {
    return (
      <div
        className="bg-white w-[85%] rounded-borderExtraRoundness p-3.5 text-sm font-semibold text-foregroundBlack leading-6"
        dangerouslySetInnerHTML={{ __html: overallGameComment ?? "" }}
      />
    );
  }

  const label = t(`analisa.penilaian.${rating}`);
  const format = FORMAT_LABEL[rating] ?? "adalah";

  return (
    <div style={{ backgroundColor: "#ffffff" }} className="w-[85%] min-h-24 p-3.5 rounded-borderExtraRoundness text-foregroundBlack text-sm font-semibold flex flex-col gap-1.5">
      <div className="flex flex-row justify-between items-center gap-3">
        <div className="flex flex-row items-center gap-2 min-w-0">
          <RatingSVG draggable rating={rating} size={22} />
          <span className="truncate">
            {moveSan} {t(`analisa.formatLabel.${format}`, { label })}
          </span>
        </div>
        <div className="shrink-0">
          <FormatEval evaluation={evaluation} white={white} wdl={wdl} />
        </div>
      </div>
      <div className="leading-5 text-foregroundBlack">{komentar}</div>
    </div>
  );
}

export { FormatEval, Comments as default };
