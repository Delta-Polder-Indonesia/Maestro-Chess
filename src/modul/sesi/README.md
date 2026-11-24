# Modul Sesi — Tab Kerja dan preferensi

Modul ini bagian dari modular monolith, bukan layanan terpisah. Cakupannya saat ini adalah model/provider Tab Kerja serta penyimpanan pengaturan, daftar tema papan, context dan provider konfigurasi Analisa. Konteks, komponen, dan bagian Sesi lainnya belum dipindahkan.

## API dan kompatibilitas

- `src/modul/sesi/index.js` adalah fasad utama: ia mengekspor API model, `TabKerjaProvider`, `useTabKerja`, seluruh API preferensi, dan `ConfigContextProvider` bernama.
- `src/modul/sesi/model.js` adalah fasad model tanpa JSX. `src/modul/sesi/preferensi.js` adalah fasad preferensi tanpa JSX: ia mengekspor `bacaAngka`, `bacaBoolean`, `bacaTeks`, `cobaBacaTeks`, `tulis`, `tulisBoolean`, `boardThemes`, `ConfigContext` dan `defaultUsedRatings`. Entry ini dapat diimpor Node tanpa loader JSX; `ConfigContext` tetap menggunakan React.
- Pemanggil aplikasi menggunakan fasad utama untuk provider/Tab Kerja dan fasad preferensi untuk API preferensi yang tidak memerlukan JSX. Path lama `src/halaman/Analisa/tabKerja.js`, `konteks/tabKerja.jsx`, `penyimpanan.js`, `komponen/pengaturan/boardThemes.js`, `konteks/configKonteks.js`, dan `konteks/config.jsx` tetap ada sebagai re-export kompatibilitas. Keempat shim preferensi meneruskan langsung ke implementasi pindahan yang sama agar tidak memuat dependensi fitur lain; `config.jsx` mempertahankan ekspor default provider.
- Tidak ada implementasi atau context kedua: fasad dan path lama melihat identitas fungsi, `ConfigContext`, array `boardThemes`, objek `defaultUsedRatings`, provider dan hook yang sama dalam satu registry modul. State tetap terpisah untuk setiap instance provider, bukan singleton global.
- Dependensi eksternal modul tetap `react`, fasad Pekerjaan, helper titipan PGN, dan dua konteks Analisa (`analyzeKonteks.js` serta `boardKonteks.js`). Hubungan Tab Kerja ke konteks Analisa adalah coupling lama yang masih ada; penyederhanaannya memerlukan tahap terpisah. Implementasi preferensi tidak bergantung pada fitur lain di luar Sesi.

## Kontrak Tab Kerja

- Kunci `sessionStorage` tetap `maestro-analisa-tab-v1`; envelope JSON tetap `{ versi: 1, daftar, aktifId }`. Pembaca memeriksa versi dan ID aktif, menyaring ID/layar yang tidak sah serta duplikat, menormalkan akun dan penunjuk laporan/draf, dan memulihkan tujuan papan sesi lama seperti sebelumnya.
- Penulis menserialisasi objek tab yang diberikan apa adanya di dalam `daftar`; ia **tidak** menyaring field ekstra pada objek tersebut. Pembaca kemudian hanya memproyeksikan field yang dikenal. Perilaku ini dikarakterisasi dan dipertahankan, bukan jaminan bahwa setiap objek input hanya berisi penunjuk.
- Saat ada sesi tersimpan, penulisan ditunda sampai pemulihan selesai. Jika ada PGN titipan, tab baru ditambahkan dengan pilihan akun tab aktif tanpa menghapus PGN titipan. Pilihan akun dan penunjuk tab tetap terpisah; penghapusan akun bersama membersihkan pilihan yang cocok.
- `siapkanImpor` menginisialisasi Pekerjaan, memakai penunjuk draf pilihan atau fallback lama, dan membuat ID lain bila fallback sedang dipakai tab lain. Permintaan `bukaImpor` yang tidak lagi sesuai navigasi tidak membuka layar setelah inisialisasi selesai; kegagalan inisialisasi tetap diteruskan ke pemanggil.
- Jika penyimpanan tidak tersedia, sesi tetap dapat digunakan di memori dan status ketersediaan mencerminkan kegagalan. Kegagalan penyimpanan tidak menjamin data tersimpan; percobaan berikutnya terjadi saat state sesi berubah. Tidak ada sinkronisasi baru antar-tab browser.
- `perbaruiTab` mempertahankan identitas objek lama bila field yang dibandingkannya tidak berubah, termasuk jika hanya field ekstra yang diberikan. Ini perilaku lama, bukan perbaikan validasi.

## Kontrak preferensi

- Pengaturan menggunakan `localStorage` dengan awalan `maestro-analisa-`. `bacaTeks` tetap membaca kunci lama yang dikenal sebagai fallback bila kunci baru tidak ada, tanpa menulis ulang atau menghapusnya. Khusus `usedRatings` lama yang berisi 11 bit, bit ketiga digandakan saat dibaca; nilai pada kunci baru tidak dikonversi.
- `cobaBacaTeks` hanya memeriksa kunci baru dan membedakan nilai yang tidak ada dari kegagalan akses. Pembacaan angka, boolean, konversi string, nilai bawaan dan pelaporan kegagalan penyimpanan tetap seperti sebelumnya; `tulisBoolean` tetap tidak mengembalikan hasil `tulis`.
- Urutan/nilai tema dan rating, objek rating bawaan yang dapat dimutasi, serta identitas context dipertahankan. Provider membaca preferensi ketika di-mount; setter hanya mengubah state provider, sedangkan penyimpanan perubahan dilakukan oleh komponen yang sudah bertanggung jawab. Remount membaca nilai tersimpan lagi.

## Pengujian

Tes karakterisasi `tests/analisa-sesi-*-karakterisasi.test.mjs` dijalankan terhadap implementasi asli sebelum pemindahan dan tetap menguji path kompatibilitas. `tests/analisa-sesi-batas.test.mjs` dan `tests/analisa-sesi-preferensi-batas.test.mjs` memeriksa ekspor, identitas, batas dependensi dan pemanggil; tes siklus memeriksa graf source seluruh aplikasi. Pengujian provider memakai React Test Renderer, transpile JSX dan storage/Pekerjaan tiruan; itu bukan pengujian browser atau data pengguna nyata.
