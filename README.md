# Maestro Chess

Maestro Chess adalah aplikasi analisa catur mandiri. Antarmukanya diadaptasi dari halaman Analisa ChessClub, tetapi berjalan sebagai situs tersendiri — tidak memerlukan situs ChessClub atau backend Maestro.

## Fitur

- Impor PGN, FEN, atau tautan partai publik Chess.com/Lichess; berkas PGN yang berisi beberapa partai disimpan seluruhnya, dengan partai pertama langsung dianalisis.
- Laporan langkah, grafik evaluasi, klasifikasi langkah, akurasi, saran engine, variasi di papan, dan ekspor.
- Akun publik, pengambilan partai, database lokal, wawasan pemain, dan peninjauan indikasi penggunaan engine. Indikasi tersebut **bukan bukti kecurangan** dan perlu ditinjau manusia.
- Pengaturan papan, suara, kedalaman, dan bahasa Indonesia/Inggris.

Aplikasi menyediakan enam pilihan worker single-thread: **Stockfish 16**, **Stockfish 16.1 Lite**, **Stockfish 17.1 Lite**, **Stockfish 18 Lite**, **Stockfish 18 Lite (JS 18.0.8)**, dan **Stockfish 19 Lite**. Pilihan terakhir untuk Stockfish 18 menggunakan pemuat dari paket stockfish.js 18.0.8, tetapi WASM mesinnya identik dengan Stockfish 18 Lite bawaan. Pilihan disimpan di peramban dan digunakan pada analisis berikutnya. Worker dan WASM lokal dimuat saat diperlukan. Stockfish 16 juga memuat jaringan NNUE lokal sekitar 38 MiB pada penggunaan pertama. SharedArrayBuffer dan header cross-origin isolation tidak diperlukan. Kedalaman bawaan adalah 13 (dapat diatur 6–20); kedalaman tinggi dan analisis banyak partai bisa memerlukan waktu lama, terutama di ponsel. Hasil dan klasifikasi dapat berbeda antarversi atau kedalaman.

PGN dan perhitungan engine tetap di peramban. Partai dan koleksi disimpan di IndexedDB, sedangkan pengaturan disimpan di localStorage; menghapus data situs juga menghapus data tersebut. Menghapus akun dari aplikasi, setelah konfirmasi, juga menghapus koleksi dan partai lokal akun itu, tetapi tidak menghapus akun di situs asal. Jika IndexedDB tidak tersedia, database memakai cadangan localStorage tanpa pemotongan pada 100 partai, tetapi tetap bergantung pada kuota dan izin peramban. Jika cadangan atau koordinasi antar-tab tidak tersedia, perubahan hanya berada di memori sementara dan aplikasi memberi peringatan. Pengaturan Maestro versi lama dibaca sebagai fallback tanpa menghapus data lamanya.

**File Terbaru** di halaman Papan menampilkan riwayat fitur yang dibuka; pilih baris untuk kembali ke fitur tersebut. Laporan beserta posisi, variasi dan panah terakhir, serta draf Impor (PGN, FEN, dan tautan) disimpan otomatis di IndexedDB terpisah. Kartu Report Analisa membuka laporan aktif, dan setelah impor berhasil formulir berikutnya dimulai dengan draf kosong tanpa menghapus draf lama. Laporan yang selesai dapat dibuka lagi tanpa menghitung ulang. Analisis atau pengambilan tautan yang terputus saat halaman ditutup harus dimulai lagi; jika analisis ulang terputus, hasil selesai sebelumnya tetap tersedia. Riwayat dan pekerjaan hanya tersimpan di browser dan perangkat tersebut, bukan sinkronisasi atau cadangan server, dan ikut hilang jika data situs dihapus. Hindari mengedit laporan yang sama di beberapa tab sekaligus: tulisan terakhir yang selesai dapat menimpa perubahan tab lain. Jika penyimpanan tidak tersedia atau penuh, aplikasi memberi peringatan dan sebagian perubahan hanya tersedia di memori tab; salin PGN/draf sebelum menutupnya.

Fitur akun, impor tautan, serta profil pemain memerlukan internet dan menghubungi API publik Chess.com atau Lichess langsung dari peramban. Nama pemain yang ditampilkan dalam laporan juga dapat dikirim ke API profil Chess.com untuk mencari avatar dan bendera. Ketersediaannya bergantung pada layanan, CORS, dan batas API masing-masing; aplikasi tidak meminta kata sandi akun.

## Menjalankan di komputer sendiri

Siapkan Git dan Node.js 22, lalu jalankan:

```sh
git clone https://github.com/Delta-Polder-Indonesia/Maestro-Chess.git
cd Maestro-Chess
cp .env.example .env
npm ci
npm run dev
```

