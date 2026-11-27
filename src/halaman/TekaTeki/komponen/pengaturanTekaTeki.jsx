/**
 * Pengaturan latihan yang hidup DI DALAM layar teka-teki (bukan di Pengaturan
 * umum). Dibuka lewat tombol gigi di kepala panel, persis panel puzzle En
 * Croissant: rentang rating dua-thumb, pemilih tema, lalu empat sakelar sifat
 * kerja sesi. Kontrol pilih/sakelar memakai komponen pengaturan yang sudah ada
 * agar bentuk dan aksesibilitasnya seragam; rentang rating memakai kontrol
 * dua-thumb khas fitur ini.
 */
import { daftarTema } from "../../../modul/tekaTeki/index.js";
import PilihRingkas from "../../Analisa/komponen/pengaturan/pilihRingkas.jsx";
import SakelarPengaturan from "../../Analisa/komponen/pengaturan/sakelarPengaturan.jsx";
import RentangRating from "./rentangRating.jsx";
import { RATING_ATAS, RATING_BAWAH } from "../logika/usePreferensiTekaTeki.js";

/** Tema bawaan dari kosakata soal Lichess yang paling sering dipakai. */
const TEMA_BAWAAN = [
  "backRankMate", "mateIn1", "mateIn2", "mateIn3", "fork", "pin", "skewer",
  "discoveredAttack", "sacrifice", "deflection", "endgame", "middlegame", "opening",
];

function BarisSakelar({ label, deskripsi, checked, onChange }) {
  return (
    <div className="flex items-start gap-2.5">
      <SakelarPengaturan checked={checked} onCheckedChange={onChange} aria-label={label} />
      <div className="min-w-0 pt-0.5">
        <div className="text-[13px] font-medium leading-4 text-foreground">{label}</div>
        <div className="mt-0.5 text-[11.5px] leading-4 text-foregroundGrey">{deskripsi}</div>
      </div>
    </div>
  );
}

export default function PengaturanTekaTeki({ prefs, t }) {
  const pilihanTema = [
    { id: "semua", label: t("tekaTeki.pengaturan.semuaTema") },
    ...daftarTema(TEMA_BAWAAN.map((nama) => ({ tema: [nama] }))).map((nama) => ({ id: nama, label: nama })),
  ];

  return (
    <div className="flex flex-col gap-3 border-b border-border pb-3" data-uji="pengaturan-teka-teki">
      <div>
        <div className="mb-1.5 text-[13px] font-semibold text-foreground">{t("tekaTeki.pengaturan.rentangRating")}</div>
        <RentangRating
          nilaiMin={prefs.ratingMin}
          nilaiMax={prefs.ratingMax}
          onChangeMin={(n) => prefs.ubah("ratingMin", n)}
          onChangeMax={(n) => prefs.ubah("ratingMax", n)}
          min={RATING_BAWAH}
          max={RATING_ATAS}
          step={50}
          disabled={prefs.progresif}
          labelMin={t("tekaTeki.pengaturan.ratingMin")}
          labelMax={t("tekaTeki.pengaturan.ratingMax")}
          labelRentang={t("tekaTeki.pengaturan.rentangRating")}
        />
      </div>

      <div>
        <div className="mb-1.5 text-[13px] font-semibold text-foreground">{t("tekaTeki.pengaturan.tema")}</div>
        <PilihRingkas
          ariaLabel={t("tekaTeki.pengaturan.tema")}
          lebar="w-full"
          nilai={prefs.tema || "semua"}
          pilihan={pilihanTema}
          onChange={(nilai) => prefs.ubah("tema", nilai === "semua" ? "" : nilai)}
          labelNaik={t("analisa.pengaturan.opsiSebelumnya")}
          labelTurun={t("analisa.pengaturan.opsiBerikutnya")}
        />
      </div>

      <div className="flex flex-col gap-3 pt-1">
        <BarisSakelar
          label={t("tekaTeki.pengaturan.progresif")}
          deskripsi={t("tekaTeki.pengaturan.progresifDeskripsi")}
          checked={prefs.progresif}
          onChange={(baru) => prefs.ubah("progresif", baru)}
        />
        <BarisSakelar
          label={t("tekaTeki.pengaturan.sembunyiRating")}
          deskripsi={t("tekaTeki.pengaturan.sembunyiRatingDeskripsi")}
          checked={prefs.sembunyiRating}
          onChange={(baru) => prefs.ubah("sembunyiRating", baru)}
        />
        <BarisSakelar
          label={t("tekaTeki.pengaturan.lompatCepat")}
          deskripsi={t("tekaTeki.pengaturan.lompatCepatDeskripsi")}
          checked={prefs.lompatCepat}
          onChange={(baru) => prefs.ubah("lompatCepat", baru)}
        />
        <BarisSakelar
          label={t("tekaTeki.pengaturan.catatWaktu")}
          deskripsi={t("tekaTeki.pengaturan.catatWaktuDeskripsi")}
          checked={prefs.catatWaktu}
          onChange={(baru) => prefs.ubah("catatWaktu", baru)}
        />
      </div>
    </div>
  );
}
