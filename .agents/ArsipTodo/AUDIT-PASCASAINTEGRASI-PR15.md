# Audit pascaintegrasi PR #15 — Maestro Chess

**Objek audit:** [PR #15 — ruang kerja](https://github.com/Delta-Polder-Indonesia/Maestro-Chess/pull/15), HEAD `469d6a9c9b805d098b40bf6d4d346248a4d04b2f`. Audit ini tidak memperbaiki temuan atau memulai Tahap 2. Angka dan status di bawah berlaku pada saat pemeriksaan HEAD tersebut; hasil CI/Vercel yang dibaca dibedakan dari perintah lokal yang dijalankan ulang.

## A. Ringkasan status

- PR #15 **OPEN**, base `main`, mergeable/clean menurut GitHub; HEAD lokal dan remote sama. PR #14 juga **OPEN**, tidak diubah. `main` tetap di `cb17e22c11fda6ba36db8d42b334cafa1f1f2e98` pada pemeriksaan awal dan akhir.
- Kedua commit asli PR #14 dan commit Tahap 1 merupakan ancestor HEAD. Seluruh sembilan file PR #14 dan sembilan file Tahap 1 identik dengan commit sumber masing-masing, termasuk mode file. Tidak ada file tambahan dalam diff PR #15 di luar gabungan kedua set tersebut.
- Suite lokal **232/232**, lint, typecheck, build dan verifier root/subpath, pemeriksa siklus, dan audit dependency lulus. CI dan deployment Vercel yang dibaca memang menunjuk HEAD yang sama.
- Ditemukan masalah **yang sudah ada sebelum integrasi** pada tampilan akun saat pembacaan storage gagal, hasil/notifikasi saat kegagalan `pastikanKoleksi`, persistensi pengaturan saat storage penuh, cache profil, kontras tab Akun tidak aktif, status disabled tombol Muat, dan label bahasa Inggris. Tidak ada bukti bahwa masalah tersebut disebabkan oleh integrasi. Ada pula utang batas modul dan dokumentasi yang perlu diperhatikan.
- **Kesiapan bersyarat:** integrasi dan fondasi Tahap 1 terbukti utuh dalam cakupan pemeriksaan ini, tetapi belum cukup bukti untuk menyatakan seluruh regresi visual, aksesibilitas, dan perilaku lintas-browser bebas masalah. Browser/E2E tidak tersedia tanpa instalasi; belum ada pengujian visual atau profil browser riil dalam audit ini. Tinjau temuan dan setujui perlindungan pengujian sebelum migrasi berikutnya.
- **Cakupan dokumentasi/konfigurasi:** `README.md`, `AGENTS.md`, `.agents/skills/git-identity/SKILL.md`, README Analisa, `package.json`/lockfile, `.npmrc`, konfigurasi Next/ESLint/TypeScript/Tailwind/PostCSS/Vercel, workflow CI dan kedua skrip verifier ditinjau. Tidak ditemukan `DESIGN.md` atau instruksi `AGENTS.md` bersarang di source/tests.

## B. Verifikasi Git

- Branch aktif: `arena/8100c81e-maestro-chess`; HEAD: `469d6a9c9b805d098b40bf6d4d346248a4d04b2f`; tree: `64f062de322befeda4e39572e0e79e9c870df92f`.
- Parent commit gabungan: `fc1e735509d0b733d455cd6c2e0803adcee158e2` (Tahap 1) dan `b89e7638f271eeb771530f9573708ecf08af751e` (head PR #14). `8dbac6c726f55280aa796bfa2745b2691d04702f` adalah parent dari `b89e763`. Keempat commit tampak di riwayat PR #15 dan beridentitas pemilik.
- `git merge-base fc1e735 b89e763` = `661cc958060a8f1ef7aa256cd59153699c95f40c`; sesudah integrasi `git merge-base HEAD b89e763` = `b89e763`. `git merge-base --is-ancestor` berhasil untuk keempat commit. Clone bersifat shallow, tetapi kedua parent, merge-base dan semua commit yang diperlukan tersedia secara lokal.
- `git ls-remote --heads origin main arena/8100c81e-maestro-chess arena/dfcdb23b-maestro-chess` dan API PR menunjukkan SHA yang sama dengan objek yang diperiksa. Tidak dilakukan fetch, checkout, perubahan branch, atau penulisan riwayat.
- `git diff b89e763 HEAD -- <sembilan path PR14>` kosong; selain hash blob, perbandingan diff tersebut juga memeriksa mode. Sembilan path adalah:
  1. `src/app/globals.css`
  2. `src/halaman/Analisa/akun/PanelTarikPartai.jsx`
  3. `src/halaman/Analisa/komponen/areaKerja.jsx`
  4. `src/halaman/Analisa/komponen/nav/layarAkun.jsx`
  5. `src/halaman/Analisa/komponen/nav/layarPengaturan.jsx`
  6. `src/lib/terjemahan/en/analisa.js`
  7. `src/lib/terjemahan/id/analisa.js`
  8. `tests/analisa-layar-pengaturan.test.mjs`
  9. `tests/analisa-p1-ui.test.mjs`
- Pemeriksaan setara terhadap `fc1e735` lulus untuk `database/{akun,index,koleksi,partai,revisiBasis,statistik}.js` dan `tests/analisa-{revisi-storage,revisi,siklus-database}.test.mjs`. Kedua set masing-masing sembilan file tidak beririsan, dan tepat 18 path tersebut membentuk diff `main..HEAD`; `git diff --check cb17e22 HEAD` lulus. Tidak ditemukan perubahan tak terduga pada tracked source.

## C. Audit regresi PR #14

### Panel Akun

- `LayarAkun` menyatukan `DaftarAkun` dan `PanelTarikPartai` ([layarAkun.jsx:180–216](src/halaman/Analisa/komponen/nav/layarAkun.jsx#L180)); kartu memiliki kontrol pilih dan hapus terpisah, konfirmasi dan label aksesibel ([KartuAkun.jsx:113–145](src/halaman/Analisa/akun/KartuAkun.jsx#L113)). Daftar kosong tetap menyediakan tombol tambah ([DaftarAkun.jsx:31–49](src/halaman/Analisa/akun/DaftarAkun.jsx#L31)).
- Penghapusan berhasil membersihkan pilihan atau memilih akun berikutnya tanpa memanggil navigasi ke papan ([layarAkun.jsx:153–169](src/halaman/Analisa/komponen/nav/layarAkun.jsx#L153)); event storage untuk tab lain memperbarui daftar/pilihan ([layarAkun.jsx:50–65](src/halaman/Analisa/komponen/nav/layarAkun.jsx#L50)). Parent tetap memasang layar Akun ([areaKerja.jsx:568–602](src/halaman/Analisa/komponen/areaKerja.jsx#L568)). Tes komponen memeriksa penghapusan terakhir lokal dan event tab lain, tetapi menggunakan mock dan bukan bukti navigasi lintas-tab di browser nyata.
- Loading/progres, pembatalan dan pencegahan respons basi ada di [PanelTarikPartai.jsx:69–81,112–177,405–418](src/halaman/Analisa/akun/PanelTarikPartai.jsx#L69). Keberhasilan, arsip parsial, penyimpanan sementara/gagal dan error ditampilkan sebagai `status`/`alert` ([PanelTarikPartai.jsx:138–170,421–433](src/halaman/Analisa/akun/PanelTarikPartai.jsx#L138)); error penghapusan dan status proses ada di [layarAkun.jsx:116–121,180–184](src/halaman/Analisa/komponen/nav/layarAkun.jsx#L116). Ada ketidaksesuaian atribut disabled tombol utama yang direproduksi pada F.
- Daftar akun disimpan sebagai `maestro-analisa-daftar-akun`; rentang/filter yang terakhir digunakan sebagai `maestro-analisa-tarik-terakhir`, sedangkan pilihan akun tiap tab berada dalam `sessionStorage` `maestro-analisa-tab-v1` ([penyimpanan.js:14–36](src/halaman/Analisa/penyimpanan.js#L14), [PanelTarikPartai.jsx:150–162](src/halaman/Analisa/akun/PanelTarikPartai.jsx#L150), [tabKerja.js:3,45–76](src/halaman/Analisa/tabKerja.js#L3)). Opsi unduhan terakhir dan cache profil `maestro-analisa-pemain-v2-*` memiliki kunci terpisah dan tidak dibersihkan oleh handler penghapusan akun ([layarAkun.jsx:136–152](src/halaman/Analisa/komponen/nav/layarAkun.jsx#L136), [pemainCatur.js:25,56–59](src/lib/pemainCatur.js#L25)). Ini inventaris retensi, bukan klaim pelanggaran kebijakan privasi.
- Tata letak memakai kolom vertikal lalu horizontal pada `lg`, serta header yang berubah di `max-width:640px` ([layarAkun.jsx:185–204](src/halaman/Analisa/komponen/nav/layarAkun.jsx#L185), [globals.css:167–190](src/app/globals.css#L167)). Ini pemeriksaan source, **bukan** verifikasi responsivitas/render baru pada berbagai viewport. PR #14 juga menghilangkan satu padding dan `scrollbar-gutter` di kolom kanan; kesetaraan visual dan scrollbar belum dapat diklaim.
- Dalam locale Inggris, judul kosong mengikuti kamus menjadi “Pick an account”, tetapi tab pertama masih literal “Tanggal”. Ini dibuktikan dengan React Test Renderer dan kamus Inggris tiruan konteks, serta terjadi juga pada base; lihat P3-5.

### Warna Pengaturan dan tab Akun

- Kategori aktif Pengaturan benar-benar memakai `text-backgroundBoxBoxHighlighted`, penanda aktif terpisah, dan tidak menambahkan latar hijau; kategori tidak aktif memiliki hover ([layarPengaturan.jsx:197–217](src/halaman/Analisa/komponen/nav/layarPengaturan.jsx#L197)). Tab Tanggal/Filter memakai token hijau dan teks gelap melalui kelas aktif dan CSS ([PanelTarikPartai.jsx:239–255](src/halaman/Analisa/akun/PanelTarikPartai.jsx#L239), [globals.css:142–153](src/app/globals.css#L142)). CSS hasil build memuat kelas-kelas tersebut; tes memeriksa class/`aria-current`, bukan computed style browser.
- **Cascade statis:** `TabsList` menambahkan `bg-slate-100` ([tabs.jsx:6–10](src/components/ui/tabs.jsx#L6)) dan `cn` mempertahankan kedua kelas. Dalam CSS build root, `.slanted-tabs-container` muncul setelah `.bg-slate-100`; keduanya memiliki spesifisitas satu kelas, sehingga deklarasi custom `#2c2d30` mengungguli `#f1f5f9`. Trigger tidak aktif memiliki latar transparan dan teks abu-abu lewat aturan custom serta utilitas `!important` ([globals.css:129–153](src/app/globals.css#L129), [PanelTarikPartai.jsx:243–252](src/halaman/Analisa/akun/PanelTarikPartai.jsx#L243)). Ini analisis cascade dan CSS hasil build, bukan pengukuran computed style pada browser.
- Token Analisa: hijau `#81b64c`, teks gelap `#363636`, abu-abu `#939291` ([analisa.css:16–30,73–76,122–123](src/halaman/Analisa/analisa.css#L16)); latar panel `#121212` ([PanelLayar.jsx:31–32](src/halaman/Analisa/komponen/nav/PanelLayar.jsx#L31)). Perhitungan kontras sRGB nominal: tab aktif **5,02:1**, teks aktif Pengaturan pada `#121212` **7,79:1**, dan teks alert penghapusan `#fa412d` pada `#121212` **5,23:1**. Tab Akun tidak aktif adalah **4,43:1**, di bawah ambang 4,5:1 untuk teks kecil biasa; lihat P2-3. Ini perhitungan nilai source, bukan pengukuran piksel atau audit WCAG menyeluruh.
- Pencarian source menunjukkan aturan `.slanted-tab` hanya dipakai kedua trigger panel ini. Nilai token bersama tidak berubah dalam diff PR #14, sehingga perubahan selector itu tidak langsung mengganti nilai token komponen lain. Terdapat satu palet UI gelap yang terlihat di source; tujuh tema yang ada mengubah warna papan, bukan token UI ([boardThemes.js:1–9](src/halaman/Analisa/komponen/pengaturan/boardThemes.js#L1)). Tidak ada bukti pengujian mode warna sistem atau browser lain pada audit ini.
- `TabsTrigger` mendeklarasikan focus-visible `outline-slate-800` ([tabs.jsx:15–21](src/components/ui/tabs.jsx#L15)); warna deklarasi `#1e293b` berbanding `#2c2d30` hanya sekitar **1,06:1**. Gaya/kontras fokus yang benar-benar terlihat, termasuk clipping dan gaya bawaan browser, belum bisa dikonfirmasi tanpa browser. Kategori Pengaturan tidak memiliki aturan focus-visible khusus pada class-nya; jangan menganggap fokusnya sudah tervalidasi. Hover dan disabled/error tidak dinyatakan lulus secara visual.

## D. Audit Tahap 1: database dan penyimpanan

- Source diffs menunjukkan repository `akun`, `koleksi`, `partai`, dan `statistik` beralih dari mengimpor barrel ke `revisiBasis.js`; barrel me-re-export bus lalu repository ([database/index.js:1–16](src/halaman/Analisa/database/index.js#L1)). Teks implementasi bus hasil ekstraksi dibandingkan dengan blok lama di `cb17e22` dan identik byte-for-byte. Pemindai AST dan tes siklus atas 202 modul kode source menemukan nol siklus, nol import/require nonliteral dan nol referensi literal relatif/alias yang gagal diresolusi dalam cakupannya. URL worker/aset bukan edge import JS dan diaudit terpisah.
- Runtime import dari [basisData.js:26–45](src/halaman/Analisa/basisData.js#L26) menghasilkan tepat **18 named exports**: `bacaRevisiBasis`, `langgananRevisi`, `buatIdPartai`, `normalisasiHasil`, `normalisasiDataPartai`, `hitungStatistikKoleksiRingan`, `simpanBanyakPartai`, `pastikanKoleksi`, `ambilSemuaKoleksi`, `ambilDaftarPartai`, `ambilPartai`, `hapusPartai`, `hapusKoleksi`, `gabungkanPemain`, `bersihkanBasisData`, `hitungStatistikBasisData`, `eksporPgnKoleksi`, `imporPgnKeBasisData`. `naikkanRevisi` dan binding internal tidak bocor lewat fasad.
- Binding ESM tetap hidup; notifikasi sinkron mengambil snapshot `Set`, mempertahankan urutan, subscribe/unsubscribe, duplikasi dan isolasi exception ([revisiBasis.js:9–56](src/halaman/Analisa/database/revisiBasis.js#L9); [tes revisi](tests/analisa-revisi.test.mjs)). Tes storage memeriksa urutan **commit → listener → resolve** pada transaksi yang diuji, invalidasi cache statistik, abort tanpa notifikasi, fallback/recovery dan notifikasi pada cleanup gagal ([analisa-revisi-storage.test.mjs:26–143](tests/analisa-revisi-storage.test.mjs#L26)).
- Pemanggil aktual: `partai.js`, `koleksi.js` dan `akun.js` menaikkan revisi; `statistik.js` membaca live binding. Layar Akun, Database, Wawasan dan `useAkunKoleksi` berlangganan fasad; `KartuAkun` dan `DashboardAkun` membandingkan revisi cache ([layarAkun.jsx:38–47](src/halaman/Analisa/komponen/nav/layarAkun.jsx#L38), [layarDatabase.jsx:342](src/halaman/Analisa/komponen/nav/layarDatabase.jsx#L342), [layarWawasan.jsx:86](src/halaman/Analisa/komponen/nav/layarWawasan.jsx#L86), [useAkunKoleksi.js:24](src/halaman/Analisa/akun/useAkunKoleksi.js#L24)). Bus berada dalam satu instance modul/tab; pengujian ini tidak membuktikan bus itu sendiri melakukan broadcast lintas browser tab.
- Nama DB `maestro_chess_database_v1`, versi 3, store `partai`/`koleksi` dengan keyPath `id`, serta delapan indeks `platform`, `username`, `kombinasi`, `timestamp`, `platformWaktu`, `usernameWaktu`, `kombinasiWaktu`, `koleksiWaktu` diperiksa di source dan fake IndexedDB ([migrasi.js:20–33,372–391](src/halaman/Analisa/database/migrasi.js#L20)). `migrasi.js`, `statusSimpan.js`, `basisData.js`, `akun/koordinasiAkun.js`, dan `akun/daftarAkun.js` identik dengan base `cb17e22`. Penyimpanan pekerjaan tetap DB terpisah `maestro_chess_pekerjaan_v1` v1. Ini bukti perubahan source dan fixture sintetis, bukan pemeriksaan semua data pengguna nyata.
- Fallback tetap memakai snapshot `maestro-analisa-db-snapshot-v2` dan kunci lama `maestro-analisa-db-koleksi`/`maestro-analisa-db-partai` ([migrasi.js:49–75](src/halaman/Analisa/database/migrasi.js#L49)); recovery dan penghapusan cadangan ditinjau pada [migrasi.js:249–344,434–448](src/halaman/Analisa/database/migrasi.js#L249). Tes mencakup data rusak, kuota, transaksi abort, marker dan perubahan tab lain dengan mock.
- Penghapusan akun: pembatalan dimulai sebelum `Web Lock`, lalu dalam lock `maestro-analisa-basis-akun` dilakukan recovery/open DB, penanda generasi `maestro-analisa-generasi-akun-*`, hapus koleksi dengan **koneksi yang sama**, bersihkan cache, hapus daftar, finalisasi; kegagalan dilaporkan ([layarAkun.jsx:123–177](src/halaman/Analisa/komponen/nav/layarAkun.jsx#L123), [koordinasiAkun.js:9–11,141–198](src/halaman/Analisa/akun/koordinasiAkun.js#L9)). Pada browser tanpa Web Locks, operasi wajib menolak. Ini bukan transaksi atomik lintas IndexedDB/localStorage; hasil sebagian dan kebutuhan coba ulang adalah kontrak yang sudah didokumentasikan.
- **Kegagalan parsial yang diuji:** dalam fake IndexedDB, penghapusan satu partai uji commit, pembacaan localStorage kemudian disuntik gagal, pembersihan fallback mengembalikan `false`, dan revisi tetap naik ([koleksi.js:174–184](src/halaman/Analisa/database/koleksi.js#L174); [analisa-revisi-storage.test.mjs:118–143](tests/analisa-revisi-storage.test.mjs#L118)). Pada karakterisasi tambahan yang menggabungkan kode database dan `LayarAkun` melalui React Test Renderer, alert muncul, pilihan masih menunjuk Alice dan callback sukses tidak dipanggil. Karena listener revisi juga membaca daftar saat storage gagal, daftar di UI menjadi kosong walau daftar dalam storage tiruan masih berisi Alice; setelah pembacaan pulih dan panel diaktifkan ulang, daftar muncul lagi. Pengujian menggunakan Web Lock/localStorage tiruan, child UI stub dan satu data sintetis, bukan browser atau data pengguna. Tidak disimpulkan bahwa data lain hilang atau bangkit kembali. Lihat P2-4.
- **Pengecualian urutan transaksi:** pada cabang `reqGet.onerror`, `pastikanKoleksi` dapat memberi notifikasi dan mengembalikan objek sebelum transaksi abort. Kegagalan penulisan koleksi pun dapat menghasilkan objek meski transaksi abort. Kedua keadaan direproduksi pada HEAD dan base dengan read-error dan quota-error asinkron yang disuntik ke fake IndexedDB; lihat P2-5. Karena itu klaim commit → notifikasi → resolve hanya berlaku untuk jalur yang benar-benar diuji, bukan seluruh jalur database.

## E. Quality gate

Pengujian lokal menggunakan Node `v22.22.3`, npm `10.9.8` dan `node_modules` yang sudah tersedia; tidak dijalankan `npm ci`/install. Hasil remote di bawah hanya dibaca.

| Pemeriksaan | Perintah / sumber | Hasil aktual | Catatan |
|---|---|---|---|
| Suite penuh | `npm test` | **232 lulus, 0 gagal/skip** | Lokal pada HEAD; termasuk tes enam engine UCI nyata di Node dan fake IndexedDB, bukan E2E browser. |
| Engine UCI | `tests/analisa-p2-engine-uci.test.mjs` dalam `npm test` | Lulus untuk keenam pilihan engine | Menyalin enam loader JS/WASM dan berkas NNUE eksternal ke direktori sementara; subprocess Node menjalankan UCI `position startpos`, `go depth 4`, serta memeriksa `bestmove`, pesan error NNUE dan beberapa indikator NNUE. Stockfish 16 memakai wrapper khusus. Ini bukan tes browser Worker, MIME, atau deployment. |
| Bus dan storage | `node --test tests/analisa-revisi.test.mjs tests/analisa-revisi-storage.test.mjs` | 10/10 lulus | Subset dari 232, bukan tambahan 10 ke jumlah suite. |
| Siklus | `node --test tests/analisa-siklus-database.test.mjs` | 3/3 lulus | AST: 202 modul source; 541 pasangan internal unik, 10 dynamic import literal, 0 siklus/unknown import dalam cakupan parser. |
| Lint | `npm run lint` | Lulus | `--max-warnings=0`; pengecualian dan `react-hooks/exhaustive-deps: off` tetap sesuai konfigurasi. |
| Typecheck | `npm run typecheck` setelah build root | Lulus | `allowJs` tanpa `checkJs`; bukan jaminan seluruh logika JS telah diperiksa tipe. |
| Build root | `env -u NEXT_PUBLIC_BASE_PATH NEXT_TELEMETRY_DISABLED=1 npm run build` | Lulus | Ekspor statis; root dibangun kembali setelah subpath. |
| Build subpath | `NEXT_PUBLIC_BASE_PATH=/Maestro-Chess NEXT_TELEMETRY_DISABLED=1 npm run build` | Lulus | Dijalankan setelah build/typecheck root, tidak paralel. |
| Verifier ekspor | `npm run test:build` setelah masing-masing build | Lulus pada root dan subpath | 54 file wajib tidak kosong dan direktori aset; verifier bukan tes semua URL runtime. |
| Metadata build Vercel | `npm run test:vercel` setelah masing-masing build | Lulus pada root dan subpath | Memeriksa `vercel.json` dan manifest lokal `.next`, bukan respons deployment publik. |
| Aset & path HTML | Skrip Python sementara: `html.parser`, `sha256` untuk `public/**` vs `dist/**` | Root dan subpath: 4 HTML, 57 atribut `src`/`href` lokal (30 unik), **320 hash aset cocok**, 6 pasangan loader/WASM ada | Tidak mencakup URL yang hanya dibentuk saat runtime atau MIME/akses live. |
| Security | `npm audit --include=dev --audit-level=high` | 0 kerentanan dilaporkan | Hasil registry pada saat audit; tidak memperbarui paket. |
| Pohon paket | `npm ls --all --json` | Exit 0, tetapi 2 paket ditandai **extraneous** | `@emnapi/runtime@1.11.3` dan `@img/sharp-wasm32@0.35.5` ada pada `node_modules`; keduanya tercantum sebagai optional di lockfile. Tidak dibersihkan atau dipasang ulang. |
| Karakterisasi tambahan | Skrip Node/React Test Renderer sementara dengan `fetch`, storage, Web Lock dan fake IndexedDB | Mereproduksi dua masalah cache profil, atribut disabled, label Inggris, UI penghapusan parsial, urutan `pastikanKoleksi` pada kegagalan read/write, dan persistensi pengaturan saat kuota penuh | Skenario penghapusan parsial, label, error read/write dan kuota pengaturan juga direproduksi dari source `cb17e22` yang diekstrak ke direktori sementara; child UI dan browser APIs tiruan, tidak memakai jaringan live. Bukan tes browser. |
| Konsistensi artefak | Pemeriksa lokal atas laporan, peta AST dan CSV | 10 inventaris, 316 edge, 54 file/129 pasangan file-simbol konsisten; path tautan lokal diperiksa | Tiga snippet karakterisasi profil/read/write pada laporan dijalankan pada HEAD dan base. Anchor tautan diperiksa sampai baris awal; bukan pemeriksaan tautan eksternal atau browser. |
| Browser/visual | Pencarian executable Chromium/Firefox dan modul Playwright/Selenium/Puppeteer yang tersedia | **Tidak dijalankan** | Tidak tersedia; tidak memasang dependency/browser. Tidak ada screenshot, pengukuran breakpoint, keyboard, computed style atau aksesibilitas browser baru. |
| CI GitHub | `gh run view 45426969619` dan `gh run view 45426951777` | Keduanya `success`, SHA `469d6a9` | Hasil remote **dibaca**, bukan job yang dijalankan ulang lokal. [PR CI](https://github.com/Delta-Polder-Indonesia/Maestro-Chess/actions/runs/45426969619), [push CI](https://github.com/Delta-Polder-Indonesia/Maestro-Chess/actions/runs/45426951777). |
| Vercel | Metadata dan event deployment `dpl_6Dxy6Nz1ihGc2ECUf5ENtxXS4e8K` | **READY/STAGED**, preview, SHA `469d6a9` | [Inspector](https://vercel.com/acme-1004/maestro-chess/6Dxy6Nz1ihGc2ECUf5ENtxXS4e8K); status remote dibaca. Production terdaftar **READY/PROMOTED** pada `cb17e22`, bukan HEAD PR. Metadata bukan bukti respons HTTP, browser, isi setiap file, atau MIME WASM. |

Catatan deployment: metadata project/deployment menunjukkan `nodeVersion: 26.x` sementara CI dan README memakai Node 22; project settings menyebut `outputDirectory: dist`, sedangkan `vercel.json` menyetel `null`. Deployment preview tetap READY; precedence konfigurasi output efektif dan MIME/isi yang dilayani tidak dibuktikan di audit ini. Log preview menunjukkan peringatan npm `Unknown env config "cache-dir"` dan `eslint@9.39.5` deprecated; tidak ada kegagalan build yang dilaporkan. Tidak dilakukan perubahan konfigurasi.

## F. Temuan

Tidak ditemukan temuan P0 atau P1 yang terbukti dalam cakupan audit. Temuan berikut tidak disembunyikan oleh hasil tes hijau; semuanya belum diperbaiki.

### P2 — sedang

**P2-1 — kegagalan jaringan profil tersimpan sebagai `null` di cache memori.** Bukti: [pemainCatur.js:171–190](src/lib/pemainCatur.js#L171) mengembalikan nilai jika `cache.has(kunci)`, termasuk `null`, lalu menyimpan hasil HTTP gagal ke Map. Karakterisasi mock: request Lichess pertama gagal, pemanggilan kedua tetap `null` tanpa request baru; `segarkanKartuPemain` memaksa request kedua yang berhasil. Dampak: profil dapat tetap kosong setelah jaringan pulih; kartu Akun menggunakan hook tanpa tombol refresh ([KartuAkun.jsx:23,47–51](src/halaman/Analisa/akun/KartuAkun.jsx#L23)). Refresh memperbaiki hasil lookup selanjutnya, tetapi hook yang sudah mounted tidak berlangganan perubahan cache dan tidak otomatis menerima hasil refresh komponen lain ([pemainCatur.js:225–241](src/lib/pemainCatur.js#L225)); reload atau perubahan dependensi dapat memicu lookup ulang. File identik dengan `cb17e22`; bukan regresi yang dibuktikan dari PR #14/Tahap 1. **Rekomendasi:** sebelum mengubah perilaku, sepakati kebijakan retry/cache negatif dan lindungi offline→online dengan tes; pemindahan murni harus mempertahankan perilaku yang disetujui.

**P2-2 — respons profil lama dapat menimpa hasil refresh yang lebih baru.** Bukti: [pemainCatur.js:171–190,202–212](src/lib/pemainCatur.js#L171) tidak memeriksa generasi permintaan sebelum menulis Map dan localStorage. Karakterisasi mock: request lama ditahan, refresh menghasilkan `New Version`, lalu respons lama selesai dan lookup berikutnya serta `maestro-analisa-pemain-v2-...` berisi `Old Version`. Dampak: profil usang dapat tersimpan dan dibaca lagi setelah refresh/reload. Kartu Wawasan mempertahankan hasil refresh dalam state lokal ([kartuProfil.jsx:27–31,44–56](src/halaman/Analisa/komponen/nav/wawasan/kartuProfil.jsx#L27)), tetapi itu tidak mencegah cache bersama tertimpa atau lookup komponen lain memakai nilai lama. File sama dengan base. **Rekomendasi:** uji balapan ini dan putuskan pengamanan generasi/pembatalan sebagai perubahan perilaku terpisah yang disetujui.

**P2-3 — kontras teks tab Akun tidak aktif kurang dari 4,5:1.** Bukti: [PanelTarikPartai.jsx:243–252](src/halaman/Analisa/akun/PanelTarikPartai.jsx#L243), [globals.css:129–153](src/app/globals.css#L129), dan [analisa.css:17](src/halaman/Analisa/analisa.css#L17): teks `#939291` pada latar `#2c2d30`, rasio sRGB **4,433:1** untuk teks 12/14 px. Dampak: teks kecil tidak memenuhi ambang nominal 4,5:1 untuk kontras teks normal; rendering/anti-aliasing dan focus belum diperiksa di browser. Kondisi tidak aktif sama pada `cb17e22`. **Rekomendasi:** setujui terpisah penyesuaian token/warna dan uji kembali semua pemakai, mode, state dan breakpoint; jangan ubah tampilan dalam refactor diam-diam.

**P2-4 — daftar akun dapat tampak kosong setelah gagal membaca storage ketika penghapusan parsial.** Bukti: [koleksi.js:174–184](src/halaman/Analisa/database/koleksi.js#L174) mengirim revisi setelah commit meski cleanup fallback gagal; listener [layarAkun.jsx:38–47](src/halaman/Analisa/komponen/nav/layarAkun.jsx#L38) membaca ulang daftar, sementara [daftarAkun.js:14–21](src/halaman/Analisa/akun/daftarAkun.js#L14) menyamakan read error dengan `[]`. Dalam karakterisasi gabungan dengan fake IndexedDB dan React Test Renderer, injeksi kegagalan `getItem` tepat setelah commit menghasilkan alert, pilihan Alice tetap aktif, daftar terlihat `[]`, dan daftar dalam storage tiruan tetap `[Alice]`; setelah akses dipulihkan dan panel diaktifkan ulang daftar muncul kembali. Satu partai **uji** yang ditargetkan penghapusan memang tidak lagi ada pada DB tiruan; tidak diuji apakah data lain hilang atau muncul kembali. Skenario yang sama dijalankan pada source base `cb17e22`, bukan regresi integrasi. **Dampak:** status daftar dan pilihan dapat bertentangan saat storage tidak dapat dibaca, meskipun pesan penghapusan sebagian sudah benar. **Rekomendasi:** setelah persetujuan, bedakan gagal baca dari daftar kosong dan uji recovery/seleksi pada storage yang benar-benar diblokir di browser.

**P2-5 — error koleksi dapat memberi hasil dan notifikasi sebelum abort.** Bukti: [koleksi.js:69–110](src/halaman/Analisa/database/koleksi.js#L69) pada `reqGet.onerror` melakukan `store.put`, `naikkanRevisi`, lalu `resolve(baru)` tanpa menunggu commit; cabang penulisan biasa juga melakukan `resolve(baru)` pada `tx.onerror`. Dalam fake IndexedDB, suntikan kegagalan asinkron pada satu `get` menghasilkan urutan **revisi → resolve objek → abort**, dan koleksi uji tidak ada setelahnya. Suntikan terpisah `QuotaExceededError` pada `put` menghasilkan **resolve objek → abort**, tanpa koleksi tersimpan. Kedua karakterisasi sama pada HEAD dan source base `cb17e22`. **Dampak:** pemanggil dapat menerima objek meski koleksi tidak tersimpan; pada kegagalan read, listener juga terpicu untuk transaksi yang abort. `pastikanKoleksi` dipanggil saat sinkronisasi akun ([layarAkun.jsx:78–80](src/halaman/Analisa/komponen/nav/layarAkun.jsx#L78), [layarDatabase.jsx:357–360](src/halaman/Analisa/komponen/nav/layarDatabase.jsx#L357)). Tidak ada klaim kehilangan partai pengguna atau bukti frekuensi kegagalan ini pada browser nyata. **Rekomendasi:** setelah persetujuan, definisikan kontrak error/abort, pastikan pemberitahuan untuk perubahan IndexedDB menunggu commit, dan tambahkan tes read-error, quota dan abort.

**P2-6 — perubahan pengaturan dapat gagal tersimpan tanpa peringatan pada kondisi kuota tertentu.** [penyimpanan.js:61–72](src/halaman/Analisa/penyimpanan.js#L61) mengembalikan `false` dan mencatat error ke console bila `setItem` gagal; sakelar suara mengabaikan hasil itu dan tetap mengubah state ([moves.jsx:68–71](src/halaman/Analisa/komponen/pengaturan/moves.jsx#L68)). Peringatan global memeriksa `getItem` saat mount dan status pekerjaan, bukan setiap kegagalan tulis pengaturan ([areaKerja.jsx:153–169](src/halaman/Analisa/komponen/areaKerja.jsx#L153)). Dalam karakterisasi React Test Renderer dengan storage tiruan, `getItem` berhasil, `setItem` melempar `QuotaExceededError`, dan status pekerjaan dimock tersedia: sakelar berubah dari ON ke OFF, nilai tersimpan tetap `1`, tidak ada alert dari komponen peringatan yang diuji, dan setelah remount sakelar kembali ON. Error tetap tercatat di console. Skenario sama pada HEAD dan base `cb17e22`. **Dampak:** pilihan dapat tampak diterapkan tetapi tidak bertahan; ini bukan pengujian reload atau kuota di browser nyata. **Rekomendasi:** setelah persetujuan, pertimbangkan sinyal kegagalan tulis yang terlihat pengguna dan tes UI/reload; pertahankan operasi dalam memori bila itu kontrak yang diinginkan.

### P3 — rendah

**P3-1 — tombol Muat tampak enabled saat penghapusan sedang berlangsung.** Parent meneruskan `disabled={sedangHapus}` ([layarAkun.jsx:200–209](src/halaman/Analisa/komponen/nav/layarAkun.jsx#L200)), dan handler memang berhenti bila prop `disabled` ([PanelTarikPartai.jsx:83–85](src/halaman/Analisa/akun/PanelTarikPartai.jsx#L83)), tetapi atribut tombol utama hanya `disabled={!akunAktif || sedang}` ([PanelTarikPartai.jsx:377–389](src/halaman/Analisa/akun/PanelTarikPartai.jsx#L377)). React Test Renderer dengan akun terpilih dan `disabled=true` mereproduksi `button.disabled=false`; klik tidak memulai unduhan. Dampak: kontrol tampak dan terpapar aktif tetapi tidak melakukan tindakan selama penghapusan. Kondisi sama pada base. **Rekomendasi:** setelah persetujuan perubahan UX, samakan atribut dan guard, lalu uji loading/penghapusan dan keyboard.

**P3-2 — batas fitur belum menjadi API yang dapat ditegakkan.** [layarAkun.jsx:10–16,136–152](src/halaman/Analisa/komponen/nav/layarAkun.jsx#L10) mengimpor `bukaDB` internal sekaligus fasad koleksi; [bestMoves.jsx:5](src/halaman/Analisa/komponen/pengaturan/bestMoves.jsx#L5) mengimpor `Arrow` dari file papan besar, dan [ratings.jsx:2](src/halaman/Analisa/komponen/pengaturan/ratings.jsx#L2) memakai helper dalam konverter Chess.com. Ini adalah ketergantungan aktual/utang arsitektur, bukan bukti rusaknya runtime. Dampak: perubahan batas tanpa perencanaan dapat mengganggu lock, bundle, state dan pemanggil. **Rekomendasi:** rancang API eksplisit dan tes kontrak; untuk hapus akun pertahankan urutan lock dan satu koneksi, jangan hanya mengganti path import.

**P3-3 — komentar penyimpanan tidak sesuai implementasi.** [basisData.js:7,17](src/halaman/Analisa/basisData.js#L7) menyebut sembilan indeks dan bus berada di barrel; pembuat skema memastikan delapan indeks ([migrasi.js:383–390](src/halaman/Analisa/database/migrasi.js#L383)) dan bus kini di `revisiBasis.js`. [daftarAkun.js:6,12–17](src/halaman/Analisa/akun/daftarAkun.js#L6) menyebut kunci `kci-analisa-daftar-akun`, tetapi awalan aktual menghasilkan `maestro-analisa-daftar-akun` ([penyimpanan.js:14,33–36](src/halaman/Analisa/penyimpanan.js#L14)). Dampak: dokumentasi internal menyesatkan pembaca saat migrasi. **Rekomendasi:** setelah disetujui, perbarui komentar tanpa mengubah skema, kunci atau API.

**P3-4 — lingkungan build tidak identik.** [CI](.github/workflows/ci.yml#L28) dan [README](README.md#L22) menggunakan Node 22; metadata deployment Vercel yang diperiksa mencatat konfigurasi Node 26.x. Deployment sukses, jadi ini **bukan** klaim build rusak; dampaknya adalah reproduksibilitas/perbedaan cakupan versi. Metadata juga menyebut output directory project `dist` meski `vercel.json` berisi `null`; precedence efektif belum dibuktikan. **Rekomendasi:** putuskan versi/konfigurasi target dan uji kombinasi yang relevan sebelum menyelaraskan, dengan persetujuan pemilik.

**P3-5 — label “Tanggal” tidak diterjemahkan saat bahasa Inggris dipilih.** [PanelTarikPartai.jsx:243–247](src/halaman/Analisa/akun/PanelTarikPartai.jsx#L243) memakai literal, bukan `t(...)`; teks di sekelilingnya menggunakan kamus. Dengan React Test Renderer, kamus Inggris dan tab tiruan, judul kosong menjadi “Pick an account” tetapi tab tetap “Tanggal”. Source dan karakterisasi base `cb17e22` menunjukkan label yang sama, sehingga ini bukan regresi PR #14. **Dampak:** UI Inggris bercampur bahasa. **Rekomendasi:** setujui perubahan teks secara terpisah, lalu uji kedua locale tanpa mengasumsikan kunci terjemahan lain tepat untuk label ini.

### Reproduksi dua temuan profil tanpa jaringan atau perubahan source

Jalankan di root repository dengan dependency yang sudah ada. Mock respons dibuat di memori; hasil yang diharapkan menunjukkan perilaku bermasalah saat ini, bukan perbaikan:

```sh
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { ambilKartuPemain, segarkanKartuPemain } from './src/lib/pemainCatur.js';
const s = new Map();
globalThis.localStorage = { getItem: k => s.get(k) ?? null, setItem: (k,v) => s.set(k,v), removeItem: k => s.delete(k) };
let n = 0;
globalThis.fetch = async () => ++n === 1 ? {ok:false} : {ok:true,json:async()=>({id:'ok',perfs:{},count:{}})};
assert.equal(await ambilKartuPemain('retry-case','lichessOrg'), null);
assert.equal(await ambilKartuPemain('retry-case','lichessOrg'), null);
assert.equal(n, 1); // tidak ada retry
assert.equal((await segarkanKartuPemain('retry-case','lichessOrg')).exists, true);
assert.equal(n, 2);
let release; n = 0;
globalThis.fetch = async () => ++n === 1
  ? await new Promise(resolve => { release = () => resolve({ok:true,json:async()=>({id:'old',profile:{firstName:'Old',lastName:'Version'},perfs:{},count:{}})}); })
  : {ok:true,json:async()=>({id:'new',profile:{firstName:'New',lastName:'Version'},perfs:{},count:{}})};
const old = ambilKartuPemain('race-case','lichessOrg');
assert.equal((await segarkanKartuPemain('race-case','lichessOrg')).name, 'New Version');
release(); await old;
assert.equal((await ambilKartuPemain('race-case','lichessOrg')).name, 'Old Version');
assert.equal(JSON.parse(s.get('maestro-analisa-pemain-v2-lichessOrg:race-case')).name, 'Old Version');
console.log('Terbukti: cache negatif tidak retry dan respons lama menimpa cache baru.');
JS
```

### Reproduksi P2-5: error read IndexedDB sebelum abort

Dijalankan dari root dengan `fake-indexeddb` yang sudah terpasang. Injeksi memakai detail privat fake IndexedDB, sehingga ini karakterisasi sintetis, bukan uji browser atau data nyata:

```sh
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { indexedDB, IDBDatabase, IDBObjectStore, IDBKeyRange } from 'fake-indexeddb';
const nilai = new Map();
globalThis.localStorage = {
  getItem: k => nilai.get(k) ?? null,
  setItem: (k,v) => nilai.set(k,String(v)),
  removeItem: k => nilai.delete(k),
  key: i => [...nilai.keys()][i] ?? null,
  get length() { return nilai.size; }
};
globalThis.window = {indexedDB, addEventListener(){}, removeEventListener(){}};
globalThis.IDBKeyRange = IDBKeyRange;
Object.defineProperty(globalThis, 'navigator', {configurable:true,value:{
  locks:{request:async (_nama, _opsi, aksi) => aksi()}
}});
const basis = await import('./src/halaman/Analisa/basisData.js');
const {bukaDB} = await import('./src/halaman/Analisa/database/migrasi.js');
await bukaDB();
const riwayat = [], awal = basis.bacaRevisiBasis();
const berhenti = basis.langgananRevisi(n => riwayat.push(`revisi:${n}`));
let akhir;
const tunggu = new Promise(resolve => { akhir = resolve; });
const txAsli = IDBDatabase.prototype.transaction;
const getAsli = IDBObjectStore.prototype.get;
IDBDatabase.prototype.transaction = function(stores, mode, ...rest) {
  const tx = txAsli.call(this, stores, mode, ...rest);
  if (mode === 'readwrite' && Array.isArray(stores) && stores.length === 1 && stores[0] === 'koleksi') {
    tx.addEventListener('complete', () => { riwayat.push('commit'); akhir(); });
    tx.addEventListener('abort', () => { riwayat.push('abort'); akhir(); });
  }
  return tx;
};
IDBObjectStore.prototype.get = function(kunci) {
  if (this.name !== 'koleksi' || kunci !== 'chessCom:readfailed') return getAsli.call(this,kunci);
  // Injeksi hanya di fake-indexeddb: operasi get asinkron melempar.
  const raw = this._rawObjectStore, asli = raw.getValue;
  raw.getValue = () => { throw new DOMException('injected', 'UnknownError'); };
  try { return getAsli.call(this,kunci); } finally { raw.getValue = asli; }
};
try {
  const hasil = await basis.pastikanKoleksi({platform:'chessCom',username:'ReadFailed'});
  riwayat.push('resolve');
  await tunggu;
  assert.equal(hasil.id,'chessCom:readfailed');
  assert.deepEqual(riwayat,[`revisi:${awal+1}`,'resolve','abort']);
} finally {
  berhenti();
  IDBDatabase.prototype.transaction = txAsli;
  IDBObjectStore.prototype.get = getAsli;
}
assert.equal((await basis.ambilSemuaKoleksi()).some(k => k.id === 'chessCom:readfailed'),false);
console.log('Terbukti:',riwayat.join(' → '),'; koleksi uji tidak tersimpan.');
JS
```

### Reproduksi P2-5: error write IndexedDB sebelum abort

Jalankan terpisah dari contoh read. Injeksi menggunakan detail privat `fake-indexeddb`, bukan database browser atau data nyata:

```sh
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { indexedDB, IDBDatabase, IDBObjectStore, IDBKeyRange } from 'fake-indexeddb';
const nilai = new Map();
globalThis.localStorage = {
  getItem: k => nilai.get(k) ?? null,
  setItem: (k,v) => nilai.set(k,String(v)),
  removeItem: k => nilai.delete(k),
  key: i => [...nilai.keys()][i] ?? null,
  get length() { return nilai.size; }
};
globalThis.window = {indexedDB, addEventListener(){}, removeEventListener(){}};
globalThis.IDBKeyRange = IDBKeyRange;
Object.defineProperty(globalThis, 'navigator', {configurable:true,value:{
  locks:{request:async (_nama, _opsi, aksi) => aksi()}
}});
const basis = await import('./src/halaman/Analisa/basisData.js');
const {bukaDB} = await import('./src/halaman/Analisa/database/migrasi.js');
await bukaDB();
const riwayat = [], awal = basis.bacaRevisiBasis();
const berhenti = basis.langgananRevisi(n => riwayat.push(`revisi:${n}`));
let akhir;
const tunggu = new Promise(resolve => { akhir = resolve; });
const txAsli = IDBDatabase.prototype.transaction;
const putAsli = IDBObjectStore.prototype.put;
IDBDatabase.prototype.transaction = function(stores, mode, ...rest) {
  const tx = txAsli.call(this, stores, mode, ...rest);
  if (mode === 'readwrite' && Array.isArray(stores) && stores.length === 1 && stores[0] === 'koleksi') {
    tx.addEventListener('complete', () => { riwayat.push('commit'); akhir(); });
    tx.addEventListener('abort', () => { riwayat.push('abort'); akhir(); });
  }
  return tx;
};
IDBObjectStore.prototype.put = function(data, ...rest) {
  if (this.name !== 'koleksi' || data?.id !== 'chessCom:writefailed') return putAsli.call(this,data,...rest);
  // Injeksi hanya di fake-indexeddb: put asinkron gagal karena kuota.
  const raw = this._rawObjectStore, asli = raw.storeRecord;
  raw.storeRecord = () => { throw new DOMException('injected', 'QuotaExceededError'); };
  try { return putAsli.call(this,data,...rest); } finally { raw.storeRecord = asli; }
};
try {
  const hasil = await basis.pastikanKoleksi({platform:'chessCom',username:'WriteFailed'});
  riwayat.push('resolve');
  await tunggu;
  assert.equal(hasil.id,'chessCom:writefailed');
  assert.deepEqual(riwayat,['resolve','abort']);
  assert.equal(basis.bacaRevisiBasis(),awal);
} finally {
  berhenti();
  IDBDatabase.prototype.transaction = txAsli;
  IDBObjectStore.prototype.put = putAsli;
}
assert.equal((await basis.ambilSemuaKoleksi()).some(k => k.id === 'chessCom:writefailed'),false);
console.log('Terbukti:',riwayat.join(' → '),'; koleksi uji tidak tersimpan.');
JS
```

## G. Rekomendasi Tahap 2 dan inventaris kandidat

**Usulan pertama: Profil, secara bersyarat dan hanya setelah persetujuan.** Profil memiliki dua file utama, enam edge masuk dari Akun/Papan/Wawasan, satu edge keluar ke helper aset bersama dan tidak memakai IndexedDB. Dibanding Impor ia memiliki lebih sedikit dependensi keluar; dibanding Pekerjaan/Koleksi ia tidak mengelola laporan atau data partai. Namun P2-1/P2-2 dan belum adanya tes langsung berarti **belum aman dimigrasi tanpa characterization gate**. Jangan memperbaiki bug tersebut diam-diam di refactor. Pertahankan satu cache, kunci/format, empat ekspor yang tersedia, normalisasi platform/nama, state hook dan URL base path; jika perbaikan perilaku diinginkan, minta persetujuan terpisah. Tiga simbol diimpor lintas kelompok; `ambilKartuPemain` diekspor dan dipanggil di dalam file sendiri, tetapi tidak ditemukan sebagai import lintas kelompok. Rancangan tetap satu modular monolith dan satu deployment.

**Metode inventaris:** 205 file `src` yang dilacak semuanya dipetakan satu kali sebagai *kepemilikan utama calon*, menggunakan peta rancangan sebelumnya dan menambahkan `database/revisiBasis.js` ke Koleksi. Sepuluh kandidat mencakup 165 file; sisanya 25 shared, 9 shell, 5 app dan 1 README. Ini pengelompokan audit, **bukan** struktur/API yang sudah ada atau daftar file yang wajib dipindahkan. File dapat memiliki tanggung jawab lintas fitur; CSS bersama, tes, aset, pemanggil dan konfigurasi dijelaskan terpisah dan tidak dihitung ulang dalam jumlah utama.

Graf dibangun dengan parser TypeScript atas 202 file JS/JSX/TS/TSX source yang dilacak: import, re-export dan `import()`/`require()` literal relatif/alias `@/`; 542 deklarasi internal menjadi 541 pasangan file unik, 316 pasangan melintasi kelompok usulan. Paket eksternal, CSS, browser APIs, `new Worker`, URL yang dibentuk dan dependensi tes tidak dihitung sebagai edge internal. Tidak ada resolusi literal gagal atau import/require nonliteral dalam cakupan parser. Statistik *masuk/keluar* di bawah menghitung **pasangan file unik**, bukan jumlah fitur, simbol atau pemanggilan runtime. Peta 316 edge dengan path/baris tersedia di [PETA-DEPENDENSI-PASCASAINTEGRASI-PR15.csv](PETA-DEPENDENSI-PASCASAINTEGRASI-PR15.csv).

| Kandidat | File utama | Edge masuk | Edge keluar | Kompleksitas relatif |
|---|---:|---:|---:|---|
| Profil | 2 | 6 | 1 | Rendah–sedang, bersyarat |
| Pekerjaan | 4 | 15 | 0 | Sedang–tinggi |
| Analisis | 14 | 42 | 3 | Tinggi |
| Sesi | 21 | 68 | 8 | Tinggi |
| Koleksi | 29 | 18 | 30 | Tinggi |
| Papan | 46 | 5 | 83 | Sangat tinggi |
| Impor | 2 | 2 | 11 | Sedang–tinggi |
| Wawasan | 14 | 1 | 23 | Sedang–tinggi |
| Akun | 18 | 2 | 65 | Tinggi |
| Pengaturan | 15 | 3 | 40 | Sedang–tinggi |

### Peta dependensi konkret kandidat Profil

```text
src/halaman/Analisa/akun/KartuAkun.jsx:23 -> src/lib/pemainCatur.js
src/halaman/Analisa/komponen/game/game.jsx:13 -> src/lib/pemainCatur.js
src/halaman/Analisa/komponen/game/name.jsx:6 -> src/lib/bendera.js
src/halaman/Analisa/komponen/menu/analysis/summary/playersAccuracy.jsx:5 -> src/lib/pemainCatur.js
src/halaman/Analisa/komponen/nav/wawasan/kartuProfil.jsx:14 -> src/lib/bendera.js
src/halaman/Analisa/komponen/nav/wawasan/kartuProfil.jsx:8 -> src/lib/pemainCatur.js
src/lib/bendera.js:1 -> src/lib/asets.js
```

Nama file dan nomor baris ini diperoleh dari source HEAD. Fitur/panel tidak langsung mengimpor barrel Profil karena barrel tersebut belum ada. Akun, Papan dan Wawasan harus tetap berbagi **satu** cache saat batas baru dirancang.

### Profil — 2 file utama

- **Tanggung jawab:** Klien dan normalisasi profil Chess.com/Lichess, cache Map/localStorage, hook React, validasi dan URL bendera lokal. Tidak memiliki IndexedDB. `pemainCatur.js` masih mencampur HTTP, cache dan hook; `bendera.js` memakai helper URL aset.
- **Dependensi masuk:** 6 pasangan: akun 1, papan 3, wawasan 2.
- **Dependensi keluar:** 1 pasangan: shared 1. Package eksternal yang tercatat pada file kelompok: `react` (1); akses browser/HTTP/worker dicatat terpisah dari graf.
- **API saat ini:** Tidak ada barrel fitur resmi. `segarkanKartuPemain`, `useKartuPemain`, dan `urlBendera` benar-benar diimpor lintas kelompok; `ambilKartuPemain` juga diekspor dan dipakai oleh fungsi/hook di file sendiri, tetapi tidak ditemukan diimpor lintas kelompok.
- **CSS/aset:** Tidak memiliki CSS sendiri; tampil lewat kelas dan token global milik konsumen Akun/Papan/Wawasan; bendera di `public/flags/`.
- **Risiko:** Singleton cache, kunci `maestro-analisa-pemain-v2-`, hasil null/offline, urutan respons dan kontrak dua platform. P2-1/P2-2 terbukti; risiko bukan nol.
- **Pengujian pelindung:** Tidak ditemukan tes langsung API profil/bendera dalam `tests/`; `analisa-tab-panel.test.mjs` dan `analisa-kinerja.test.mjs` memock hook. Perlu karakterisasi sukses/404/offline→online, balapan refresh, Map/localStorage, case/dua platform, hook unmount dan URL base path sebelum migrasi; perubahan hasil bug butuh izin tersendiri.
- **Kompleksitas:** Rendah–sedang, bersyarat.

Daftar file utama:
```text
src/lib/bendera.js
src/lib/pemainCatur.js
```

### Pekerjaan — 4 file utama

- **Tanggung jawab:** Store dan adapter IndexedDB laporan/draf, snapshots, antrean tulis, manajer laporan aktif dan riwayat fitur; singleton `pekerjaan` dipakai oleh shell, papan, impor dan sesi.
- **Dependensi masuk:** 15 pasangan: impor 2, papan 3, sesi 3, shell 7.
- **Dependensi keluar:** 0 pasangan: tidak ada edge internal lintas kelompok. Package eksternal yang tercatat pada file kelompok: `chess.js` (1), `react` (1); akses browser/HTTP/worker dicatat terpisah dari graf.
- **API saat ini:** Ekspor path-level mencakup `pekerjaan`, `buatAdapterPekerjaan`, `buatPenyimpananPekerjaan`, `ID_DRAF_IMPOR`, `buatIdPekerjaan`, `buatIdDrafImpor`, `snapshotLaporanAman`, `simpanDrafImpor`, `daftarkanPembacaLaporan`, `simpanLaporanAktif`, `buatManajerLaporan`, `catatFitur`, `daftarRiwayat`, `usePekerjaan`; belum ada barrel fitur. Kedua fungsi `buatAdapterPekerjaan`/`buatPenyimpananPekerjaan` dipakai internal dan diimpor tes, tetapi tidak ditemukan sebagai import lintas kelompok source. Simbol yang benar-benar melintasi kelompok dicantumkan di matriks di bawah.
- **CSS/aset:** Tidak memiliki stylesheet sendiri; presentasi riwayat berada di shell dan memakai CSS/tokens bersama.
- **Risiko:** DB terpisah `maestro_chess_pekerjaan_v1` v1, snapshot/pointer dan serialisasi: kesalahan dapat kehilangan laporan/draf. Cross-tab last-write-wins harus tetap didokumentasikan.
- **Pengujian pelindung:** Lindungi dengan `tests/analisa-pekerjaan.test.mjs`, `analisa-impor-draf.test.mjs`, `analisa-riwayat-navigasi.test.mjs` dan `analisa-tab-kerja.test.mjs`; tambah fixture DB lama, kuota/blokir, race dan reload browser.
- **Kompleksitas:** Sedang–tinggi.

Daftar file utama:
```text
src/halaman/Analisa/manajerLaporan.js
src/halaman/Analisa/pekerjaan.js
src/halaman/Analisa/riwayatFitur.js
src/halaman/Analisa/usePekerjaan.js
```

### Analisis — 14 file utama

- **Tanggung jawab:** PGN/FEN, rumus akurasi/evaluasi, fase, buku pembukaan, store analisis dan orkestrasi Stockfish/UCI serta enam pilihan engine dan worker.
- **Dependensi masuk:** 42 pasangan: akun 17, impor 1, papan 17, pengaturan 2, sesi 3, wawasan 2.
- **Dependensi keluar:** 3 pasangan: shared 3. Package eksternal yang tercatat pada file kelompok: `chess.js` (5); akses browser/HTTP/worker dicatat terpisah dari graf.
- **API saat ini:** Ekspor aktual tersebar: `EngineAnalisis`, `parsePGN`, `bacaPartaiPGN`, `MULTI_PV`, `GALAT_*`, fungsi akurasi/evaluasi, `catatAnalisis`/`langgananAnalisis`, `DAFTAR_ENGINE`, `ENGINE_BAKU`, `EngineCatur`; belum ada barrel fitur.
- **CSS/aset:** Tidak punya CSS domain khusus; hasil ditampilkan oleh Papan/Wawasan dengan `globals.css`, `analisa.css` dan utilitas Tailwind.
- **Risiko:** Dipakai luas, engine/NNUE, pembatalan, parser dan angka hasil; pemisahan dapat menggandakan worker atau mengubah output. Aset/URL harus tetap sama.
- **Pengujian pelindung:** Lindungi dengan `analisa-engine.test.mjs`, `analisa-p2-engine-uci.test.mjs`, `analisa-p2-engine-provider.test.mjs`, `analisa-p2-engine-provenance.test.mjs`, `analisa-import.test.mjs`; tambah pembandingan fixture PGN/FEN dan worker browser root/subpath.
- **Kompleksitas:** Tinggi.

Daftar file utama:
```text
src/halaman/Analisa/mesin/akurasi.js
src/halaman/Analisa/mesin/analisisTersimpan.js
src/halaman/Analisa/mesin/buku.js
src/halaman/Analisa/mesin/cekWasm.js
src/halaman/Analisa/mesin/engine.js
src/halaman/Analisa/mesin/evaluasi.js
src/halaman/Analisa/mesin/fase.js
src/halaman/Analisa/mesin/keamananBidak.js
src/halaman/Analisa/mesin/kunciFen.js
src/halaman/Analisa/mesin/langkahKritis.js
src/halaman/Analisa/mesin/peluang.js
src/halaman/Analisa/mesin/penilaian.js
src/halaman/Analisa/mesin/ringkasanAnalisis.js
src/lib/engineCatur.js
```

### Sesi — 21 file utama

- **Tanggung jawab:** Provider dan context React untuk papan, analisis, engine, kesalahan, impor, preferensi dan tab kerja; dropdown serta penyimpanan preferensi/tema papan.
- **Dependensi masuk:** 68 pasangan: akun 8, impor 2, koleksi 2, papan 18, pengaturan 18, shell 18, wawasan 2.
- **Dependensi keluar:** 8 pasangan: analisis 3, pekerjaan 3, shared 2. Package eksternal yang tercatat pada file kelompok: `react` (15), `lucide-react` (1); akses browser/HTTP/worker dicatat terpisah dari graf.
- **API saat ini:** Ekspor aktual antarfile antara lain `AnalyzeContext`, `ConfigContext`, `BoardContext`, `useBoard`, `useTampilan`, `TabKerjaProvider`, `useTabKerja`, `bacaTeks`/`tulis` dan `boardThemes`; tidak ada API fitur tunggal.
- **CSS/aset:** Token dari `analisa.css`/`globals.css`; `boardThemes.js` mendefinisikan warna papan, bukan stylesheet fitur.
- **Risiko:** Identitas context, urutan provider, lifetime papan/worker, listener aktif, kunci local/sessionStorage dan state tiap tab sangat sensitif.
- **Pengujian pelindung:** Lindungi dengan `analisa-tab-kerja.test.mjs`, `analisa-tab-panel.test.mjs`, `analisa-kinerja.test.mjs`, `analisa-storage.test.mjs`, `analisa-pengaturan-kinerja.test.mjs`; tambah navigasi/restore dan browser multi-tab.
- **Kompleksitas:** Tinggi.

Daftar file utama:
```text
src/halaman/Analisa/komponen/errors/pushPageError.js
src/halaman/Analisa/komponen/nav/SelectDaftar.jsx
src/halaman/Analisa/komponen/nav/useDropdown.js
src/halaman/Analisa/komponen/pengaturan/boardThemes.js
src/halaman/Analisa/konteks/analyze.jsx
src/halaman/Analisa/konteks/analyzeKonteks.js
src/halaman/Analisa/konteks/board.jsx
src/halaman/Analisa/konteks/boardKonteks.js
src/halaman/Analisa/konteks/config.jsx
src/halaman/Analisa/konteks/configKonteks.js
src/halaman/Analisa/konteks/errors.jsx
src/halaman/Analisa/konteks/errorsKonteks.js
src/halaman/Analisa/konteks/import.jsx
src/halaman/Analisa/konteks/importKonteks.js
src/halaman/Analisa/konteks/mesin.jsx
src/halaman/Analisa/konteks/mesinKonteks.js
src/halaman/Analisa/konteks/panelAktif.js
src/halaman/Analisa/konteks/tabKerja.jsx
src/halaman/Analisa/penyimpanan.js
src/halaman/Analisa/tabKerja.js
src/lib/titipanAnalisa.js
```

### Koleksi — 29 file utama

- **Tanggung jawab:** Fasad dan repository partai/koleksi/statistik, migrasi, revisi, fallback, daftar dan koordinasi akun, plus layar/tabel basis data.
- **Dependensi masuk:** 18 pasangan: akun 12, impor 2, shell 1, wawasan 3.
- **Dependensi keluar:** 30 pasangan: sesi 2, shared 28. Package eksternal yang tercatat pada file kelompok: `react` (4), `@tanstack/react-table` (2), `lucide-react` (2), `@tanstack/react-table/legacy` (1), `chess.js` (1), `class-variance-authority` (1); akses browser/HTTP/worker dicatat terpisah dari graf.
- **API saat ini:** `basisData.js` adalah fasad eksplisit 18 nama pada bagian D. `daftarAkun.js`, `koordinasiAkun.js` dan `statusSimpan.js` masih menyediakan ekspor path-level yang dipakai lintas fitur.
- **CSS/aset:** Tidak ada stylesheet fitur sendiri; layar dan dialog memakai token `globals.css`/`analisa.css` dan utilitas Tailwind.
- **Risiko:** Skema/fallback, satu bus, lock, transaksi, data lama dan akses langsung `bukaDB` dari Akun; migrasi paling sensitif terhadap kehilangan data.
- **Pengujian pelindung:** Pertahankan `analisa-revisi*.test.mjs`, `analisa-siklus-database.test.mjs`, `analisa-p1-{indexeddb,fallback,cross-tab,recovery,corrupt-recovery}.test.mjs`, `analisa-database.test.mjs`; tambah DB versi lama dan Web Locks browser nyata.
- **Kompleksitas:** Tinggi.

Daftar file utama:
```text
src/components/ui/alert.jsx
src/halaman/Analisa/akun/daftarAkun.js
src/halaman/Analisa/akun/koordinasiAkun.js
src/halaman/Analisa/akun/useAkunKoleksi.js
src/halaman/Analisa/basisData.js
src/halaman/Analisa/database/akun.js
src/halaman/Analisa/database/index.js
src/halaman/Analisa/database/koleksi.js
src/halaman/Analisa/database/migrasi.js
src/halaman/Analisa/database/partai.js
src/halaman/Analisa/database/revisiBasis.js
src/halaman/Analisa/database/statistik.js
src/halaman/Analisa/database/statusSimpan.js
src/halaman/Analisa/database/tanggalPgn.js
src/halaman/Analisa/komponen/nav/database/dialogDatabase.jsx
src/halaman/Analisa/komponen/nav/database/formatDatabase.js
src/halaman/Analisa/komponen/nav/database/ikonDatabase.jsx
src/halaman/Analisa/komponen/nav/database/kolomKoleksi.jsx
src/halaman/Analisa/komponen/nav/database/panelRingkasanDatabase.jsx
src/halaman/Analisa/komponen/nav/database/panelTabelData.jsx
src/halaman/Analisa/komponen/nav/database/tabelPartai.jsx
src/halaman/Analisa/komponen/nav/database/tabelRingkasan.jsx
src/halaman/Analisa/komponen/nav/database/toolbarTabel.jsx
src/halaman/Analisa/komponen/nav/layarDatabase.jsx
src/halaman/Analisa/komponen/svg/back.jsx
src/halaman/Analisa/komponen/svg/download.jsx
src/halaman/Analisa/komponen/svg/square-fill-equal.jsx
src/halaman/Analisa/komponen/svg/square-fill-minus.jsx
src/halaman/Analisa/komponen/svg/square-fill-plus.jsx
```

### Papan — 46 file utama

- **Tanggung jawab:** Board, bidak, drag/touch/keyboard, navigasi langkah, suara, jam, grafik dan komponen laporan/analisis.
- **Dependensi masuk:** 5 pasangan: pengaturan 1, shell 4.
- **Dependensi keluar:** 83 pasangan: analisis 17, pekerjaan 3, profil 3, sesi 18, shared 42. Package eksternal yang tercatat pada file kelompok: `react` (17), `chess.js` (8); akses browser/HTTP/worker dicatat terpisah dari graf.
- **API saat ini:** Ekspor saat ini berupa komponen default `game.jsx`, `board.jsx`, menu dan kontrol; `Arrow` diekspor dari `board.jsx` dan dipakai Pengaturan. Belum ada public API fitur formal.
- **CSS/aset:** Global `analisa.css`/`globals.css`, utilitas Tailwind, warna `boardThemes`; memanfaatkan aset suara, bidak, bendera dan worker.
- **Risiko:** Banyak file, 83 edge keluar, mempertahankan mount papan saat tersembunyi, fokus, gesture, ukuran, animasi dan state laporan.
- **Pengujian pelindung:** Lindungi dengan `analisa-p2-board.test.mjs`, `analisa-p2-fen-navigation.test.mjs`, `analisa-papan.test.mjs`, `analisa-kinerja.test.mjs`; perlu visual/keyboard/touch, suara, screen reader dan perangkat nyata.
- **Kompleksitas:** Sangat tinggi.

Daftar file utama:
```text
src/components/chess/ChessPiece.jsx
src/halaman/Analisa/komponen/boardMenu/boardMenu.jsx
src/halaman/Analisa/komponen/game/board.jsx
src/halaman/Analisa/komponen/game/capturedPieces.jsx
src/halaman/Analisa/komponen/game/clock.jsx
src/halaman/Analisa/komponen/game/evaluation.jsx
src/halaman/Analisa/komponen/game/game.jsx
src/halaman/Analisa/komponen/game/gameStartSound.js
src/halaman/Analisa/komponen/game/getMoves.js
src/halaman/Analisa/komponen/game/keyboardPapan.js
src/halaman/Analisa/komponen/game/name.jsx
src/halaman/Analisa/komponen/game/pendengarKeyboard.jsx
src/halaman/Analisa/komponen/game/useAnalisisPapan.js
src/halaman/Analisa/komponen/game/useMuatPartai.js
src/halaman/Analisa/komponen/game/usePekerjaanLaporan.js
src/halaman/Analisa/komponen/menu/analysis/gameButtons.jsx
src/halaman/Analisa/komponen/menu/analysis/gameChart.jsx
src/halaman/Analisa/komponen/menu/analysis/grafikEval.js
src/halaman/Analisa/komponen/menu/analysis/moves/comments.jsx
src/halaman/Analisa/komponen/menu/analysis/moves/moves.jsx
src/halaman/Analisa/komponen/menu/analysis/moves/movesData.js
src/halaman/Analisa/komponen/menu/analysis/moves/overallGameComment.jsx
src/halaman/Analisa/komponen/menu/analysis/summary/gameRating.jsx
src/halaman/Analisa/komponen/menu/analysis/summary/playersAccuracy.jsx
src/halaman/Analisa/komponen/menu/analysis/summary/playersAccuracyData.js
src/halaman/Analisa/komponen/menu/analysis/summary/ratingBox.jsx
src/halaman/Analisa/komponen/menu/analysis/summary/ratingCount.jsx
src/halaman/Analisa/komponen/menu/analysis/summary/summary.jsx
src/halaman/Analisa/komponen/menu/loading/grafikMuat.jsx
src/halaman/Analisa/komponen/menu/loading/loading.jsx
src/halaman/Analisa/komponen/menu/loading/loadingBar.jsx
src/halaman/Analisa/komponen/menu/loading/persenProgres.js
src/halaman/Analisa/komponen/menu/menu.jsx
src/halaman/Analisa/komponen/suaraPapan.js
src/halaman/Analisa/komponen/svg/boardIcon.jsx
src/halaman/Analisa/komponen/svg/files.jsx
src/halaman/Analisa/komponen/svg/lens.jsx
src/halaman/Analisa/komponen/svg/nextMove.jsx
src/halaman/Analisa/komponen/svg/pause.jsx
src/halaman/Analisa/komponen/svg/play.jsx
src/halaman/Analisa/komponen/svg/result.jsx
src/halaman/Analisa/komponen/svg/skipGame.jsx
src/halaman/Analisa/komponen/svg/star.jsx
src/halaman/TekaTeki/animasiBidak.js
src/lib/suara.js
src/lib/waktuSenggang.js
```

### Impor — 2 file utama

- **Tanggung jawab:** Layar/validasi PGN, FEN dan tautan Chess.com/Lichess, batas input, pengambilan HTTP, pembatalan, draf dan penyimpanan koleksi.
- **Dependensi masuk:** 2 pasangan: shell 2.
- **Dependensi keluar:** 11 pasangan: analisis 1, koleksi 2, pekerjaan 2, sesi 2, shared 4. Package eksternal yang tercatat pada file kelompok: `chess.js` (1), `react` (1); akses browser/HTTP/worker dicatat terpisah dari graf.
- **API saat ini:** `validasiPgn`, `validasiFen`, `uraikanTautanPartai`, `susunPgnDariTcn`, `ambilPgn`, `BATAS_IMPOR`, `KODE_GALAT`; layar default `layarImpor.jsx`; belum ada barrel.
- **CSS/aset:** Global dan utilitas Tailwind; tidak ada CSS tersendiri. Dialog dan fokus juga bergantung pada shell/shared.
- **Risiko:** Meski dua file, memiliki 11 edge keluar; validasi input, data draf, HTTP dan abort/late response dapat berubah.
- **Pengujian pelindung:** Pertahankan `analisa-import.test.mjs`, `analisa-impor-draf.test.mjs`, `analisa-riwayat-navigasi.test.mjs`; tambah alur browser, input besar, timeout, abort, draf dan multi-PGN.
- **Kompleksitas:** Sedang–tinggi.

Daftar file utama:
```text
src/halaman/Analisa/komponen/nav/layarImpor.jsx
src/halaman/Analisa/komponen/nav/validasiImpor.js
```

### Wawasan — 14 file utama

- **Tanggung jawab:** Statistik/filter, tren, pembukaan, akurasi, profil dan dashboard yang membaca koleksi serta hasil analisis; sebagian komponen bernama Akun namun dipanggil Wawasan.
- **Dependensi masuk:** 1 pasangan: shell 1.
- **Dependensi keluar:** 23 pasangan: analisis 2, koleksi 3, profil 2, sesi 2, shared 14. Package eksternal yang tercatat pada file kelompok: `react` (6), `recharts` (1); akses browser/HTTP/worker dicatat terpisah dari graf.
- **API saat ini:** `layarWawasan.jsx` default; fungsi path-level `agregasiWawasan`, `filterPartaiWawasan`, `hitungTrenRating`, `hitungPembukaanTeratas` dan lain-lain di `mesin/wawasan.js`; belum ada barrel.
- **CSS/aset:** Selector `.wawasan-*` ada di `src/halaman/Analisa/analisa.css:176–214`, plus utilitas Tailwind dan token bersama.
- **Risiko:** Cache revisi, hasil lintas fitur, grafik/format, filter dan CSS scoped global; dependensi profil dan koleksi harus tetap searah.
- **Pengujian pelindung:** Pertahankan `analisa-database.test.mjs`, `analisa-tab-panel.test.mjs`, `analisa-riwayat-navigasi.test.mjs`; tambah fixture perhitungan/filter dan visual grafik/kondisi kosong di browser.
- **Kompleksitas:** Sedang–tinggi.

Daftar file utama:
```text
src/halaman/Analisa/akun/DaftarPembukaanAkun.jsx
src/halaman/Analisa/akun/DashboardAkun.jsx
src/halaman/Analisa/akun/statsAkun.js
src/halaman/Analisa/komponen/nav/layarWawasan.jsx
src/halaman/Analisa/komponen/nav/wawasan/distribusiHasil.jsx
src/halaman/Analisa/komponen/nav/wawasan/filterBar.jsx
src/halaman/Analisa/komponen/nav/wawasan/grafikTrenRating.jsx
src/halaman/Analisa/komponen/nav/wawasan/kartuAkurasi.jsx
src/halaman/Analisa/komponen/nav/wawasan/kartuPembukaan.jsx
src/halaman/Analisa/komponen/nav/wawasan/kartuProfil.jsx
src/halaman/Analisa/komponen/nav/wawasan/kpiGrid.jsx
src/halaman/Analisa/komponen/nav/wawasan/opsiWawasan.js
src/halaman/Analisa/komponen/svg/refresh.jsx
src/halaman/Analisa/mesin/wawasan.js
```

### Akun — 18 file utama

- **Tanggung jawab:** Formulir dan kartu akun, rentang/filter unduh Chess.com/Lichess, pembatalan, status, UI deteksi engine dan analisis indikatif.
- **Dependensi masuk:** 2 pasangan: shell 2.
- **Dependensi keluar:** 65 pasangan: analisis 17, koleksi 12, profil 1, sesi 8, shared 27. Package eksternal yang tercatat pada file kelompok: `react` (7), `@radix-ui/react-tabs` (1), `lucide-react` (1); akses browser/HTTP/worker dicatat terpisah dari graf.
- **API saat ini:** Layar default `layarAkun`/`layarDeteksiEngine`; ekspor aktual `muatPartaiChessCom`, `muatPartaiLichess`, konverter dan API anti-cheat path-level. Daftar/lock masuk kelompok Koleksi menurut rancangan, bukan barrel Akun.
- **CSS/aset:** `src/app/globals.css:110–190` untuk header/tab Akun, `analisa.css` dan utilitas Tailwind; token bersama dipakai lintas layar.
- **Risiko:** 65 edge keluar; alur penghapusan lock/abort, unduhan tertunda, storage dan dua tab; juga temuan disabled dan visual belum diuji.
- **Pengujian pelindung:** Pertahankan `analisa-p1-ui.test.mjs`, `analisa-account-cancel.test.mjs`, `analisa-p1-indexeddb.test.mjs`, `analisa-p1-cross-tab.test.mjs`, `analisa-p2-archives.test.mjs`, `analisa-tab-panel.test.mjs`; tambah browser dua tab/responsif.
- **Kompleksitas:** Tinggi.

Daftar file utama:
```text
src/components/ui/tabs.jsx
src/halaman/Analisa/akun/DaftarAkun.jsx
src/halaman/Analisa/akun/FormulirAkun.jsx
src/halaman/Analisa/akun/KartuAkun.jsx
src/halaman/Analisa/akun/PanelTarikPartai.jsx
src/halaman/Analisa/akun/PemilihRentang.jsx
src/halaman/Analisa/akun/antiCheatRiwayat.js
src/halaman/Analisa/akun/muatPartaiAkun.js
src/halaman/Analisa/akun/rentangTanggal.js
src/halaman/Analisa/komponen/nav/layarAkun.jsx
src/halaman/Analisa/komponen/nav/layarDeteksiEngine.jsx
src/halaman/Analisa/komponen/nav/ringkasanAntiCheat.jsx
src/halaman/Analisa/mesin/antiCheat.js
src/halaman/Analisa/mesin/antiCheat/agregat.js
src/halaman/Analisa/mesin/antiCheat/dasar.js
src/halaman/Analisa/mesin/antiCheat/kalibrasi.js
src/halaman/Analisa/mesin/antiCheat/skor.js
src/halaman/Analisa/mesin/laporanPeninjauan.js
```

### Pengaturan — 15 file utama

- **Tanggung jawab:** Kategori/cari, tema papan, sakelar, suara, rating, panah, bahasa, tautan dokumentasi dan pemilihan engine.
- **Dependensi masuk:** 3 pasangan: shell 3.
- **Dependensi keluar:** 40 pasangan: analisis 2, papan 1, sesi 18, shared 19. Package eksternal yang tercatat pada file kelompok: `react` (7), `chess.js` (3), `next/link` (1); akses browser/HTTP/worker dicatat terpisah dari graf.
- **API saat ini:** Default `layarPengaturan.jsx`, `layarEngine.jsx` dan komponen; `URL_REPO` path-level. Belum ada barrel fitur; menggunakan `Arrow` papan dan helper dari konverter.
- **CSS/aset:** Token global `globals.css`/`analisa.css`, warna Tailwind dan preview papan; state aktif/hover/focus bergantung cascade bersama.
- **Risiko:** Menyentuh preferensi persisten, state konteks, dependensi Papan, engine, teks/i18n dan responsivitas; kesetaraan visual perlu bukti.
- **Pengujian pelindung:** Pertahankan `analisa-layar-pengaturan.test.mjs`, `analisa-layar-engine.test.mjs`, `analisa-pengaturan-kinerja.test.mjs`, `analisa-storage.test.mjs`; tambah computed style, keyboard, kontras dan screenshot browser.
- **Kompleksitas:** Sedang–tinggi.

Daftar file utama:
```text
src/halaman/Analisa/komponen/menu/analyze/selectChessComData.js
src/halaman/Analisa/komponen/nav/layarEngine.jsx
src/halaman/Analisa/komponen/nav/layarPengaturan.jsx
src/halaman/Analisa/komponen/pengaturan/barisPengaturan.jsx
src/halaman/Analisa/komponen/pengaturan/bestMoves.jsx
src/halaman/Analisa/komponen/pengaturan/mesin.jsx
src/halaman/Analisa/komponen/pengaturan/moves.jsx
src/halaman/Analisa/komponen/pengaturan/ratings.jsx
src/halaman/Analisa/komponen/pengaturan/sakelarPengaturan.jsx
src/halaman/Analisa/komponen/pengaturan/themes.jsx
src/halaman/Analisa/komponen/svg/github.jsx
src/halaman/Analisa/komponen/svg/license.jsx
src/halaman/Analisa/komponen/svg/sound-mute.jsx
src/halaman/Analisa/komponen/svg/soundMax.jsx
src/lib/repo.js
```

### Lampiran API path-level yang benar-benar dipakai lintas kelompok

Berikut seluruh simbol pada file tujuan yang diimpor atau dire-export dari **kelompok usulan lain** oleh source HEAD menurut AST, dikelompokkan menurut pemilik file tujuan. Ini bukan daftar semua ekspor internal atau API publik resmi. `(dynamic module)` berarti modul dimuat dengan `import()`; daftarnya tidak menebak nama ekspor yang dipakai pemanggil. Lokasi dan nomor baris pemanggil ada di CSV; pemanggil dari tes, package eksternal, CSS dan akses runtime bukan import tidak tercakup.


**Profil**
- `src/lib/bendera.js` — `urlBendera`.
- `src/lib/pemainCatur.js` — `segarkanKartuPemain`, `useKartuPemain`.

**Pekerjaan**
- `src/halaman/Analisa/manajerLaporan.js` — `buatManajerLaporan`.
- `src/halaman/Analisa/pekerjaan.js` — `ID_DRAF_IMPOR`, `buatIdDrafImpor`, `buatIdPekerjaan`, `daftarkanPembacaLaporan`, `pekerjaan`, `simpanDrafImpor`, `simpanLaporanAktif`, `snapshotLaporanAman`.
- `src/halaman/Analisa/riwayatFitur.js` — `KUNCI_FITUR`, `catatFitur`, `daftarRiwayat`.
- `src/halaman/Analisa/usePekerjaan.js` — `usePekerjaan`.

**Analisis**
- `src/halaman/Analisa/mesin/akurasi.js` — `CP_AWAL`, `CP_CEILING`, `DAFTAR_ANOTASI`, `akurasiMove`, `anotasiMove`, `cpBaku`, `harmonikDariJumlah`, `inversAkurasi`, `kerugianMove`, `nilaiGrafikCp`, `peluangMenang`, `pemainDariEntri`, `petaAnotasiKosong`, `rataHarmonik`.
- `src/halaman/Analisa/mesin/analisisTersimpan.js` — `ambilPetaAnalisis`, `catatAnalisis`, `langgananAnalisis`.
- `src/halaman/Analisa/mesin/buku.js` — `cariNamaPembukaan`.
- `src/halaman/Analisa/mesin/cekWasm.js` — `hashUntukEngine`, `wasmSupported`.
- `src/halaman/Analisa/mesin/engine.js` — `EngineAnalisis`, `GALAT_BATAL`, `MULTI_PV`, `bacaPartaiPGN`, `deformatSquare`, `formatSquare`, `getCastle`, `invertColor`, `parseMove`, `parsePGN`, `parsePosition`.
- `src/halaman/Analisa/mesin/evaluasi.js` — `STATUS_EVALUASI`, `apakahMateTerminal`, `langkahTerpaksa`, `ratingTampilan`, `tandaMate`.
- `src/halaman/Analisa/mesin/fase.js` — `DAFTAR_FASE`, `FASE_PEMBUKAAN`, `faseBerikutnya`, `isEndMiddlegame`, `isEndOpening`, `papanDariFen`.
- `src/halaman/Analisa/mesin/penilaian.js` — `invertColor`.
- `src/halaman/Analisa/mesin/ringkasanAnalisis.js` — `ringkasAnalisis`.
- `src/lib/engineCatur.js` — `DAFTAR_ENGINE`, `ENGINE_BAKU`, `cariEngine`.

**Sesi**
- `src/halaman/Analisa/komponen/errors/pushPageError.js` — `pushPageError`, `pushPageWarning`.
- `src/halaman/Analisa/komponen/nav/SelectDaftar.jsx` — `default`.
- `src/halaman/Analisa/komponen/nav/useDropdown.js` — `tekanPanahOpsi`, `useDropdown`.
- `src/halaman/Analisa/komponen/pengaturan/boardThemes.js` — `boardThemes`.
- `src/halaman/Analisa/konteks/analyze.jsx` — `default`.
- `src/halaman/Analisa/konteks/analyzeKonteks.js` — `AnalyzeContext`, `TAMPILAN_ANALISA`.
- `src/halaman/Analisa/konteks/boardKonteks.js` — `useBoard`, `useSetTampilan`, `useTampilan`.
- `src/halaman/Analisa/konteks/config.jsx` — `default`.
- `src/halaman/Analisa/konteks/configKonteks.js` — `ConfigContext`, `defaultUsedRatings`.
- `src/halaman/Analisa/konteks/errors.jsx` — `default`.
- `src/halaman/Analisa/konteks/errorsKonteks.js` — `ErrorsContext`.
- `src/halaman/Analisa/konteks/importKonteks.js` — `useImport`.
- `src/halaman/Analisa/konteks/mesin.jsx` — `MesinProvider`.
- `src/halaman/Analisa/konteks/mesinKonteks.js` — `useMesin`.
- `src/halaman/Analisa/konteks/panelAktif.js` — `PanelAktifContext`.
- `src/halaman/Analisa/konteks/tabKerja.jsx` — `TabKerjaProvider`, `useTabKerja`.
- `src/halaman/Analisa/penyimpanan.js` — `bacaBoolean`, `bacaTeks`, `cobaBacaTeks`, `tulis`, `tulisBoolean`.
- `src/lib/titipanAnalisa.js` — `adaPgnTitipan`, `ambilPgnTitipan`.

**Koleksi**
- `src/halaman/Analisa/akun/daftarAkun.js` — `bacaDaftarAkun`, `hapusDariDaftar`, `tambahKeDaftar`.
- `src/halaman/Analisa/akun/koordinasiAkun.js` — `aktifkanKembaliAkun`, `akunSedangDihapus`, `daftarkanOperasiAkun`, `denganKunciAkun`, `langgananPenghapusanAkun`, `mulaiPenghapusanAkun`, `penandaMilikAkun`, `periksaSinyalAkun`, `tandaiPenghapusanAkun`.
- `src/halaman/Analisa/akun/useAkunKoleksi.js` — `useAkunKoleksi`.
- `src/halaman/Analisa/basisData.js` — `ambilDaftarPartai`, `bacaRevisiBasis`, `hapusKoleksi`, `imporPgnKeBasisData`, `langgananRevisi`, `pastikanKoleksi`, `simpanBanyakPartai`.
- `src/halaman/Analisa/database/migrasi.js` — `bukaDB`.
- `src/halaman/Analisa/database/statusSimpan.js` — `pesanPenyimpananPartai`.
- `src/halaman/Analisa/komponen/nav/layarDatabase.jsx` — `(dynamic module)`.

**Papan**
- `src/halaman/Analisa/komponen/boardMenu/boardMenu.jsx` — `default`.
- `src/halaman/Analisa/komponen/game/board.jsx` — `Arrow`.
- `src/halaman/Analisa/komponen/game/game.jsx` — `default`.
- `src/halaman/Analisa/komponen/menu/analysis/gameButtons.jsx` — `default`.
- `src/halaman/Analisa/komponen/menu/menu.jsx` — `default`.

**Impor**
- `src/halaman/Analisa/komponen/nav/layarImpor.jsx` — `(dynamic module)`.
- `src/halaman/Analisa/komponen/nav/validasiImpor.js` — `validasiPgn`.

**Wawasan**
- `src/halaman/Analisa/komponen/nav/layarWawasan.jsx` — `(dynamic module)`.

**Akun**
- `src/halaman/Analisa/komponen/nav/layarAkun.jsx` — `(dynamic module)`.
- `src/halaman/Analisa/komponen/nav/layarDeteksiEngine.jsx` — `(dynamic module)`.

**Pengaturan**
- `src/halaman/Analisa/komponen/nav/layarEngine.jsx` — `(dynamic module)`.
- `src/halaman/Analisa/komponen/nav/layarPengaturan.jsx` — `(dynamic module)`.
- `src/lib/repo.js` — `URL_REPO`.

### Catatan arsitektur lintas fitur

- Batas usulan belum ditegakkan di source. Selain impor langsung Akun ke `database/migrasi.js`, Pengaturan mengimpor `Arrow` dari papan dan helper dari konverter. `DashboardAkun` saat ini dipanggil oleh Wawasan. Peta edge menunjukkan keadaan aktual menurut pengelompokan, bukan bukti pelanggaran terhadap API yang belum diimplementasikan.
- `areaKerja.jsx` (775 baris), `board.jsx` (974), `layarDatabase.jsx` (934), `database/partai.js` (769), `mesin/engine.js` (709) mencampur sejumlah tanggung jawab; jumlah baris saja tidak membuktikan file harus dipecah. `src/halaman/TekaTeki/animasiBidak.js` benar-benar diimpor papan, sehingga tidak boleh dianggap file mati berdasarkan nama folder.
- Global `globals.css` dan `analisa.css` memasok token/selector lintas fitur; Wawasan memiliki selector khusus di CSS bersama dan tooltip Radix dapat muncul di portal. Glob Tailwind saat ini hanya mencakup `src/pages`, `components`, `halaman`, `app`, `errors` ([tailwind.config.ts:13–20](tailwind.config.ts#L13)); rencana folder baru harus membuktikan coverage class sebelum migrasi, bukan mengubah konfigurasi sekarang.
- Route memuat Analisa secara client-only ([page.tsx:7–9](src/app/page.tsx#L7)); delapan panel menggunakan React.lazy ([areaKerja.jsx:77–84](src/halaman/Analisa/komponen/areaKerja.jsx#L77)), papan tetap mounted tersembunyi ([areaKerja.jsx:753–760](src/halaman/Analisa/komponen/areaKerja.jsx#L753)). Worker dibuat saat `EngineCatur.mulai()` ([engineCatur.js:83–88](src/lib/engineCatur.js#L83)); `berkasPublik` menerapkan base path ([asets.js:1–5](src/lib/asets.js#L1)). Tes UCI Node dan hash aset tidak menggantikan tes worker/WASM/NNUE browser pada server root/subpath.
- Pola validasi kode negara di [pemainCatur.js:40–45](src/lib/pemainCatur.js#L40) dan [bendera.js:3–7](src/lib/bendera.js#L3) serupa, tetapi konteks input/output berbeda. Pertahankan keduanya sampai kesetaraan dibuktikan; jangan menghapus file hanya berdasarkan kemiripan.

## H. Status Git dan batas tindakan

- **File source, test, konfigurasi, dependency dan aset yang dilacak:** tidak berubah. `git diff` dan `git diff --cached` kosong. SHA-256 `package.json`: `58e9fe148d8bf8db308477dcb4b9d122c8aaf36e1fda94217bd6bb4bfb4c0c56`; `package-lock.json`: `7fd8339fcd932cd73d5b349e8213d8d0de062d644813dc7b05471bd2820e04ba`. Keduanya cocok dengan blob base. Tidak ada dependency/browser yang dipasang, diperbarui atau dihapus dalam audit ini.
- **Artefak audit baru, untracked:** `AUDIT-PASCASAINTEGRASI-PR15.md` dan `PETA-DEPENDENSI-PASCASAINTEGRASI-PR15.csv`. Tiga artefak audit yang sudah untracked sebelum audit tetap ada dan tidak diubah/dihapus. Build/typecheck menghasilkan atau menimpa output yang diabaikan Git (`dist/`, `.next/`, `tsconfig.tsbuildinfo`); output root dipulihkan terakhir. Salinan base untuk karakterisasi hanya dibuat di `/tmp`, tanpa checkout branch.
- **Commit baru:** tidak ada. **Push:** tidak ada. **PR baru:** tidak ada. **Perubahan/merge ke main:** tidak ada. PR #14 dan branch-nya tidak diubah. Pemeriksaan remote akhir masih menunjukkan PR #15 pada `469d6a9`, PR #14 pada `b89e763`, dan `main` pada `cb17e22`; status dapat berubah oleh pekerjaan pihak lain setelah audit.
- **Keputusan:** jangan mulai Tahap 2 atau memperbaiki temuan sampai pemilik menyetujui ruang lingkup dan proteksi pengujiannya.
