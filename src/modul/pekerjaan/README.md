# Modul Pekerjaan

Pekerjaan mengelola riwayat dan penyimpanan lokal laporan, draf impor, serta kunjungan fitur. Ini modul dalam satu aplikasi modular monolith, bukan layanan terpisah. Pemanggil aplikasi menggunakan `src/modul/pekerjaan/index.js` sebagai fasad publik.

## Kontrak dan dependensi

Fasad mempertahankan semua ekspor bernama dari empat path lama: `pekerjaan`, `buatAdapterPekerjaan`, `buatPenyimpananPekerjaan`, `ID_DRAF_IMPOR`, `buatIdPekerjaan`, `buatIdDrafImpor`, `sumberPekerjaan`, `judulPekerjaan`, `snapshotLaporanAman`, `simpanDrafImpor`, `daftarkanPembacaLaporan`, `simpanLaporanAktif`, `buatManajerLaporan`, `KUNCI_FITUR`, `catatFitur`, `daftarRiwayat`, dan `usePekerjaan`. Empat file lama di `src/halaman/Analisa/` adalah re-export kompatibilitas dengan identitas ekspor yang sama, bukan implementasi atau store tambahan.

Modul tidak mengimpor fitur lain atau helper lokal. Ia tetap menggunakan dependensi yang sudah ada: `react` untuk hook dan `chess.js` untuk validasi FEN. Instance `pekerjaan` adalah singleton per konteks JavaScript; factory tetap membuat adapter/store terpisah sesuai kontrak lama.

## Penyimpanan dan koordinasi

- Database IndexedDB tetap `maestro_chess_pekerjaan_v1` versi 1, dengan object store `daftar` dan `isi`, keduanya ber-`keyPath` `id`. Metadata dan isi ditulis/dihapus dalam satu transaksi; pointer `meta:laporan-aktif` dan `meta:draf-aktif` disimpan seperti sebelumnya.
- Antrean memiliki satu penulis per instance dan menggabungkan operasi tertunda berdasarkan ID. Operasi yang sudah aktif selesai lebih dahulu; perubahan atau hapus terbaru untuk suatu ID tidak menggantikan pekerjaan lain. Metadata dan isi di memori melindungi perubahan terbaru dari pembacaan lama.
- Manajer mencatat laporan berjalan, selesai, atau terputus dan mengabaikan callback untuk laporan lain atau yang sudah tidak berjalan. Pembatalan engine/`AbortController` tetap menjadi tanggung jawab pemanggil papan; modul ini tidak menambahkan executor atau mekanisme pembatalan baru.
- Kegagalan baca/tulis membuat status `tersedia` menjadi `false` dan mempertahankan salinan memori, bukan menjamin persistensi. Status ini tetap gagal pada instance tersebut; operasi tulis yang gagal tidak otomatis dicoba ulang. Data yang gagal dihapus dapat muncul kembali saat penyimpanan dibuka ulang. Record yang tidak ditemukan juga dicache sebagai `null` oleh instance yang membacanya.
- Instance/tab tidak menyinkronkan cache atau notifikasi antartab. Penyimpanan bersama tetap last-write-wins; membuka instance baru membaca kembali data yang telah tersimpan. Perilaku ini dipertahankan, bukan diubah pada modularisasi.

## Pengujian

Tes karakterisasi `tests/analisa-pekerjaan-*-karakterisasi.test.mjs` dijalankan pada implementasi asli sebelum pemindahan dan tetap menggunakan path kompatibilitas. Tes tersebut memakai fake IndexedDB, adapter tiruan, dan React Test Renderer—bukan browser atau data pengguna nyata. `tests/analisa-pekerjaan-batas.test.mjs` memeriksa fasad, identitas ekspor, singleton, dependensi, dan pemanggil; tes siklus berlaku untuk seluruh source.
