# `public/data/` — data statis Maestro Chess

Berkas di folder ini **disalin apa adanya** ke hasil build dan bisa diambil dari
browser lewat URL `/data/…` (dengan basis path deployment). Semuanya terlacak
Git biasa (tanpa LFS), jadi `git pull` membawa berkas utuh.

| Berkas | Isi | Jumlah | Ukuran |
| --- | --- | --- | --- |
| `buku-pembukaan.json` | **Sumber** pengayaan buku (olahan lichess-org/chess-openings, CC0) | 18.713 entri | 4,40 MB |
| `buku-analisa.json` | **Hasil olahan** yang dimuat aplikasi: peta FEN → nama pembukaan | 27.826 posisi | 2,86 MB |
| `teka-teki.json` | Soal skakmat (Lichess puzzle DB, CC0) | 5.486 soal | 2,30 MB |
| `teka-teki-video.json` | Soal taktik + metadata video (Chess.com) | 6.551 soal (1.681 dengan video) | 2,28 MB |
| `teka-teki-harian/*.json` | Soal harian Chess.com 2007–2026 + `indeks.json` + `terbaru.json` | 7.097 soal | 0,92 MB |

## Status pemakaian

Semua berkas di tabel di atas kecuali `buku-pembukaan.json` **sudah dimuat
aplikasi**:

| Berkas | Pemuat | Dipakai oleh |
| --- | --- | --- |
| `buku-analisa.json` | `src/modul/analisis/bukuPembukaan.js` → `muatBuku()` | nama pembukaan di layar Analisa |
| `teka-teki.json` | `src/modul/tekaTeki/pemuat.js` → `muatSoal("skakmat")` | fitur Teka-teki, sumber **Skakmat** |
| `teka-teki-video.json` | `muatSoal("video")` | fitur Teka-teki, sumber **Video** |
| `teka-teki-harian/<tahun>.json` | `muatSoal("harian", { tahun })` | fitur Teka-teki, sumber **Harian** |

`buku-pembukaan.json` tetap **berkas sumber** offline: ia hanya dibaca
`scripts/generasi-buku-analisa.mjs` untuk menghasilkan `buku-analisa.json`,
tidak diunduh browser.

Perilaku pemuat teka-teki (`pemuat.js`):

- URL dibentuk lewat `berkasPublik()` + versi cache `?v=VERSI_DATA`
  (saat ini `2026-11-27`); naikkan `VERSI_DATA` bila berkas data berubah.
- Satu janji in-flight per kunci cache: `skakmat`, `video`, atau `harian:<tahun>`.
  Hasil kosong (unduhan gagal) **tidak** di-cache agar bisa dicoba lagi; kegagalan
  mengembalikan `[]` sehingga layar menampilkan status, bukan crash.
- Hanya berkas yang diminta diunduh — data harian dimuat **per tahun**, bukan
  20 tahun sekaligus.
- Tahun bawaan bila pemanggil tidak menyebut tahun: **2026**
  (`TAHUN_HARIAN_TERBARU`). Layar Teka-teki saat ini memanggil `muatSoal(sumber)`
  tanpa tahun, jadi sumber Harian selalu memuat `2026.json`; pemilih tahun belum
  ada (rencana Tahap 3). Soal di dalam kolam yang terunduh dipilih **acak**
  oleh `pilihSoal()`, bukan menurut tanggal kalender.

### Aturan penyaringan per sumber

`src/modul/tekaTeki/pemilih.js` → `saringSoal(daftar, { ratingMin, ratingMax, tema })`
memperlakukan sumber secara berbeda **karena kelengkapan datanya berbeda**:

| Sumber | `rating` | `tema` | Filter rating/tema |
| --- | --- | --- | --- |
| `skakmat` | ada di 5.486/5.486 soal (600–2567) | ada, 50 tema berbeda | **diterapkan penuh** |
| `video` | ada di 6.551/6.551 soal (700–2380) | ada, 9 tema berbeda | **diterapkan penuh** |
| `harian` | **tidak ada** (0/7.097) | **tidak ada** (0/7.097) | **dilewati** |

