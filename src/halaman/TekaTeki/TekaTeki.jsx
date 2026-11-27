/**
 * Layar Teka-teki — tata letak tiga wilayah seperti puzzle En Croissant:
 * papan di kiri, panel latihan di kanan atas, riwayat sesi di kanan bawah.
 * Pada layar sempit ketiganya menumpuk vertikal.
 *
 * Preferensi dibaca dari config bersama ("satu pintu") sehingga pengaturannya
 * tinggal di layar Pengaturan, bukan tersebar di fitur ini.
 */
import { useContext, useMemo, useRef, useState } from "react";
import { ConfigContext } from "../../modul/sesi/preferensi.js";
import { useI18n } from "../../lib/i18n.jsx";
import PanelLayar from "../Analisa/komponen/nav/PanelLayar.jsx";
import useSesiTekaTeki from "./logika/useSesiTekaTeki.js";
import useUkuranPapan from "./logika/useUkuranPapan.js";
import pgnDariSoal from "./logika/pgnDariSoal.js";
import PapanTekaTeki from "./komponen/papanTekaTeki.jsx";
import PanelTekaTeki from "./komponen/panelTekaTeki.jsx";
import RiwayatSesi from "./komponen/riwayatSesi.jsx";

export default function TekaTeki({ onAnalisa }) {
  const { t } = useI18n();
  const config = useContext(ConfigContext);
  const [sumber, setSumber] = useState("skakmat");
  const wadahPapan = useRef(null);
  const ukuran = useUkuranPapan(wadahPapan);

  const [ratingMin] = config.puzzleRatingMin ?? [1000];
  const [ratingMax] = config.puzzleRatingMax ?? [1500];
  const [tema] = config.puzzleTema ?? [""];
  const [progresif] = config.puzzleProgresif ?? [false];
  const [sembunyiRating] = config.puzzleSembunyiRating ?? [false];
  const [lompatCepat] = config.puzzleLompatCepat ?? [true];
  const [catatWaktu] = config.puzzleCatatWaktu ?? [true];

  const sesi = useSesiTekaTeki({ sumber, ratingMin, ratingMax, tema, progresif, lompatCepat, catatWaktu });
  const pilihanSumber = useMemo(() => [
    { id: "skakmat", label: t("tekaTeki.sumber.skakmat") },
    { id: "video", label: t("tekaTeki.sumber.video") },
    { id: "harian", label: t("tekaTeki.sumber.harian") },
  ], [t]);

  const pesan = sesi.pesan ? t(`tekaTeki.pesan.${sesi.pesan}`) : "";
  const statusNada = sesi.pesan === "salah" ? "text-lossRed" : sesi.pesan ? "text-winGreen" : "text-foregroundGrey";

  return (
    <PanelLayar judul={t("tekaTeki.judul")} subjudul={t("tekaTeki.deskripsi")} lebarMaks="max-w-[1100px]">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div ref={wadahPapan} className="flex min-h-[260px] shrink-0 items-start justify-center lg:min-h-0 lg:flex-1">
          <PapanTekaTeki
            t={t}
            fen={sesi.fen}
            pihak={sesi.soal?.pihak ?? "w"}
            ukuran={ukuran}
            onLangkah={sesi.mainkan}
            petunjuk={sesi.petunjuk}
            terkunci={!sesi.belumSelesai || sesi.solusiBerjalan}
          />
        </div>
        <div className="flex min-h-0 w-full flex-col gap-3 lg:w-[360px] lg:shrink-0">
          {sesi.memuat ? <p className="text-[13px] text-foregroundGrey">{t("tekaTeki.status.memuat")}</p> : null}
          {!sesi.memuat && !sesi.soal ? (
            <p className="text-[13px] text-foregroundGrey">{t(`tekaTeki.status.${sesi.pesan === "gagal" ? "gagal" : "kosong"}`)}</p>
          ) : null}
          <PanelTekaTeki
            t={t}
            sesi={sesi}
            sumber={sumber}
            onSumber={setSumber}
            pilihanSumber={pilihanSumber}
            sembunyiRating={sembunyiRating}
            catatWaktu={catatWaktu}
            onAnalisa={() => onAnalisa?.(pgnDariSoal(sesi.soal))}
          />
          <p aria-live="polite" className={`min-h-[18px] text-[12.5px] font-medium ${statusNada}`}>{pesan}</p>
          <RiwayatSesi t={t} riwayat={sesi.riwayat} aktif={sesi.aktif} onPilih={sesi.pilihRiwayat} />
        </div>
      </div>
    </PanelLayar>
  );
}
