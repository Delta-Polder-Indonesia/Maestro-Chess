/**
 * Katalog pengaturan Analisa — SUMBER TUNGGAL ("1 pintu") untuk metadata
 * seluruh pengaturan: tab, grup, dan baris yang bisa dicari.
 *
 * Menambah fitur baru cukup mendaftarkan entri di sini (grup/tab + baris
 * pencarian) lalu merender kontrolnya di komponen grup terkait. Layar
 * Pengaturan menurunkan navigasi, judul grup, dan indeks pencarian dari
 * katalog ini sehingga tidak ada definisi pengaturan yang tercecer.
 *
 * Modul data murni (tanpa React): label disimpan sebagai kunci i18n dan
 * diterjemahkan oleh layar. Ikon/render tetap di layar karena berupa komponen.
 * Baris dinamis (tema papan & label penilaian) ditambahkan layar di atas
 * BARIS_STATIS karena jumlahnya mengikuti registri tema/rating.
 */

export const TAB_META = [
  { id: "papan", judulKunci: "analisa.pengaturan.tab.papan", deskripsiKunci: "analisa.pengaturan.tab.papanDeskripsi" },
  { id: "penilaian", judulKunci: "analisa.pengaturan.penilaian", deskripsiKunci: "analisa.pengaturan.tab.penilaianDeskripsi" },
  { id: "langkah", judulKunci: "analisa.pengaturan.langkah", deskripsiKunci: "analisa.pengaturan.tab.langkahDeskripsi" },
  { id: "teka-teki", judulKunci: "tekaTeki.pengaturan.tab", deskripsiKunci: "tekaTeki.pengaturan.tabDeskripsi" },
  { id: "bahasa", judulKunci: "analisa.pengaturan.tab.bahasa", deskripsiKunci: "analisa.pengaturan.tab.bahasaDeskripsi" },
  { id: "dokumentasi", judulKunci: "analisa.pengaturan.tab.dokumentasi", deskripsiKunci: "analisa.pengaturan.tab.dokumentasiDeskripsi" },
];

export const GRUP_META = [
  { id: "tema", tab: "papan", judulKunci: "analisa.pengaturan.temaPapan", deskripsiKunci: "analisa.pengaturan.deskripsi.temaPapan" },
  { id: "perilaku", tab: "papan", judulKunci: "analisa.pengaturan.perilakuPapan", deskripsiKunci: "analisa.pengaturan.deskripsi.perilakuPapan" },
  { id: "tampilan", tab: "papan", judulKunci: "analisa.pengaturan.tampilan", deskripsiKunci: "analisa.pengaturan.deskripsi.tampilan" },
  { id: "penilaian", tab: "penilaian", judulKunci: "analisa.pengaturan.penilaian", deskripsiKunci: "analisa.pengaturan.tab.penilaianDeskripsi" },
  { id: "langkah", tab: "langkah", judulKunci: "analisa.pengaturan.langkahTerbaik", deskripsiKunci: "analisa.pengaturan.tab.langkahDeskripsi" },
  { id: "tekaTeki", tab: "teka-teki", judulKunci: "tekaTeki.pengaturan.grup", deskripsiKunci: "tekaTeki.pengaturan.grupDeskripsi" },
  { id: "bahasa", tab: "bahasa", judulKunci: "analisa.pengaturan.bahasa", deskripsiKunci: "analisa.pengaturan.deskripsi.bahasa" },
  { id: "dokumentasi", tab: "dokumentasi", judulKunci: "analisa.pengaturan.tab.dokumentasi", deskripsiKunci: "analisa.pengaturan.tab.dokumentasiDeskripsi" },
];

