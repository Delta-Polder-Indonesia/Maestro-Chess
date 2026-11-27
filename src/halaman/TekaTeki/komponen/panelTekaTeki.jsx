/**
 * Panel kanan-atas teka-teki (pola En Croissant): pemilih sumber + tombol gigi,
 * pengaturan latihan yang bisa dibuka-tutup di tempat, kartu statistik
 * (rating/waktu/akurasi/rantai/rata-rata), indikator giliran, aksi soal
 * baru–analisa–bersihkan, lalu dua tombol besar Petunjuk dan Lihat solusi.
 *
 * Pengaturan latihan tinggal di sini (di dalam fitur), bukan di layar
 * Pengaturan umum — tombol gigi membuka panel rentang rating/tema/sakelar.
 */
import { formatWaktu } from "../../../modul/tekaTeki/index.js";
import PilihRingkas from "../../Analisa/komponen/pengaturan/pilihRingkas.jsx";
import PengaturanTekaTeki from "./pengaturanTekaTeki.jsx";

function Kartu({ label, nilai, nada = "" }) {
  return (
    <div className="min-w-0 flex-1 rounded-borderRoundness border border-border bg-backgroundBox px-2 py-1.5">
      <div className="truncate text-[10.5px] uppercase tracking-wide text-foregroundGrey">{label}</div>
      <div className={`truncate text-[15px] font-bold tabular-nums ${nada}`}>{nilai}</div>
    </div>
  );
}

function TombolAksi({ label, onClick, disabled, children, aktif = false }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-borderRoundness border border-border bg-backgroundDropdown transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        aktif ? "text-backgroundBoxBoxHighlighted" : "text-foregroundGrey hover:text-foreground"
      }`}
    >{children}</button>
  );
}

export default function PanelTekaTeki({
  t, sesi, sumber, onSumber, prefs, bukaPengaturan, onTogglePengaturan, onAnalisa, pilihanSumber,
}) {
  const { soal, statistik, waktu, status, belumSelesai, solusiBerjalan, riwayat, aktif } = sesi;
  const ratingTerlihat = soal?.rating ?? null;
  // Rating disembunyikan hanya selama soal belum ditandai; begitu salah/benar
  // rating terlihat (paritas En Croissant).
  const ratingTampil = ratingTerlihat === null ? "—" : (prefs.sembunyiRating && status === "belum" ? "?" : String(ratingTerlihat));
  const giliran = soal?.pihak === "w" ? t("tekaTeki.panel.giliranPutih") : t("tekaTeki.panel.giliranHitam");
  const nadaAkurasi = statistik.akurasi === null ? "text-foregroundGrey" : (statistik.akurasi >= 50 ? "text-winGreen" : "text-lossRed");
  const temaSoal = riwayat[aktif]?.tema ?? [];

  return (
    <div className="flex min-h-0 flex-col gap-2.5 rounded-borderRoundness border border-border bg-backgroundBoxDarker p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <PilihRingkas
            ariaLabel={t("tekaTeki.sumber.label")}
            lebar="w-full"
            nilai={sumber}
            pilihan={pilihanSumber}
            onChange={onSumber}
            labelNaik={t("analisa.pengaturan.opsiSebelumnya")}
            labelTurun={t("analisa.pengaturan.opsiBerikutnya")}
          />
        </div>
        <TombolAksi
          label={t("tekaTeki.panel.pengaturan")}
          onClick={onTogglePengaturan}
          aktif={bukaPengaturan}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </TombolAksi>
      </div>

      {bukaPengaturan ? <PengaturanTekaTeki prefs={prefs} t={t} /> : null}

      <div className="flex flex-wrap gap-1.5">
        <Kartu label={t("tekaTeki.panel.rating")} nilai={ratingTampil} />
        {prefs.catatWaktu ? <Kartu label={t("tekaTeki.panel.waktu")} nilai={formatWaktu(waktu)} /> : null}
        <Kartu label={t("tekaTeki.panel.akurasi")} nilai={statistik.akurasi === null ? "—" : `${statistik.akurasi}%`} nada={nadaAkurasi} />
        <Kartu label={t("tekaTeki.panel.streak")} nilai={String(statistik.streak)} />
        {prefs.catatWaktu && statistik.rataWaktu !== null ? <Kartu label={t("tekaTeki.panel.rataWaktu")} nilai={`${(statistik.rataWaktu / 1000).toFixed(1)}s`} /> : null}
      </div>

      {status !== "belum" && temaSoal.length ? (
        <div className="flex flex-wrap gap-1" aria-label={t("tekaTeki.panel.temaSoal")}>
          {temaSoal.map((tema) => (
            <span key={tema} className="rounded-full border border-border bg-backgroundBox px-2 py-0.5 text-[10.5px] text-foregroundGrey">{tema}</span>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className={`h-4 w-4 shrink-0 rounded-[2px] border border-border ${soal?.pihak === "w" ? "bg-white" : "bg-black"}`} />
          <span className="truncate text-[15px] font-semibold text-foreground">{soal ? giliran : ""}</span>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <TombolAksi label={t("tekaTeki.panel.soalBaru")} onClick={sesi.soalBaru} disabled={!soal}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </TombolAksi>
          <TombolAksi label={t("tekaTeki.panel.analisaPosisi")} onClick={onAnalisa} disabled={!soal}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          </TombolAksi>
          <TombolAksi label={t("tekaTeki.panel.bersihkanSesi")} onClick={sesi.bersihkanSesi} disabled={!riwayat.length}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </TombolAksi>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={sesi.ambilPetunjuk}
          disabled={!soal || !belumSelesai || solusiBerjalan}
          className="h-9 flex-1 rounded-borderRoundness border border-border bg-backgroundDropdown text-[13px] font-semibold text-foreground transition-colors hover:border-foregroundGrey disabled:cursor-not-allowed disabled:opacity-40"
        >{t("tekaTeki.panel.petunjuk")}</button>
        <button
          type="button"
          onClick={sesi.lihatSolusi}
          disabled={!soal || solusiBerjalan}
          className="h-9 flex-1 rounded-borderRoundness border border-border bg-backgroundDropdown text-[13px] font-semibold text-foreground transition-colors hover:border-foregroundGrey disabled:cursor-not-allowed disabled:opacity-40"
        >{t("tekaTeki.panel.lihatSolusi")}</button>
      </div>
    </div>
  );
}
