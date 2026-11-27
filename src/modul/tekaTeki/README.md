# Modul `tekaTeki` — fondasi fitur teka-teki

Logika bersama untuk fitur teka-teki: bentuk baku soal, pemilihan, penilaian
langkah, statistik sesi, dan pemuat data. **Tanpa React/JSX/DOM**, sehingga bisa
dipinjam layar mana pun lewat satu fasad `index.js` (ekspor dikunci tes batas).

```
src/modul/tekaTeki/
├── index.js     # fasad publik (24 ekspor, dikunci tes)
├── soal.js      # parse langkah + normalisasi tiga sumber data
├── pemilih.js   # saring rating/tema, progresif, pilih soal acak teruji
├── penilai.js   # benar/salah/skakmat, balasan otomatis, petunjuk bertingkat
├── sesi.js      # akurasi, streak, rata-rata waktu, format waktu
└── pemuat.js    # fetch malas per sumber + cache janji (gagal tidak di-cache)
```

Tes: `tests/teka-teki-modul.test.mjs` (14 tes, termasuk replay 120 soal nyata
sampai skakmat dan uji cache pemuat dengan `fetch` tiruan).

## Sumber data

Berkas di `public/data/` (skema lengkap: `public/data/README.md`):

| Jenis | Berkas | Isi |
| --- | --- | --- |
| `skakmat` | `teka-teki.json` | 5.486 soal (Lichess, CC0) |
| `video` | `teka-teki-video.json` | 6.551 soal, 1.681 bertautan video |
| `harian` | `teka-teki-harian/<tahun>.json` | 7.097 soal 2007–2026 |

Semua langkah disimpan sebagai pasangan koordinat `c4-c8;b7-c8` (promosi
`f2-f1q`). `parseLangkah` mengubahnya sekali menjadi langkah chess.js; lapisan
UI tidak perlu tahu format berkas.

## Aturan main (diadopsi dari En Croissant)

Perilaku layar puzzle [En Croissant](https://github.com/franciscoBSalgueiro/en-croissant)
(GPL-3.0) diadopsi sebagai **aturan dan tata letak**, lalu **ditulis ulang** untuk
susunan kode repo ini (MIT) — tidak ada kode sumber yang disalin.

| Perilaku sumber | Padanan di modul ini |
| --- | --- |
| Langkah pertama solusi adalah langkah lawan | `posisiAwalPemain()` memainkannya; `pihakPemain()` = kebalikan giliran FEN |
| Langkah benar → balasan lawan otomatis | `nilaiLangkah().balasan` |
| Skakmat alternatif tetap dianggap benar | `nilaiLangkah()` menerima `isCheckmate()` |
| Langkah salah tidak memajukan posisi | `nilaiLangkah().benar === false` (UI membatalkan langkah) |
| Langkah ilegal ≠ salah | `nilaiLangkah().sah === false` |
| Petunjuk bertingkat: petak → panah → hapus | `petunjukBerikutnya()` |
| Rentang rating 600–2800, bawaan 1000–1500 | `RENTANG_RATING` |
| Mode progresif: `[rating+50, rating+100]` | `rentangProgresif()` |
| Tema opsional ("semua tema") | `saringSoal({tema})`, `daftarTema()` |
| Akurasi, streak dari ekor, rata-rata waktu soal benar | `hitungStatistik()` |

## Tahap pembangunan

- **Tahap 1 (selesai):** modul bersama ini + tes.
- **Tahap 2 (berikutnya):** layar `src/halaman/TekaTeki/` — papan di kiri,
  panel kanan atas (pemilih sumber, gigi pengaturan, kartu Rating/Waktu/
  Akurasi/Streak/Rata-rata, tombol Petunjuk & Lihat solusi), kanan bawah
  (riwayat sesi + notasi langkah). Pengaturan masuk katalog "satu pintu".
- **Tahap 3:** tema/video/harian, lompat ke analisa posisi (jalur titipan PGN
  `src/modul/sesi/titipan.js`), dan preferensi lanjutan.

Catatan lisensi: mengadopsi **ide/perilaku** tidak menyalin karya GPL. Bila nanti
menyalin berkas (suara, gambar, kode) dari En Croissant, lisensi dan atribusinya
harus dibahas lebih dulu — repo ini MIT.