// Baris pencarian statis. `kunci` juga dipakai fungsi cocok() komponen grup;
// `labelKunci` adalah kunci i18n label yang terlihat. Urutan = urutan tampil.
export const BARIS_STATIS = [
  { kunci: "setBidak", labelKunci: "analisa.pengaturan.setBidak", grup: "tema" },
  { kunci: "koordinatPapan", labelKunci: "analisa.pengaturan.koordinatPapan", grup: "tema" },
  { kunci: "koordinat.no", labelKunci: "analisa.pengaturan.koordinat.tanpa", grup: "tema" },
  { kunci: "koordinat.edge", labelKunci: "analisa.pengaturan.koordinat.tepi", grup: "tema" },
  { kunci: "koordinat.all", labelKunci: "analisa.pengaturan.koordinat.semua", grup: "tema" },
  { kunci: "langkahLegal", labelKunci: "analisa.pengaturan.langkahLegal", grup: "perilaku" },
  { kunci: "animasi", labelKunci: "analisa.pengaturan.animasi", grup: "perilaku" },
  { kunci: "suara", labelKunci: "analisa.pengaturan.suara", grup: "perilaku" },
  { kunci: "sorotLangkah", labelKunci: "analisa.pengaturan.sorotLangkah", grup: "perilaku" },
  { kunci: "autoPromosi", labelKunci: "analisa.pengaturan.autoPromosi", grup: "perilaku" },
  { kunci: "volume", labelKunci: "analisa.pengaturan.volume", grup: "perilaku" },
  { kunci: "koleksiSuara", labelKunci: "analisa.pengaturan.koleksiSuara", grup: "perilaku" },
  { kunci: "kecepatanAnimasi", labelKunci: "analisa.pengaturan.kecepatanAnimasi", grup: "perilaku" },
  { kunci: "tampilanMaterial", labelKunci: "analisa.pengaturan.tampilanMaterial", grup: "perilaku" },
  { kunci: "pratinjauHover", labelKunci: "analisa.pengaturan.pratinjauHover", grup: "perilaku" },
  { kunci: "gulirLangkah", labelKunci: "analisa.pengaturan.gulirLangkah", grup: "perilaku" },
  { kunci: "tema", labelKunci: "analisa.pengaturan.tema", grup: "tampilan" },
  { kunci: "ukuranFont", labelKunci: "analisa.pengaturan.ukuranFont", grup: "tampilan" },
  { kunci: "warnaAksen", labelKunci: "analisa.pengaturan.warnaAksen", grup: "tampilan" },
  { kunci: "puzzleRentangRating", labelKunci: "tekaTeki.pengaturan.rentangRating", grup: "tekaTeki" },
  { kunci: "puzzleTema", labelKunci: "tekaTeki.pengaturan.tema", grup: "tekaTeki" },
  { kunci: "puzzleProgresif", labelKunci: "tekaTeki.pengaturan.progresif", grup: "tekaTeki" },
  { kunci: "puzzleSembunyiRating", labelKunci: "tekaTeki.pengaturan.sembunyiRating", grup: "tekaTeki" },
  { kunci: "puzzleLompatCepat", labelKunci: "tekaTeki.pengaturan.lompatCepat", grup: "tekaTeki" },
  { kunci: "puzzleCatatWaktu", labelKunci: "tekaTeki.pengaturan.catatWaktu", grup: "tekaTeki" },
  { kunci: "formatSkor", labelKunci: "analisa.pengaturan.formatSkor", grup: "penilaian" },
  { kunci: "tablebase", labelKunci: "analisa.pengaturan.tablebase", grup: "penilaian" },
  { kunci: "sorotLabel", labelKunci: "analisa.pengaturan.sorotLabel", grup: "penilaian" },
  { kunci: "tampilPanah", labelKunci: "analisa.pengaturan.tampilPanah", grup: "langkah" },
  { kunci: "panahSetelahLangkah", labelKunci: "analisa.pengaturan.panahSetelahLangkah", grup: "langkah" },
  { kunci: "hapusPanahKlik", labelKunci: "analisa.pengaturan.hapusPanahKlik", grup: "langkah" },
  { kunci: "notasiLangkah", labelKunci: "analisa.pengaturan.notasiLangkah", grup: "langkah" },
  { kunci: "bahasa", labelKunci: "analisa.pengaturan.bahasa", grup: "bahasa" },
  { kunci: "kodeSumber", labelKunci: "analisa.nav.kodeSumber", grup: "dokumentasi" },
  { kunci: "atribusi", labelKunci: "analisa.nav.atribusi", grup: "dokumentasi" },
];
