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

> **Status pemakaian:** hanya `buku-analisa.json` yang dimuat aplikasi saat ini.
> Data teka-teki **sengaja disimpan lebih dulu** untuk fitur mendatang dan belum
> dipakai kode mana pun.

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

### `teka-teki-video.json` — metadata + `{ "problems": [...] }`

Metadata: `versi`, `jumlahVideo`, `jumlahLegenda`, `jumlahStudi`,
`jumlahAnotasi`, `jumlahTotal`. Field soal menambah: `judulSoal`, `video`,
`pelatih`, `tanggal`, `kurasi`, `jumlahTerpecahkan`, `turnamen`.

### `teka-teki-harian/<tahun>.json`

```json
{ "tahun": 2025, "jumlah": 365,
  "soal": [ { "tanggal": "2025-01-01", "fen": "…", "langkah": "b3-b1;c1-b1;…" } ] }
```

`indeks.json` memuat `versi`, `dibuat`, `sumber`, `catatan`, `jumlah`,
`terlama`, `terbaru`, dan daftar `tahun` (`{tahun, jumlah, dari, sampai, berkas}`).
`terbaru.json` memuat `{ dibuat, soal: [7 soal terakhir] }`.

## Format langkah teka-teki (perlu konverter)

`moves`/`langkah` memakai **pasangan koordinat dipisah `;`**, bukan SAN/UCI:

```
c4-c8;b7-c8;c1-c8;f6-d8;c8-d8
```

Promosi ditandai huruf bidak di belakang petak tujuan, mis. `f2-f1q`.
Untuk memakainya dengan `chess.js`, ubah tiap pasangan menjadi
`{ from: "c4", to: "c8", promotion: "q" }`. Langkah pertama adalah langkah
pemain, langkah berikutnya balasan lawan, dan seterusnya berselang-seling.

## Titik sambung yang sudah tersedia

Tombol **Analisa** pada soal dapat menitipkan PGN lewat
`src/modul/sesi/titipan.js` (fasad tanpa JSX):

- `KUNCI_PGN_TITIPAN` — kunci sessionStorage
- `adaPgnTitipan()` — cek titipan
- `ambilPgnTitipan()` — ambil sekali lalu bersihkan

Sudah dipakai `areaKerja.jsx` dan `useMuatPartai.js`, jadi fitur teka-teki tidak
perlu membuat jalur impor baru.

## Catatan desain sebelum membangun fitur

- **CSP:** `media-src 'self'` dan `img-src 'self' https://images.chesscomfiles.com`.
  URL `video` pada `teka-teki-video.json` menunjuk `media.chesscomfiles.com`,
  sehingga **tidak akan terputar** di bawah CSP sekarang. Memutar video dari host luar
  perlu keputusan sadar pemilik (menambah host `media-src` atau menyediakan
  berkas sendiri) — jangan melemahkan CSP diam-diam.
- **Ukuran:** total folder ≈ 12,8 MB. Muat malas per berkas (harian per tahun,
  bukan semuanya sekaligus) dan hindari mengimpor JSON besar ke bundel.
- **Atribusi:** provenance sudah tercatat di halaman Atribusi kartu **06**
  (buku) dan **07** (teka-teki), beserta berkas lisensi di `public/licenses/`.
  Pertahankan saat fitur dibangun.
- **Penyegaran data harian:** snapshot ini berasal dari arsip publik
  `samuraitruong/chess.com-daily-puzzle`; belum ada skrip pengambil yang
  ter-commit di repo ini. Jika perlu menyegarkan, tambahkan skripnya lebih dulu
  agar perubahan data dapat diaudit.
