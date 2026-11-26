---
name: struktur-fitur-modular
description: Gunakan skill ini saat menambah fitur baru (mis. Main Catur, Repertoar, Papan Analisis, atau layar lain) atau menata ulang berkas fitur, untuk memastikan setiap fitur tersusun modular dan berkelompok dalam foldernya sendiri — rapi seperti rak buku perpustakaan — bukan terpecah berserakan lintas direktori.
---

# Struktur Fitur Modular: Rak Buku Perpustakaan

Setiap fitur wajib hidup sebagai **satu kelompok folder yang modular dan rapi**, seperti rak buku di perpustakaan: tiap buku (fitur) punya rak dan labelnya sendiri, buku sejenis dikelompokkan berdekatan, dan tidak ada buku yang tercecer di lantai atau ditumpuk di rak lain. Tujuan skill ini: ketika ada fitur tambahan seperti **Main Catur** dan seterusnya, berkasnya **tersusun, berkelompok, dan mudah ditemukan** — bukan berserakan.

## Kapan Menggunakan Skill Ini

- Sebelum menambah fitur/layar baru (Main Catur, Repertoar Baru, Papan Analisis, Teka-Teki lanjutan, dll.).
- Sebelum memindahkan, menambah, atau memecah berkas milik suatu fitur.
- Saat meninjau PR yang menyentuh banyak folder: pastikan tidak ada berkas fitur yang "nyasar" ke direktori fitur lain atau ke root.

## Prinsip Rak Buku

1. **Satu fitur = satu rak bernama jelas.** Seluruh berkas sebuah fitur berada di bawah satu folder fitur, bukan tersebar di banyak tempat.
2. **Kelompokkan per jenis/peran di dalam rak.** UI, state/konteks, logika/mesin, dan data dipisah ke sub-folder concerns yang konsisten — seperti mengelompokkan buku per kategori di rak yang sama.
3. **Label yang jelas.** Nama folder/berkas menggambarkan isinya; setiap fitur punya `README.md` yang menjelaskan struktur dan perilakunya.
4. **Tidak ada buku tercecer.** Jangan menaruh berkas fitur di root `src/`, di folder fitur lain, atau membuat berkas lepas yang tidak jelas kepemilikannya.
5. **Pinjam, jangan duplikat.** Logika yang dipakai lintas fitur tinggal di modul bersama (`src/modul/`); fitur meminjam lewat fasad, bukan menyalin kode.

## Konvensi Folder Repo Ini (contoh nyata)

Halaman/fitur dikelompokkan di `src/halaman/<NamaFitur>/` dengan nama PascalCase, dan dipecah per peran. Contoh yang sudah ada: `src/halaman/Analisa/` dan `src/halaman/TekaTeki/`.

```
src/halaman/<NamaFitur>/
├── <NamaFitur>.jsx        # entry halaman
├── README.md              # peta struktur + perilaku penting fitur
├── komponen/              # komponen UI (boleh dipecah lagi per sub-fitur)
├── konteks/               # provider/state/ masa hidup (bila perlu)
├── mesin/ atau logika/    # parser, perhitungan, adaptor (logika murni)
├── <sub-fitur>/           # kelompok concerns lain, mis. akun/, database/
└── konstanta.js           # konstanta khusus fitur
```

Logika yang dipakai **lintas fitur** hidup di modul bersama, bukan di dalam fitur:

```
src/modul/<domain>/        # mis. analisis/, pekerjaan/, profil/, sesi/
├── index.js               # fasad/barrel publik (ekspor terkunci tes batas)
└── ...                    # implementasi modular
```

Pendukung lain tetap dikelompokkan pada tempatnya:
- Terjemahan per fitur: `src/lib/terjemahan/{id,en}/<fitur>.js`.
- Aset publik: `public/` per jenis (`public/engine/`, `public/data/`, `public/sounds/`, `public/images/`).
- Tes: `tests/` dengan nama yang menyebut fitur/modul terkait.

## Contoh: Menambah "Main Catur"

Saat fitur **Main Catur** dikerjakan, buat raknya sendiri, jangan mencampur ke Analisa:

```
src/halaman/MainCatur/
├── MainCatur.jsx
├── README.md
├── komponen/              # papan, kontrol, daftar langkah, dll.
├── konteks/               # state permainan bila perlu
└── logika/                # aturan langkah, jam, hasil
```

- Logika yang sudah ada dan dipakai bersama (mis. fondasi engine di `src/modul/analisis/`, preferensi di `src/modul/sesi/`) **dipinjam lewat fasad**, bukan disalin ke MainCatur.
- Terjemahan baru di `src/lib/terjemahan/{id,en}/mainCatur.js`, bukan menumpuk di berkas fitur lain.
- Bila MainCatur hanya memakai ulang komponen papan yang sudah modular, impor dari tempatnya; jangan menduplikasi komponen papan ke folder MainCatur.

## Wajib Dipatuhi

- **Jangan** menyebar berkas satu fitur ke banyak direktori yang tidak berhubungan, atau menaruhnya di root `src/`.
- **Jangan** mencampur berkas fitur baru ke folder fitur lain (mis. menaruh logika Main Catur di `src/halaman/Analisa/`).
- **Jangan** menduplikasi logika bersama; pakai modul `src/modul/` lewat fasadnya.
- **Jangan** menambah ekspor publik baru pada barrel `src/modul/<domain>/index.js` tanpa kebutuhan nyata — daftar ekspor dikunci oleh tes batas modul.
- Saat memindahkan kode lama, pertahankan **fasad/shim kompatibilitas** agar impor lama tidak putus, dan tulis tes karakterisasi sebelum migrasi (lihat roadmap).
- Hormati arah **Modular Monolith** (satu aplikasi, modul berbatas jelas) — bukan microservices dan bukan refactor besar tanpa persetujuan.

## Checklist Sebelum Menambah Fitur

- [ ] Folder fitur `src/halaman/<NamaFitur>/` dibuat dengan entry + `README.md`.
- [ ] Berkas dikelompokkan per peran (komponen/konteks/logika/data), bukan flat berserakan.
- [ ] Logika bersama diambil dari `src/modul/` lewat fasad, bukan disalin.
- [ ] Terjemahan, aset, dan tes ditempatkan pada kelompoknya masing-masing.
- [ ] Tidak ada berkas fitur yang nyasar ke root atau folder fitur lain.
- [ ] Tes batas modul tetap hijau; gerbang pemeriksaan dijalankan.

## Referensi

- [AGENTS.md](../../AGENTS.md) — aturan repo dan identitas Git.
- [Skill identitas Git](../git-identity/SKILL.md) — wajib sebelum commit/push/PR/merge.
- [ArsipTodo & roadmap modularisasi](../../ArsipTodo/README.md) — arah Modular Monolith dan batas tahap.
- Contoh struktur nyata: `src/halaman/Analisa/README.md`, `src/modul/analisis/`, `src/modul/sesi/`.