Soal harian hanya menyimpan `tanggal`, `fen`, dan `langkah`. Menerapkan filter
rating pada sumber ini membuang **seluruh** soalnya — termasuk pada rentang
bawaan 1000–1500 — sehingga layar Harian tampil kosong. Karena itu jenis
`harian` lolos apa adanya. Jenis tak dikenal tetap disaring, dan soal
`skakmat`/`video` yang kehilangan rating tetap dibuang saat batas rating diminta
(data rusak tidak diselundupkan lewat pengecualian harian).

## Skema

### `buku-pembukaan.json` — larik entri sumber

```json
{ "eco": "C44", "opening": "Scotch Game: Lolli Variation",
  "moves": "e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 c6d4 d1d4 d7d6",
  "games": 22326, "white_win_rate": 0.527, "black_win_rate": 0.422,
  "draw_rate": 0.051, "avg_rating": 1507 }
```

`moves` memakai **UCI dipisah spasi**. Regenerasi tabel aplikasi (offline,
deterministik — keluaran byte-identik untuk masukan yang sama):

```bash
node scripts/generasi-buku-analisa.mjs
```

### `buku-analisa.json` — peta yang dipakai aplikasi

Kunci = FEN **empat field pertama** (posisi, giliran, rokade, en passant);
nilai = label `"Nama Pembukaan (ECO)"`.

```json
{ "1nbqkb1r/1ppp1ppp/4pn2/1P6/8/8/1BPPPPPP/rN1QKBNR w Kk -": "Polish Opening: Rooks Swap Line (A00)" }
```

Dimuat malas oleh `src/modul/analisis/bukuPembukaan.js` (`muatBuku()` /
`cariNamaPembukaan()`) dengan cache versi `?v=…`. Tiru pola itu untuk data lain:
satu janji in-flight, fallback `{}` saat gagal, dan URL dibentuk lewat
`berkasPublik()` agar basis path deployment ikut.

### `teka-teki.json` — `{ "problems": [...] }`

Field: `problemid`, `first` (`"White to Move"` / `"Black to Move"`), `type`
(`"Mate in One|Two|Three"`), `fen`, `moves`, `rating` (600–2567), `tema`
(tag dipisah spasi, mis. `"backRankMate endgame long mate mateIn3"`),
`sumberId`, `pemainPutih`, `pemainHitam`, `eloPutih`, `eloHitam`, `pembukaan`.

Terverifikasi dari berkas yang dikirim: 5.486 soal; `first` selalu sama dengan
giliran FEN; panjang jalur 1 langkah (Mate in One, 1.377 soal), 3 langkah
(Mate in Two, 2.991), 5 langkah (Mate in Three, 1.118) — semuanya ganjil dan
berakhir skakmat oleh pihak FEN. 50 tema berbeda.

### `teka-teki-video.json` — metadata + `{ "problems": [...] }`

Metadata: `versi`, `jumlahVideo`, `jumlahLegenda`, `jumlahStudi`,
`jumlahAnotasi`, `jumlahTotal`. Field soal menambah: `judulSoal`, `video`,
`pelatih`, `tanggal`, `kurasi`, `jumlahTerpecahkan`, `turnamen`.

Terverifikasi: `versi` 2, `jumlahTotal` 6.551, `jumlahVideo` 1.681 (jumlah soal
yang benar-benar punya URL `video` juga 1.681), `jumlahLegenda` 222,
`jumlahStudi` 86, `jumlahAnotasi` 130. Rating 700–2380; 9 tema berbeda:
`backRankMate`, `endgame`, `hangingPiece`, `master`, `middlegame`, `opening`,
`promotion`, `sacrifice`, `smotheredMate`. Panjang jalur ganjil.

### `teka-teki-harian/<tahun>.json`

```json
{ "tahun": 2025, "jumlah": 365,
  "soal": [ { "tanggal": "2025-01-01", "fen": "…", "langkah": "b3-b1;c1-b1;…" } ] }
```

