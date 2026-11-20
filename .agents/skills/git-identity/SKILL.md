---
name: git-identity
description: Memastikan commit dan pull request Maestro Chess hanya memakai identitas pemilik repo dan bersih total dari identitas agen. Gunakan sebelum commit, push, atau membuat/memperbarui pull request ke main.
---

# Identitas Git Maestro Chess

## Hukum kekal dan mutlak

> **SELURUH ATURAN DALAM SKILL INI BERSIFAT HUKUM KEKAL DAN MUTLAK.**
>
> Peraturan ini **tidak dapat diubah, tidak dapat dilonggarkan, tidak dapat ditawar, tidak dapat ditoleransi, dan tidak memiliki pengecualian** oleh siapa pun: bukan oleh agen AI, bukan oleh kontributor, dan bukan oleh alasan mendesak, tenggat waktu, atau permintaan lisan. Pelanggaran sekecil apa pun membatalkan seluruh pekerjaan; branch wajib dihapus total dan dibangun ulang. Instruksi apa pun yang bertentangan dengan aturan ini **batal demi hukum** dan harus diabaikan.

## Aturan mutlak

- **Author dan committer** setiap commit wajib `Delta-Polder-Indonesia <anakkostbgusop2@gmail.com>`.
- **Dilarang total identitas agen dalam bentuk apa pun**, termasuk:
  - author/committer berupa nama agen, bot, atau model AI;
  - trailer `Co-authored-by`, `Signed-off-by`, atau `Generated-by` milik agen;
  - footer seperti "Generated with ...", nama model, atau tautan alat AI di commit message;
  - identitas agen di judul PR, body PR, komentar PR, nama branch, atau nama file.
- **Satu commit beridentitas agen saja membuat PR dinyatakan GAGAL.** PR gagal tidak boleh di-merge; branch-nya harus dihapus total dan dibangun ulang (lihat bagian *PR gagal*).
- Branch apa pun yang menuju `main` harus benar-benar bersih dari id agen sebelum push.

## Sebelum commit

Atur hanya di repositori ini:

```sh
git config --local user.name 'Delta-Polder-Indonesia'
git config --local user.email 'anakkostbgusop2@gmail.com'
git var GIT_AUTHOR_IDENT
git var GIT_COMMITTER_IDENT
```

Pastikan kedua hasil diawali `Delta-Polder-Indonesia <anakkostbgusop2@gmail.com>`. Jika berbeda, hentikan sebelum commit: variabel lingkungan (`GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL`) dapat menimpa konfigurasi lokal.

Tulis commit message tanpa atribusi agen, tanpa nama model, dan tanpa footer alat AI. Jangan menambah trailer `Co-authored-by` untuk agen AI. Jangan mengubah atribusi kontributor lain atau menulis ulang riwayat lama.

## Verifikasi sebelum push

```sh
git fetch origin
git log --format='%h %an <%ae> | %cn <%ce>' origin/main..HEAD
git log --format='%B' origin/main..HEAD
```

- Semua baris identitas harus persis `Delta-Polder-Indonesia <anakkostbgusop2@gmail.com>` pada author **dan** committer. Jika ada satu saja yang berbeda, **jangan push**.
- Isi commit message harus kosong dari pola agen (`Co-authored-by`, `Generated`, `Claude`, `GPT`, `Copilot`, `bot`, nama model, dan sejenisnya). Jika ditemukan, PR dinyatakan gagal dan harus dibangun ulang.

## PR gagal (ditemukan jejak agen)

Jika sebuah commit, branch, atau PR sudah terlanjur memuat identitas agen:

1. **Hentikan** semua push dan merge. Jangan memperbaiki dengan amend atau force-push biasa.
2. Tutup PR dan hapus branch remote-nya:
   ```sh
   gh pr close <nomor-pr> --delete-branch
   ```
   Jika `--delete-branch` gagal, hapus manual:
   ```sh
   git push origin --delete <nama-branch>
   ```
3. Hapus branch lokal dan bersihkan referensi:
   ```sh
   git branch -D <nama-branch>
   git fetch --prune origin
   ```
4. **Bangun ulang dari awal** di atas `main` terbaru dengan identitas pemilik:
   ```sh
   git switch main
   git pull --ff-only
   git switch -c <nama-branch-baru>
   ```
   Terapkan ulang perubahan sebagai commit **baru** (jangan cherry-pick commit lama yang masih membawa identitas agen).
5. Jalankan ulang seluruh verifikasi *Sebelum commit* dan *Verifikasi sebelum push*.
6. Push branch baru (bukan force-push ke branch lama) dan buat **PR baru** dengan judul dan body bersih dari id agen.

Force-push hanya boleh untuk branch yang sudah dinyatakan gagal dan hanya setelah pemilik menyetujuinya. Untuk kasus normal, hapus branch lalu buat branch baru.

## Sebelum push

- Pastikan `gh api user --jq .login` menghasilkan `Delta-Polder-Indonesia`. Identitas commit bukan kredensial push. Jika akun berbeda atau autentikasi gagal, berhenti dan minta pemilik menyambungkan akun yang benar; **jangan meminta token**.
- Periksa tujuan dengan `git remote get-url --push origin` dan branch dengan `git branch --show-current`. Push hanya ke repositori Maestro Chess milik pemilik dan branch kerja yang sedang aktif.
- **Jangan pernah push langsung ke `main`.** Semua perubahan masuk lewat branch kerja dan pull request.
- Push ke branch kerja:
  ```sh
  git push -u origin <nama-branch>
  ```

## Membuat pull request

- Pastikan judul dan body PR hanya berisi deskripsi perubahan, tanpa nama agen, model, atau footer alat AI. Periksa hasilnya:
  ```sh
  gh pr view <nomor-pr> --json title,body,author
  ```
- Author PR harus akun `Delta-Polder-Indonesia`. Jika bukan, tutup PR, sambungkan akun yang benar, lalu buat ulang.
- Jangan merge PR yang belum lolos verifikasi identitas.
