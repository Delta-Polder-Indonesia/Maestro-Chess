/**
 * Grup pengaturan "Latihan teka-teki" (adopsi panel puzzle En Croissant):
 * rentang rating, tema, progresif, sembunyikan rating, lompat cepat, catat waktu.
 *
 * Kontrol memakai komponen pengaturan yang sudah ada (NumberField, PilihRingkas,
 * SakelarPengaturan) agar bentuk dan perilakunya seragam dengan grup lain.
 * Nilai disimpan lewat config bersama + penyimpanan lokal ("satu pintu").
 */
import { useContext } from "react";
import { ConfigContext, tulis, tulisBoolean } from "../../../../modul/sesi/preferensi.js";
import { daftarTema } from "../../../../modul/tekaTeki/index.js";
import { useI18n } from "../../../../lib/i18n.jsx";
import BarisPengaturan from "./barisPengaturan.jsx";
import GeserPengaturan from "./geserPengaturan.jsx";
import PilihRingkas from "./pilihRingkas.jsx";
import SakelarPengaturan from "./sakelarPengaturan.jsx";

/** Tema bawaan dari kosakata soal Lichess yang paling sering dipakai. */
const TEMA_BAWAAN = [
  "backRankMate", "mateIn1", "mateIn2", "mateIn3", "fork", "pin", "skewer",
  "discoveredAttack", "sacrifice", "deflection", "endgame", "middlegame", "opening",
];

export default function TekaTekiPengaturan({ cocok = () => true, deskripsi = () => "" }) {
  const { t } = useI18n();
  const config = useContext(ConfigContext);
  const [ratingMin, setRatingMin] = config.puzzleRatingMin;
  const [ratingMax, setRatingMax] = config.puzzleRatingMax;
  const [tema, setTema] = config.puzzleTema;
  const [progresif, setProgresif] = config.puzzleProgresif;
  const [sembunyiRating, setSembunyiRating] = config.puzzleSembunyiRating;
  const [lompatCepat, setLompatCepat] = config.puzzleLompatCepat;
  const [catatWaktu, setCatatWaktu] = config.puzzleCatatWaktu;

  // Batas dijepit dan diurutkan supaya min tidak pernah melewati max.
  function ubahMin(nilai) {
    const sah = Math.min(nilai, ratingMax);
    setRatingMin(sah);
    tulis("puzzleRatingMin", String(sah));
  }
  function ubahMax(nilai) {
    const sah = Math.max(nilai, ratingMin);
    setRatingMax(sah);
    tulis("puzzleRatingMax", String(sah));
  }
  function ubahTema(nilai) {
    const sah = nilai === "semua" ? "" : nilai;
    setTema(sah);
    tulis("puzzleTema", sah);
  }
  function sakelar(nama, nilai, setNilai) {
    setNilai(nilai);
    tulisBoolean(nama, nilai);
  }

  const labelRentang = t("tekaTeki.pengaturan.rentangRating");
  const labelTema = t("tekaTeki.pengaturan.tema");
  const labelProgresif = t("tekaTeki.pengaturan.progresif");
  const labelSembunyi = t("tekaTeki.pengaturan.sembunyiRating");
  const labelLompat = t("tekaTeki.pengaturan.lompatCepat");
  const labelWaktu = t("tekaTeki.pengaturan.catatWaktu");
  const pilihanTema = [
    { id: "semua", label: t("tekaTeki.pengaturan.semuaTema") },
    ...daftarTema(TEMA_BAWAAN.map((nama) => ({ tema: [nama] }))).map((nama) => ({ id: nama, label: nama })),
  ];
  const judul = (teks) => <span className="text-[13.5px] font-medium text-foreground">{teks}</span>;

  return (
    <section>
      {cocok("puzzleRentangRating", labelRentang) ? (
        <BarisPengaturan judul={judul(labelRentang)} deskripsi={deskripsi("puzzleRentangRating") || t("tekaTeki.pengaturan.rentangRatingDeskripsi")}>
          <div className="flex items-center gap-2">
            <GeserPengaturan
              nilai={ratingMin} onChange={ubahMin} min={600} max={2800} step={50}
              ariaLabel={t("tekaTeki.pengaturan.ratingMin")}
              labelNaik={t("analisa.pengaturan.naikkan")} labelTurun={t("analisa.pengaturan.turunkan")}
              hintSeret={t("analisa.pengaturan.seretNilai")}
            />
            <GeserPengaturan
              nilai={ratingMax} onChange={ubahMax} min={600} max={2800} step={50}
              ariaLabel={t("tekaTeki.pengaturan.ratingMax")}
              labelNaik={t("analisa.pengaturan.naikkan")} labelTurun={t("analisa.pengaturan.turunkan")}
              hintSeret={t("analisa.pengaturan.seretNilai")}
            />
          </div>
        </BarisPengaturan>
      ) : null}
      {cocok("puzzleTema", labelTema) ? (
        <BarisPengaturan judul={judul(labelTema)} deskripsi={deskripsi("puzzleTema") || t("tekaTeki.pengaturan.temaDeskripsi")}>
          <PilihRingkas
            ariaLabel={labelTema} lebar="w-[190px]" nilai={tema || "semua"} pilihan={pilihanTema} onChange={ubahTema}
            labelNaik={t("analisa.pengaturan.opsiSebelumnya")} labelTurun={t("analisa.pengaturan.opsiBerikutnya")}
          />
        </BarisPengaturan>
      ) : null}
      {cocok("puzzleProgresif", labelProgresif) ? (
        <BarisPengaturan judul={judul(labelProgresif)} deskripsi={deskripsi("puzzleProgresif") || t("tekaTeki.pengaturan.progresifDeskripsi")}>
          <SakelarPengaturan checked={progresif} onCheckedChange={(baru) => sakelar("puzzleProgresif", baru, setProgresif)} aria-label={labelProgresif} />
        </BarisPengaturan>
      ) : null}
      {cocok("puzzleSembunyiRating", labelSembunyi) ? (
        <BarisPengaturan judul={judul(labelSembunyi)} deskripsi={deskripsi("puzzleSembunyiRating") || t("tekaTeki.pengaturan.sembunyiRatingDeskripsi")}>
          <SakelarPengaturan checked={sembunyiRating} onCheckedChange={(baru) => sakelar("puzzleSembunyiRating", baru, setSembunyiRating)} aria-label={labelSembunyi} />
        </BarisPengaturan>
      ) : null}
      {cocok("puzzleLompatCepat", labelLompat) ? (
        <BarisPengaturan judul={judul(labelLompat)} deskripsi={deskripsi("puzzleLompatCepat") || t("tekaTeki.pengaturan.lompatCepatDeskripsi")}>
          <SakelarPengaturan checked={lompatCepat} onCheckedChange={(baru) => sakelar("puzzleLompatCepat", baru, setLompatCepat)} aria-label={labelLompat} />
        </BarisPengaturan>
      ) : null}
      {cocok("puzzleCatatWaktu", labelWaktu) ? (
        <BarisPengaturan judul={judul(labelWaktu)} deskripsi={deskripsi("puzzleCatatWaktu") || t("tekaTeki.pengaturan.catatWaktuDeskripsi")}>
          <SakelarPengaturan checked={catatWaktu} onCheckedChange={(baru) => sakelar("puzzleCatatWaktu", baru, setCatatWaktu)} aria-label={labelWaktu} />
        </BarisPengaturan>
      ) : null}
    </section>
  );
}
