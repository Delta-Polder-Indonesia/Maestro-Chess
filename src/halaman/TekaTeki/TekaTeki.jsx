/**
 * Layar Teka-teki — tata letak tiga wilayah seperti puzzle En Croissant:
 * papan di kiri, panel latihan di kanan atas, riwayat sesi di kanan bawah.
 * Pada layar sempit ketiganya menumpuk vertikal.
 *
 * Preferensi latihan adalah milik fitur ini (bukan pengaturan umum aplikasi):
 * dibaca/disunting di dalam layar lewat tombol gigi pada panel, persis pola
 * En Croissant. Warna papan / set bidak / tampilan tetap di Pengaturan umum.
 */
import { useMemo, useRef, useState } from "react";
import { useI18n } from "../../lib/i18n.jsx";
import PanelLayar from "../Analisa/komponen/nav/PanelLayar.jsx";
import useSesiTekaTeki from "./logika/useSesiTekaTeki.js";
import usePreferensiTekaTeki from "./logika/usePreferensiTekaTeki.js";
import useUkuranPapan from "./logika/useUkuranPapan.js";
import pgnDariSoal from "./logika/pgnDariSoal.js";
import PapanTekaTeki from "./komponen/papanTekaTeki.jsx";
import PanelTekaTeki from "./komponen/panelTekaTeki.jsx";
import RiwayatSesi from "./komponen/riwayatSesi.jsx";

export default function TekaTeki({ onAnalisa }) {
  const { t } = useI18n();
  const prefs = usePreferensiTekaTeki();
  const [sumber, setSumber] = useState("skakmat");
  const [bukaPengaturan, setBukaPengaturan] = useState(false);
  const wadahPapan = useRef(null);
  const ukuran = useUkuranPapan(wadahPapan);

  const sesi = useSesiTekaTeki({
    sumber,
    ratingMin: prefs.ratingMin, ratingMax: prefs.ratingMax, tema: prefs.tema,
    progresif: prefs.progresif, lompatCepat: prefs.lompatCepat, catatWaktu: prefs.catatWaktu,
  });
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
            prefs={prefs}
            bukaPengaturan={bukaPengaturan}
            onTogglePengaturan={() => setBukaPengaturan((b) => !b)}
            pilihanSumber={pilihanSumber}
            onAnalisa={() => onAnalisa?.(pgnDariSoal(sesi.soal))}
          />
          <p aria-live="polite" className={`min-h-[18px] text-[12.5px] font-medium ${statusNada}`}>{pesan}</p>
          <RiwayatSesi t={t} riwayat={sesi.riwayat} aktif={sesi.aktif} onPilih={sesi.pilihRiwayat} />
        </div>
      </div>
    </PanelLayar>
  );
}
