# Kredit & lisensi set bidak (`public/bidak/`)

Aset bidak di folder ini disalin dari repositori **ChessClub** milik pemilik
(`Delta-Polder-Indonesia/ChessClub`, `src/asets/`), yang pada gilirannya
bersumber dari koleksi aset statis **lichess-org/lila**
(`public/piece/`, https://github.com/lichess-org/lila). Maestro Chess memakai
Next.js, sehingga aset disajikan statis dari `public/bidak/<set>/` (bukan
`import.meta.glob` ala Vite seperti di ChessClub).

Setiap set berisi 12 bidak (putih/hitam × raja, menteri, benteng, gajah, kuda,
pion). Set berbasis SVG memakai kode `wK/bK/...`; set PNG memakai huruf kecil
`wk/bk/...`; set Chessnut (`bidak/`) memakai nama Indonesia; set Chess.com
(`ChessCom/`) memakai PNG.

## Lisensi per set (ringkasan)

Lisensi **berbeda-beda** per set. Notices yang ikut dikirim bersama aset
dipertahankan apa adanya (mis. `cburnett/license.txt`, `bidak/README.md`).

| Set | Penulis | Lisensi |
| --- | --- | --- |
| cburnett | Colin M.L. Burnett | CC BY-SA 3.0 (juga BSD/GFDL/GPL) |
| bidak (Chessnut) | Alexis Luengas | Apache 2.0 |
| merida | Armando Hernández Marroquin | GPLv2+ |
| alpha | Eric Bentzen | lihat sumber lichess |
| california | Jerry S. | **CC BY-NC-SA 4.0** (non-komersial) |
| cardinal | sadsnake1 | **CC BY-NC-SA 4.0** (non-komersial) |
| icpieces | sadsnake1 | **CC BY-NC-SA 4.0** (non-komersial) |
| dubrovny, gioco, governor, maestro, staunty, tatiana, chess7, dll. | kontributor lichess | CC BY-SA 3.0/4.0 atau kompatibel |
| Chess.com, 3D_*, dan set PNG lain | berbagai | lihat sumber; sebagian hak milik |

> **Catatan penting:** beberapa set (California, Cardinal, ICPieces) berlisensi
> **CC BY-NC-SA** yang membatasi pemakaian komersial, dan set bermerek
> (Chess.com) dapat bersifat hak milik. Aset dipakai apa adanya dari repo
> pemilik untuk keperluan pribadi/turnamen. Tinjau lisensi tiap set sebelum
> pemakaian komersial; ganti atau hapus set yang tidak sesuai kebutuhan lisensi
> aplikasi Anda.

## Sumber

- ChessClub: https://github.com/Delta-Polder-Indonesia/ChessClub
- lichess-org/lila (koleksi bidak): https://github.com/lichess-org/lila/tree/master/public/piece
- Chessnut: https://github.com/LexLuengas/chessnut-pieces
- Cburnett: https://commons.wikimedia.org/wiki/Template:SVG_chess_pieces

Lihat juga berkas `ATTRIBUTIONS` di root repositori dan halaman `/attributions`.
