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

GitHub Actions menjalankan CI pada pull request ke `main` dan setiap push ke `main`. Untuk mengulangi pemeriksaan secara lokal, gunakan Node.js 22 dan `.env` seperti pada langkah instalasi:

```sh
npm ci
npm run lint
npm run typecheck
npm run build
npm audit --audit-level=high
```

Peringatan ESLint membuat pemeriksaan lint gagal. Build memerlukan akses ke Google Fonts untuk mengunduh Roboto. Audit berjalan terpisah dari build dan gagal jika npm menemukan kerentanan **high** atau **critical**, termasuk pada dependensi pengembangan.

## Menerbitkan situs

Jika situs akan diakses di subpath seperti `/Maestro-Chess/`, isi `NEXT_PUBLIC_BASE_PATH=/Maestro-Chess` di `.env` sebelum menjalankan `npm run build`. Jika situs berada di root domain, biarkan nilainya kosong. Unggah isi folder `dist/` hasil build ke hosting statis.

## Lisensi dan kredit

Lisensi MIT dan pemberitahuan hak cipta tersedia di [LICENSE](LICENSE). Kredit serta lisensi untuk gambar bidak, suara papan, dan Stockfish.js tercantum di [ATTRIBUTIONS](ATTRIBUTIONS).