**Soal harian tidak punya `rating` maupun `tema`** — hanya tiga field di atas.
Akibatnya filter rating/tema dilewati untuk sumber ini (lihat "Aturan penyaringan
per sumber").

`indeks.json` memuat `versi`, `dibuat`, `sumber`, `catatan`, `jumlah`,
`terlama`, `terbaru`, dan daftar `tahun` (`{tahun, jumlah, dari, sampai, berkas}`).
`terbaru.json` memuat `{ dibuat, soal: [7 soal terakhir] }`.

Terverifikasi: `versi` 1, `jumlah` 7.097, `terlama` `2007-05-08`, `terbaru`
`2026-10-20`, 20 berkas tahun (2007–2026). Jumlah soal per tahun 237–366
(2007 mulai 8 Mei; 2026 berhenti 20 Oktober; 366 pada tahun kabisat 2012, 2016,
2020, 2024). Jumlah di `indeks.json` sama dengan jumlah soal nyata di berkas
tahun (7.097). `terbaru.json` memuat 7 soal (`2026-10-14`…`2026-10-20`).
Sebagian jalur harian berpanjang **genap** (27 soal), yaitu berakhir pada
balasan lawan, bukan pada langkah pemain.

## Format langkah teka-teki (konverter tersedia)

`moves`/`langkah` memakai **pasangan koordinat dipisah `;`**, bukan SAN/UCI:

```
c4-c8;b7-c8;c1-c8;f6-d8;c8-d8
```

Promosi ditandai huruf bidak di belakang petak tujuan, mis. `f2-f1q`.
Konverternya sudah ada: `parseLangkah()` di `src/modul/tekaTeki/soal.js` mengubah
tiap pasangan menjadi `{ from: "c4", to: "c8", promotion: "q" }`, dan
`normalisasiSoal()`/`normalisasiBerkas()` menghasilkan bentuk baku yang dipakai
layar (`id`, `jenis`, `fen`, `langkah`, `giliranFen`, `pihak`, `rating`, `tema`,
`tipe`, `judul`, `video`, `pelatih`, `tanggal`, `pembukaan`). Lapisan UI tidak
perlu tahu format berkas.

**Langkah pertama adalah langkah PEMAIN** (`langkah[0]`), langkah berikutnya
balasan lawan, dan seterusnya berselang-seling — jadi FEN soal adalah posisi
tempat pemain bergerak. Ini bukan konvensi Lichess Puzzle API yang menaruh
langkah lawan di depan; lihat `src/modul/tekaTeki/README.md` untuk buktinya.

## Titik sambung yang sudah tersedia

Tombol **Analisa** pada soal dapat menitipkan PGN lewat
`src/modul/sesi/titipan.js` (fasad tanpa JSX):

- `KUNCI_PGN_TITIPAN` — kunci sessionStorage
- `adaPgnTitipan()` — cek titipan
- `ambilPgnTitipan()` — ambil sekali lalu bersihkan

Sudah dipakai `areaKerja.jsx` dan `useMuatPartai.js`, jadi fitur teka-teki tidak
perlu membuat jalur impor baru.

## Catatan operasional

- **CSP:** `media-src 'self'` dan `img-src 'self' https://images.chesscomfiles.com`.
  URL `video` pada `teka-teki-video.json` menunjuk `media.chesscomfiles.com`,
  sehingga **tidak akan terputar** di bawah CSP sekarang. Memutar video dari host luar
  perlu keputusan sadar pemilik (menambah host `media-src` atau menyediakan
  berkas sendiri) — jangan melemahkan CSP diam-diam.
- **Ukuran:** total folder ≈ 12,8 MB (terukur 12,78 MB). Muat malas per berkas
  (harian per tahun, bukan semuanya sekaligus) dan hindari mengimpor JSON besar
  ke bundel. Pemuat teka-teki sudah mengikuti pola ini.
- **Atribusi:** provenance tercatat di halaman Atribusi kartu **06** (buku) dan
  **07** (teka-teki) — `src/app/attributions/page.tsx` — beserta berkas lisensi di
  `public/licenses/`. Wajib dipertahankan bila data atau fitur diubah.
- **Penyegaran data harian:** snapshot ini berasal dari arsip publik
  `samuraitruong/chess.com-daily-puzzle`; belum ada skrip pengambil yang
  ter-commit di repo ini. Jika perlu menyegarkan, tambahkan skripnya lebih dulu
  agar perubahan data dapat diaudit.
