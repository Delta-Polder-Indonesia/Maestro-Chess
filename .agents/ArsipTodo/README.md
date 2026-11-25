# Arsip Todo dan Roadmap Modularisasi Maestro Chess

Dokumen ini mengubah lima artefak audit menjadi daftar kerja yang dapat ditinjau dan dikerjakan **bertahap**. Tujuannya tetap satu aplikasi **Modular Monolith**, bukan microservices. Roadmap ini adalah rencana, **bukan persetujuan untuk mengubah kode, memperbaiki bug, menambahkan dependensi, commit, push, atau merge**. Pilih dan sepakati satu cakupan kecil dengan pemilik sebelum setiap tahap.

## Mulai dari sini

1. Baca [AGENTS.md](../../AGENTS.md), [skill identitas Git](../skills/git-identity/SKILL.md), dan [catatan kelanjutan](../../CATATAN-KELANJUTAN-MAESTRO-CHESS.md).
2. Periksa branch, `git status`, HEAD, isi workspace, head PR dan hasil GitHub Actions yang relevan. Jangan menganggap angka atau SHA dalam arsip masih terbaru. Jangan memeriksa status/deployment Vercel.
3. Cocokkan kandidat dengan kode, tes, pemanggil dan dependensi **saat itu**. Tentukan batas tahap dan minta persetujuan pemilik. Tahap 13 belum disetujui.
4. Sebelum memindahkan implementasi, tulis dan jalankan tes karakterisasi pada kode asli. Kerjakan migrasi hanya dalam cakupan yang telah disetujui, lalu jalankan gerbang pemeriksaan dan laporkan hasil serta keterbatasannya.
5. Perbarui status roadmap dan catatan kelanjutan setelah pekerjaan benar-benar selesai. Berhenti untuk menunggu keputusan berikutnya; tidak perlu menyelesaikan semuanya sekaligus.

**Perhatian Git historis:** pada awal penyusunan, HEAD lokal menunjuk `cb17e22`, sedangkan isi 672 file proyek cocok dengan tree PR #15 `0455971`. Posisi branch kemudian diselaraskan ke head PR setelah memastikan isi dan izin seluruh 683 file workspace yang relevan tidak berubah. Ini hanya catatan kejadian, bukan jaminan status di masa depan. Sebelum tindakan Git, petakan perbedaannya dan minta arahan jika belum jelas; **jangan** melakukan reset, checkout, clean, staging massal, atau menimpa perubahan hanya untuk "merapikan" status.

## Isi arsip dan batasnya

