/**
 * Bangun tabel "langkah buku" untuk halaman Analisa — versi diperkaya.
 *
 * Halaman Analisa menandai langkah yang masih berada dalam teori pembukaan
 * dengan label "book" + nama pembukaannya. Data sumbernya adalah buku
 * pembukaan milik ChessClub (public/data/buku-pembukaan.json, hasil olahan
 * lichess-org/chess-openings, CC0): 18.713 garis UCI beserta statistik partai.
 *
 * Skrip asli ChessClub hanya mencatat posisi AKHIR tiap garis (11.957 posisi).
 * Versi ini memperkaya tabel dengan mencatat JUGA posisi sepanjang garis
 * (posisi antara), sehingga posisi teori yang belum punya nama garis sendiri
 * tetap dikenali sebagai langkah buku. Aturan nama tetap sama: varian yang
 * paling sering dimainkan (games terbesar) yang melalui posisi itu.
 *
 * Label yang sudah ada di buku lama dipertahankan apa adanya — pengayaan ini
 * murni MENAMBAH posisi baru, tidak menulis ulang label lama. Menjalankan
 * ulang skrip ini idempoten: buku lama dibaca sebagai baseline, lalu posisi
 * baru dihitung ulang secara deterministik dari sumber yang sama.
 *
 * Hasil: public/data/buku-analisa.json — peta "4 bidang pertama FEN" → nama,
 * mis. "rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq" →
 * "Italian Game (C50)". Penghitung setengah-langkah/penuh sengaja dibuang
 * supaya posisi yang sama dari partai mana pun tetap dikenali.
 *
 * Jalankan: node scripts/generasi-buku-analisa.mjs
 * (naikkan VERSI_BUKU di src/modul/analisis/bukuPembukaan.js setiap kali
 * berkas hasilnya berubah agar cache peramban tidak menahan buku lama).
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Chess } from "chess.js";

import { kunciFen } from "../src/halaman/Analisa/mesin/kunciFen.js";

/**
 * Fungsi murni pengayaan buku: replay setiap garis UCI dari posisi awal,
 * catat setiap posisi yang dilalui, pilih nama varian paling sering dimainkan
 * per posisi, lalu gabungkan dengan baseline (label lama menang).
 *
 * @param {Array<{moves?: string, opening?: string, eco?: string, games?: number}>} daftar
 * @param {Record<string, string>} baseline peta FEN→nama yang sudah ada
 * @returns {{peta: Record<string, string>, statistik: object}}
 */
export function bangunBuku(daftar, baseline = {}) {
  const permainan = new Chess();
  const terbaik = new Map();
  let gagal = 0;
  let posisiDilalui = 0;

  for (const entri of daftar) {
    const langkah = String(entri.moves ?? "").trim().split(/\s+/).filter(Boolean);
    if (!langkah.length) continue;

    permainan.reset();
    const kunciGaris = [];
    let rusak = false;
    for (const uci of langkah) {
      try {
        permainan.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined });
      } catch {
        rusak = true;
        break;
      }
      posisiDilalui++;
      kunciGaris.push(kunciFen(permainan.fen()));
    }
    // Garis korup dilewati utuh (sama seperti skrip asli ChessClub): jangan
    // menyumbang label dari awalan yang belum tentu dimaksudkan sumbernya.
    if (rusak) {
      gagal++;
      continue;
    }

    const jumlah = Number(entri.games ?? 0);
    for (const kunci of kunciGaris) {
      const lama = terbaik.get(kunci);
      // Satu posisi bisa muncul dari beberapa varian; pakai nama varian yang
      // paling sering dimainkan supaya labelnya paling mudah dikenali pembaca.
      if (!lama || jumlah > lama.games) {
        terbaik.set(kunci, { nama: entri.opening, eco: entri.eco, games: jumlah });
      }
    }
  }

  const peta = { ...baseline };
  let baru = 0;
  for (const [kunci, nilai] of terbaik) {
    if (Object.hasOwn(peta, kunci)) continue;
    peta[kunci] = nilai.eco ? `${nilai.nama} (${nilai.eco})` : nilai.nama;
    baru++;
  }

  const urut = Object.fromEntries(Object.entries(peta).sort((a, b) => a[0].localeCompare(b[0])));
  return {
    peta: urut,
    statistik: {
      garis: daftar.length,
      gagal,
      posisiDilalui,
      posisiUnik: terbaik.size,
      baru,
      total: Object.keys(urut).length,
    },
  };
}

const AKAR = path.resolve(import.meta.dirname, "..");
const SUMBER = path.join(AKAR, "public/data/buku-pembukaan.json");
const TUJUAN = path.join(AKAR, "public/data/buku-analisa.json");

async function utama() {
  const daftar = JSON.parse(await readFile(SUMBER, "utf8"));
  let baseline = {};
  try {
    baseline = JSON.parse(await readFile(TUJUAN, "utf8"));
  } catch {
    // Buku lama belum ada (mis. checkout bersih tanpa data) — mulai dari kosong.
  }
  const { peta, statistik } = bangunBuku(daftar, baseline);
  const json = JSON.stringify(peta);
  await writeFile(TUJUAN, json, "utf8");
  console.log(
    `Tabel buku analisis: ${statistik.total} posisi (${statistik.baru} baru) dari ${statistik.garis} entri ` +
      `(${(json.length / 1024 / 1024).toFixed(2)} MB) → ${path.relative(AKAR, TUJUAN)}` +
      (statistik.gagal ? ` — ${statistik.gagal} entri dilewati (langkah tidak legal)` : ""),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  utama();
}
