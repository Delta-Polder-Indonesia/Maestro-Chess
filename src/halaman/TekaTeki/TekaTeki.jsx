/**
 * Layar Teka-teki — tata letak seperti puzzle En Croissant: papan di kiri,
 * panel latihan di kanan atas, lalu kotak status + daftar langkah dengan
 * navigasi << < > >> di kanan bawah. Pada layar sempit semuanya menumpuk.
 *
 * Preferensi latihan adalah milik fitur ini (bukan pengaturan umum aplikasi):
 * dibaca/disunting di dalam layar lewat tombol gigi pada panel. Warna papan /
 * set bidak / tampilan tetap di Pengaturan umum.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../lib/i18n.jsx";
import PanelLayar from "../Analisa/komponen/nav/PanelLayar.jsx";
import useSesiTekaTeki from "./logika/useSesiTekaTeki.js";
import usePreferensiTekaTeki from "./logika/usePreferensiTekaTeki.js";
import useUkuranPapan from "./logika/useUkuranPapan.js";
import pgnDariSoal from "./logika/pgnDariSoal.js";
import buatJejak from "./logika/jejakLangkah.js";
import PapanTekaTeki from "./komponen/papanTekaTeki.jsx";
import PanelTekaTeki from "./komponen/panelTekaTeki.jsx";
import RiwayatLangkah from "./komponen/riwayatLangkah.jsx";

export default function TekaTeki({ onAnalisa }) {
  const { t } = useI18n();
  const prefs = usePreferensiTekaTeki();
  const [sumber, setSumber] = useState("skakmat");
  const [bukaPengaturan, setBukaPengaturan] = useState(false);
  // Indeks jejak yang sedang ditinjau; null = posisi live (langkah terakhir).
  const [tinjau, setTinjau] = useState(null);
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

  const jejak = useMemo(
    () => buatJejak(sesi.soal, sesi.indeks, sesi.langkahNyata),
    [sesi.soal, sesi.indeks, sesi.langkahNyata],
  );
  const lastIndex = Math.max(0, jejak.length - 1);
  // Setiap soal/jalur maju kembali ke tampilan live.
  useEffect(() => { setTinjau(null); }, [sesi.soal, sesi.indeks]);

  const tampilIndex = tinjau === null ? lastIndex : Math.min(tinjau, lastIndex);
  const meninjau = tinjau !== null && tampilIndex < lastIndex;
  const fenTampil = meninjau ? (jejak[tampilIndex]?.fen ?? sesi.fen) : sesi.fen;
  const terkunci = meninjau || !sesi.belumSelesai || sesi.solusiBerjalan;
  // Langkah terakhir yang menghasilkan posisi tampil → sorotan + asal luncuran.
  const idxTampil = meninjau ? tampilIndex : sesi.indeks;
  const langkahTerakhir = sesi.soal?.langkah?.[idxTampil - 1];
  const langkahAkhir = langkahTerakhir ? { from: langkahTerakhir.from, to: langkahTerakhir.to } : null;

  function navigasi(arah) {
    let baru;
    if (arah === "awal") baru = 0;
    else if (arah === "sebelum") baru = Math.max(0, tampilIndex - 1);
    else if (arah === "berikut") baru = Math.min(lastIndex, tampilIndex + 1);
    else baru = lastIndex;
    setTinjau(baru >= lastIndex ? null : baru);
  }

  const pesan = sesi.pesan ? t(`tekaTeki.pesan.${sesi.pesan}`) : "";
  const statusNada = sesi.pesan === "salah" ? "text-lossRed" : sesi.pesan ? "text-winGreen" : "text-foreground";
  const giliran = sesi.soal?.pihak === "w" ? t("tekaTeki.panel.giliranPutih") : t("tekaTeki.panel.giliranHitam");

  return (
    <PanelLayar lebarMaks="max-w-[1200px]">
      {/* Nama fitur sudah menjadi label tab di bilah atas; kepala penjelasan
          tidak diulang di dalam layar. Judul tetap ada untuk pembaca layar. */}
      <h1 className="sr-only">{t("tekaTeki.judul")}</h1>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div ref={wadahPapan} className="flex min-h-[260px] shrink-0 items-start justify-center lg:min-h-0 lg:flex-1">
          <PapanTekaTeki
            fen={fenTampil}
            pihak={sesi.soal?.pihak ?? "w"}
            ukuran={ukuran}
            onLangkah={sesi.mainkan}
            petunjuk={sesi.petunjuk}
            langkahAkhir={langkahAkhir}
            terkunci={terkunci}
          />
        </div>
        <div className="flex min-h-0 w-full flex-col gap-2.5 overflow-y-auto lg:min-w-[340px] lg:flex-1">
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
          {/* Kotak status: pesan latihan + id soal */}
          <div className="flex h-[52px] shrink-0 items-center justify-between gap-2 rounded-borderRoundness border border-border bg-backgroundBoxDarker px-3.5 text-[12.5px]">
            <span aria-live="polite" className={`truncate font-medium ${statusNada}`}>{pesan || (sesi.soal ? giliran : "")}</span>
            <span className="shrink-0 font-mono text-[11px] text-foregroundGrey">{sesi.soal?.id ?? ""}</span>
          </div>
          <RiwayatLangkah
            t={t}
            jejak={jejak}
            tinjau={tampilIndex}
            onTinjau={(i) => setTinjau(i >= lastIndex ? null : i)}
            onNavigasi={navigasi}
          />
        </div>
      </div>
    </PanelLayar>
  );
}
