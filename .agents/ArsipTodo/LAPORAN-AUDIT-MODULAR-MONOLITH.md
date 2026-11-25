# Audit dan rancangan Modular Monolith — Maestro Chess

**Status: rancangan untuk ditinjau; belum disetujui dan belum diimplementasikan.**

- Basis audit: `cb17e22c11fda6ba36db8d42b334cafa1f1f2e98` pada branch `arena/8100c81e-maestro-chess`, sama dengan `origin/main` saat diperiksa.
- Lingkup yang diusulkan: satu repositori, satu aplikasi Next.js/React dan satu deployment statis. Tidak ada microservice, backend baru, penggantian framework, migrasi massal TypeScript, perubahan UX/teks/warna, skema penyimpanan, atau penghapusan fitur.
- Dokumen ini dan dua CSV pendamping adalah **artefak audit yang belum dilacak Git**, bukan perubahan source. Tidak ada commit, push, PR, atau merge untuk tugas ini.
- **Pintu keputusan:** implementasi, penambahan dependensi pengujian, perubahan konfigurasi, commit dan push baru dilakukan setelah pemilik menyetujui rancangan ini secara eksplisit. Temuan cacat lama di bagian 9 bukan persetujuan untuk memperbaikinya.

## 1. Dokumen pendamping dan cara membacanya

1. [Peta lengkap file lama → tujuan usulan](PETA-FILE-MODULAR-MONOLITH.csv): satu baris untuk setiap **587 file yang dilacak** pada commit dasar, ditambah **24 baris** untuk usulan file baru yang tidak berasal langsung dari satu file lama. Destinasi yang dipisah dengan ` ; ` berarti satu file lama diusulkan dipecah; beberapa file baru lainnya tercantum sebagai bagian dari baris pemecahan itu. `-` pada kolom file lama menandakan file baru. Tidak ada penghapusan fitur atau aset yang diusulkan.
2. [Inventaris referensi](INVENTARIS-REFERENSI-MODULAR-MONOLITH.csv): 1.105 lokasi teridentifikasi: 642 import/re-export literal yang berhasil diresolusi ke `src`, 443 kandidat string file/mock dalam tes, dan 20 ekspresi import/`require` dinamis nonliteral. Kolom tujuan adalah **destinasi utama kandidat**, bukan perintah mengganti path secara mekanis: hasil akhir lintas modul harus menggunakan API bagian 5, dan file hasil pemecahan memerlukan pemilihan ekspor yang tepat. String mock dapat relatif terhadap modul yang ditranspilasi, bukan file tes. Inventaris ini membantu peninjauan, bukan bukti bahwa pencarian referensi nonliteral, komentar, konfigurasi, CSS, URL dan runtime telah lengkap.

Pemeriksaan peta: 587 sumber lama unik tercakup tepat sekali; 204 tujuan utama file `src` dan seluruh tujuan utama file lama tidak bertabrakan, termasuk perbedaan huruf besar/kecil; tidak ada tabrakan file-versus-direktori. Ada **tiga tujuan dengan beberapa asal yang disengaja**: `shared/browser/idAcak.js` untuk fungsi pembuat ID yang identik, `analisis/domain/warnaLangkah.js` untuk dua fungsi penentu warna yang identik, dan `koleksi/index.js` untuk fasad lama serta re-export database. Gabungkan hanya isi yang disebutkan, pertahankan nama/kontrak lama dan buktikan dengan tes. Pemeriksaan ini adalah pemeriksaan peta, bukan bukti hasil implementasi.

## 2. Metode dan kondisi saat ini

