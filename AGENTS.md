# Aturan identitas Git

Tujuan aturan ini adalah menjaga agar akun agen AI tidak tercatat sebagai kontributor atau pembuat PR di repositori ini. Ikuti [skill identitas Git](.agents/skills/git-identity/SKILL.md) untuk langkah pemeriksaan dan penanganannya.

## Wajib dibaca sebelum mengubah apa pun

Sebelum membaca, mengedit, menambah, atau menghapus file apa pun di repositori ini, baca dan patuhi [skill identitas Git](.agents/skills/git-identity/SKILL.md).

- **Commit perubahan pada branch kerja:** author dan committer wajib `Delta-Polder-Indonesia <anakkostbgusop2@gmail.com>`.
- **Commit merge otomatis GitHub:** nama atau email author boleh berbeda jika terhubung ke akun pemilik `Delta-Polder-Indonesia`, dan committer boleh `GitHub <noreply@github.com>`. Ini bukan atribusi agen AI. Pastikan PR dan tindakan merge dilakukan melalui akun pemilik; periksa detailnya sesuai skill.
- Jangan menambahkan identitas atau atribusi agen AI ke commit, trailer, nama branch atau file, judul, isi, atau komentar PR. Ikuti nama branch yang ditetapkan lingkungan. Jangan mengubah atribusi kontributor manusia lain atau menulis ulang riwayat lama untuk menyamarkan kepemilikan.
- Jangan push langsung ke `main`; gunakan branch kerja dan pull request. Ikuti pembatasan branch dari lingkungan kerja.
- PR yang memuat atribusi agen dinyatakan gagal dan tidak boleh di-merge. Hentikan proses, beri tahu pemilik, dan tentukan pembangunan ulang atau penanganan hingga bersih sesuai batasan lingkungan; jangan otomatis menghapus branch atau menulis ulang riwayat.

Aturan ini berlaku untuk seluruh repositori dan dapat diperbarui atas permintaan eksplisit pemilik. Sebelum commit, push, membuat PR, atau merge, ikuti pemeriksaan dalam skill tersebut.
