# Fitur Teka-teki (`src/halaman/TekaTeki/`)

Latihan taktik dengan soal dari data lokal. Tata letak dan aturan main diadopsi
dari layar **Puzzle** [En Croissant](https://github.com/franciscoBSalgueiro/en-croissant)
(GPL-3.0), lalu **ditulis ulang** untuk repo ini (MIT) — tidak ada kode sumber
yang disalin.

```
src/halaman/TekaTeki/
├── TekaTeki.jsx                  # entry layar: papan kiri, panel + daftar langkah kanan
├── README.md                     # berkas ini
├── komponen/
│   ├── papanTekaTeki.jsx         # pembungkus: terpilih/sasaran/promosi/tanda → sesi
│   ├── papanInteraktif.jsx       # papan drag/klik adopsi ChessClub (bidak hantu, pointer capture)
│   ├── dialogPromosi.jsx         # pilih bidak promosi (wajib) saat pion ke baris akhir
│   ├── panelTekaTeki.jsx         # sumber + sampah + gigi, 4 kartu statistik, aksi, petunjuk/solusi
│   ├── pengaturanTekaTeki.jsx    # pengaturan latihan DI DALAM layar (buka/tutup)
│   ├── rentangRating.jsx         # slider dua-thumb rentang rating (scrub+keyboard)
│   ├── sakelarRingkas.jsx        # sakelar 38x20 gaya Mantine untuk grid 2x2
│   └── riwayatLangkah.jsx        # daftar langkah SAN + navigasi << < > >>
└── logika/
    ├── useSesiTekaTeki.js        # orkestrasi sesi (memuat, menilai, statistik)
    ├── usePreferensiTekaTeki.js  # preferensi milik fitur (bukan config umum)
    ├── useUkuranPapan.js         # papan persegi mengikuti wadah
    ├── jejakLangkah.js           # posisi + SAN dari awal s.d. indeks dimainkan
    ├── tandaBantu.js             # toggle mark petak + panah (klik kanan, ala chess.com)
    └── pgnDariSoal.js            # PGN untuk "Analisa posisi ini"
```

## Papan interaktif (adopsi ChessClub)

Papan teka-teki memakai papan interaktif sendiri (`papanInteraktif.jsx`),
diadopsi dari **ChessClub** `src/halaman/TekaTeki/PapanTekaTeki.jsx` dan
disambungkan ke aset Maestro (PieceSVG, boardThemes, urlBidak, animasiBidak):

- **Seret**: bidak hantu mengikuti kursor lewat transform DOM langsung (tanpa
  re-render → tanpa lag), `setPointerCapture` pada akar papan, slop **5px** untuk
  membedakan klik dari seret, `select-none` + `preventDefault` non-sentuh sehingga
  teks di sekitar papan tidak ikut terblok. **Klik kanan saat menyeret = batal**
  (bidak kembali ke asal).
- **Klik-untuk-jalan**: klik bidak → titik langkah sah; klik tujuan → main; klik
  ulang bidak terpilih → batal pilih. Klik "hantu" pasca-seret ditelan agar tidak
  dobel.
- **Tanda bantu**: klik kanan petak = mark; seret klik kanan = panah (Shift/Ctrl/
  Alt → merah/hijau/biru); klik kiri = hapus semua tanda.
- **Promosi**: pion ke baris akhir membuka dialog wajib pilih (menteri/benteng/
  gajah/kuda). **Luncuran** bidak saat FEN berganti memakai GESER_ISEPIC.

Pembungkus (`papanTekaTeki.jsx`) memiliki keadaan interaksi dan membaca tema/set
bidak/koordinat dari ConfigContext (Pengaturan umum); aturan main tetap di sesi.

## Tata letak (pola En Croissant)

| Wilayah | Isi |
| --- | --- |
| Kiri | Papan persegi, orientasi mengikuti pihak pemain |
| Kanan atas | Pemilih sumber + **sampah** (bersihkan sesi) + **gigi** (pengaturan buka/tutup di tempat), empat kartu statistik mono **Rating/Waktu/Akurasi/Rantai** (rantai berikon api), tema soal, toolbar (soal baru · analisa posisi · ulangi soal), tombol **Petunjuk** dan **Lihat solusi** |
| Kanan bawah | Kotak status (pesan + id soal), daftar langkah SAN yang bisa diklik untuk meninjau posisi, baris navigasi **« ‹ › »** |

Kolom kanan dapat digulir; meninjau langkah lama mengunci papan sampai kembali
ke langkah terakhir (live). Di layar sempit semuanya menumpuk vertikal.

**Pintu masuk hanya kartu "Teka-Teki" di beranda Papan** — tidak ada item di
bilah nav kiri, persis En Croissant yang membuka puzzle dari beranda, bukan
menaruhnya sebagai menu terpisah.

Begitu dibuka, layar ini menempati **tab bernama "Teka-Teki" di bilah tab atas**
dan bilah itu tetap tampil (lihat `tampilkanBilahTab` di `areaKerja.jsx`). Tidak
ada kepala "Teka-teki / Latih taktik dengan soal dari basis data lokal." di dalam
layar: nama fitur cukup dibaca dari tab, sehingga papan dan panel latihan langsung
mendapat ruang penuh.

## Aturan main

Semua aturan tinggal di modul bersama **`src/modul/tekaTeki/`** (lihat README-nya);
hook di fitur ini hanya mengatur state:

1. langkah pembuka lawan dimainkan otomatis, pemain membalas;
2. langkah benar → balasan lawan otomatis; langkah terakhir → soal selesai;
3. langkah salah tidak memajukan posisi dan menandai soal salah, tetapi latihan
   tetap bisa dilanjutkan sampai jalur selesai; papan terkunci hanya bila soal
   sudah benar atau jalurnya dituntaskan;
4. petunjuk bertingkat petak → panah → hapus, dan menandai soal salah;
5. lihat solusi memutar ulang solusi (jeda 450 ms/langkah) dan menandai salah;
6. waktu berhenti pada tanda pertama (benar/salah); rating dan tema soal
   terbuka begitu soal ditandai;
7. mode progresif menaikkan rentang rating dari rating soal terakhir; lompat
   cepat membuka soal berikutnya begitu jalur selesai (benar maupun salah);
   waktu dicatat bila diminta.

## Preferensi (milik fitur, bukan pengaturan umum)

Preferensi latihan mengatur **sifat kerja sesi teka-teki itu sendiri**, jadi ia
bersifat personal untuk fitur ini — berbeda dari warna papan / set bidak /
tampilan yang bersifat umum dan tinggal di layar Pengaturan "satu pintu".
Karena itu preferensi ini **disimpan dan disunting di dalam layar teka-teki**:
tombol gigi di kepala panel membuka panel pengaturan (pola En Croissant).

- `usePreferensiTekaTeki.js` membaca/menulis lewat fasad penyimpanan sesi
  (`bacaAngka/bacaTeks/bacaBoolean/tulis/tulisBoolean`), bukan config bersama.
- Isi: rentang rating dua-thumb (600–2800, bawaan 1000–1500, dinonaktifkan saat
  progresif), tema, progresif, sembunyikan rating, langsung ke soal berikutnya,
  dan catat waktu.
- Katalog `katalogPengaturan.js` dan layar Pengaturan umum **tidak** memuat
  baris/grup/tab teka-teki.

## Titik sambung

- **Papan**: `src/halaman/Analisa/komponen/game/board.jsx` dipakai ulang; papan
  memanggil `analyzeMove(fen, langkah)` yang diteruskan ke sesi untuk dinilai.
- **Analisa posisi**: `pgnDariSoal()` menghasilkan PGN ber-header FEN, lalu
  `areaKerja` memuatnya lewat `muatPartai` (papan Analisa terbuka).
- **Terjemahan**: rak sendiri `src/lib/terjemahan/{id,en}/tekaTeki.js`, kunci
  `tekaTeki.*`. Kartu beranda memakai `analisa.papan.kartu.puzzle.*`.
- **Beranda Papan**: `layarPapan.jsx` meneruskan `onTekaTeki` yang membuka layar
  ini; satu-satunya pintu masuk fitur.

## Tahap

- **Tahap 1** (selesai): modul bersama + tes.
- **Tahap 2** (selesai): layar, panel, riwayat, i18n, tes.
- **Tahap 2b** (selesai): pengaturan latihan dipindah ke dalam layar (tombol
  gigi), item nav dihapus, preferensi jadi milik fitur; pintu masuk cukup kartu
  beranda Papan.
- **Tahap 2c** (selesai): tata letak diselaraskan dengan mockup "En Croissant
  Replica" — empat kartu statistik mono (rantai berikon api), grid 2x2 sakelar
  ringkas, toolbar aksi, kotak status + daftar langkah SAN dengan navigasi
  « ‹ › » (menggantikan keping riwayat sesi).
- **Tahap 2d** (selesai): papan drag/klik diadopsi dari **ChessClub**
  (`papanInteraktif.jsx`) — bidak hantu, pointer capture, slop 5px, klik-untuk-
  jalan + titik langkah sah, klik-kanan batal seret, tanda bantu, dialog promosi,
  luncuran bidak; menggantikan papan Analisa yang sebelumnya dipakai ulang.
- **Tahap 2e** (selesai): nama fitur tampil sebagai **tab di bilah tab atas**
  (`Teka-Teki`), sama seperti fitur Papan lain (Impor Permainan, Deteksi Engine,
  Wawasan). Kepala penjelasan di dalam layar dihapus — pemain sudah paham main,
  jadi cukup tab; judul tetap ada sebagai `h1 sr-only` untuk pembaca layar.
  Kunjungan fitur kini dicatat ke "File Terbaru" (`FITUR_DICATAT`).
- **Tahap 3** (rencana): pemilih tahun untuk soal harian, penanda video, penyaring
  tema dari data aktif, dan penyimpanan sesi antar kunjungan.

Tes: `tests/teka-teki-modul.test.mjs` (logika) dan `tests/teka-teki-layar.test.mjs`
(sesi, pengaturan, pemasangan, paritas kamus).
