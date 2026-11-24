# Catatan kelanjutan Maestro Chess

Catatan ini merangkum pekerjaan yang sudah selesai dan daftar hal yang masih perlu dipetakan. Tidak harus selesai dalam satu hari: pekerjaan dapat dilanjutkan perlahan, satu cakupan kecil yang disetujui setiap kali.

## Titik terakhir

- Repositori: [Delta-Polder-Indonesia/Maestro-Chess](https://github.com/Delta-Polder-Indonesia/Maestro-Chess).
- Branch kerja: `arena/8100c81e-maestro-chess`.
- [PR #15](https://github.com/Delta-Polder-Indonesia/Maestro-Chess/pull/15) masih **terbuka** dan belum di-merge ke `main`.
- Commit migrasi kode Tahap 12: `41169d190c9c88fc79162993402feb58c0a5cd4f`. Ringkasan PR sudah diperbarui sampai Tahap 12. Commit dokumentasi dapat menyusul; periksa `git log -1` dan head PR untuk SHA terbaru.
- Kode dan tes sampai Tahap 12 sudah di-commit dan di-push. **Tahap 13 belum dimulai dan cakupannya belum disetujui.**
- Catatan ini disimpan di branch kerja dan menjadi bagian dari PR saat branch dipush. Lima artefak audit yang disebut di bawah tetap untracked dan tidak disertakan dalam commit. Jangan mengandalkan file sementara di `/tmp` atau hasil build untuk sesi mendatang.

## Yang sudah dikerjakan

| Tahap | Cakupan yang selesai | Commit utama |
|---|---|---|
| 1 | Memisahkan bus revisi database untuk memutus siklus; perubahan PR #14 juga terintegrasi ke branch kerja. Ini **bukan** migrasi seluruh Koleksi. | `fc1e735`, `469d6a9` |
| 2 | Memodularisasi Profil: fungsi profil, cache dan bendera, dengan path kompatibilitas. | `54bf167` |
| 3 | Memodularisasi Pekerjaan: laporan, draf, riwayat dan singleton, dengan kontrak penyimpanan lama. | `358e2a3` → `277f350` |
| 4 | Sesi: model dan provider Tab Kerja. | `36240c0` → `e8868bc` |
| 5 | Sesi: preferensi, tema papan serta context/provider konfigurasi. | `d89c0ac` → `ba8d3bb` |
| 6 | Sesi: galat dan titipan PGN. | `d362a45` → `6b5a776` |
| 7 | Sesi: context dan provider impor. | `d741b90` → `70fa440` |
| 8 | Sesi: context panel aktif dan hook dropdown. | `987f807` → `38b3643` |
| 9 | Sesi: context, hook dan provider Board. | `a0d7b62` → `335f841` |
| 10 | Sesi: context dan provider Analyze. | `2d56491` → `3768c3f` |
| 11 | Sesi: `KonteksMesin` dan `useMesin`; provider Mesin tetap di path lama. | `f940855` → `9733ffc` |
| 12 | Fondasi Analisis: `EngineCatur`, daftar pilihan engine dan pemeriksaan WASM; path lama tetap kompatibel. | `c0d93ab` → `41169d1` |

Pada tabel, panah menunjukkan commit karakterisasi sebelum commit migrasi. Untuk Tahap 12, `EngineAnalisis` dan `MesinProvider` masih di lokasi lama; hanya impor fondasi engine-nya yang diarahkan ke fasad baru. Pemindahan context Board atau Impor ke Sesi **tidak berarti** seluruh fitur Papan atau Impor sudah dimodularisasi.

### Verifikasi terakhir pada Tahap 12

- Tes karakterisasi pada implementasi asli: **25/25**; suite sebelum migrasi: **524/524**. Setelah migrasi: **535/535** tes lokal, termasuk 11 tes batas baru.
- Lint, typecheck dan audit dependensi lulus; audit melaporkan **0 kerentanan**. Graf: **246 source / 583 edge**, tanpa siklus atau impor lokal yang tidak terpecahkan.
- Build root dan `/Maestro-Chess` serta kedua verifier **lokal** lulus. Hash **320 aset publik** cocok dengan baseline Git dan hasil ekspor.
- GitHub Actions pada SHA migrasi: [push](https://github.com/Delta-Polder-Indonesia/Maestro-Chess/actions/runs/45487328506) dan [pull request](https://github.com/Delta-Polder-Indonesia/Maestro-Chess/actions/runs/45487344830) sukses.
- Keenam engine diuji lewat UCI di Node; tes provider/worker lain memakai tiruan. Ini **bukan** bukti pengujian browser Worker, visual, jaringan nyata, screen reader, atau data pengguna. Typecheck tidak memeriksa seluruh logika JavaScript karena `checkJs` tidak aktif.

## Daftar pekerjaan yang masih perlu dipetakan

Ini adalah peta kasar dari audit dan kode saat ini, **bukan** persetujuan untuk memindahkan semuanya sekaligus. Urutan, batas setiap tahap, dan nomor tahap terakhir belum ditetapkan; setiap bagian dapat dibagi menjadi beberapa tahap kecil.

- [ ] **Tahap 13:** periksa kode dan kondisi terbaru, petakan kandidat beserta file, ekspor, pemanggil dan dependensinya, lalu sepakati satu cakupan kecil sebelum migrasi.
- [ ] **Analisis yang tersisa:** adaptor `EngineAnalisis`, parser PGN/FEN, rumus evaluasi/akurasi, buku pembukaan dan penyimpanan hasil analisis masih perlu dipetakan. Jangan menganggap seluruh modul Analisis selesai hanya karena fondasi engine sudah dipindah.
- [ ] **Sesi yang tersisa:** `MesinProvider` masih berada di `src/halaman/Analisa/konteks/mesin.jsx` dan masih memakai adaptor `EngineAnalisis` lama. Pertahankan di sana sampai dependensi Analisis yang dibutuhkan sudah dimodularisasi. Komponen `SelectDaftar` juga masih di lokasi lama dan perlu ditinjau secara terpisah jika menjadi cakupan tahap berikutnya.
- [ ] **Koleksi dan Akun:** petakan fasad, database, fallback, koordinasi/lock, penghapusan akun dan pemanggilnya. Bagian ini sensitif terhadap data dan membutuhkan tes karakterisasi serta kompatibilitas yang kuat; bus revisinya saja sudah dipisahkan pada Tahap 1.
- [ ] **Wawasan dan fitur Impor:** petakan layar, validasi, sumber data dan batas antarmodul. Context/provider impor di Sesi sudah selesai, tetapi fitur Impor belum selesai secara keseluruhan.
- [ ] **Fitur Papan dan Pengaturan:** petakan komponen visual, interaksi papan, laporan, suara, panah dan pemanggil tanpa mengubah tampilan atau perilaku. Context/provider Board di Sesi sudah selesai, tetapi fitur Papan belum selesai secara keseluruhan.
- [ ] **Shell, shared, CSS dan konfigurasi:** tinjau komposisi provider, navigasi, helper bersama, referensi path, Tailwind dan CSS sesuai kebutuhan. Jangan memindah atau menghapus file/adapter hanya karena tampak tidak dipakai; perlu bukti dan persetujuan cakupan.
- [ ] **Pengujian akhir:** ulangi suite, batas/siklus, audit, build root dan subpath, verifier lokal, hash aset dan kompatibilitas data. Rencanakan pengujian browser/visual yang belum tercakup. Playwright, axe-core, atau dependensi baru lainnya **tidak boleh ditambahkan tanpa persetujuan terpisah**.
- [ ] **Penutupan:** periksa PR dan GitHub Actions pada SHA yang benar, laporkan hasil dan tunggu instruksi eksplisit sebelum merge. Bug/perilaku lama yang ditemukan tetap dicatat; perbaikannya memerlukan persetujuan tersendiri.

## Aturan yang tetap berlaku

1. Baca `AGENTS.md` dan `.agents/skills/git-identity/SKILL.md` sebelum bekerja. Tetap di branch aktif; jangan membuat, mengganti nama, atau berpindah branch.
2. Tetap **Modular Monolith**, bukan microservices. Jangan mengubah desain, warna, layout, teks, UX, fitur, skema penyimpanan/cache atau format data.
3. Untuk setiap tahap: petakan target dari kode aktual; tulis dan jalankan tes karakterisasi pada implementasi asli **sebelum** mengubah/memindahkan implementasi; pertahankan ekspor, identitas context/provider/hook dan path kompatibilitas yang diperlukan; jaga batas dependensi.
4. Jangan memperbaiki bug lama diam-diam, menambah dependensi, menghapus file tanpa bukti, atau melakukan migrasi massal di luar cakupan yang disetujui.
5. Pertahankan seluruh tes lama—baseline saat catatan ini dibuat **535 tes**, tetapi periksa jumlah terbaru saat melanjutkan. Jalankan tes karakterisasi dan batas baru, lint, typecheck, audit dependensi, build root dan `/Maestro-Chess`, kedua verifier lokal, pemeriksaan siklus/batas, dan hash 320 aset publik.
6. Jika commit dan push memang diminta untuk tahap yang disetujui, pisahkan commit karakterisasi dan migrasi; push hanya branch aktif setelah gate lokal lulus. Perbarui PR setelah GitHub Actions yang relevan lulus. Jangan merge ke `main` tanpa instruksi eksplisit.
7. **Larangan Vercel:** jangan memanggil tool Vercel, meminta metadata akun/proyek Vercel, atau mengakses/memeriksa deployment maupun preview Vercel. `npm run test:build` dan `npm run test:vercel` adalah verifier **lokal** yang tetap diminta; pemeriksaan CI dibatasi pada GitHub Actions, bukan status/deployment Vercel.

## Lima artefak audit yang tidak boleh ikut commit

File berikut masih untracked dan tidak diubah. Jangan sertakan dalam commit kecuali ada instruksi baru dari pemilik:

1. `AUDIT-PASCASAINTEGRASI-PR15.md`
2. `INVENTARIS-REFERENSI-MODULAR-MONOLITH.csv`
3. `LAPORAN-AUDIT-MODULAR-MONOLITH.md`
4. `PETA-DEPENDENSI-PASCASAINTEGRASI-PR15.csv`
5. `PETA-FILE-MODULAR-MONOLITH.csv`

Audit adalah potret dan usulan dari waktu sebelumnya, bukan status implementasi terkini: cocokkan lagi dengan kode aktual dan catatan ini. Dokumentasi teknis yang sudah ada: `src/modul/sesi/README.md`, `src/modul/analisis/README.md`, serta ringkasan tiap tahap di PR #15.

## Cara melanjutkan besok

Tidak ada tenggat yang harus dipaksakan. Mulai dengan membaca panduan dan catatan ini, memeriksa `git status`, branch, HEAD, keadaan PR dan artefak audit, lalu petakan satu kandidat Tahap 13. Sepakati cakupannya sebelum menulis migrasi; setelah tahap selesai dan dilaporkan, berhenti lagi untuk menunggu persetujuan.

Contoh pesan untuk melanjutkan:

> Baca `AGENTS.md` dan `CATATAN-KELANJUTAN-MAESTRO-CHESS.md`, periksa status terbaru, lalu petakan kandidat Tahap 13. Jangan ubah implementasi sebelum cakupannya disepakati dan karakterisasi lulus.
