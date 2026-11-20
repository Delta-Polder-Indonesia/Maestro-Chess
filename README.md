# Maestro Chess

Maestro Chess membantu kamu menemukan langkah yang mengubah jalannya partai catur. Masukkan notasi partai dalam format PGN atau pilih partai dari Chess.com atau Lichess. Setelah Stockfish selesai menganalisis, telusuri langkah di papan sambil melihat perubahan evaluasinya di grafik.

## Menjalankan di komputer sendiri

Siapkan Git, Node.js, dan npm, lalu jalankan:

```sh
git clone https://github.com/Delta-Polder-Indonesia/Maestro-Chess.git
cd Maestro-Chess
cp .env.example .env
npm ci
npm run dev
```

Buka <http://localhost:3000>. Untuk pengembangan lokal, biarkan `NEXT_PUBLIC_BASE_PATH` kosong seperti pada `.env.example`.

## Pemeriksaan sebelum merge

GitHub Actions menjalankan CI pada setiap push dan pull request. CI juga dapat dijalankan secara manual dari tab Actions. Job terpisah memeriksa ESLint dan TypeScript, build produksi beserta kelengkapan hasil ekspor statis, serta keamanan dependensi. Tidak diperlukan secret untuk pemeriksaan ini.

Untuk mengulangi pemeriksaan secara lokal, gunakan Node.js 22 dan `.env` seperti pada langkah instalasi:

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

Peringatan ESLint membuat pemeriksaan lint gagal. File hasil build dan Stockfish pihak ketiga tidak ikut dilint. `npm test` menguji konfigurasi base path saat variabel tidak disetel, kosong, maupun berisi subpath. CI menjalankan build tanpa menyetel `NEXT_PUBLIC_BASE_PATH`, seperti konfigurasi root bawaan. `test:build` memeriksa halaman, URL aset yang tidak valid, aset Next.js, data opening, serta file engine Stockfish yang diperlukan di `dist/`. `test:vercel` memeriksa konfigurasi dan manifest build Next.js di `.next/`. Build memerlukan akses ke Google Fonts untuk mengunduh Roboto.

Audit berjalan terpisah dari build dan gagal jika npm menemukan kerentanan **high** atau **critical**, termasuk pada dependensi pengembangan. Versi PostCSS bawaan Next.js ditimpa dengan versi 8 yang lebih baru untuk mengatasi kerentanan; tinjau kembali override tersebut saat memperbarui Next.js.

## Menerbitkan situs

Jika situs akan diakses di subpath seperti `/Maestro-Chess/`, isi `NEXT_PUBLIC_BASE_PATH=/Maestro-Chess` di `.env` sebelum menjalankan `npm run build`. Jika situs berada di root domain, biarkan nilainya kosong atau tidak disetel. Unggah isi folder `dist/` hasil build ke hosting statis.

Untuk deployment Vercel, `vercel.json` mengatur deteksi otomatis Output Directory. Jangan mengarahkan builder Next.js ke `dist`: folder tersebut berisi situs statis, sedangkan manifest build yang dibutuhkan Vercel berada di `.next/`.

Karena menggunakan `output: "export"`, aturan HTTP header di `next.config.ts` tidak diterapkan secara otomatis pada hasil ekspor; konfigurasi header harus diatur pada hosting statis.

## Lisensi dan kredit

Lisensi MIT dan pemberitahuan hak cipta tersedia di [LICENSE](LICENSE). Kredit serta lisensi untuk gambar bidak, suara papan, dan Stockfish.js tercantum di [ATTRIBUTIONS](ATTRIBUTIONS).
