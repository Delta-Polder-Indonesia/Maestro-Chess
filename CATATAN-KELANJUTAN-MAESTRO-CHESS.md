# Catatan kelanjutan Maestro Chess

Catatan ini merangkum pekerjaan yang sudah selesai sampai **Tahap 25** dan daftar pekerjaan yang masih perlu dipetakan untuk tahap selanjutnya. Tidak harus selesai dalam satu hari: pekerjaan dapat dilanjutkan perlahan, satu cakupan kecil yang disetujui setiap kali.

## Titik terakhir

- Repositori: [Delta-Polder-Indonesia/Maestro-Chess](https://github.com/Delta-Polder-Indonesia/Maestro-Chess).
- Branch kerja aktif: `arena/f7e03724-maestro-chess` (dibuat dari `main` pada `30e7d0e`, setelah [PR #15](https://github.com/Delta-Polder-Indonesia/Maestro-Chess/pull/15) di-merge).
- [PR #16](https://github.com/Delta-Polder-Indonesia/Maestro-Chess/pull/16) masih **terbuka** (`OPEN`) dan belum di-merge ke `main`.
- Commit migrasi kode Modular Monolith terakhir (**Tahap 25**): `a2c49465e67f5f3c60b8944eb943b9be83db2f03` (`skorAntiCheat.js` / `antiCheatSkor.js`). **Modularisasi dijeda setelah Tahap 25** (Tahap 26 belum dimulai dan cakupannya belum disetujui).
- Setelah Tahap 25, dilakukan pembaruan konfigurasi **HTTP Security Headers & CSP strict** untuk deployment statis (`1bfdbe3`: `vercel.json`, `scripts/externalize-inline-scripts.mjs`, `scripts/verify-static-export.mjs`, `package.json`, serta tes pada `tests/security-headers-csp.test.mjs` dan `tests/verify-static-export.test.mjs`). Periksa `git log -1` dan head PR #16 untuk SHA terbaru.
- Jangan mengandalkan file sementara di `/tmp` atau hasil build lokal (`dist/`, `.next/`) untuk sesi mendatang.

## Yang sudah dikerjakan

### Tahap 1–12 (PR #15 — telah ter-merge di `30e7d0e`)

| Tahap | Cakupan yang selesai | Commit utama |
|---|---|---|
| 1 | Memisahkan bus revisi database untuk memutus siklus; perubahan PR #14 ikut terintegrasi. Ini **bukan** migrasi seluruh Koleksi. | `fc1e735`, `469d6a9` |
| 2 | Memodularisasi Profil: fungsi profil, cache dan bendera, dengan path kompatibilitas. | `54bf167` |
| 3 | Memodularisasi Pekerjaan: laporan, draf, riwayat dan singleton, dengan kontrak penyimpanan lama. | `358e2a3` → `277f350` |
| 4 | Sesi: model dan provider Tab Kerja. | `36240c0` → `e8868bc` |
| 5 | Sesi: preferensi, tema papan serta context/provider konfigurasi. | `d89c0ac` → `ba8d3bb` |
| 6 | Sesi: galat dan titipan PGN. | `d362a45` → `6b5a776` |
| 7 | Sesi: context dan provider impor. | `d741b90` → `70fa440` |
| 8 | Sesi: context panel aktif dan hook dropdown. | `987f807` → `38b3643` |
| 9 | Sesi: context, hook dan provider Board. | `a0d7b62` → `335f841` |
| 10 | Sesi: context dan provider Analyze. | `2d56491` → `3768c3f` |
| 11 | Sesi: `KonteksMesin` dan `useMesin`; `MesinProvider` tetap di path lama. | `f940855` → `9733ffc` |
| 12 | Fondasi Analisis: `EngineCatur`, daftar pilihan engine dan pemeriksaan WASM; path lama tetap kompatibel. | `c0d93ab` → `41169d1` |

### Tahap 13–25 & Perbaikan Keamanan (Branch aktif `arena/f7e03724-maestro-chess` / PR #16)

| Tahap | Cakupan yang selesai | Commit utama |
|---|---|---|
| Fondasi | Menambahkan skill `.agents/skills/audit-review-solution-framework/SKILL.md` (kerangka 4 Tahap Evolusi Solusi). | `9eb0811` |
| 13 | Analisis: deteksi fase permainan (`deteksiFase.js` / `fase.js`, shim `mesin/fase.js`). | `3badea5` → `5b761d4` |
| 14 | Analisis: kurva peluang menang (`kurvaPeluang.js` / `peluang.js`, shim `mesin/peluang.js`). | `0d03b68` → `953cf34` |
| 15 | Analisis: pendaftaran hasil analisis sesi di memori (`hasilSesi.js` / `analisisTersimpan.js`, shim `mesin/analisisTersimpan.js`). | `404ee9a` → `efd6f28` |
| 16 | Analisis: konvensi evaluasi langkah & skor UCI (`konvensiEvaluasi.js` / `evaluasi.js`, shim `mesin/evaluasi.js`; barrel `index.js` mencapai **34 ekspor**). | `edeb388` → `e7b8772` |
| 17 | Analisis: deteksi keamanan bidak / baterai (`bateraiBidak.js` / fasad internal `keamananBidak.js`, shim `mesin/keamananBidak.js`). | `fc1c6b6` → `a69895f` |
| 18 | Analisis: buku pembukaan & kunci FEN (`bukuPembukaan.js` / fasad internal `buku.js`, shim `mesin/buku.js` & `mesin/kunciFen.js`). | `ef2cdb2` → `eb0c272` |
| 19 | Analisis: klasifikasi kualitas langkah, pengorbanan & langkah paksa (`penilaianLangkah.js` / fasad internal `penilaian.js`, shim `mesin/penilaian.js`). | `c57f69e` → `b786001` |
| 20 | Analisis: metrik akurasi, CPL, anotasi NAG & agregasi harmonik (`metrikAkurasi.js` / fasad internal `akurasi.js`, shim `mesin/akurasi.js`). | `c73fd7d` → `4932a1e` |
| 21 | Analisis: deteksi langkah kritis MultiPV (`deteksiLangkahKritis.js` / fasad internal `langkahKritis.js`, shim `mesin/langkahKritis.js`). | `d3ec751` → `cda3399` |
| 22 | Analisis: ringkasan hasil analisis partai per warna (`ringkasPartai.js` / fasad internal `ringkasanAnalisis.js`, shim `mesin/ringkasanAnalisis.js`). | `1196787` → `55d7e7c` |
| 23 | Analisis: agregasi wawasan profil pemain (`wawasanProfil.js` / fasad internal `wawasan.js`, shim `mesin/wawasan.js`). | `da846b6` → `ea5551c` |
| 24A | Analisis: konstanta `MULTI_PV` (`konstantaMesin.js` / `multiPv.js`) dan lapisan dasar anti-cheat 26 ekspor (`dasarAntiCheat.js` / `antiCheatDasar.js`, shim `mesin/antiCheat/dasar.js`). | `3a3d394` → `9adb807` |
| 24B | Analisis: kalibrasi komponen anti-cheat 8 ekspor (`kalibrasiAntiCheat.js` / `antiCheatKalibrasi.js`, shim `mesin/antiCheat/kalibrasi.js`). | `47c1006` → `18499b9` |
| 25 | Analisis: skor per partai anti-cheat (`skorAntiCheat.js` / `antiCheatSkor.js`, shim `mesin/antiCheat/skor.js`); barrel publik `src/modul/analisis/index.js` tetap **34 ekspor**. | `2a49d10` → `a2c4946` |
| Keamanan | Perbaikan HTTP Security Headers Mozilla Observatory di `vercel.json` (`Content-Security-Policy` tanpa `script-src 'unsafe-inline'` dengan `'wasm-unsafe-eval'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `COOP: same-origin`, `CORP: same-origin`, `Permissions-Policy`, tanpa `COEP`), eksternalisasi inline script React Flight pada build ekspor statis (`scripts/externalize-inline-scripts.mjs`), serta penegakan CSP di `scripts/verify-static-export.mjs` dan `tests/security-headers-csp.test.mjs`. | `1bfdbe3` |

Pada tabel di atas, panah (`→`) menunjukkan commit tes karakterisasi pra-migrasi diikuti commit migrasi implementasi, fasad, shim kompatibilitas, dan tes batas modul. Pemindahan context Board, Impor, atau Analyze ke Sesi serta modul kalkulasi murni ke `src/modul/analisis/` **tidak berarti** seluruh fitur Papan, Impor, Wawasan UI, atau adaptor `EngineAnalisis` sudah dipindahkan.

### Verifikasi terakhir pada Tahap 25 (`a2c4946`) dan pembaruan keamanan (`1bfdbe3`)

- Pada Tahap 25 (`a2c4946`): `npm run lint` (`0` warning), `npm run typecheck` (`0` error), `npm test` (**721/721 tes top-level / 729/729 subtes lulus**), `npm audit` (`0` kerentanan), build root & subpath `/Maestro-Chess`, verifier statis/Vercel lokal, serta hash SHA-256 **320/320 aset publik (`public/**`)** seluruhnya lulus.
- Setelah pembaruan HTTP Security Headers & CSP strict (`1bfdbe3`): `npm run lint` (`0` warning), `npm run typecheck` (`0` error), `npm test` (**723/723 tes top-level / 731/731 subtes lulus**), `npm audit` (`0` kerentanan), build root & subpath `/Maestro-Chess` + eksternalisasi inline script CSP, `npm run test:build`, `npm run test:vercel`, dan paritas SHA-256 **320/320 aset publik (`public/**`)** seluruhnya lulus. Periksa status GitHub Actions terbaru pada head branch di PR #16.
- Pengujian berjalan di Node.js menggunakan React Test Renderer dan mock terjemahan/provider/buku/fetch/basisData/engine/Worker; ini **bukan** bukti pengujian browser Worker nyata, tampilan visual, jaringan nyata, screen reader, atau data IndexedDB pengguna nyata. `typecheck` memakai `allowJs` tanpa `checkJs`.

## Daftar pekerjaan todo (status sampai Tahap 25)

### Selesai sampai Tahap 25

- [x] **Tahap 1–12 (PR #15):** bus revisi database, modul `profil`, modul `pekerjaan`, modul `sesi` (`TabKerja`, preferensi/tema/config, galat/titipan, impor, panel aktif/dropdown, context Board/Analyze/Mesin), dan fondasi `EngineCatur`/`cekWasm`.
- [x] **Tahap 13–16 (Analisis publik, `index.js` 34 ekspor):** `deteksiFase.js`, `kurvaPeluang.js`, `hasilSesi.js`, dan `konvensiEvaluasi.js`.
- [x] **Tahap 17–23 (Analisis internal & fasad):** `bateraiBidak.js`, `bukuPembukaan.js`, `penilaianLangkah.js`, `metrikAkurasi.js`, `deteksiLangkahKritis.js`, `ringkasPartai.js`, dan `wawasanProfil.js` beserta seluruh shim kompatibilitasnya.
- [x] **Tahap 24A, 24B, & 25 (Anti-Cheat bertahap):** `konstantaMesin.js` (`MULTI_PV`), `dasarAntiCheat.js`, `kalibrasiAntiCheat.js`, dan `skorAntiCheat.js` beserta fasad internal `multiPv.js`, `antiCheatDasar.js`, `antiCheatKalibrasi.js`, `antiCheatSkor.js`, dan shim di `mesin/antiCheat/{dasar,kalibrasi,skor}.js`.
- [x] **Keamanan ekspor statis & header Vercel:** header keamanan HTTP Observatory (`vercel.json`) + eksternalisasi skrip inline Flight + verifikasi CSP pada `verify-static-export.mjs`.

### Pekerjaan tersisa yang masih perlu dipetakan (Tahap 26+)

- [ ] **Tahap 26 (kandidat lanjutan Analisis):** periksa kondisi terbaru lalu pilih satu cakupan kecil dari sisa `src/halaman/Analisa/mesin/`, misalnya:
  - `src/halaman/Analisa/mesin/antiCheat/agregat.js` dan fasad teratas `src/halaman/Analisa/mesin/antiCheat.js` (seluruh lapisan bawah `dasar`/`kalibrasi`/`skor` sudah siap di `src/modul/analisis/`), **atau**
  - `src/halaman/Analisa/mesin/laporanPeninjauan.js`, **atau**
  - `src/halaman/Analisa/mesin/engine.js` (adaptor `EngineAnalisis` & parser PGN/FEN — dependensi utama yang masih menahan `MesinProvider`).
- [ ] **Sisa Sesi:** `MesinProvider` masih berada di `src/halaman/Analisa/konteks/mesin.jsx` dan masih memakai adaptor `EngineAnalisis` lama. Pertahankan di sana sampai `engine.js` sudah dimodularisasi ke fasad Analisis yang disetujui. Komponen `SelectDaftar` juga ditinjau terpisah jika menjadi cakupan berikutnya.
- [ ] **Koleksi dan Akun:** petakan `basisData.js`, `database/*`, `akun/daftarAkun.js`, `akun/koordinasiAkun.js`, `akun/muatPartaiAkun.js`, `akun/antiCheatRiwayat.js`, transaksi, fallback, dan penghapusan akun. Bagian ini sensitif terhadap data dan membutuhkan tes karakterisasi serta kompatibilitas yang kuat; hanya bus revisinya (`revisiBasis.js`) yang sudah dipisahkan pada Tahap 1.
- [ ] **Wawasan UI, Impor, dan Akun UI:** petakan `layarWawasan.jsx`, `ringkasanAntiCheat.jsx`, `layarDeteksiEngine.jsx`, `layarImpor.jsx`, `validasiImpor.js`, dan komponen UI akun (`akun/*.jsx`). Context/provider impor dan agregasi murni `wawasanProfil.js` sudah selesai, tetapi layar & integrasinya belum dipindah.
- [ ] **Fitur Papan dan Pengaturan:** petakan `komponen/game/*`, `board.jsx`, `komponen/menu/*`, `komponen/pengaturan/*`, suara, dan panah tanpa mengubah tampilan atau perilaku. Context/provider Board di Sesi sudah selesai, tetapi fitur Papan belum selesai secara keseluruhan.
- [ ] **Shell, shared, CSS, dan konfigurasi:** tinjau komposisi provider, navigasi, helper bersama, referensi path, Tailwind, dan CSS sesuai kebutuhan. Jangan memindah atau menghapus file/shim kompatibilitas tanpa bukti dan persetujuan cakupan.
- [ ] **Pengujian akhir & verifikasi browser:** ulangi suite penuh, batas/siklus, audit, build root dan subpath, verifier lokal, hash aset, dan rencanakan pengujian browser nyata (Worker/WASM, visual, jaringan nyata, a11y, IndexedDB). Playwright, axe-core, atau dependensi baru lainnya **tidak boleh ditambahkan tanpa persetujuan terpisah**.
- [ ] **Penutupan:** periksa PR #16 dan GitHub Actions pada SHA yang benar, laporkan hasil, dan tunggu instruksi eksplisit sebelum merge ke `main`. Bug/perilaku lama yang ditemukan tetap dicatat; perbaikannya memerlukan persetujuan tersendiri.

## Aturan yang tetap berlaku

1. Baca `AGENTS.md` dan `.agents/skills/git-identity/SKILL.md` sebelum bekerja. Tetap di branch aktif; jangan membuat, mengganti nama, atau berpindah branch.
2. Tetap **Modular Monolith**, bukan microservices. Jangan mengubah desain, warna, layout, teks, UX, fitur, skema penyimpanan/cache, atau format data.
3. Untuk setiap tahap: petakan target dari kode aktual; tulis dan jalankan tes karakterisasi pada implementasi asli **sebelum** mengubah/memindahkan implementasi; pertahankan ekspor, identitas context/provider/hook, dan path kompatibilitas yang diperlukan; jaga batas dependensi.
4. Jangan memperbaiki bug lama diam-diam, menambah dependensi, menghapus file tanpa bukti, atau melakukan migrasi massal di luar cakupan yang disetujui.
5. Pertahankan seluruh tes lama—baseline saat catatan ini dibuat **723 tes (731 subtes)** termasuk tes keamanan CSP, dan periksa jumlah terbaru saat melanjutkan. Jalankan tes karakterisasi dan batas baru, lint, typecheck, audit dependensi, build root dan `/Maestro-Chess`, kedua verifier lokal, pemeriksaan siklus/batas, dan hash aset publik (`public/**` vs `dist/**`).
6. Jika commit dan push memang diminta untuk tahap yang disetujui, pisahkan commit karakterisasi dan migrasi; push hanya branch aktif setelah gate lokal lulus. Perbarui PR setelah GitHub Actions yang relevan lulus. Jangan merge ke `main` tanpa instruksi eksplisit.
7. **Larangan Vercel:** jangan memanggil tool Vercel, meminta metadata akun/proyek Vercel, atau mengakses/memeriksa deployment maupun preview Vercel. `npm run test:build` dan `npm run test:vercel` adalah verifier **lokal** yang tetap diminta; pemeriksaan CI dibatasi pada GitHub Actions, bukan status/deployment Vercel.

## Arsip audit historis

Lima artefak audit snapshot lama dari masa PR #15 sudah diarsipkan bersama panduan di `.agents/ArsipTodo/` (`README.md`, `AUDIT-PASCASAINTEGRASI-PR15.md`, `INVENTARIS-REFERENSI-MODULAR-MONOLITH.csv`, `LAPORAN-AUDIT-MODULAR-MONOLITH.md`, `PETA-DEPENDENSI-PASCASAINTEGRASI-PR15.csv`, `PETA-FILE-MODULAR-MONOLITH.csv`). Audit tersebut adalah potret historis sebelum Tahap 13–25, bukan status implementasi terkini: selalu cocokkan lagi dengan kode aktual, `src/modul/analisis/README.md`, dan catatan ini.

## Cara melanjutkan besok

Tidak ada tenggat yang harus dipaksakan. Mulai dengan membaca `AGENTS.md`, `CATATAN-KELANJUTAN-MAESTRO-CHESS.md`, dan `src/modul/analisis/README.md`, memeriksa `git status`, branch, HEAD, serta status PR #16, lalu petakan satu kandidat kecil **Tahap 26** (misalnya `antiCheat/agregat.js` + `antiCheat.js` atau `laporanPeninjauan.js`). Sepakati cakupannya sebelum menulis migrasi; setelah tahap selesai dan dilaporkan, berhenti lagi untuk menunggu persetujuan.

Contoh pesan untuk melanjutkan:

> Baca `AGENTS.md` dan `CATATAN-KELANJUTAN-MAESTRO-CHESS.md`, periksa status terbaru, lalu petakan kandidat Tahap 26. Jangan ubah implementasi sebelum cakupannya disepakati dan karakterisasi lulus.
