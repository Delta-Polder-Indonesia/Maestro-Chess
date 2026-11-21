# Analisa Maestro Chess

Halaman ini mengadaptasi UI dan logika Analisa dari [ChessClub](https://github.com/Delta-Polder-Indonesia/ChessClub) (revisi `7871f2415ab60c78765f358bc6d44df003456883`) menjadi aplikasi Next.js mandiri. ChessClub sendiri menyertakan kode dari Brilliant-Chess dan ChessGameReviewer. Sumber, hak cipta, lisensi, serta tautan kode sumber Stockfish tercantum di [ATTRIBUTIONS](../../../ATTRIBUTIONS) dan `public/licenses/`.

## Struktur

- `Analisa.jsx`, `analisa.css`, `komponen/`: papan, laporan, navigasi, impor, akun, database, pengaturan, deteksi engine, dan wawasan.
- `konteks/`: state papan, preferensi dan masa hidup engine. Papan tetap terpasang ketika layar navigasi berubah.
- `mesin/`: parser PGN/FEN, klasifikasi langkah, perhitungan ringkasan dan wawasan, serta adaptor UCI.
- `database/`, `basisData.js`, `akun/`: IndexedDB, fallback, koleksi, statistik, dan pengambilan partai akun publik.
- `penyimpanan.js`: pembacaan/tulis preferensi aman di bawah awalan `maestro-analisa-`; pengaturan Maestro lama dibaca sebagai fallback tanpa dihapus.
- `src/lib/engineCatur.js`: worker UCI yang dimuat secara malas. Satu-satunya build adalah Stockfish 18 Lite single-thread di `public/engine/`.
- `src/lib/asets.js`: URL aset yang menghormati `NEXT_PUBLIC_BASE_PATH`; buku pembukaan di `public/data/`, suara Lichess di `public/sounds/`.

## Perilaku penting

- Analisis PGN menggunakan partai pertama; seluruh partai yang valid dalam PGN multi-partai juga disimpan ke koleksi impor lokal. FEN membuka satu posisi. Perubahan bahasa/suara tidak boleh mengulang analisis; perubahan data atau kedalaman memang memulainya lagi.
- Kedalaman default 13, rentang 6–20. Pencarian MultiPV dan pemindaian banyak partai dapat lambat pada perangkat kecil. Engine hanya menggunakan satu thread.
- Setiap pencarian membawa `AbortSignal`. Analisis yang dibatalkan atau digantikan tidak boleh menimpa hasil partai yang lebih baru; kegagalan worker ditampilkan sebagai galat, bukan disamakan dengan pembatalan.
- Evaluasi UCI dinyatakan relatif terhadap pihak yang mendapat giliran. `mesin/penilaian.js` dan adaptor analisis menangani konversi untuk tampilan.
- Hasil PGN `*` atau yang tidak diketahui disimpan sebagai `unknown`, bukan remis. Partai lama yang sudah pernah disimpan sebagai remis tidak otomatis diubah.
- IndexedDB menggunakan `maestro_chess_database_v1`. Data tetap lokal sampai dihapus oleh pengguna atau peramban; fallback localStorage menyimpan maksimal 100 partai terbaru.
- Permintaan akun dan profil dilakukan langsung dari peramban ke API publik masing-masing. Fitur tersebut memerlukan koneksi, CORS dan ketersediaan layanan.
- Deteksi engine bersifat indikatif, bukan penetapan kecurangan.

Jalankan pemeriksaan proyek yang tercantum di [README utama](../../../README.md) sebelum mengubah atau merilisnya.