- Membaca aturan repo dan identitas Git, README utama dan README Analisa, konfigurasi Next, Tailwind, ESLint, TypeScript, CI, Vercel dan skrip verifikasi; menelusuri storage, jaringan, worker, UI, CSS, import dinamis, tes dan aset. Inventaris memakai `git ls-files`; dependensi dan hasil build yang diabaikan Git tidak dihitung sebagai source.
- Dari 587 file: `src` 204 (201 modul JS/JSX/TS/TSX, dua CSS dan satu README), `public` 320, `tests` 43 (41 file tes dan dua helper), sisanya konfigurasi, skrip, dokumentasi dan lisensi. Total source kode sekitar 32.031 baris, di luar CSS.
- Analisis AST atas modul source menemukan 541 deklarasi dependensi internal, 540 pasangan file unik dan 10 `import()` literal dalam source. Tidak ada **import relatif/alias literal yang gagal diresolusi oleh pemindai** setelah suffix query dipisahkan untuk identitas file; query aslinya tetap bermakna dalam tes. Ada ekspresi dinamis yang tidak dapat diputuskan secara statis. Semua 201 modul source dapat dijangkau dari route secara statis, **bukan** bukti setiap cabang atau ekspor pernah dipakai pada runtime.
- Terdapat satu *strongly connected component* berisi lima file: `database/index.js`, `database/partai.js`, `database/koleksi.js`, `database/statistik.js`, dan `database/akun.js`. `index.js` me-re-export empat file itu, sementara mereka mengimpor bus revisi dari `index.js`. Komentar saat ini menjelaskan mengapa siklus ESM tersebut kebetulan aman, tetapi urutan inisialisasi tetap rapuh. Sumber: [database/index.js](src/halaman/Analisa/database/index.js#L14).
- Bila file saat ini hanya **dikelompokkan secara hipotetis** menurut peta kandidat, graf antarkelompok tidak memiliki siklus. Itu belum membuktikan siklus lima file telah hilang, batas public API terpenuhi, atau pemecahan yang diusulkan otomatis benar.

### Baseline yang benar-benar dijalankan

| Pemeriksaan | Hasil pada basis audit | Batas pembuktian |
|---|---|---|
| `npm run lint`, `npm test` | Lulus; 217 tes, 0 gagal, 0 dilewati | Termasuk tes lokal enam engine nyata melalui UCI/NNUE; bukan enam engine di semua browser |
| `npm run build`, `npm run typecheck` | Lulus berurutan pada Node `v22.22.3`, npm `10.9.8` | `allowJs` tanpa `checkJs`; typecheck tidak memeriksa seluruh logika JS |
| `npm run test:build`, `npm run test:vercel` | Lulus pada build default | Verifier ekspor memeriksa 54 file wajib tidak kosong dan direktori aset, bukan integritas semua 320 aset |
| Build dan `test:build` dengan `NEXT_PUBLIC_BASE_PATH=/Maestro-Chess` | Lulus; pada dua HTML yang diperiksa, 9 dan 34 URL lokal semuanya berprefiks | Bukan pemeriksaan seluruh URL dinamis/runtime; build default kemudian dipulihkan dan diverifikasi |
| `npm audit --include=dev --audit-level=high` | 0 kerentanan pada saat pemeriksaan | Hasil bergantung pada waktu dan registry |
| Browser lokal Chromium pada ekspor statis | Alur PGN/engine/persistensi, kasus akun dan dua tab diperiksa; permintaan pihak ketiga pada skenario uji dimock | Belum merupakan matriks browser/perangkat, pembaca layar, atau pengujian API live |
| CSS akun pada 390, 515, 516, 639, 640, 641, 767, 768, 1099, 1100, 1668, 1669, 1920 px | Pada fixture akun yang dimock, lebar dokumen sama dengan viewport dan tidak ada `pageerror`; header `column-reverse` sampai 640 px, `row` pada 641 px | Satu layar dan satu browser; breakpoint lebar area kerja juga harus diuji secara terpisah |

## 3. Temuan arsitektur yang mendasari rancangan

1. **Tanggung jawab bercampur.** [areaKerja.jsx](src/halaman/Analisa/komponen/areaKerja.jsx#L77) (775 baris) mengatur lazy panel, tab, fokus, draf dan lifecycle papan. [board.jsx](src/halaman/Analisa/komponen/game/board.jsx) (974), [layarDatabase.jsx](src/halaman/Analisa/komponen/nav/layarDatabase.jsx) (934), `database/partai.js` (769), `mesin/engine.js` (709) dan `akun/muatPartaiAkun.js` (661) menggabungkan beberapa alasan perubahan. Ukuran bukan alasan tunggal untuk memecah: `svg/rating.jsx` (1.277 baris) adalah banyak path gambar, dan dua kamus sekitar 1.000 baris masing-masing; tidak diusulkan memecahnya hanya agar pendek.
2. **DB bocor melewati fasad.** `basisData.js` sudah memiliki 18 ekspor eksplisit, tetapi layar akun juga mengimpor `bukaDB` langsung dari internal untuk menjamin urutan penghapusan. Solusinya bukan sekadar melarang import itu: kontrak koordinasi baru harus tetap memegang lock dan memakai koneksi yang sama, sebagaimana bagian 6.
3. **Lapisan belum konsisten.** Validasi impor mencampur validasi/HTTP; deteksi domain mengambil `MULTI_PV` dari file yang juga mengelola engine; `pemainCatur.js` menggabungkan fetch, cache dan hook React; `pekerjaan.js` menggabungkan adapter IndexedDB, state dan snapshot. Peta menandai pemecahan spesifik, bukan migrasi mekanis ke folder `domain`/`infrastructure`.
4. **Kontrak antarfitur tersebar sebagai deep import.** UI mengakses file internal dan konteks pada jalur relatif panjang. Misalnya pengaturan mengambil `Arrow` dari file papan besar; `capitalizeFirst` hidup dalam konverter Chess.com meskipun hanya dipakai pengaturan. Usulan `Arrow.jsx` dan `kapitalisasi.js` menghilangkan dua keterikatan itu tanpa membuang konverter lama.
5. **Keadaan harus tetap tunggal.** Provider engine memiliki worker yang dibuat malas; papan tetap mounted dan tersembunyi dengan `visibility`, bukan dilepas. Delapan panel dimuat malas, dan `PenitipPgn` sengaja dipasang setelah `<main>` agar urutan efek tetap benar. Pemindahan yang menggandakan singleton, memindahkan efek atau mengubah key React dapat mengulang analisis atau menghilangkan state. Lihat [areaKerja.jsx](src/halaman/Analisa/komponen/areaKerja.jsx#L757).
6. **Nama dan dokumentasi sebagian tidak menggambarkan pemakaian.** `src/halaman/TekaTeki/animasiBidak.js` benar-benar dipakai papan; bukan kandidat hapus. `DashboardAkun` dan turunannya saat ini dipakai Wawasan walaupun berada di `akun/`. Sebagian komentar mengacu ke struktur/rute lama; komentar `basisData.js` menyebut sembilan indeks, sedangkan pembuat skema saat ini memastikan delapan. Perbarui dokumentasi berdasarkan kode, bukan sebaliknya.
7. **Duplikasi perlu bukti.** Badan `pemainDariEntri`/`pemainLangkah` identik dan tiga pembuat ID acak menggunakan ekspresi yang identik; keduanya kandidat konsolidasi dengan tes kontrak. Namun `olahPartaiChessCom` lama masih diimpor tes dan berbeda dari konverter akun: jangan digabung atau dihapus. `KEDALAMAN` dan fungsi/ekspor lain yang belum terlihat dipakai tetap dipertahankan.
8. **Konfigurasi peka path.** Tailwind hanya memindai direktori lama; perpindahan tanpa memperluas `content` dapat diam-diam menghilangkan kelas. Override ESLint hanya berlaku pada `src/halaman/Analisa/**`. Tes menggunakan import, `new URL`, pembacaan README, string mock transpiler dan import ber-query; semuanya harus ditinjau, termasuk referensi yang tidak dikenali pemindai.

## 4. Struktur tujuan yang diusulkan

Pohon ini menunjukkan batas utama, bukan seluruh 646 tujuan kandidat. Rincian setiap file ada pada CSV. Direktori dibuat hanya ketika ada file nyata; subfolder `domain`, `application`, `infrastructure` dan `ui` dipakai **hanya** jika tanggung jawabnya memang ada.

```text
src/
  app/                         # route Next, metadata, global CSS
  shell/                       # komposisi provider, navigasi, tab dan lapisan layar
  shared/
    browser/ catur/ i18n/ ui/ # primitive benar-benar digunakan bersama
  modules/
    analisis/                  # domain catur/analisis, PGN, Stockfish dan buku
    pekerjaan/                 # laporan, draf dan riwayat lokal
    profil/                    # profil publik, cache dan bendera
    sesi/                      # konteks, preferensi, tab dan lifecycle aktif
    koleksi/                   # basis partai/koleksi, sinkronisasi dan revisi
    akun/                      # akun, unduhan partai dan deteksi indikatif
    wawasan/                   # statistik, grafik dan dashboard
    impor/                     # formulir, validasi dan sumber PGN/FEN/tautan
    papan/                     # papan, permainan, interaksi dan laporan visual
    pengaturan/                # layar pengaturan dan pilihan engine
public/                        # URL/isi tetap, termasuk semua engine dan lisensi
tests/                         # tes yang ada, diperbarui referensinya
browser-tests/                 # usulan tes browser deterministik
scripts/                       # verifier lama dan usulan pemeriksa arsitektur
docs/analisa.md                # usulan lokasi README Analisa
```

**Alasan batas:** `koleksi` memiliki data partai, daftar akun lokal dan mekanisme lock bersama; `akun` memegang proses pengambilan dan deteksi, bukan koneksi DB. `pekerjaan` terpisah karena laporan/draf memang memakai database berbeda. `sesi` menguasai state dan lifecycle panel bersama, sehingga `SelectDaftar` dan `useDropdown` yang bergantung pada `PanelAktifContext` ditempatkan di sana, bukan di `shared` generik. `profil` adalah satu klien/cache yang dikonsumsi beberapa fitur. `papan` terpisah dari rumus `analisis`; `wawasan` mengonsumsi hasil dan koleksi tanpa memiliki keduanya. `shared` hanya berisi primitive yang sungguh digunakan lintas modul atau oleh komponen shared; `URL_REPO` ditempatkan pada pengaturan, dengan re-export navigasi lama tetap tersedia.

Pembagian **204 file `src` lama menurut tujuan utamanya**, sebelum file yang dipecah dan entry point baru dihitung: `app` 5, `shell` 9, `shared` 25, dokumentasi 1; `papan` 46, `akun` 18, `wawasan` 14, `koleksi` 28, `sesi` 21, `pengaturan` 15, `impor` 2, `pekerjaan` 4, `analisis` 14 dan `profil` 2.

Konvensi: komponen `.jsx` bernama PascalCase; hook `use...`; fungsi dan file nonkomponen camelCase yang deskriptif; domain fitur memakai nama Indonesia yang sudah digunakan proyek. CSS Module dipakai hanya untuk aturan yang benar-benar milik fitur. Nama import, default/named export dan kelas/atribut yang dibutuhkan pemanggil diperbarui bersama dalam satu tahap; tidak ada perubahan teks pengguna atau output bisnis.

## 5. API publik dan arah dependensi

**Aturan:** kode satu modul hanya mengimpor modul lain dari entry point yang secara eksplisit didaftarkan di bawah, bukan `domain/`, `ui/`, `application/` atau `infrastructure/` internalnya. Import internal satu modul sendiri diperbolehkan. `app` bergantung pada `shell`; `shell` merangkai fitur; `shared` tidak bergantung pada `app`, `shell` atau modul fitur. `domain` tidak mengimpor React, DOM, storage, HTTP, worker, `application` atau `infrastructure`; dependensi domain lintas modul hanya melalui entry point domain yang ringan. UI memanggil application/API, dan adapter mengakses browser/HTTP/IDB. Tidak ada kewajiban membuat barrel besar atau wrapper yang tidak dipakai. Tes unit boleh menguji internal secara langsung; kode produksi tetap lewat API.

Arah **yang diizinkan setelah pemecahan** (semua modul juga boleh menggunakan `shared` yang relevan):

| Pemanggil | Boleh bergantung pada modul |
|---|---|
| `analisis`, `pekerjaan`, `profil` | Tidak pada modul fitur lain |
| `sesi` | `analisis`, `pekerjaan` |
| `koleksi` | `sesi` |
| `akun` | `analisis`, `koleksi`, `profil`, `sesi` |
| `wawasan` | `analisis`, `koleksi`, `profil`, `sesi` |
| `impor` | `analisis`, `koleksi`, `pekerjaan`, `sesi` |
| `papan` | `analisis`, `pekerjaan`, `profil`, `sesi` |
| `pengaturan` | `analisis`, `papan`, `sesi` |
| `shell` | Semua entry point fitur yang dirangkainya dan `shared` |

File pemilih Chess.com lama ditempatkan di `pengaturan/ui` karena satu-satunya pemakai runtime-nya adalah pengaturan. `capitalizeFirst` dipisah sebagai helper UI setempat dan di-re-export dari file lama hasil pemindahan agar ekspor lainnya, termasuk konverter yang diuji, tetap tersedia; ini tidak menambah ketergantungan `pengaturan → akun`. Aturan ini harus diverifikasi terhadap import, re-export, alias dan dynamic import aktual setelah setiap tahap, bukan hanya menurut nama folder.

### Entry point dan kontrak

| Pemilik / entry point usulan | Kontrak yang dipakai lintas batas; state/data yang dimiliki |
|---|---|
| `analisis/index.js` | Hanya ekspor domain eksplisit yang benar-benar dipakai, termasuk `MULTI_PV`, `GALAT_BATAL`, `GALAT_PGN`, `GALAT_FEN`, `GALAT_MESIN`, `formatSquare`, `deformatSquare`, `getCastle`, `invertColor`, `akurasiMove`, `pemainDariEntri`, `kerugianMove`, `rataHarmonik`, `cpBaku`, `nilaiGrafikCp`, `anotasiMove`, `CP_AWAL`, `CP_CEILING`, `DAFTAR_ANOTASI`, `harmonikDariJumlah`, `peluangMenang`, `petaAnotasiKosong`, `inversAkurasi`, `apakahMateTerminal`, `ratingTampilan`, `STATUS_EVALUASI`, `langkahTerpaksa`, `tandaMate`, `DAFTAR_FASE`, `FASE_PEMBUKAAN`, `faseBerikutnya`, `papanDariFen`, `isEndOpening` dan `isEndMiddlegame`. Nilai MultiPV tetap 5; eval UCI tetap relatif terhadap pihak yang bergilir. |
| `analisis/pgn.js`, `operasi.js` | `bacaPartaiPGN` dan helper jam/PGN dipisah dari `parseMove`, `parsePosition`, `parsePGN` dan `ringkasAnalisis`; bentuk parameter, hasil, galat dan `AbortSignal` tetap. `bacaPartaiPGN` tetap membaca partai pertama dan melaporkan jumlah partai. |
| `analisis/engine.js`, `buku.js`, `hasilSesi.js` | Pilihan `DAFTAR_ENGINE`, `ENGINE_BAKU`, `cariEngine`, `EngineAnalisis`, `hashUntukEngine`, `wasmSupported`; `cariNamaPembukaan`; serta `catatAnalisis`, `ambilPetaAnalisis`, `langgananAnalisis` dan operasi store analisis yang sudah ada. Engine/assets dibuat/dimuat malas. Hasil sesi tetap di memori; modul ini bukan pemilik riwayat IndexedDB. |
| `koleksi/index.js` | Mempertahankan tepat 18 nama fasad `basisData.js`: `bacaRevisiBasis`, `langgananRevisi`, `buatIdPartai`, `normalisasiHasil`, `normalisasiDataPartai`, `hitungStatistikKoleksiRingan`, `simpanBanyakPartai`, `pastikanKoleksi`, `ambilSemuaKoleksi`, `ambilDaftarPartai`, `ambilPartai`, `hapusPartai`, `hapusKoleksi`, `gabungkanPemain`, `bersihkanBasisData`, `hitungStatistikBasisData`, `eksporPgnKoleksi`, `imporPgnKeBasisData`. Opsi dan hasil lama tetap; misalnya daftar mengembalikan `{ partai, total, galat? }`, simpan melaporkan media/hasil, dan impor multi-PGN tetap menyimpan partai valid. Opsi internal lama pada fungsi publik tidak dihapus hanya demi pembersihan. |
| `koleksi/akun.js`, `koordinasiAkun.js`, `penghapusanAkun.js`, `useAkunKoleksi.js`, `pesanPenyimpananPartai.js`, `LayarDatabase.jsx` | Daftar akun `{ platform, username }`, koordinasi generasi/abort/lock, hook daftar koleksi, pesan penyimpanan dan layar Database. Use case penghapusan baru `hapusDataAkunTerkoordinasi(platform, username, { bersihkanCache })` menerima callback pembersihan cache **sinkron** milik akun, mengembalikan hasil daftar lama atau `null`/galat seperti alur lama, dan tidak mengekspos koneksi IDB. `bukaDB`, store, cursor dan bus kenaikan revisi tetap internal. Kontrak rinci urutan di bagian 6. |
| `pekerjaan/index.js`, `usePekerjaan.js` | API eksplisit `pekerjaan`, `buatIdPekerjaan`, `buatIdDrafImpor`, `ID_DRAF_IMPOR`, `snapshotLaporanAman`, `simpanDrafImpor`, `daftarkanPembacaLaporan`, `simpanLaporanAktif`, `buatManajerLaporan`, `catatFitur`, `daftarRiwayat`, `KUNCI_FITUR` dan ekspor lama lain yang dipakai tes/pemanggil. Memiliki satu store pekerjaan, metadata/isi, draf, snapshot dan riwayat; tidak memakai DB koleksi. |
| `profil/index.js`, `urlBendera.js` | `ambilKartuPemain(username, platform)`, `segarkanKartuPemain`, `useKartuPemain` dan `urlBendera`; memiliki satu cache profil, klien HTTP dan hook React terpisah. Nama, URL, validasi kode bendera dan TTL/cache lama tetap. |
| `sesi/konteks.js`, `providers.jsx`, `tabKerja.jsx` | Ekspor ringan konteks/hook papan, impor, konfigurasi, analisis, galat, engine dan `PanelAktifContext`; provider dirangkai shell. `useTabKerja`/`TabKerjaProvider` memiliki entry point tersendiri agar import konteks ringan tidak otomatis memuat store pekerjaan. Identitas React context, urutan provider dan satu worker tetap. |
| `sesi/preferensi.js`, `temaPapan.js`, `pesanGalat.js`, `titipanAnalisa.js`, `SelectDaftar.jsx`, `useDropdown.js` | API aman `bacaTeks`, `cobaBacaTeks`, `bacaAngka`, `bacaBoolean`, `tulis`, `tulisBoolean`, `boardThemes`, `pushPageError`/`pushPageWarning`, titipan PGN serta komponen/dropdown yang sadar panel aktif. Prefiks, fallback dan sinyal kegagalan tetap. Pemilik data tertentu tetap modul yang menentukan kuncinya. |
| `akun/LayarAkun.jsx`, `LayarDeteksiEngine.jsx` | Pertahankan props/callback saat ini, termasuk `akunTab`, `aktif`, `onTutup`, `onAkunDihapus` dan `onBukaAkun`. Akun memiliki formulir, HTTP Chess.com/Lichess, pembatalan unduhan dan cache deteksi; deteksi tetap indikatif dan mempertahankan sanggahan. Koleksi menerima record melalui API, bukan akses store langsung. |
| `wawasan/LayarWawasan.jsx` | Layar dengan `akunTab` dan `aktif`; membaca koleksi, hasil analisis dan profil melalui API. Memiliki state filter/tampilan lokal, bukan data sumber. Dashboard/kartu pembukaan saat ini menjadi internal Wawasan. |
| `impor/index.js`, `LayarImpor.jsx` | `validasiPgn`, `validasiFen`, `uraikanTautanPartai`, `susunPgnDariTcn`, `ambilPgn`, `BATAS_IMPOR`, `KODE_GALAT`; bentuk error dan limit lama tetap. Layar mempertahankan `onTutup`, `onImpor`, `onSebelumImpor`, `drafId` dan `onDrafId`; draf dimiliki `pekerjaan`, penyimpanan partai dimiliki `koleksi`. |
| `papan/Game.jsx`, `BoardMenu.jsx`, `Menu.jsx`, `GameButtons.jsx`, `Arrow.jsx`, `suara.js` | Entry point komposisi shell dan `Arrow` untuk pratinjau pengaturan; props, event dan perilaku tetap. Memiliki interaksi papan, state UI lokal dan adapter audio; data sesi/pekerjaan tetap milik modul terkait. Ekspor audio yang ada tetap tersedia meski hook React dipisah dari pemutar. |
| `pengaturan/LayarPengaturan.jsx`, `LayarEngine.jsx`, `repository.js` | Layar pengaturan/engine dan `URL_REPO`; membaca/menulis pilihan lewat sesi, daftar engine lewat analisis dan pratinjau panah lewat API papan. Navigasi mempertahankan re-export `URL_REPO` yang ada. |
| `shell/Analisa.jsx` dan `shared/*` | `Analisa` tetap dimuat secara client-only oleh route Next; shell merangkai provider, navigasi dan layar tanpa menjadi pemilik database. `shared` menyediakan URL aset, pembatalan, PGN ringan/hasil, i18n dan komponen yang dipakai lintas fitur, tanpa re-export seluruh fitur. |

Kontrak ini akan didokumentasikan dengan JSDoc/tes sesuai kebutuhan, bukan migrasi TypeScript massal. API yang sebelumnya diekspor namun hanya diuji atau belum terbukti tidak dipakai tetap dipertahankan; tidak semua harus diumumkan sebagai API lintas fitur.

## 6. Data, transaksi dan kompatibilitas: syarat keras

- **Koleksi:** `maestro_chess_database_v1`, versi **3**, store `partai` dan `koleksi`; delapan indeks: `platform`, `username`, `kombinasi`, `timestamp`, `platformWaktu`, `usernameWaktu`, `kombinasiWaktu`, `koleksiWaktu`. Jangan menaikkan versi atau mengubah keyPath, record, urutan query, perilaku tanggal impor lama maupun ID.
- **Pekerjaan:** `maestro_chess_pekerjaan_v1`, versi **1**, store `daftar` dan `isi`. Pertahankan `draf:impor`, prefiks `draf:`, `laporan:`, `fitur:`, pointer metadata, snapshot versi 1, satu instance dan antrean tulis. Semantik last-write-wins antar-tab tetap seperti sekarang; jangan diam-diam mengubahnya saat refactoring.
- **Fallback dan preferensi:** pertahankan `maestro-analisa-db-snapshot-v2`, kunci lama `maestro-analisa-db-koleksi` dan `maestro-analisa-db-partai`, pembacaan kunci lama preferensi, prefiks `maestro-analisa-`, `maestro-analisa-daftar-akun`, `maestro-analisa-generasi-akun-`, `maestro-analisa-pemain-v2-`, `maestro-anticheat-cache-v7`, `maestro-chess-bahasa`, `maestro-suara-papan`, `maestro-analisa-tab-v1` dan `maestro-analisa-impor-awal`. Pertahankan perbedaan storage yang tak tersedia, fallback memori dan sinyal peringatan kepada pengguna.
- **Penghapusan akun sangat sensitif:** pertahankan `mulaiPenghapusanAkun` dan pembatalan kerja terkait sebelum menunggu Web Lock `maestro-analisa-basis-akun`; di dalam lock wajib, pulihkan fallback dengan `bukaDB({ terkunci: true })`, buat penanda generasi, hapus koleksi dengan **koneksi yang sama**, bersihkan cache deteksi, hapus daftar akun, lalu selesaikan penanda; jika gagal, jalur `finally` mengembalikan status penanda seperti saat ini. Kode UI/account tidak lagi menerima `IDBDatabase`: use case publik koleksi memegang koneksi dan menerima callback `bersihkanCache` yang sama-sama dijalankan di dalam lock. Jangan mengambil lock ulang dari operasi yang sudah terkunci. Keberhasilan parsial tetap dilaporkan gagal seperti sekarang; ini bukan transaksi atomik lintas IndexedDB dan localStorage.
- **Satu bus revisi:** pindahkan state/listener dan `naikkanRevisi` ke file privat `revisiBasis.js` yang tidak me-re-export repository. Internal repository mengimpor bus itu; fasad `koleksi/index.js` me-re-export hanya 18 nama. Tidak ada repository yang mengimpor fasadnya sendiri. Live binding revisi, urutan notifikasi dan satu instance tetap, lalu verifikasi SCC kosong.
- **URL dan aset:** semua `public/**` tetap pada URL dan isi sekarang: 271 bendera, 23 file engine/sumber, 9 suara, 8 lisensi, 6 gambar, data pembukaan serta `.nojekyll` dan favicon. Enam pilihan Stockfish, NNUE, loader, atribusi dan URL ber-base-path dipertahankan. Pertahankan juga pemberitahuan hak cipta/lisensi pada file source yang dipindah atau dipecah, serta perbarui tautan relatif dokumentasi. Dua WASM 18 yang identik tidak membuktikan loader/pilihannya bisa dihapus.
- **Keamanan/privasi:** validasi tautan HTTPS/host, batas 1 MiB PGN/respons, 500 ply, FEN 256 byte dan timeout 12 detik tetap; pembatalan dan error engine tetap dibedakan. `comments.jsx` memakai `dangerouslySetInnerHTML`, sementara generator meng-escape `& < > \" '` pada nama: pertahankan escape dan uji input berbahaya; jangan menganggap semua HTML pihak ketiga aman. Jangan mengirim data baru ke server atau mengubah kebijakan privasi.

## 7. Rencana CSS dan perilaku visual

1. `src/app/globals.css`: tetap menjadi tempat reset, token `:root`, scrollbar dan tooltip global. Tooltip Radix dapat dipasang di portal di luar `.analisa-root`; jangan memindahkannya ke scope yang membuatnya kehilangan gaya. Pindahkan hanya kelompok `slanted-*` dan `user-title-section` yang dipakai `PanelTarikPartai` ke `PanelTarikPartai.module.css`; perbarui semua class terkait, termasuk `data-state`, dan pertahankan media `max-width: 640px`.
2. `src/halaman/Analisa/analisa.css` → `src/shell/analisa.css`: pertahankan `.analisa-root`, seluruh token/alias, scrollbar, seleksi dan pengaturan animasi. Ekstrak selector Wawasan saja ke `Wawasan.module.css` dengan spesifisitas dan urutan yang setara, misalnya scope global `.analisa-root` plus kelas lokal; perbarui seluruh pengguna SVG/kartu/grafik, termasuk hover.
3. Jangan menghapus `.analisa-tanpa-animasi` atau selector lain hanya karena pencarian statis belum menemukan pemakainya. Pertahankan semua nilai warna, ukuran, urutan cascade, animasi, portal, fokus dan layout. Jika CSS Modules tidak dapat dibuktikan setara, pertahankan aturan global sampai ada rencana yang disetujui, jangan memaksa konversi.
4. Tambahkan glob `src/modules`, `src/shared`, `src/shell` ke Tailwind **sebelum** file UI pertama dipindah; pertahankan juga glob lama selama migrasi. Cakupan override ESLint baru harus setara dengan file asal, bukan pengecualian luas yang melemahkan lint untuk seluruh modul.
5. Pembandingan visual/interaksi sebelum dan sesudah harus mencakup semua layar, tema, bahasa, tooltip/dialog/portal, animasi on/off serta breakpoint Tailwind/CSS: 516, 640, 700, 768, 1000, 1024, 1100, 1280, 1468, 1536, 1669 px, termasuk satu piksel di kedua sisi dan pengujian **lebar kontainer** untuk panel, bukan hanya viewport.

## 8. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi/pintu berhenti |
|---|---|---|
| Lock atau recovery berubah saat menghapus akun | Data lama bangkit, data sebagian terhapus atau salah mengaku sukses | Use case dengan satu lock/koneksi, tes gagal di setiap langkah dan dua tab; hentikan tahap bila urutan berbeda |
| Provider, singleton, lazy import atau urutan efek berubah | Worker ganda, analisis ulang, hilang tab/draf/fokus | Uji jumlah worker, mount papan, perpindahan panel, `PenitipPgn`, cancel dan reload; bandingkan chunk/lazy network |
| Import dinamis, string mock atau alias tertinggal | Build lulus tetapi panel/test tertentu rusak | Inventaris referensi + pencarian ulang semua path/URL/query + buka setiap panel pada build statis |
| CSS Modules/Tailwind mengubah cascade | Warna, responsivitas, portal, animasi atau kelas hilang | Baseline screenshot dan computed style, periksa semua breakpoint dan interaksi; kembali ke CSS global bila tidak setara |
| Split parser/engine mengubah output | Akurasi, tanggal, FEN/PGN, suara atau laporan berubah | Tes karakterisasi lama vs baru, fixture malformed/multi-PGN dan UCI semua pilihan |
| Fasad mengekspor terlalu banyak atau memuat modul berat | Siklus baru, modul internal bocor, chunk awal membesar | Entry point eksplisit per kemampuan, domain ringan, analisis graf dan pengukuran chunk |
| IndexedDB/legacy/localStorage tidak kompatibel | Data pengguna tidak terbaca | Fixture sintetis versi lama → baru dan kembali; tidak mengubah skema/kunci; verifikasi fallback dan kuota |
| Aset/lisensi dibuang atau URL subpath salah | Engine/gambar tidak jalan atau kewajiban lisensi rusak | Semua `public/**` tetap, verifier + uji worker dan GET aset di root/subpath, pembandingan hash |
| Mengandalkan typecheck atas JS | Kesalahan JS lolos | Pertahankan lint dan tes runtime; jangan mengklaim JS ter-typecheck seluruhnya |

## 9. Temuan perilaku lama — di luar ruang lingkup refactoring

Temuan berikut dilaporkan agar tidak tertutup oleh migrasi. **Tidak diperbaiki tanpa persetujuan terpisah**, karena memperbaikinya mengubah perilaku bisnis/UX:

- Pada [pengambilan akun](src/halaman/Analisa/akun/muatPartaiAkun.js#L361), Chess.com mengunduh semua arsip relevan sebelum memotong `maks`; ini dapat melakukan lebih banyak request daripada jumlah partai yang diminta. Lichess mengirim `max` sebelum filter lanjutan di klien, sehingga partai yang lebih lama tetapi cocok dapat terlewat. Skenario diperiksa dengan respons tiruan, bukan API produksi live.
- README sudah mengingatkan bahwa dua tab mengedit laporan yang sama dapat saling menimpa. Penghapusan akun saat ini membersihkan koleksi, daftar dan cache deteksi, tetapi bukan berarti seluruh cache profil atau laporan/draf yang terpisah ikut terhapus. Jangan menyatakan penghapusan menyeluruh tanpa rancangan retensi baru.
- Draf impor dapat tersimpan sebelum validasi ukuran saat tombol analisis ditekan; `Worker` yang diam tanpa pesan/error dapat meninggalkan promise menunggu; perlu peninjauan tersendiri. Pemeriksaan aksesibilitas lokal juga menemukan area yang perlu ditinjau, termasuk kontras dan fokus kalender; belum ada verifikasi pembaca layar nyata.
- Titipan PGN `maestro-analisa-impor-awal` masih dibaca oleh empat lokasi walaupun penulis rute lama tidak ditemukan. Pertahankan pembaca dan formatnya; tidak ada dasar runtime cukup untuk menghapusnya. Montserrat masih tercantum pada dependensi dan atribusi meski import aktual tidak ditemukan.

## 10. Strategi pengujian dan kriteria penerimaan

**Sebelum perubahan:** buat fixture sintetis dan tangkapan baseline yang dapat direproduksi dari commit dasar, dengan waktu, font, bahasa, jaringan dan animasi dikendalikan. Jangan memakai/menyimpan data pribadi pengguna. Untuk perbandingan gambar, simpan hasil sementara sebagai artefak pengujian; hanya masukkan gambar referensi kecil ke Git bila memang diperlukan dan disetujui.

**Setiap tahap**, secara berurutan, tanpa menjalankan build dan typecheck bersamaan:

1. Jalankan `npm run lint`, `npm test`, `npm run build`, `npm run typecheck`, `npm run test:build`, `npm run test:vercel`; jalankan audit dependensi ketika lockfile berubah dan pada akhir. Seluruh 217 tes baseline harus tetap ada dan lulus; tes baru tidak menggantikan tes lama.
2. Pemeriksa arsitektur baru memeriksa siklus, akses internal lintas modul, arah izin, alias, re-export dan `import()` literal. Tambahkan tes untuk detektornya sendiri serta laporkan ekspresi nonliteral untuk peninjauan. Pada tahap baseline, izinkan **hanya SCC lama yang diketahui** secara sementara; setelah tahap pemutusan SCC, tidak ada pengecualian siklus. Aturan batas pada file yang belum dimigrasikan boleh memiliki daftar pengecualian eksplisit yang terus menyusut sampai kosong.
3. Uji PGN tunggal/multi, PGN rusak, tanggal dan hasil tak diketahui, FEN/setup, navigasi, promosi, anotasi, jam, filter/urut/paginasi/ekspor koleksi, error dan abort. Pastikan partai pertama dianalisis dan semua partai valid impor disimpan sesuai perilaku lama. Bandingkan hasil rumus, ID dan format laporan dengan fixture baseline, termasuk karakter berbahaya pada nama.
4. Jalankan keenam pilihan Stockfish dengan file/NNUE lokal, cek loading malas, satu worker, opsi, MultiPV, cancel, error dan pemulihan; cek suara, animasi, grafik, pengaturan, ID/EN, unduhan laporan dan fitur lama lain.
5. Uji kompatibilitas synthetic IndexedDB v1/v2/v3 dan snapshot lama, tanpa menaikkan versi baru; uji data sebelum → sesudah, reload, dan pembacaan kembali pada versi sebelumnya bila rollback dilakukan. Uji IndexedDB/storage/Web Locks diblokir, kuota penuh, koneksi tertahan, snapshot rusak, penghapusan di tiap tahap dan dua tab. Hindari klaim rollback sempurna bila data pengguna telah berubah sementara.
6. Uji browser melalui ekspor statis yang dilayani pada root **dan** di bawah `/Maestro-Chess/`: seluruh panel, direct reload `/attributions/`, worker/WASM/bendera/suara, tab/fokus/keyboard, tooltip, menu dan dialog. Bandingkan screenshot dan computed styles terhadap baseline pada breakpoint bagian 7, beserta perilaku drag/touch/keyboard. Ukur chunk awal dan pastikan panel/engine tetap malas. Gunakan fixture HTTP deterministik; API live, Firefox/WebKit/perangkat dan pembaca layar diuji terpisah bila tersedia, atau dilaporkan sebagai celah, bukan dinyatakan lulus.
7. Jalankan axe dan tes keyboard sebagai pemeriksaan regresi terhadap baseline; jangan mengklaim kepatuhan WCAG penuh. Temuan aksesibilitas lama tidak diam-diam diubah sebagai bagian pemindahan.

Di akhir, ulangi seluruh suite pada build default dan subpath, periksa `public/**`/lisensi, semua referensi lama, hasil graf tanpa SCC atau deep import lintas modul, CI, serta diff dan status kerja. **Tidak ada merge otomatis.**

## 11. Urutan migrasi setelah disetujui

Setiap butir dapat dibagi menjadi beberapa commit kecil per modul; tiap commit/tahap harus dapat dibangun, melewati pemeriksaan relevan di bagian 10, lalu di-commit dan di-push ke branch aktif. Adapter kompatibilitas sementara boleh dipakai jika diperlukan agar setiap commit mandiri; nama/path sementaranya tidak termasuk peta tujuan akhir dan harus dihapus setelah seluruh pemanggil dipindah. Jangan membuat folder kosong.

0. Ambil `origin/main` terbaru dan periksa diff dengan basis audit. Integrasikan secara aman pada branch aktif bila diperlukan; hentikan dan minta arahan jika perubahan baru memengaruhi rancangan atau ada konflik. Tambahkan tes karakterisasi, pemeriksa arsitektur, konfigurasi glob lama+baru dan tes browser. Usulan hanya menambah dependensi **development** `@playwright/test` dan `@axe-core/playwright` yang kompatibel, skrip `test:arsitektur`/`test:e2e` serta job CI; stack produksi tidak diganti. Baseline graf hanya mengizinkan SCC lama yang tercatat.
1. Putuskan SCC database terlebih dahulu dengan mengekstrak bus revisi, pertahankan fasad dan live binding, tambah tes notifikasi/operasi/fallback. Setelah ini graf source harus tanpa siklus, termasuk pada setiap tahap berikutnya.
2. Pindahkan primitive lintas fitur yang benar-benar bersama dan `analisis`: pisah kontrak domain/PGN dari wrapper worker/orchestrator; pindahkan `MULTI_PV` dan helper warna dengan nilai/fungsi tetap. Perbarui semua pemanggil dan tes pada tahap yang sama.
3. Pindahkan `pekerjaan` dan `profil` sebagai modul terpisah, pertahankan singleton/cache dan format; lalu `sesi` beserta provider, preferensi dan tab. Pindahkan dependensi dengan memperhatikan urutan provider dan tidak memuat fitur berat lewat barrel umum.
4. Pindahkan `koleksi`, fasad 18 nama, repository, koordinasi dan use case penghapusan terkontrol. Uji kuat data lama/dua tab. Pindahkan `akun` bersama callback cache sehingga akses `bukaDB` dari UI dapat dihilangkan tanpa mengubah urutan.
5. Pindahkan `wawasan`, `impor`, kemudian `papan` dan `pengaturan`; gunakan entry point fitur, perbarui seluruh static/dynamic import, mock dan CSS yang terkait. Pisahkan `Arrow` dan hanya helper `capitalizeFirst`; jangan hapus konverter lama atau pilihan engine.
6. Pindahkan/pecah `shell`, perbarui route, README, komentar dan referensi konfigurasi/tes; hilangkan adapter/glob lama yang memang sudah tidak dipakai setelah pembuktian. Jalankan matriks lengkap, audit siklus, subpath, aset dan kompatibilitas data.
7. Sebelum setiap commit/push/PR, patuhi `AGENTS.md` dan skill identitas: periksa author, committer, hook dan pesan commit aktual. Push hanya branch aktif. Jika belum ada PR untuk branch tugas ini, buat PR dari branch ini dengan judul **`ruang kerja`**; jika sudah ada, gunakan PR tersebut. PR #14 yang ditemukan saat audit berasal dari branch lain dan bukan PR tugas ini. Periksa CI/identitas dan laporkan hasil; **tunggu instruksi merge eksplisit**.

## 12. Yang belum dilakukan / keputusan yang diminta

- Belum ada file aplikasi, tes, konfigurasi, aset atau data diubah; belum ada refactoring, commit, push atau PR untuk tugas ini.
- Peta dan API masih rancangan: pemecahan, nama API baru, dua CSS Module dan dependensi browser-test di atas memerlukan persetujuan. Tidak ada jaminan kesetaraan final sampai migrasi dan pengujian benar-benar dikerjakan.
- Belum diuji menyeluruh pada API Chess.com/Lichess live, Firefox/WebKit, perangkat fisik atau screen reader; header dan unduhan biner WASM produksi juga belum diverifikasi langsung. Baseline Chromium/mocks dan verifier lokal tidak menggantikannya.
- Perbaikan temuan lama di bagian 9 tidak termasuk persetujuan refactoring ini.

**Mohon setujui secara eksplisit rancangan dan urutan di atas, atau berikan bagian yang ingin diubah. Sampai ada persetujuan, pekerjaan berhenti pada audit dan dokumen ini.**