| Salinan artefak | Basis historis | Kegunaan saat melanjutkan |
|---|---|---|
| [Laporan audit Modular Monolith](LAPORAN-AUDIT-MODULAR-MONOLITH.md) | `cb17e22` | Alasan pembagian modul, kontrak, risiko data/visual, dan usulan urutan awal. |
| [Peta file](PETA-FILE-MODULAR-MONOLITH.csv) | `cb17e22` | 587 file lama dan 24 usulan file baru; membantu menemukan kandidat, **bukan** daftar pemindahan otomatis. |
| [Inventaris referensi](INVENTARIS-REFERENSI-MODULAR-MONOLITH.csv) | `cb17e22` | 1.105 kandidat impor, ekspor, string tes/mock dan ekspresi dinamis untuk ditelusuri ulang. |
| [Audit pascaintegrasi PR #15](AUDIT-PASCASAINTEGRASI-PR15.md) | `469d6a9` | Temuan historis P2/P3, bukti, reproduksi sintetis, risiko dan kandidat per fitur. |
| [Peta dependensi pascaintegrasi](PETA-DEPENDENSI-PASCASAINTEGRASI-PR15.csv) | `469d6a9` | 316 hubungan lintas kelompok pada saat audit; titik awal memetakan pemanggil dan dependensi. |

Kelima salinan identik dengan file asli di root pada saat arsip dibuat; file asli tetap dipertahankan. Isi, nomor baris, hasil tes, status PR, prioritas dan perintah dalam audit tersebut adalah **potret lama**. Usulan `src/modules/...` dalam peta awal berbeda dari struktur yang benar-benar dipakai sekarang, yaitu `src/modul/...`. Laporan lama yang menyebut belum ada implementasi telah tersusul oleh Tahap 1–12. Isi audit tidak mengesampingkan instruksi terbaru pemilik.

Karena laporan Markdown disalin apa adanya, tautan lama yang menunjuk `src/...`, `tests/...`, dan file root lain di dalam laporan mungkin tidak bekerja relatif terhadap folder arsip. Buka path tersebut dari root repositori dan cocokkan dengan kode terbaru; tautan antarsalinan di folder arsip tetap dapat dipakai.

**Penyimpanan:** pemilik menyetujui kelima **salinan di folder ini** disertakan dalam PR bersama roadmap. Lima file asli di root tetap dipertahankan dan tidak boleh disertakan dalam commit tanpa izin tersendiri. Saat melanjutkan, periksa status Git/PR yang terbaru; isi salinan tetap merupakan snapshot, bukan hasil audit terkini.

## Kondisi terakhir yang diketahui

| Bagian | Status yang sudah dicapai, bukan seluruh fitur selesai |
|---|---|
| Database | Tahap 1 memisahkan bus revisi dan memutus siklus lama. Koleksi dan koordinasi akun **belum** dimodularisasi seluruhnya. |
| Profil dan Pekerjaan | Tahap 2–3 memindahkan modul, mempertahankan fasad, path kompatibilitas, cache/singleton dan kontrak data lama. |
| Sesi | Tahap 4–11 memindahkan model/provider tab, preferensi, galat, titipan, impor, panel, Board, Analyze serta context/hook Mesin. Ini tidak berarti seluruh fitur Papan atau Impor telah pindah. |
| Analisis | Tahap 12 memindahkan fondasi `EngineCatur`, pilihan engine dan pemeriksaan WASM. Parser, perhitungan, adaptor `EngineAnalisis`, buku dan hasil analisis masih perlu dipetakan. |
| MesinProvider | `src/halaman/Analisa/konteks/mesin.jsx` tetap pada path lama karena masih membutuhkan adaptor `EngineAnalisis` lama. Jangan menambahkan ketergantungan langsung Sesi ke implementasi lama `engine.js` atau `cekWasm.js`. |
| CI | Perbaikan tes setelah Tahap 12 telah dikerjakan. Pemeriksaan lokal yang dilaporkan: 539/539 tes; Actions pada `0455971` dilaporkan sukses. Angka dan SHA ini adalah riwayat, bukan hasil pengujian pada tahap berikutnya. |

Rujukan teknis aktual saat penulisan: [Profil](../../src/modul/profil/README.md), [Pekerjaan](../../src/modul/pekerjaan/README.md), [Sesi](../../src/modul/sesi/README.md) dan [fondasi Analisis](../../src/modul/analisis/README.md). Selalu periksa kembali isinya bersama kode.

## Urutan kerja yang disarankan

Prioritas berikut adalah **urutan perencanaan**, bukan penilaian tingkat keparahan baru. Setiap baris dapat dibagi menjadi beberapa tahap kecil dan setiap tahap memerlukan persetujuan sendiri. Pekerjaan peninjauan risiko data dapat berjalan terpisah dari kandidat Analisis; temuan tidak boleh diperbaiki diam-diam dalam migrasi.

| ID | Prioritas | Cakupan | Syarat sebelum dilanjutkan |
|---|---|---|---|
| R-00 | Pertama | Baseline terkini dan kesepakatan Tahap 13 | Status Git dan kode aktual dipahami; kandidat dan batas disetujui. |
| R-01 | Kandidat berikut | Satu bagian kecil Analisis, misalnya fase permainan | Peta ekspor/pemanggil dan tes karakterisasi sebelum pemindahan. |
| R-02 | Berikutnya, bertahap | Sisa domain Analisis, parser, buku, hasil sesi, adaptor engine | Tiap bagian dibatasi sendiri; identitas, output dan pembatalan terlindungi. |
| R-03 | Setelah dependensinya siap | Provider Mesin dan sisa Sesi | Adaptor yang diperlukan sudah mempunyai batas/API Analisis yang disetujui; jangan membuat edge ke implementasi lama. |
| R-04 | Risiko data tinggi | Koleksi, database dan koordinasi Akun | Kontrak transaksi, fallback, lock, koneksi dan data lama dipetakan serta diuji. |
| R-05 | Sesudah batas terkait siap | Fitur Impor, Wawasan dan Akun | API data/analisis yang dipakai jelas; bagi berdasarkan fitur dan risiko, bukan pemindahan massal. |
| R-06 | Setelah fondasi terkait siap | Fitur Papan dan Pengaturan | Kesetaraan state, interaksi, preferensi dan visual dapat dibuktikan untuk cakupan yang dipilih. |
| R-07 | Menjelang akhir | Shell, shared, CSS, konfigurasi dan pembersihan kompatibilitas | Semua pemanggil/path termasuk dinamis diperiksa; bukti diperlukan sebelum menghapus apa pun. |
| R-08 | Setiap tahap dan penutupan | Pengujian, keamanan data, dokumentasi dan CI | Semua gerbang relevan lulus; keterbatasan ditulis; merge hanya atas instruksi eksplisit. |

### R-00 — siapkan satu tahap

- [ ] Catat branch, HEAD, status perubahan, head PR dan kondisi Actions pada SHA yang benar. Pelihara pekerjaan lokal yang sudah ada; selesaikan perbedaan Git secara aman hanya dengan arahan pemilik.
- [ ] Tetapkan kandidat, file sumber, API/ekspor, konsumen, impor dinamis, string mock, lisensi dan risiko; perbarui peta dari kode aktual, bukan dengan mengganti path CSV secara mekanis.
- [ ] Catat perilaku asli, hasil tes yang sudah ada dan cakupan yang belum diuji. Pastikan tidak ada perubahan desain, fitur atau data yang terselip.
- [ ] Ajukan cakupan dan tes perlindungan kepada pemilik. Jangan mulai implementasi sebelum disetujui.

### R-01 — contoh kandidat Tahap 13: fase permainan

**Ini hanya usulan untuk dipetakan dan disepakati, bukan keputusan bahwa Tahap 13 harus memilihnya.** [fase.js](../../src/halaman/Analisa/mesin/fase.js) relatif kecil, bergantung pada `chess.js` yang sudah ada, dan masih berada di path Analisis lama. Namun hasilnya dipakai oleh ringkasan Akurasi dan perhitungan indikatif engine, sehingga bukan perubahan tanpa risiko.

- [ ] Periksa delapan ekspor saat itu: `FASE_PEMBUKAAN`, `FASE_MENENGAH`, `FASE_AKHIR`, `DAFTAR_FASE`, `isEndOpening`, `isEndMiddlegame`, `faseBerikutnya`, dan `papanDariFen`; petakan pemanggil, re-export dan mock ulang.
- [ ] Pada snapshot ini pemanggil mencakup `playersAccuracy.jsx`, `ringkasanAntiCheat.jsx`, `antiCheat/skor.js` dan `antiCheat/agregat.js`. Periksa semuanya lagi, termasuk pemanggil lain yang mungkin ditambahkan.
- [ ] Karakterisasi papan batas fase, transisi satu arah dan urutannya, FEN kosong/rusak, serta output yang dipakai perhitungan lama. Jaga urutan dan identitas `DAFTAR_FASE`, termasuk sifatnya yang dapat dimutasi; jangan memperbaiki perilaku lama dalam tahap pemindahan.
- [ ] Jika cakupan migrasi disetujui, tetapkan entry point dan shim kompatibilitas yang diperlukan; pastikan path lama dan baru mengarah ke satu definisi dalam registry yang sama. Uji ekspor, identitas, hasil, pemanggil, batas dan siklus sebelum/sesudah.
- [ ] Hentikan jika paritas tidak dapat dibuktikan atau ternyata perlu memindahkan komponen/perilaku di luar cakupan. Komentar lama menyebut `scripts/uji-evaluasi.mjs`, tetapi skrip itu tidak ditemukan pada snapshot ini; gunakan tes yang benar-benar ada atau usulkan tes baru tanpa menambah dependensi.

### R-02 — selesaikan Analisis sedikit demi sedikit

- [ ] Petakan kelompok perhitungan/evaluasi/akurasi, fase, parser PGN/FEN, buku pembukaan, hasil analisis sesi dan adaptor `EngineAnalisis` di `src/halaman/Analisa/mesin/`. Peta lama membantu menemukan kandidat, tetapi cek setiap ekspor dan konsumen sekarang.
- [ ] Pisahkan tiap kelompok menjadi usulan tahap tersendiri. Utamakan batas yang bisa dikarakterisasi tanpa mengubah engine, data dan UI sekaligus; jangan menganggap hasil sesi sebagai data yang otomatis persisten.
- [ ] Untuk rumus/parser, bandingkan hasil dan error pada fixture normal, batas, input rusak, multi-PGN dan FEN. Pertahankan nilai, urutan langkah, pembulatan dan perilaku lama.
- [ ] Untuk buku, lindungi URL/base path, satu cache/promise, kegagalan dan percobaan ulang. Untuk hasil sesi, lindungi identitas satu Map/listener, notifikasi dan snapshot. Untuk adaptor engine, lindungi antrean, worker malas, opsi, pembatalan, galat dan output.
- [ ] Pertahankan lisensi source, shim yang masih dibutuhkan dan hasil enam engine. Uji UCI di Node tidak membuktikan Worker/WASM/NNUE berjalan di browser: rencanakan uji browser secara terpisah tanpa menambah dependensi tanpa izin.

### R-03 — provider Mesin dan sisa Sesi

- [ ] Inventarisasi dependensi aktual `MesinProvider`, urutan provider, instance, hook, pemanggil, pengaturan dan siklus hidup worker.
- [ ] Pindahkan provider hanya setelah dependensi Analisis yang benar-benar dibutuhkan sudah dimodularisasi dan fasadnya disepakati. Pertahankan context/hook tunggal serta urutan provider; jangan impor langsung implementasi lama `engine.js` atau `cekWasm.js` dari Sesi.
- [ ] Karakterisasi pemilihan ulang engine, satu worker per konteks yang sesuai, pembatalan, error, mount/unmount dan penyimpanan preferensi. Tinjau `SelectDaftar` sebagai kandidat terpisah, bukan bagian otomatis dari provider.

### R-04 — Koleksi dan Akun: keamanan data terlebih dahulu

- [ ] Petakan `basisData.js`, `database/`, bus `revisiBasis.js`, `akun/daftarAkun.js`, `akun/koordinasiAkun.js`, pemanggil, transaksi, fallback dan jalur penghapusan. Bus revisi sudah dipisahkan; jangan menyimpulkan seluruh Koleksi sudah pindah.
- [ ] Pertahankan 18 ekspor fasad lama yang digunakan saat ini, identitas bus/listener serta urutan notifikasi yang dikarakterisasi. Jangan mengubah nama/versi DB, object store, indeks, kunci, format record, cache, fallback atau semantik lintas tab tanpa persetujuan tersendiri.
- [ ] Untuk penghapusan akun, petakan urutan abort/lock/generasi, pemulihan fallback, koneksi yang sama, pembersihan cache dan kegagalan parsial. Rancangan API pengganti dalam audit adalah **usulan**, bukan izin mengubah urutan atau kontrak.
- [ ] Gunakan fixture sintetis untuk data lama, commit/abort, gagal baca/tulis, kuota, koneksi tertahan, storage terblokir, recovery dan dua tab. Uji kompatibilitas/rollback sesuai bukti yang tersedia; jangan mengklaim seluruh data pengguna aman hanya dari mock.
- [ ] Sebelum menyentuh area yang memiliki temuan perilaku lama, lakukan triase A-01/A-02 di bawah. Perbaikan perilaku memerlukan keputusan dan tes terpisah dari migrasi.

### R-05 — Impor, Wawasan dan Akun

- [ ] **Impor:** pisahkan pemetaan layar, validasi PGN/FEN/URL, HTTP/abort, draf dan integrasi koleksi. Pertahankan batas input, error, urutan validasi dan format draf; context/provider yang sudah di Sesi bukan berarti seluruh fitur telah dipindahkan.
- [ ] **Wawasan:** petakan statistik, filter, profil, hasil analisis, invalidasi revisi dan grafik. Lindungi output/agregasi, status kosong, cache dan sumber data; perhatikan komponen bernama Akun yang digunakan Wawasan.
- [ ] **Akun:** petakan dua sumber unduhan, pembatalan, hasil parsial, deteksi indikatif dan integrasi Koleksi/Profil. Jangan memindah UI dan koordinasi penyimpanan secara massal dalam satu tahap.
- [ ] Untuk tiap fitur, sepakati pemilik data dan API yang sungguh diperlukan; uji kontrak, input, error, perubahan panel, data lama serta pemanggil sebelum migrasi berikutnya.

### R-06 — Papan dan Pengaturan

- [ ] Petakan game, papan, menu, laporan, suara, panah, preferensi dan pemanggil lintas modul. Board context/provider di Sesi bukan seluruh fitur Papan.
- [ ] Pertahankan mount papan saat panel tersembunyi, state tab/draf, focus, drag/touch/keyboard, urutan efek, suara dan interaksi. Jangan mengubah warna, ukuran, layout, teks, animasi atau UX.
- [ ] Bila memindahkan UI, periksa cakupan Tailwind/CSS, portal, cascade dan bundle/lazy loading. Siapkan baseline visual/browser yang relevan; jika tidak dapat diuji, catat celah dan tunda perubahan yang tidak dapat dibuktikan setara.
- [ ] Pisahkan peninjauan helper/`Arrow` lintas fitur menjadi cakupan kecil; jangan menghapus konverter atau ekspor yang belum terbukti tidak dipakai.

### R-07 — shell, shared dan penutupan struktural

- [ ] Petakan komposisi provider, route, navigasi, delapan panel lazy, helper bersama, URL aset, CSS global dan referensi konfigurasi. Buat API bersama hanya untuk kebutuhan nyata, bukan barrel yang memuat seluruh fitur.
- [ ] Tinjau static/dynamic import, alias, `require`, query, string mock, URL worker/aset dan dokumentasi. Pemeriksa graf JS tidak membuktikan seluruh referensi runtime/CSS sudah aman.
- [ ] Pertahankan file/path kompatibilitas sampai seluruh pemanggil dan penggunaan lain dibuktikan aman. Penghapusan file, glob, shim atau aset memerlukan bukti dan persetujuan cakupan.
- [ ] Setelah semua cakupan terkait selesai, tinjau kembali arah dependensi, siklus, ukuran/lazy loading, dokumentasi, kompatibilitas dan sisa pengecualian. Tidak ada migrasi massal demi mencocokkan pohon usulan lama.

## Antrean temuan lama — verifikasi dahulu, perbaiki hanya dengan izin terpisah

Semua ID P2/P3 di tabel merujuk pada [bagian F audit pascaintegrasi](AUDIT-PASCASAINTEGRASI-PR15.md#f-temuan) pada `469d6a9`. Ini **bukan** pernyataan bahwa masalah masih terjadi, bahwa prioritas lamanya tetap tepat, atau bahwa akar masalah telah dibuktikan di browser saat ini. Jalankan reproduksi yang relevan pada kode terbaru, gunakan data sintetis, dan catat hasil sebelum meminta keputusan.

| ID | Temuan dan area | Langkah berikut yang diarahkan | Keputusan/hasil yang diperlukan jika perbaikan disetujui |
|---|---|---|---|
| A-01 | P2-5: hasil/notifikasi `pastikanKoleksi` dapat mendahului abort transaksi. | Periksa `database/koleksi.js`; ulangi injeksi read error, quota dan abort dengan IndexedDB tiruan, lalu tentukan celah uji browser. | Sepakati kontrak error dan waktu notifikasi; buktikan hasil transaksi dan notifikasi tidak menyesatkan pada kasus yang diperbaiki. |
| A-02 | P2-4: gagal membaca daftar akun saat penghapusan parsial dapat terlihat sebagai daftar kosong. | Ulangi gagal baca dan recovery dengan data sintetis; catat state pilihan, alert, data dan revisi. | Sepakati perbedaan daftar kosong vs gagal baca, pemulihan dan pesan; uji ulang tanpa mengklaim kehilangan data di luar bukti. |
| A-03 | P2-1/P2-2: cache negatif profil dan balapan respons lama/refresh. | Periksa implementasi `src/modul/profil/` dan karakterisasi offline→online serta urutan respons. | Sepakati kebijakan retry, cache negatif dan respons basi sebelum mengubah kontrak; pertahankan satu cache dan kompatibilitas. |
| A-04 | P2-6: perubahan preferensi tampak diterapkan ketika penulisan storage gagal. | Suntik gagal tulis/kuota dengan pembacaan berhasil; periksa state, alert dan remount/reload. | Sepakati sinyal yang terlihat serta perilaku memori dan persistensi; perubahan UX perlu izin. |
| A-05 | P2-3, P3-1, P3-5: kontras tab akun, status tombol Muat dan label bahasa. | Verifikasi kondisi terbaru, keyboard dan kedua bahasa; lakukan pengujian browser bila tersedia. | Warna, atribut/UX dan teks tidak diubah tanpa persetujuan tersendiri; setelah itu uji state dan breakpoint yang terdampak. |
| A-06 | P3-2/P3-3: deep import lintas fitur dan komentar storage yang mungkin tidak sesuai kode. | Perbarui peta `bukaDB`, `Arrow`, helper dan komentar dari kode aktual. | Untuk batas baru, uji kontrak/lock; untuk komentar, setujui cakupan dokumentasi tanpa mengubah data atau perilaku. |
| A-07 | Worker yang diam, retensi/cache, pengambilan arsip dan last-write-wins antar-tab. | Periksa temuan di bagian 9 laporan awal dan karakterisasikan skenario relevan. | Tentukan perilaku yang diinginkan, dampak data/privasi dan tes terlebih dahulu; jangan menjanjikan penghapusan menyeluruh tanpa rancangan retensi. |
| A-08 | Notice font Inter/Roboto dan risiko fokus/visual pada halaman atribusi/landing. | Periksa `ATTRIBUTIONS`, lisensi publik, metadata font dan fokus/kontras di browser; review kebutuhan lisensi secara terpisah. | Jangan menyimpulkan pelanggaran hukum atau mengubah teks, tautan, warna/layout tanpa persetujuan. Laporkan apa yang diuji dan yang belum. |

Audit lama P3-4 juga membahas perbedaan lingkungan build berdasarkan metadata deployment saat itu. Jangan menggunakan temuan itu sebagai alasan mengakses Vercel: pembandingan yang diizinkan saat ini dibatasi pada lingkungan **lokal** dan GitHub Actions, tanpa metadata, status, deployment, preview, atau tool Vercel.

## R-08 — gerbang setiap tahap yang disetujui

Sebelum migrasi, jalankan karakterisasi pada implementasi asli dan simpan bukti baseline. Setelahnya, pertahankan seluruh tes lama, tambahkan tes batas dan jalankan tes terarah serta suite lengkap. Jumlah tes dan aset harus dihitung ulang; 539 tes dan 320 aset adalah angka dari pemeriksaan historis, bukan syarat bahwa jumlah tidak boleh bertambah.

Contoh perintah lokal berurutan dari root setelah dependensi lockfile tersedia (jangan menjalankan build dan typecheck bersamaan):

```sh
npm run lint
npm test
node --test tests/analisa-siklus-database.test.mjs
npm audit --include=dev --audit-level=high

env -u NEXT_PUBLIC_BASE_PATH NEXT_TELEMETRY_DISABLED=1 npm run build
npm run typecheck
npm run test:build
npm run test:vercel

NEXT_PUBLIC_BASE_PATH=/Maestro-Chess NEXT_TELEMETRY_DISABLED=1 npm run build
npm run test:build
npm run test:vercel
```

`test:build` dan `test:vercel` adalah **verifier lokal**, bukan akses ke layanan/deployment Vercel. Bila `node_modules` belum ada, instal hanya dependensi yang sudah terkunci sesuai prosedur repo; jangan menambahkan Playwright, axe-core atau dependensi baru tanpa persetujuan terpisah.

Selain perintah di atas:

- [ ] Jalankan tes karakterisasi dan batas yang khusus untuk tahap; periksa seluruh ekspor, identitas context/provider/singleton dan shim lama yang terdampak.
- [ ] Periksa graf import/re-export/alias/dynamic import dalam cakupan parser, siklus dan batas modul. Tes `analisa-siklus-database.test.mjs` memeriksa graf source dan siklus; tes batas tiap modul tetap diperlukan. Laporkan referensi nonliteral, URL worker dan runtime yang tidak dicakup.
- [ ] Bandingkan manifest nama dan hash seluruh file `public/**` sebelum/sesudah serta dengan hasil ekspor root dan subpath. Jumlah aset harus dihitung dari baseline terkini; jangan menyamakan verifier file wajib dengan pembandingan semua aset.
- [ ] Jika menyentuh data, uji fixture lama, abort/fallback, kuota, pemulihan dan dua tab sesuai cakupan. Jika menyentuh engine atau UI, uji worker, lazy loading, fokus/keyboard dan visual di browser bila tersedia. Bedakan uji Node/mock dari browser, data pengguna nyata dan screen reader.
- [ ] Catat perintah, SHA atau baseline workspace, hasil, kegagalan dan hal yang belum diuji. Hasil `typecheck` tidak membuktikan seluruh JavaScript telah diperiksa jika `checkJs` tidak aktif.
- [ ] Jika commit/push memang diminta, ikuti identitas dan pemeriksaan hook/seluruh commit dalam skill Git; lakukan hanya pada branch aktif setelah gate lulus. Setelah push, periksa GitHub Actions pada SHA yang tepat dan perbarui PR setelah sukses. Jangan memeriksa deployment/status Vercel dan jangan merge ke `main` tanpa instruksi eksplisit.

## Format catatan setelah satu tahap

```text
ID/cakupan yang disetujui:
Baseline branch, HEAD, status dan snapshot/PR:
File, ekspor, konsumen dan kontrak yang dipetakan:
Tes karakterisasi pada implementasi asli:
Perubahan dan shim yang dipertahankan:
Tes/gate yang dijalankan serta hasilnya:
Data, browser, aksesibilitas atau runtime yang belum diuji:
Temuan perilaku lama dan keputusan yang masih diperlukan:
Commit/push/Actions/PR, hanya jika diminta:
Status roadmap dan kandidat kecil berikutnya:
```
