---
name: git-identity
description: Menjaga commit kerja dan pull request Maestro Chess memakai identitas pemilik tanpa atribusi agen, serta membedakan commit merge otomatis GitHub. Gunakan sebelum commit, push, membuat PR, atau merge.
---

# Identitas Git dan kontribusi Maestro Chess

## Tujuan dan cara GitHub menghitung kontribusi

Jangan mencatat akun agen AI sebagai author, committer, co-author, atau pembuat PR. Commit perubahan yang dibuat pada branch kerja harus memakai identitas pemilik:

```text
Delta-Polder-Indonesia <anakkostbgusop2@gmail.com>
```

GitHub mengaitkan kontribusi commit dengan author dan email yang terhubung ke akun; trailer `Co-authored-by` juga dapat memberi kredit kepada akun lain. Pada grafik Contributors repositori, commit merge dan commit kosong tidak dihitung [1](https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/viewing-a-projects-contributors). Informasi co-author dijelaskan oleh GitHub [3](https://docs.github.com/en/pull-requests/how-tos/commit-changes/creating-a-commit-with-multiple-authors).

Daftar kontributor berbeda dari riwayat PR, nama branch, komentar, pemeriksaan otomatis, dan file repositori yang dapat dilihat publik. Menghindari atribusi agen tidak menjamin orang lain tidak dapat menyimpulkan penggunaan alat dari sumber lain. Jangan mengubah atribusi kontributor manusia lain atau menulis ulang riwayat lama untuk menyamarkan kepemilikan.

## Bedakan commit kerja dan commit merge GitHub

- **Commit perubahan pada branch kerja:** author **dan** committer harus tepat `Delta-Polder-Indonesia <anakkostbgusop2@gmail.com>`. Pesan commit tidak boleh memuat trailer atau footer yang mengatribusi agen, nama model, atau identitas agen. Contohnya, jangan menambahkan `Co-authored-by` untuk agen.
- **Commit merge otomatis yang dibuat GitHub:** author dapat menggunakan nama tampilan atau email `noreply` yang terhubung ke akun `Delta-Polder-Indonesia`; committer dapat berupa `GitHub <noreply@github.com>` (akun platform `web-flow`). Keduanya tidak otomatis menunjukkan kontribusi agen AI. Pastikan author terhubung ke akun pemilik dan `mergedBy` adalah akun pemilik.
- Pengecualian commit merge otomatis **tidak berlaku** untuk commit perubahan di branch kerja atau commit yang mencantumkan agen sebagai author/co-author. Jika identitas author merge tidak terhubung ke akun pemilik, periksa dan laporkan; jangan menebak.
- Jika menggunakan squash atau rebase atas permintaan pemilik, periksa identitas dan pesan commit hasilnya juga. Rebase GitHub dapat mengubah committer dan SHA; jangan menganggap hasilnya sama dengan commit branch.

## Sebelum membuat commit

Hanya buat commit jika diminta. Atur identitas hanya di repositori ini, lalu periksa identitas yang benar-benar digunakan Git:

```sh
git config --local user.name 'Delta-Polder-Indonesia'
git config --local user.email 'anakkostbgusop2@gmail.com'
git var GIT_AUTHOR_IDENT
git var GIT_COMMITTER_IDENT
```

Kedua hasil harus diawali identitas pemilik di atas. Variabel lingkungan seperti `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, dan `GIT_COMMITTER_EMAIL` dapat menimpa konfigurasi lokal; berhenti jika hasil berbeda.

Periksa hook yang berlaku, terutama `prepare-commit-msg` dan `commit-msg`, karena lingkungan dapat menambahkan trailer co-author secara otomatis:

```sh
git config --show-origin --get core.hooksPath || true
git rev-parse --git-path hooks
```

Jika `core.hooksPath` disetel, periksa hook pada lokasi tersebut; jika tidak, periksa direktori hooks yang ditunjukkan Git. Jangan mengubah atau menghapus hook secara permanen. Jika hook otomatis menambahkan atribusi agen, jalankan dahulu pemeriksaan yang relevan secara manual dan, pada lingkungan Unix, nonaktifkan hook **hanya untuk satu perintah commit**:

```sh
git -c core.hooksPath=/dev/null commit -m 'Jelaskan perubahan'
```

Ini menonaktifkan semua hook pada perintah tersebut, termasuk validasi; jangan melewati validasi tanpa menjalankannya secara terpisah. Setelah commit, periksa identitas dan pesan aktual sebelum push:

```sh
git show -s --format='%h %an <%ae> | %cn <%ce>%n%B' HEAD
```

Jika ada identitas atau atribusi agen, hentikan proses. Jangan menganggap pesan yang diketik sebelum commit sama dengan pesan akhir yang mungkin diubah hook.

## Verifikasi sebelum push atau membuat PR

Hanya push atau buat PR jika diminta. Perbarui referensi, lalu periksa **semua commit branch yang belum ada di main**:

```sh
git fetch origin
git log --format='%h %an <%ae> | %cn <%ce>' origin/main..HEAD
git log --format='%B' origin/main..HEAD
```

- Setiap commit dalam rentang tersebut harus memiliki author dan committer identitas pemilik yang tepat, serta pesan tanpa atribusi agen. Jika rentang memuat commit manusia lain, jangan menghapus atau mengganti atribusinya; hentikan dan minta arahan pemilik.
- Jika riwayat clone terlalu dangkal untuk memeriksa rentang, ambil riwayat yang diperlukan sebelum menyimpulkan hasil.
- Pastikan `gh api user --jq .login` menghasilkan `Delta-Polder-Indonesia`. Jika akun berbeda atau autentikasi gagal, berhenti dan minta pemilik menyambungkan akun yang benar; jangan meminta token atau kredensial.
- Periksa `git remote get-url --push origin` dan `git branch --show-current`. Push hanya ke repositori milik pemilik dan branch kerja yang sedang aktif, tidak pernah langsung ke `main`. Jangan mengganti nama, membuat, atau berpindah branch jika lingkungan melarangnya.

Setelah PR dibuat, periksa author, isi PR, dan commit yang benar-benar ada di GitHub:

```sh
PR=$(gh pr view --json number --jq .number)
HEAD_SHA=$(gh pr view "$PR" --json headRefOid --jq .headRefOid)
gh pr view "$PR" --json title,body,author,comments,reviews,headRefName,headRefOid,baseRefName,state,isDraft,mergeable,mergeStateStatus
gh api --paginate "repos/Delta-Polder-Indonesia/Maestro-Chess/pulls/$PR/commits" --jq '.[] | {sha, githubAuthor: (.author.login // null), githubCommitter: (.committer.login // null), gitAuthor: .commit.author, gitCommitter: .commit.committer, message: .commit.message}'
```

Author PR dan akun GitHub yang terkait dengan author/committer commit kerja harus `Delta-Polder-Indonesia`; identitas Git mentahnya harus sesuai aturan commit kerja. Periksa pesan commit, judul, isi, dan komentar publik yang dibuat agar tidak ada atribusi agen. Jika email commit belum terhubung ke akun pemilik, laporkan agar pemilik memeriksanya di pengaturan email GitHub.

## Merge dan pemeriksaan sesudahnya

Hanya merge jika diminta pemilik, identitas PR/commit telah diverifikasi, dan pemeriksaan yang diwajibkan sudah lulus. Pastikan akun yang sedang dipakai adalah akun pemilik. Periksa status terlebih dahulu:

```sh
gh pr checks "$PR"
```

Jika pemeriksaan lulus, merge commit biasa mempertahankan commit branch beserta SHA dan identitasnya. Pastikan `HEAD_SHA` adalah head yang sudah diverifikasi; jika berubah, ulangi pemeriksaan. Jalankan perintah merge secara terpisah dengan nomor PR secara eksplisit:

```sh
gh pr merge "$PR" --merge --match-head-commit "$HEAD_SHA"
```

Jangan mengaktifkan auto-merge, memindahkan branch, atau menghapus branch tanpa instruksi dan izin lingkungan. Bila metode merge lain diminta, periksa kembali commit hasil metode tersebut.

Sesudah merge commit biasa, verifikasi pelaku merge dan commit otomatis GitHub secara terpisah:

```sh
gh pr view "$PR" --json state,mergedBy,mergeCommit
MERGE_SHA=$(gh pr view "$PR" --json mergeCommit --jq '.mergeCommit.oid')
gh api "repos/Delta-Polder-Indonesia/Maestro-Chess/commits/$MERGE_SHA" --jq '{githubAuthor: (.author.login // null), githubCommitter: (.committer.login // null), gitAuthor: .commit.author, gitCommitter: .commit.committer}'
```

`mergedBy` dan `githubAuthor` harus menunjukkan akun pemilik. Committer `GitHub <noreply@github.com>`/`web-flow` pada **commit merge otomatis** boleh; jangan menyatakannya sebagai agen atau kegagalan identitas hanya karena berbeda dari committer commit kerja.

Sebagai pemeriksaan tambahan, daftar kontributor dapat dilihat melalui API:

```sh
gh api --paginate 'repos/Delta-Polder-Indonesia/Maestro-Chess/contributors?anon=1&per_page=100' --jq '.[] | {login: (.login // "anonymous"), contributions}'
```

Daftar dan statistik GitHub dapat terlambat diperbarui. Pemeriksaan ini tidak menggantikan pemeriksaan author dan trailer pada setiap commit PR.

## Jika ditemukan atribusi agen

PR dinyatakan gagal dan tidak boleh di-merge. Hentikan push dan merge serta beri tahu pemilik. Jangan otomatis menghapus atau mengganti branch, melakukan amend/force-push, menulis ulang `main`, atau mengubah atribusi manusia. Tentukan pembangunan ulang atau penanganan hingga bersih bersama pemilik sesuai batasan branch dan izin lingkungan. Jika atribusi sudah terlanjur dipublikasikan, jelaskan statusnya dan jangan mengklaim data publik langsung hilang.