Buka <http://localhost:3000>. Untuk pengembangan lokal, biarkan `NEXT_PUBLIC_BASE_PATH` kosong seperti pada `.env.example`. Font Geist tersedia sebagai dependensi lokal; build tidak perlu mengunduh Google Fonts.

## Pemeriksaan sebelum merge

GitHub Actions memeriksa lint, tipe, tes, build produksi, ekspor statis, metadata Vercel, dan audit dependensi. Untuk menjalankannya secara lokal:

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run test:build
npm run test:vercel
npm audit --include=dev --audit-level=high
```

Peringatan ESLint membuat pemeriksaan lint gagal. File hasil build dan Stockfish pihak ketiga tidak ikut dilint. `test:build` memeriksa halaman, aset, data pembukaan, worker engine, jaringan NNUE, dan berkas sumber/lisensinya di `dist/`. `test:vercel` memeriksa konfigurasi dan manifest Next.js di `.next/`.

`chess.js` dipatok pada rilis npm 1.1.0 untuk mempertahankan perilaku header PGN yang dipakai aplikasi. Rilis yang lebih baru menambahkan nilai header bawaan; tinjau kompatibilitasnya sebelum memperbarui versi tersebut. ESLint 9 masih ditandai deprecated, tetapi merupakan versi utama terbaru yang didukung oleh `eslint-config-next` 15 dan plugin yang dipakai. Audit mencakup dependensi pengembangan dan gagal jika ditemukan kerentanan **high** atau **critical**. Versi PostCSS bawaan Next.js ditimpa dengan versi 8 yang lebih baru; tinjau kembali override saat memperbarui Next.js.

## Menerbitkan situs

Jika situs diakses lewat subpath seperti `/Maestro-Chess/`, isi `NEXT_PUBLIC_BASE_PATH=/Maestro-Chess` sebelum `npm run build`. Jika situs berada di root domain, biarkan kosong atau tidak disetel. Unggah isi folder `dist/` ke hosting statis. Halaman diekspor sebagai direktori (`/attributions/`) agar dapat dibuka langsung tanpa aturan rewrite khusus. Seluruh aset aplikasi, buku, dan engine harus disajikan dari origin dan base path yang sama; hosting perlu melayani `.wasm` sebagai `application/wasm`.

Untuk Vercel, `vercel.json` mengatur deteksi otomatis Output Directory. Jangan mengarahkan builder Next.js ke `dist`: folder tersebut berisi situs statis, sedangkan manifest build yang dibutuhkan Vercel berada di `.next/`.

### Header keamanan dan hosting

Header keamanan (`Content-Security-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) dikonfigurasi di `vercel.json` dan **hanya diterapkan pada deployment Vercel** (produksi maupun preview). `Strict-Transport-Security` pada domain `*.vercel.app` diberikan oleh platform Vercel beserta HSTS preload list, bukan oleh `vercel.json`.

Hosting statis lain (mengunggah isi `dist/`, termasuk skrip `npm run deploy` ke GitHub Pages) **tidak otomatis memperoleh header tersebut**. GitHub Pages tidak dapat mengatur header respons kustom, sehingga proteksi CSP/header tidak hadir di sana; hosting statis lain harus mengonfigurasi header setara sendiri (mis. `_headers` pada Netlify/Cloudflare Pages atau `.htaccess` pada Apache) sesuai platform yang dipakai. Repositori ini tidak menyertakan file konfigurasi header untuk platform yang tidak digunakan. Jika kelak memakai hosting statis dengan dukungan header, salin kebijakan dari `vercel.json` ke mekanisme host tersebut dan pertahankan ketergantungan HSTS pada platform.

Subresource Integrity (SRI) SHA-384 disuntikkan ke HTML ekspor saat build untuk skrip/stylesheet awal (termasuk `dist/`), sehingga ikut terbawa ke hosting statis mana pun; chunk dinamis yang dimuat runtime webpack tidak dicakup. COEP belum diaktifkan (menunggu uji kompatibilitas browser). Verifier lokal `npm run test:build` memeriksa ekspor statis, termasuk kecocokan hash SRI serta ketiadaan inline script/style; `npm run test:vercel` memeriksa manifest build Vercel.

## Lisensi dan kredit

Lisensi MIT kode proyek tersedia di [LICENSE](LICENSE). Pemberitahuan ChessClub, Brilliant-Chess, ChessGameReviewer, Cburnett, Lichess, flag-icons, Geist, Montserrat, buku pembukaan, serta Stockfish ada di [ATTRIBUTIONS](ATTRIBUTIONS) dan halaman Atribusi di aplikasi. Lisensi pihak ketiga dan sumber Stockfish juga disertakan dalam `public/licenses/` dan `public/engine/source/` agar tersedia pada ekspor statis.
