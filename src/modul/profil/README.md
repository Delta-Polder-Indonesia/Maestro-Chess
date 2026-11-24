# Modul Profil

Modul ini mengelola pengambilan dan normalisasi profil publik Chess.com dan Lichess, cache profil, hook React, dan URL bendera lokal. Ia merupakan bagian dari satu aplikasi modular monolith, bukan layanan terpisah.

## Batas dan API

Pemanggil aplikasi menggunakan `@/modul/profil/index.js`, dengan ekspor bernama:

- `ambilKartuPemain(username, platform)` — membaca profil dari cache atau API.
- `segarkanKartuPemain(username, platform)` — membuang cache satu profil lalu mengambilnya lagi.
- `useKartuPemain(nama, aktif, platform)` — hook dengan nilai awal `undefined`, hasil kartu atau `null`.
- `urlBendera(kode)` — memvalidasi kode negara dan menyusun URL aset lokal.

`src/lib/pemainCatur.js` dan `src/lib/bendera.js` dipertahankan sebagai re-export kompatibilitas bagi pemanggil path lama; keduanya tidak memiliki implementasi atau cache sendiri. Seluruh entry point merujuk instance yang sama dalam satu konteks JavaScript. Map tidak menjadi bus lintas tab; localStorage tetap menggunakan prefiks `maestro-analisa-pemain-v2-`.

Dependensi keluar modul dibatasi pada React dan helper bersama `src/lib/asets.js`; tidak ada dependensi terhadap fitur lain. Helper tersebut menerapkan `NEXT_PUBLIC_BASE_PATH` pada URL di `public/flags/`. Modul tidak memiliki JSX atau class Tailwind.

## Kontrak yang sengaja dipertahankan

Pemindahan ini tidak mengubah perilaku: kegagalan profil dapat menyimpan `null` dalam cache memori tanpa retry otomatis, respons lama dapat menimpa hasil refresh baru, dan hook yang sudah mounted tidak berlangganan perubahan cache. Perilaku tersebut adalah karakterisasi saat ini, bukan perbaikan; perubahan kontraknya memerlukan keputusan tersendiri.

`tests/analisa-profil-karakterisasi.test.mjs` melindungi perilaku lama melalui path kompatibilitas. `tests/analisa-profil-batas.test.mjs` memeriksa identitas ekspor, cache bersama, batas dependensi dan pemanggil API; `tests/analisa-profil-integrasi.test.mjs` menjalankan modul Profil bersama komponen Akun/Wawasan/Papan dengan API dan browser tiruan. Pemeriksaan siklus seluruh source tetap berada pada `tests/analisa-siklus-database.test.mjs`.
