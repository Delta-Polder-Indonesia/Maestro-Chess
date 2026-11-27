/**
 * Pengaturan latihan yang hidup DI DALAM layar teka-teki (bukan Pengaturan
 * umum). Dibuka lewat tombol gigi di kepala panel, persis panel puzzle En
 * Croissant: rentang rating dua-thumb, pemilih tema, lalu grid 2x2 sakelar
 * sifat kerja sesi (judul + deskripsi). Sakelar memakai kontrol ringkas gaya
 * Mantine; pemilih tema memakai komponen pengaturan yang sudah ada.
 */
import { daftarTema } from "../../../modul/tekaTeki/index.js";
import PilihRingkas from "../../Analisa/komponen/pengaturan/pilihRingkas.jsx";
import SakelarRingkas from "./sakelarRingkas.jsx";
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
      <span className="mt-0.5"><SakelarRingkas checked={checked} onCheckedChange={onChange} aria-label={label} /></span>
      <div className="min-w-0 leading-tight">
        <div className="text-[13px] font-medium text-foreground">{label}</div>
        <div className="mt-0.5 text-[11px] leading-4 text-foregroundGrey">{deskripsi}</div>
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
    <div className="flex flex-col gap-4 border-b border-border pb-3.5" data-uji="pengaturan-teka-teki">
      <div className="px-1">
        <div className="mb-2 text-[13px] font-medium text-foreground">{t("tekaTeki.pengaturan.rentangRating")}</div>
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

      <div className="px-1">
        <div className="mb-1.5 text-[13px] font-medium text-foreground">{t("tekaTeki.pengaturan.tema")}</div>
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

      <div className="grid grid-cols-1 gap-x-5 gap-y-3.5 px-1 sm:grid-cols-2">
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
