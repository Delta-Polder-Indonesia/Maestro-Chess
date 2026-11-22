/**
 * Layar "Pengaturan" Report Analisa — pengganti popup gear di BoardMenu.
 * Tata letak mengikuti layar Deteksi Engine: dua kartu berdampingan tanpa tab;
 * kiri bahasa, kanan pengaturan papan tersusun ke bawah. Tiap bagian dipisah
 * garis berlabel (sama seperti pemisah "Pengaturan umum" di Deteksi Engine)
 * supaya batas bagian terbaca. Pengaturan mesin dipindah ke layar Engine dan
 * sengaja tidak direrender di sini.
 */
import { useI18n } from "../../../../lib/i18n.jsx";
import PanelLayar from "./PanelLayar.jsx";
import Themes from "../pengaturan/themes.jsx";
import Ratings from "../pengaturan/ratings.jsx";
import Moves from "../pengaturan/moves.jsx";
import BestMoves from "../pengaturan/bestMoves.jsx";

function Pemisah({ teks }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs font-bold text-foregroundGrey">{teks}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export default function LayarPengaturan({ aktif = true }) {
  const { t, bahasa, setBahasa } = useI18n();

  return (
    <PanelLayar judul={t("analisa.pengaturan.judul")}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto sm:gap-4 lg:flex-row lg:overflow-hidden">
        <div className="flex w-full shrink-0 flex-col lg:min-h-0 lg:flex-1">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[6px] border-2 border-border bg-backgroundBox">
            <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 pt-4 lg:overflow-y-auto">
              <label className="flex items-center justify-between gap-3 text-sm font-bold text-foreground">
                {bahasa === "id" ? "Bahasa" : "Language"}
                <select
                  aria-label={bahasa === "id" ? "Bahasa" : "Language"}
                  value={bahasa}
                  onChange={(event) => setBahasa(event.target.value)}
                  className="rounded-borderRoundness border border-border bg-[#272727] px-2 py-1 text-sm text-foreground"
                >
                  <option value="id">Bahasa Indonesia</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>
          </div>
        </div>
        <div className="flex min-w-0 w-full shrink-0 flex-col lg:min-h-0 lg:flex-1">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[6px] border-2 border-border bg-backgroundBox">
            <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 pt-4 lg:overflow-y-auto">
              <Pemisah teks={t("analisa.pengaturan.temaPapan")} />
              <Themes />
              <Pemisah teks={t("analisa.pengaturan.penilaian")} />
              <Ratings />
              <Pemisah teks={t("analisa.pengaturan.langkah")} />
              <Moves aktif={aktif} />
              <Pemisah teks={t("analisa.pengaturan.langkahTerbaik")} />
              <BestMoves />
            </div>
          </div>
        </div>
      </div>
    </PanelLayar>
  );
}
