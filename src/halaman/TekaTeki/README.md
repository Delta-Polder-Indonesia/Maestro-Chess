# Fitur Teka-teki (`src/halaman/TekaTeki/`)

Latihan taktik dengan soal dari data lokal. Tata letak dan aturan main diadopsi
dari layar **Puzzle** [En Croissant](https://github.com/franciscoBSalgueiro/en-croissant)
(GPL-3.0), lalu **ditulis ulang** untuk repo ini (MIT) — tidak ada kode sumber
yang disalin.

```
src/halaman/TekaTeki/
├── TekaTeki.jsx                  # entry layar: tata letak tiga wilayah
├── README.md                     # berkas ini
├── komponen/
│   ├── papanTekaTeki.jsx         # memakai ulang papan Analisa + panah petunjuk
│   ├── panelTekaTeki.jsx         # sumber, kartu statistik, aksi, petunjuk/solusi
│   └── riwayatSesi.jsx           # keping riwayat sesi (benar/salah/belum)
└── logika/
    ├── useSesiTekaTeki.js        # orkestrasi sesi (memuat, menilai, statistik)
    ├── useUkuranPapan.js         # papan persegi mengikuti wadah
    └── pgnDariSoal.js            # PGN untuk "Analisa posisi ini"
```

## Tata letak (pola En Croissant)

| Wilayah | Isi |
| --- | --- |
| Kiri | Papan, orientasi mengikuti pihak pemain |
| Kanan atas | Pemilih sumber, kartu Rating/Waktu/Akurasi/Rantai/Rata-rata, tema soal, indikator giliran, aksi (soal baru · analisa posisi · bersihkan sesi), tombol **Petunjuk** dan **Lihat solusi** |
| Kanan bawah | Riwayat sesi; klik keping membuka soal itu lagi |

Di layar sempit ketiganya menumpuk vertikal.

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

## Preferensi

Disimpan di config bersama `src/modul/sesi/` dan disunting lewat layar
**Pengaturan → Teka-teki** (grup `tekaTeki`, enam baris di katalog satu pintu):
rentang rating (600–2800, bawaan 1000–1500), tema, progresif, sembunyikan rating,
langsung ke soal berikutnya, dan catat waktu.

## Titik sambung

- **Papan**: `src/halaman/Analisa/komponen/game/board.jsx` dipakai ulang; papan
  memanggil `analyzeMove(fen, langkah)` yang diteruskan ke sesi untuk dinilai.
- **Analisa posisi**: `pgnDariSoal()` menghasilkan PGN ber-header FEN, lalu
  `areaKerja` memuatnya lewat `muatPartai` (papan Analisa terbuka).
- **Terjemahan**: rak sendiri `src/lib/terjemahan/{id,en}/tekaTeki.js`, kunci
  `tekaTeki.*`; label nav memakai `analisa.nav.tekaTeki`.

## Tahap

- **Tahap 1** (selesai): modul bersama + tes.
- **Tahap 2** (selesai): layar, panel, riwayat, pengaturan, nav, i18n, tes.
- **Tahap 3** (rencana): pemilih tahun untuk soal harian, penanda video, penyaring
  tema dari data aktif, dan penyimpanan sesi antar kunjungan.

Tes: `tests/teka-teki-modul.test.mjs` (logika) dan `tests/teka-teki-layar.test.mjs`
(sesi, pengaturan, pemasangan, paritas kamus).
