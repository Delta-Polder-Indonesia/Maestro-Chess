# Modul Sesi — Tab Kerja

Modul ini hanya mencakup model dan provider tab kerja Analisa, bukan seluruh konteks, preferensi, tema, atau komponen Sesi. Ia tetap bagian dari aplikasi modular monolith. Pemanggil aplikasi menggunakan `src/modul/sesi/index.js`, yang mengekspor seluruh API model serta `TabKerjaProvider` dan `useTabKerja`.

## Kompatibilitas dan batas

- `src/halaman/Analisa/tabKerja.js` tetap tersedia sebagai re-export model. Ia menuju fasad `src/modul/sesi/model.js` yang tidak mengimpor JSX, sehingga penggunaan model dari Node tanpa loader JSX tetap bekerja. Fasad utama juga mengekspor model yang sama; pemanggil aplikasi tetap memakai `index.js`.
- `src/halaman/Analisa/konteks/tabKerja.jsx` tetap tersedia sebagai re-export provider dan hook dari fasad utama. Tidak ada context atau implementasi kedua. Semua path melihat identitas fungsi dan React context yang sama dalam satu registry modul; state tab tetap terpisah untuk setiap instance provider, bukan singleton global.
- Dependensi yang sudah ada dipertahankan: `react`, fasad Pekerjaan, helper titipan PGN, dan dua konteks Analisa (`analyzeKonteks.js` serta `boardKonteks.js`). Hubungan provider ke konteks Analisa adalah coupling lama yang masih ada, bukan perpindahan konteks lain atau kontrak baru; penyederhanaannya memerlukan tahap terpisah. Model dan provider mengakses Pekerjaan melalui fasadnya.

## Kontrak sesi

- Kunci `sessionStorage` tetap `maestro-analisa-tab-v1`; envelope JSON tetap `{ versi: 1, daftar, aktifId }`. Pembaca memeriksa versi dan ID aktif, menyaring ID/layar yang tidak sah serta duplikat, menormalkan akun dan penunjuk laporan/draf, dan memulihkan tujuan papan sesi lama seperti sebelumnya.
- Penulis menserialisasi objek tab yang diberikan apa adanya di dalam `daftar`; ia **tidak** menyaring field ekstra pada objek tersebut. Pembaca kemudian hanya memproyeksikan field yang dikenal. Perilaku ini dikarakterisasi dan dipertahankan, bukan jaminan bahwa setiap objek input hanya berisi penunjuk.
- Saat ada sesi tersimpan, penulisan ditunda sampai pemulihan selesai. Jika ada PGN titipan, tab baru ditambahkan dengan pilihan akun tab aktif tanpa menghapus PGN titipan. Pilihan akun dan penunjuk tab tetap terpisah; penghapusan akun bersama membersihkan pilihan yang cocok.
- `siapkanImpor` menginisialisasi Pekerjaan, memakai penunjuk draf pilihan atau fallback lama, dan membuat ID lain bila fallback sedang dipakai tab lain. Permintaan `bukaImpor` yang tidak lagi sesuai navigasi tidak membuka layar setelah inisialisasi selesai; kegagalan inisialisasi tetap diteruskan ke pemanggil.
- Jika penyimpanan tidak tersedia, sesi tetap dapat digunakan di memori dan status ketersediaan mencerminkan kegagalan. Kegagalan penyimpanan tidak menjamin data tersimpan; percobaan berikutnya terjadi saat state sesi berubah. Tidak ada sinkronisasi baru antar-tab browser.
- `perbaruiTab` mempertahankan identitas objek lama bila field yang dibandingkannya tidak berubah, termasuk jika hanya field ekstra yang diberikan. Ini perilaku lama, bukan perbaikan validasi.

## Pengujian

Tes karakterisasi `tests/analisa-sesi-*-karakterisasi.test.mjs` dijalankan terhadap dua file asli sebelum pemindahan dan tetap menguji path kompatibilitas. `tests/analisa-sesi-batas.test.mjs` memeriksa ekspor, identitas context, batas dependensi dan pemanggil. Tes siklus memeriksa graf source seluruh aplikasi. Pengujian provider memakai React Test Renderer, transpile JSX dan storage/Pekerjaan tiruan; itu bukan pengujian browser atau data pengguna nyata.
