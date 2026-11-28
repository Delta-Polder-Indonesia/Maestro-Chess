/**
 * Panel kanan-atas teka-teki (pola En Croissant): pemilih sumber + tong sampah
 * + gigi, pengaturan latihan buka/tutup di tempat, empat kartu statistik
 * (rating/waktu/akurasi/rantai) berfont mono dengan ikon api pada rantai,
 * toolbar aksi (soal baru · analisa · ulang), lalu Petunjuk dan Lihat solusi.
 *
 * Pengaturan latihan tinggal di sini (di dalam fitur), bukan di Pengaturan
 * umum — tombol gigi membuka panel rentang rating/tema/sakelar.
 */
import { formatWaktu } from "../../../modul/tekaTeki/index.js";
import PilihRingkas from "../../Analisa/komponen/pengaturan/pilihRingkas.jsx";
import PengaturanTekaTeki from "./pengaturanTekaTeki.jsx";

function Kartu({ label, nilai, nada = "text-foreground" }) {
  return (
    <div className="flex min-h-[70px] min-w-0 flex-col justify-between rounded-[5px] border border-border bg-backgroundBox px-3 py-2.5">
      <span className="truncate text-[11px] text-foregroundGrey">{label}</span>
      <span className={`mt-1 truncate font-mono text-[17px] font-semibold tabular-nums ${nada}`}>{nilai}</span>
    </div>
  );
}

function KartuRantai({ label, nilai }) {
  return (
    <div className="flex min-h-[70px] min-w-0 flex-col justify-between rounded-[5px] border border-border bg-backgroundBox px-3 py-2.5">
      <span className="truncate text-[11px] text-foregroundGrey">{label}</span>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="font-mono text-[17px] font-semibold tabular-nums text-foreground">{nilai}</span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59f00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 12c2-2.96 0-7-1-8 0 3.038-1.773 4.741-3 6-1.226 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.532-1.056-3.94-2-5-1.786 3-2.791 3-4 2z" />
        </svg>
      </div>
    </div>
  );
}

function TombolAksi({ label, onClick, disabled, children, aktif = false, kecil = false }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center rounded-borderRoundness border border-border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        kecil ? "h-[26px] w-[26px]" : "h-[34px] w-[34px]"
      } ${aktif ? "bg-backgroundBoxBoxHover text-backgroundBoxBoxHighlighted" : "bg-backgroundDropdown text-foregroundGrey hover:text-foreground"}`}
    >{children}</button>
  );
}

export default function PanelTekaTeki({
  t, sesi, sumber, onSumber, prefs, bukaPengaturan, onTogglePengaturan, onAnalisa, pilihanSumber,
}) {
  const { soal, statistik, waktu, status, belumSelesai, solusiBerjalan, riwayat, aktif } = sesi;
  const ratingTerlihat = soal?.rating ?? null;
  const ratingTampil = ratingTerlihat === null ? "-" : (prefs.sembunyiRating && status === "belum" ? "?" : String(ratingTerlihat));
  const nadaAkurasi = statistik.akurasi === null ? "text-foregroundGrey" : (statistik.akurasi >= 50 ? "text-winGreen" : "text-lossRed");
  const temaSoal = riwayat[aktif]?.tema ?? [];

  return (
    <div className="flex shrink-0 flex-col gap-3.5 rounded-borderRoundness border border-border bg-backgroundBoxDarker p-3.5">
      {/* Baris 1: sumber + tong sampah (bersihkan sesi) + gigi (pengaturan) */}
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
        <TombolAksi label={t("tekaTeki.panel.bersihkanSesi")} onClick={sesi.bersihkanSesi} disabled={!riwayat.length}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </TombolAksi>
        <TombolAksi label={t("tekaTeki.panel.pengaturan")} onClick={onTogglePengaturan} aktif={bukaPengaturan}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </TombolAksi>
      </div>

      {bukaPengaturan ? <PengaturanTekaTeki prefs={prefs} t={t} temaTersedia={sesi.temaTersedia} /> : null}

      {/* Empat kartu statistik (mono) — rantai memakai ikon api */}
      <div className="grid grid-cols-4 gap-2.5">
        <Kartu label={t("tekaTeki.panel.rating")} nilai={ratingTampil} />
        <Kartu label={t("tekaTeki.panel.waktu")} nilai={prefs.catatWaktu ? formatWaktu(waktu) : "-"} />
        <Kartu label={t("tekaTeki.panel.akurasi")} nilai={statistik.akurasi === null ? "-" : `${statistik.akurasi}%`} nada={nadaAkurasi} />
        <KartuRantai label={t("tekaTeki.panel.streak")} nilai={String(statistik.streak)} />
      </div>

      {status !== "belum" && temaSoal.length ? (
        <div className="flex flex-wrap gap-1" aria-label={t("tekaTeki.panel.temaSoal")}>
          {temaSoal.map((tema) => (
            <span key={tema} className="rounded-full border border-border bg-backgroundBox px-2 py-0.5 text-[10.5px] text-foregroundGrey">{tema}</span>
          ))}
        </div>
      ) : null}

      <div className="border-t border-border" />

      {/* Toolbar aksi rata kanan: soal baru · analisa posisi · ulang soal */}
      <div className="flex items-center justify-end gap-1.5">
        <TombolAksi kecil label={t("tekaTeki.panel.soalBaru")} onClick={sesi.soalBaru} disabled={!soal}>
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="h-[13px] w-[13px]" aria-hidden="true"><path d="M7 2.5V11.5M2.5 7H11.5" /></svg>
        </TombolAksi>
        <TombolAksi kecil label={t("tekaTeki.panel.analisaPosisi")} onClick={onAnalisa} disabled={!soal}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-[13px] w-[13px]" aria-hidden="true"><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.2" y2="16.2" /></svg>
        </TombolAksi>
        <TombolAksi kecil label={t("tekaTeki.panel.ulangSoal")} onClick={sesi.ulangSoal} disabled={!soal}>
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="h-[13px] w-[13px]" aria-hidden="true"><path d="M3 3L11 11M11 3L3 11" /></svg>
        </TombolAksi>
      </div>

      {/* Dua tombol besar: Petunjuk | Lihat solusi */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={sesi.ambilPetunjuk}
          disabled={!soal || !belumSelesai || solusiBerjalan}
          className="h-9 rounded-borderRoundness border border-border bg-backgroundDropdown text-[13px] font-medium text-foregroundGrey transition-colors hover:bg-backgroundBoxBoxHover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >{t("tekaTeki.panel.petunjuk")}</button>
        <button
          type="button"
          onClick={sesi.lihatSolusi}
          disabled={!soal || solusiBerjalan}
          className="h-9 rounded-borderRoundness border border-border bg-backgroundDropdown text-[13px] font-medium text-foregroundGrey transition-colors hover:bg-backgroundBoxBoxHover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >{t("tekaTeki.panel.lihatSolusi")}</button>
      </div>
    </div>
  );
}
