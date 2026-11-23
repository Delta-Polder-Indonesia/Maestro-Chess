# Analisa Maestro Chess

Halaman ini mengadaptasi UI dan logika Analisa dari [ChessClub](https://github.com/Delta-Polder-Indonesia/ChessClub) (revisi `7871f2415ab60c78765f358bc6d44df003456883`) menjadi aplikasi Next.js mandiri. ChessClub sendiri menyertakan kode dari Brilliant-Chess dan ChessGameReviewer. Sumber, hak cipta, lisensi, serta tautan kode sumber Stockfish tercantum di [ATTRIBUTIONS](../../../ATTRIBUTIONS) dan `public/licenses/`.

## Struktur

- `Analisa.jsx`, `analisa.css`, `komponen/`: papan, laporan, navigasi, impor, akun, database, pengaturan, deteksi engine, dan wawasan.
- `konteks/`: state papan, preferensi dan masa hidup engine. Papan tetap terpasang ketika layar navigasi berubah.
- `mesin/`: parser PGN/FEN, klasifikasi langkah, perhitungan ringkasan dan wawasan, serta adaptor UCI.
- `database/`, `basisData.js`, `akun/`: IndexedDB, fallback, koleksi, statistik, dan pengambilan partai akun publik.
- `penyimpanan.js`: pembacaan/tulis preferensi aman di bawah awalan `maestro-analisa-`; pengaturan Maestro lama dibaca sebagai fallback tanpa dihapus.
- `src/lib/engineCatur.js`: enam worker UCI Stockfish single-thread di `public/engine/`, dimuat saat diperlukan. Stockfish 16 menggunakan jaringan `nn-5af11540bbfe.nnue`; lima pilihan lain menggunakan build Lite. Stockfish 18 Lite dan Stockfish 18 Lite (JS 18.0.8) memakai WASM yang identik, tetapi pemuat JavaScript berbeda. Pilihan engine disimpan di peramban, dengan Stockfish 18 Lite sebagai bawaan.
- `src/lib/asets.js`: URL aset yang menghormati `NEXT_PUBLIC_BASE_PATH`; buku pembukaan di `public/data/`, suara Lichess di `public/sounds/`.

## Perilaku penting

- Analisis PGN menggunakan partai pertama; seluruh partai yang valid dalam PGN multi-partai juga disimpan ke koleksi impor lokal. FEN membuka satu posisi. Perubahan bahasa/suara tidak boleh mengulang analisis; perubahan data atau kedalaman memang memulainya lagi.
- Kedalaman default 13, rentang 6–20. Pencarian MultiPV dan pemindaian banyak partai dapat lambat pada perangkat kecil. Engine hanya menggunakan satu thread.
- Setiap pencarian membawa `AbortSignal`. Analisis yang dibatalkan atau digantikan tidak boleh menimpa hasil partai yang lebih baru; kegagalan worker ditampilkan sebagai galat, bukan disamakan dengan pembatalan.
- Evaluasi UCI dinyatakan relatif terhadap pihak yang mendapat giliran. `mesin/penilaian.js` dan adaptor analisis menangani konversi untuk tampilan.
- Hasil PGN `*` atau yang tidak diketahui disimpan sebagai `unknown`, bukan remis. Partai lama yang sudah pernah disimpan sebagai remis tidak otomatis diubah.
- Tanggal impor diambil dari `UTCDate` atau `Date` PGN yang lengkap dan sah, bukan tanggal impor. Tanggal tak lengkap/tak sah ditampilkan sebagai tidak diketahui. Migrasi memperbaiki tanggal impor lama tanpa mengganti ID-nya.
- Ringkasan Database mencari, mengurutkan dan membagi halaman dari seluruh koleksi; pencarian juga memeriksa isi PGN, bukan hanya metadata.
- Setiap tab Papan mengingat beranda atau laporan terakhir saat membuka fitur lain. Navigasi Papan mengembalikan tab tersebut; jika beranda diminta saat laporan sedang terbuka, gunakan tab beranda terpisah agar laporan tidak tertimpa. Penunjuk tab disimpan dalam sesi peramban, sedangkan snapshot laporan dipulihkan dari penyimpanan pekerjaan bila tersedia.
- Papan mendukung seret sentuh dan dua ketuk. Dengan keyboard, Tab memfokuskan papan, tombol panah berpindah petak, Enter/Spasi memilih atau melangkah, dan Escape membatalkan pilihan atau promosi. Langkah manual pada FEN dapat dimundurkan sampai posisi awal dan dimainkan kembali; membuat langkah baru mengganti kelanjutan lama.
- IndexedDB menggunakan `maestro_chess_database_v1`. Data tetap lokal sampai dihapus oleh pengguna atau peramban; fallback localStorage menyimpan satu snapshot atomik tanpa batas 100 partai dan dipulihkan saat IndexedDB tersedia lagi. Jika kuota/izin gagal atau Web Locks tidak tersedia, perubahan fallback hanya ada di memori tab dan ditampilkan sebagai belum tersimpan permanen.
- Penghapusan akun dikoordinasikan antar-tab menggunakan Web Locks dan memerlukan peramban yang mendukungnya dalam konteks aman (HTTPS atau localhost). Jika koordinasi atau salah satu tahap penyimpanan gagal, penghapusan dilaporkan belum selesai; sebagian data mungkin sudah terhapus, sehingga pengguna dapat mencoba lagi.
- Permintaan akun dan profil dilakukan langsung dari peramban ke API publik masing-masing. Fitur tersebut memerlukan koneksi, CORS dan ketersediaan layanan. Jika sebagian arsip Chess.com gagal, partai yang berhasil tetap disimpan dan aplikasi menampilkan jumlah serta bulan arsip yang gagal.
- Deteksi engine bersifat indikatif, bukan penetapan kecurangan.

Jalankan pemeriksaan proyek yang tercantum di [README utama](../../../README.md) sebelum mengubah atau merilisnya.
